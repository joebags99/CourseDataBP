import { useState, useMemo, useEffect } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { format, startOfMonth, getYear, getQuarter } from 'date-fns';
import {
  calculateMonthlyTrends,
  identifyLowCompletionCourses,
  calculateCompletionRateTrends,
  calculateCumulativeCoverage,
  calculatePeriodStats
} from '../utils/analytics';
import '../styles/CompletionTrends.css';

const CHART_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#FF6B9D', '#82CA9D'];

// ─── Preset period helpers ────────────────────────────────────────────────────
function getPresetPeriods(preset) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  switch (preset) {
    case 'ytd':
      return {
        labelA: `YTD ${y}`,
        labelB: `YTD ${y - 1}`,
        a: { start: new Date(y, 0, 1), end: now },
        b: { start: new Date(y - 1, 0, 1), end: new Date(y - 1, m, d) }
      };
    case 'thisYear':
      return {
        labelA: String(y),
        labelB: String(y - 1),
        a: { start: new Date(y, 0, 1), end: new Date(y, 11, 31) },
        b: { start: new Date(y - 1, 0, 1), end: new Date(y - 1, 11, 31) }
      };
    case 'thisMonth': {
      const thisStart = startOfMonth(now);
      const lastStart = new Date(y, m - 1, 1);
      const lastEnd = new Date(y, m, 0); // last day of prev month
      return {
        labelA: format(thisStart, 'MMM yyyy'),
        labelB: format(lastStart, 'MMM yyyy'),
        a: { start: thisStart, end: now },
        b: { start: lastStart, end: lastEnd }
      };
    }
    case 'thisQuarter': {
      const q = Math.floor(m / 3);
      const qStart = new Date(y, q * 3, 1);
      const prevQStart = new Date(y, (q - 1) * 3, 1);
      const prevQEnd = new Date(y, q * 3, 0);
      return {
        labelA: `Q${q + 1} ${y}`,
        labelB: `Q${q === 0 ? 4 : q} ${q === 0 ? y - 1 : y}`,
        a: { start: qStart, end: now },
        b: { start: prevQStart, end: prevQEnd }
      };
    }
    default:
      return null;
  }
}

// ─── Granularity aggregation ──────────────────────────────────────────────────
function aggregateByGranularity(rateTrends, granularity) {
  if (granularity === 'monthly') return rateTrends;

  const buckets = {};

  rateTrends.forEach(month => {
    let key, label, sortDate;

    if (granularity === 'quarterly') {
      const q = getQuarter(month.date);
      const y = getYear(month.date);
      key = `${y}-Q${q}`;
      label = `Q${q} ${y}`;
      sortDate = new Date(y, (q - 1) * 3, 1);
    } else {
      const y = getYear(month.date);
      key = String(y);
      label = String(y);
      sortDate = new Date(y, 0, 1);
    }

    if (!buckets[key]) {
      buckets[key] = { label, date: sortDate, totalEnrollments: 0, totalCompletions: 0, courses: {} };
    }

    buckets[key].totalEnrollments += month.totalEnrollments;
    buckets[key].totalCompletions += month.totalCompletions;

    Object.entries(month.courses).forEach(([course, stats]) => {
      if (!buckets[key].courses[course]) {
        buckets[key].courses[course] = { enrollments: 0, completions: 0 };
      }
      buckets[key].courses[course].enrollments += stats.enrollments;
      buckets[key].courses[course].completions += stats.completions;
    });
  });

  return Object.values(buckets)
    .map(b => {
      b.completionRate = b.totalEnrollments > 0
        ? Math.round((b.totalCompletions / b.totalEnrollments) * 100) : 0;
      Object.values(b.courses).forEach(c => {
        c.completionRate = c.enrollments > 0
          ? Math.round((c.completions / c.enrollments) * 100) : 0;
      });
      return b;
    })
    .sort((a, b) => a.date - b.date);
}

// ─── Rate delta helper ────────────────────────────────────────────────────────
function DeltaBadge({ delta }) {
  if (delta === null || delta === undefined) return <span className="delta-neutral">—</span>;
  if (delta > 0) return <span className="delta-up">+{delta}%</span>;
  if (delta < 0) return <span className="delta-down">{delta}%</span>;
  return <span className="delta-neutral">0%</span>;
}

// ─── Rate color helper ────────────────────────────────────────────────────────
function getRateColor(rate) {
  if (rate >= 80) return '#00C49F';
  if (rate >= 60) return '#FFBB28';
  if (rate >= 40) return '#FF8042';
  return '#FF4444';
}

function getStatusClass(rate) {
  if (rate >= 60) return 'warning';
  if (rate >= 40) return 'attention';
  return 'critical';
}

function getStatusText(rate) {
  if (rate >= 60) return 'Needs Improvement';
  if (rate >= 40) return 'Needs Attention';
  return 'Critical';
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CompletionTrends({ data, courseGroups, groupVersions, showRawNumbers }) {
  const [activeView, setActiveView] = useState('overview');

  // ── Overview state ──
  const [overviewMode, setOverviewMode] = useState('overall');
  const [overviewCourse, setOverviewCourse] = useState('');

  // ── By Course state ──
  const [selectedCourses, setSelectedCourses] = useState(new Set());
  const [granularity, setGranularity] = useState('monthly');
  const [showOverallLine, setShowOverallLine] = useState(true);
  // 'coverage' = cumulative workforce %, 'count' = raw monthly count, 'rate' = enrollment-based %
  const [metricType, setMetricType] = useState('coverage');

  // ── Period Comparison state ──
  const [preset, setPreset] = useState('ytd');
  const [customA, setCustomA] = useState({ start: '', end: '' });
  const [customB, setCustomB] = useState({ start: '', end: '' });

  // ── Core data ──
  const monthlyTrends = useMemo(
    () => calculateMonthlyTrends(data, courseGroups, groupVersions),
    [data, courseGroups, groupVersions]
  );

  const rateTrends = useMemo(
    () => calculateCompletionRateTrends(data, courseGroups, groupVersions),
    [data, courseGroups, groupVersions]
  );

  const coverageData = useMemo(
    () => calculateCumulativeCoverage(data, courseGroups, groupVersions),
    [data, courseGroups, groupVersions]
  );

  const lowCompletionCourses = useMemo(
    () => identifyLowCompletionCourses(data, courseGroups, 70, groupVersions),
    [data, courseGroups, groupVersions]
  );

  const allCourses = useMemo(() => {
    const set = new Set();
    rateTrends.forEach(m => Object.keys(m.courses).forEach(c => set.add(c)));
    return Array.from(set).sort();
  }, [rateTrends]);

  // Auto-select top 3 courses when switching to By Course view
  useEffect(() => {
    if (activeView === 'byCourse' && selectedCourses.size === 0 && allCourses.length > 0) {
      setSelectedCourses(new Set(allCourses.slice(0, 3)));
    }
  }, [activeView, allCourses]);

  // ── Overview chart data ──
  const overviewCourses = useMemo(() => {
    if (monthlyTrends.length === 0) return [];
    const set = new Set();
    monthlyTrends.forEach(m => Object.keys(m.courses).forEach(c => set.add(c)));
    return Array.from(set).sort();
  }, [monthlyTrends]);

  const overviewChartData = useMemo(() => {
    if (overviewMode === 'overall') {
      return monthlyTrends.map(m => ({
        month: format(m.date, 'MMM yyyy'),
        completions: m.totalCompletions
      }));
    }
    if (overviewCourse) {
      return monthlyTrends.map(m => ({
        month: format(m.date, 'MMM yyyy'),
        completions: m.courses[overviewCourse] || 0
      }));
    }
    return [];
  }, [monthlyTrends, overviewMode, overviewCourse]);

  // Time-to-completion distribution
  const timeToCompletionData = useMemo(() => {
    const filtered = data.filter(r => r.daysToComplete !== null);
    const buckets = {
      '0-7 days': 0, '8-14 days': 0, '15-30 days': 0,
      '31-60 days': 0, '61-90 days': 0, '90+ days': 0
    };
    filtered.forEach(r => {
      const d = r.daysToComplete;
      if (d <= 7) buckets['0-7 days']++;
      else if (d <= 14) buckets['8-14 days']++;
      else if (d <= 30) buckets['15-30 days']++;
      else if (d <= 60) buckets['31-60 days']++;
      else if (d <= 90) buckets['61-90 days']++;
      else buckets['90+ days']++;
    });
    return Object.entries(buckets).map(([range, count]) => ({
      range, count,
      percentage: filtered.length > 0 ? Math.round((count / filtered.length) * 100) : 0
    }));
  }, [data]);

  // ── By Course chart data ──
  const aggregated = useMemo(
    () => aggregateByGranularity(rateTrends, granularity),
    [rateTrends, granularity]
  );

  // Coverage series bucketed by granularity — for cumulative data we take the
  // last month of each period so the value reflects end-of-period coverage.
  const coverageAggregated = useMemo(() => {
    const series = coverageData.seriesByMonth;
    if (granularity === 'monthly') return series;

    const buckets = {};
    series.forEach(item => {
      const key = granularity === 'quarterly'
        ? `${getYear(item.date)}-Q${getQuarter(item.date)}`
        : String(getYear(item.date));
      // Overwrite — last month of each period wins (largest cumulative value)
      buckets[key] = item;
    });

    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => ({
        ...item,
        label: granularity === 'quarterly'
          ? `Q${getQuarter(item.date)} ${getYear(item.date)}`
          : String(getYear(item.date))
      }));
  }, [coverageData, granularity]);

  const byCourseChartData = useMemo(() => {
    if (metricType === 'coverage') {
      return coverageAggregated.map(item => {
        const point = { label: item.label };
        selectedCourses.forEach(course => {
          point[course] = item.courses[course]?.coverageRate ?? null;
        });
        return point;
      });
    }

    if (metricType === 'count') {
      return aggregated.map(item => {
        const point = { label: item.label || format(item.date, 'MMM yyyy') };
        selectedCourses.forEach(course => {
          point[course] = item.courses[course]?.completions ?? null;
        });
        return point;
      });
    }

    // metricType === 'rate' (enrollment-based)
    return aggregated.map(item => {
      const point = {
        label: item.label || format(item.date, 'MMM yyyy'),
        ...(showOverallLine ? { Overall: item.completionRate } : {})
      };
      selectedCourses.forEach(course => {
        point[course] = item.courses[course]?.completionRate ?? null;
      });
      return point;
    });
  }, [aggregated, coverageAggregated, selectedCourses, metricType, showOverallLine, granularity]);

  const toggleCourse = (course) => {
    const next = new Set(selectedCourses);
    if (next.has(course)) next.delete(course);
    else next.add(course);
    setSelectedCourses(next);
  };

  // ── Period Comparison ──
  const periods = useMemo(() => {
    if (preset !== 'custom') return getPresetPeriods(preset);
    const parseMonth = (str, end) => {
      if (!str) return null;
      const [y, m] = str.split('-').map(Number);
      return end ? new Date(y, m, 0) : new Date(y, m - 1, 1);
    };
    return {
      labelA: customA.start && customA.end
        ? `${customA.start} – ${customA.end}` : 'Period A',
      labelB: customB.start && customB.end
        ? `${customB.start} – ${customB.end}` : 'Period B',
      a: { start: parseMonth(customA.start, false), end: parseMonth(customA.end, true) },
      b: { start: parseMonth(customB.start, false), end: parseMonth(customB.end, true) }
    };
  }, [preset, customA, customB]);

  const statsA = useMemo(
    () => periods ? calculatePeriodStats(data, courseGroups, periods.a.start, periods.a.end, groupVersions) : null,
    [data, courseGroups, periods, groupVersions]
  );

  const statsB = useMemo(
    () => periods ? calculatePeriodStats(data, courseGroups, periods.b.start, periods.b.end, groupVersions) : null,
    [data, courseGroups, periods, groupVersions]
  );

  const comparisonRows = useMemo(() => {
    if (!statsA || !statsB) return [];
    const allCourseNames = new Set([
      ...Object.keys(statsA.courses),
      ...Object.keys(statsB.courses)
    ]);
    return Array.from(allCourseNames)
      .map(course => {
        const a = statsA.courses[course];
        const b = statsB.courses[course];
        const rateA = a?.completionRate ?? null;
        const rateB = b?.completionRate ?? null;
        const delta = rateA !== null && rateB !== null ? rateA - rateB : null;
        return { course, a, b, rateA, rateB, delta };
      })
      .sort((x, y) => {
        if (x.delta === null && y.delta === null) return x.course.localeCompare(y.course);
        if (x.delta === null) return 1;
        if (y.delta === null) return -1;
        return y.delta - x.delta;
      });
  }, [statsA, statsB]);

  const comparisonBarData = useMemo(() => {
    if (!statsA || !statsB) return [];
    return comparisonRows.slice(0, 12).map(r => ({
      course: r.course.length > 20 ? r.course.slice(0, 18) + '…' : r.course,
      [periods?.labelA || 'Period A']: r.rateA,
      [periods?.labelB || 'Period B']: r.rateB
    }));
  }, [comparisonRows, statsA, statsB, periods]);

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="completion-trends">
      <div className="insights-header">
        <h2>Completion Insights</h2>
        <div className="view-tabs">
          <button
            className={`view-tab ${activeView === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveView('overview')}
          >
            Monthly Overview
          </button>
          <button
            className={`view-tab ${activeView === 'byCourse' ? 'active' : ''}`}
            onClick={() => setActiveView('byCourse')}
          >
            By Course
          </button>
          <button
            className={`view-tab ${activeView === 'comparison' ? 'active' : ''}`}
            onClick={() => setActiveView('comparison')}
          >
            Period Comparison
          </button>
        </div>
      </div>

      {/* ── MONTHLY OVERVIEW ── */}
      {activeView === 'overview' && (
        <div className="trends-grid">
          <div className="trend-card">
            <div className="card-header">
              <h3>Monthly Completions</h3>
              <div className="view-controls">
                <select
                  value={overviewMode}
                  onChange={(e) => {
                    setOverviewMode(e.target.value);
                    if (e.target.value === 'byCourse' && overviewCourses.length > 0) {
                      setOverviewCourse(overviewCourses[0]);
                    }
                  }}
                >
                  <option value="overall">Overall</option>
                  <option value="byCourse">By Course</option>
                </select>
                {overviewMode === 'byCourse' && (
                  <select value={overviewCourse} onChange={(e) => setOverviewCourse(e.target.value)}>
                    {overviewCourses.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={overviewChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="completions" stroke="#00C49F" fill="#00C49F" fillOpacity={0.6} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="trend-card">
            <h3>Time to Completion Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={timeToCompletionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="count" stroke="#0088FE" fill="#0088FE" fillOpacity={0.6} />
              </AreaChart>
            </ResponsiveContainer>
            <div className="distribution-details">
              {timeToCompletionData.map(bucket => (
                <div key={bucket.range} className="distribution-row">
                  <span className="range-label">{bucket.range}</span>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${bucket.percentage}%` }} />
                  </div>
                  <span className="percentage">{bucket.percentage}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="trend-card full-width">
            <h3>Courses Needing Attention (Below 70% Completion)</h3>
            {lowCompletionCourses.length === 0 ? (
              <div className="empty-state"><p>All courses have healthy completion rates!</p></div>
            ) : (
              <div className="table-wrapper">
                <table className="low-completion-table">
                  <thead>
                    <tr>
                      <th>Course</th>
                      <th>Enrollments</th>
                      <th>Completions</th>
                      <th>Completion Rate</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowCompletionCourses.map(course => (
                      <tr key={course.course}>
                        <td className="course-name">{course.course}</td>
                        <td>{course.enrollments}</td>
                        <td>{course.completions}</td>
                        <td>
                          <div className="rate-with-bar">
                            <div className="completion-bar">
                              <div
                                className="completion-fill"
                                style={{
                                  width: `${course.completionRate}%`,
                                  backgroundColor: getRateColor(course.completionRate)
                                }}
                              />
                            </div>
                            <span className="rate-text">
                              {showRawNumbers
                                ? `${course.completions}/${course.enrollments}`
                                : `${course.completionRate}%`}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className={`status-badge ${getStatusClass(course.completionRate)}`}>
                            {getStatusText(course.completionRate)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── BY COURSE ── */}
      {activeView === 'byCourse' && (
        <div className="by-course-view">
          <div className="by-course-controls">
            <div className="control-group">
              <label>Metric</label>
              <div className="button-group">
                <button
                  className={`group-btn ${metricType === 'coverage' ? 'active' : ''}`}
                  onClick={() => setMetricType('coverage')}
                  title="Cumulative % of all employees who have ever completed — consistent across enrollment policy changes"
                >
                  Workforce Coverage
                </button>
                <button
                  className={`group-btn ${metricType === 'count' ? 'active' : ''}`}
                  onClick={() => setMetricType('count')}
                  title="Raw completion counts per period — no percentage math, no denominator bias"
                >
                  Monthly Count
                </button>
                <button
                  className={`group-btn ${metricType === 'rate' ? 'active' : ''}`}
                  onClick={() => setMetricType('rate')}
                  title="Completions ÷ enrollments — unreliable before 2025 when enrollment was self-directed"
                >
                  Enrollment Rate
                </button>
              </div>
            </div>

            <div className="control-group">
              <label>Granularity</label>
              <div className="button-group">
                {['monthly', 'quarterly', 'yearly'].map(g => (
                  <button
                    key={g}
                    className={`group-btn ${granularity === g ? 'active' : ''}`}
                    onClick={() => setGranularity(g)}
                  >
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {metricType === 'rate' && (
              <label className="toggle-inline">
                <input
                  type="checkbox"
                  checked={showOverallLine}
                  onChange={(e) => setShowOverallLine(e.target.checked)}
                />
                Show overall line
              </label>
            )}
          </div>

          {metricType === 'coverage' && (
            <div className="metric-note">
              Cumulative % of <strong>{coverageData.totalEmployees} employees</strong> (all unique emails in this dataset) who have ever completed each course.
              Pre-enrollment-policy data is included — this metric is consistent across all years.
            </div>
          )}
          {metricType === 'rate' && (
            <div className="metric-note metric-note--warning">
              Enrollment-based rate: completions ÷ enrollments per period.
              Before 2025, enrollment was self-directed — only motivated employees enrolled, making those rates appear artificially high and not comparable to 2025+ data.
            </div>
          )}

          <div className="by-course-layout">
            <div className="course-selector-panel">
              <div className="selector-header">
                <span>Courses</span>
                <div className="selector-actions">
                  <button
                    className="link-btn"
                    onClick={() => setSelectedCourses(new Set(allCourses))}
                  >All</button>
                  <span className="separator">|</span>
                  <button
                    className="link-btn"
                    onClick={() => setSelectedCourses(new Set())}
                  >None</button>
                </div>
              </div>
              <div className="course-checkbox-list">
                {allCourses.map((course, i) => (
                  <label key={course} className="course-check-row">
                    <input
                      type="checkbox"
                      checked={selectedCourses.has(course)}
                      onChange={() => toggleCourse(course)}
                    />
                    <span
                      className="course-color-dot"
                      style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                    />
                    <span className="course-check-label">{course}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="by-course-chart-area">
              {selectedCourses.size === 0 && !showOverallLine ? (
                <div className="empty-state">
                  <p>Select at least one course from the list to see trends.</p>
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={380}>
                    <LineChart data={byCourseChartData} margin={{ right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" angle={-35} textAnchor="end" height={70} tick={{ fontSize: 12 }} />
                      <YAxis
                        domain={metricType === 'count' ? [0, 'auto'] : [0, 100]}
                        tickFormatter={metricType === 'count' ? v => v : v => `${v}%`}
                        width={metricType === 'count' ? 40 : 45}
                        label={metricType === 'coverage'
                          ? { value: '% of workforce', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 11 } }
                          : metricType === 'count'
                          ? { value: 'completions', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 11 } }
                          : undefined
                        }
                      />
                      <Tooltip
                        formatter={(val, name) => {
                          if (val === null) return ['No data', name];
                          if (metricType === 'count') return [val, name];
                          return [`${val}%`, name];
                        }}
                      />
                      <Legend />
                      {metricType === 'rate' && showOverallLine && (
                        <Line
                          key="Overall"
                          type="monotone"
                          dataKey="Overall"
                          stroke="#888"
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          dot={false}
                          connectNulls
                        />
                      )}
                      {Array.from(selectedCourses).map((course, i) => (
                        <Line
                          key={course}
                          type="monotone"
                          dataKey={course}
                          stroke={CHART_COLORS[i % CHART_COLORS.length]}
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          connectNulls
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>

                  {selectedCourses.size > 0 && (
                    <div className="course-summary-table">
                      <table>
                        <thead>
                          <tr>
                            <th>Course</th>
                            {metricType === 'coverage' && <>
                              <th>Overall Coverage</th>
                              <th>Employees Completed</th>
                              <th>Not Yet Completed</th>
                            </>}
                            {metricType === 'count' && <>
                              <th>Total Completions</th>
                              <th>Avg / Month</th>
                              <th>Trend</th>
                            </>}
                            {metricType === 'rate' && <>
                              <th>Avg Rate</th>
                              <th>Latest Period</th>
                              <th>Trend</th>
                            </>}
                          </tr>
                        </thead>
                        <tbody>
                          {Array.from(selectedCourses).map((course, i) => {
                            if (metricType === 'coverage') {
                              const stats = coverageData.courseStats[course];
                              const completed = stats?.totalCompleters ?? 0;
                              const missing = coverageData.totalEmployees - completed;
                              return (
                                <tr key={course}>
                                  <td>
                                    <span className="course-color-dot" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                                    {course}
                                  </td>
                                  <td><strong style={{ color: getRateColor(stats?.coverageRate ?? 0) }}>{stats?.coverageRate ?? 0}%</strong></td>
                                  <td>{completed.toLocaleString()}</td>
                                  <td style={{ color: missing > 0 ? '#FF8042' : '#00C49F' }}>{missing.toLocaleString()}</td>
                                </tr>
                              );
                            }

                            if (metricType === 'count') {
                              const counts = aggregated
                                .map(p => p.courses[course]?.completions ?? null)
                                .filter(v => v !== null);
                              const total = counts.reduce((s, v) => s + v, 0);
                              const avg = counts.length > 0 ? Math.round(total / counts.length) : null;
                              const latest = counts[counts.length - 1] ?? null;
                              const prev = counts[counts.length - 2] ?? null;
                              const delta = latest !== null && prev !== null ? latest - prev : null;
                              return (
                                <tr key={course}>
                                  <td>
                                    <span className="course-color-dot" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                                    {course}
                                  </td>
                                  <td>{total.toLocaleString()}</td>
                                  <td>{avg !== null ? avg : '—'}</td>
                                  <td><DeltaBadge delta={delta} /></td>
                                </tr>
                              );
                            }

                            // metricType === 'rate'
                            const points = aggregated
                              .map(p => p.courses[course]?.completionRate ?? null)
                              .filter(v => v !== null);
                            const avg = points.length > 0
                              ? Math.round(points.reduce((s, v) => s + v, 0) / points.length)
                              : null;
                            const latest = points[points.length - 1] ?? null;
                            const prev = points[points.length - 2] ?? null;
                            const delta = latest !== null && prev !== null ? latest - prev : null;
                            return (
                              <tr key={course}>
                                <td>
                                  <span className="course-color-dot" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                                  {course}
                                </td>
                                <td>{avg !== null ? `${avg}%` : '—'}</td>
                                <td>{latest !== null ? `${latest}%` : '—'}</td>
                                <td><DeltaBadge delta={delta} /></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── PERIOD COMPARISON ── */}
      {activeView === 'comparison' && (
        <div className="comparison-view">
          <div className="preset-row">
            {[
              { id: 'ytd', label: 'Year to Date' },
              { id: 'thisYear', label: 'Full Year' },
              { id: 'thisQuarter', label: 'This Quarter' },
              { id: 'thisMonth', label: 'This Month' },
              { id: 'custom', label: 'Custom' }
            ].map(p => (
              <button
                key={p.id}
                className={`preset-btn ${preset === p.id ? 'active' : ''}`}
                onClick={() => setPreset(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>

          {preset === 'custom' && (
            <div className="custom-periods">
              <div className="custom-period-group">
                <span className="period-label">Period A</span>
                <input
                  type="month"
                  value={customA.start}
                  onChange={(e) => setCustomA(p => ({ ...p, start: e.target.value }))}
                />
                <span>to</span>
                <input
                  type="month"
                  value={customA.end}
                  onChange={(e) => setCustomA(p => ({ ...p, end: e.target.value }))}
                />
              </div>
              <div className="custom-period-group">
                <span className="period-label">Period B</span>
                <input
                  type="month"
                  value={customB.start}
                  onChange={(e) => setCustomB(p => ({ ...p, start: e.target.value }))}
                />
                <span>to</span>
                <input
                  type="month"
                  value={customB.end}
                  onChange={(e) => setCustomB(p => ({ ...p, end: e.target.value }))}
                />
              </div>
            </div>
          )}

          {statsA && statsB && periods && (
            <>
              <div className="period-summary-cards">
                <div className="period-card period-a">
                  <div className="period-card-label">{periods.labelA}</div>
                  <div
                    className="period-card-rate"
                    style={{ color: getRateColor(statsA.overallRate) }}
                  >
                    {statsA.overallRate}%
                  </div>
                  <div className="period-card-detail">
                    {statsA.totalCompletions} / {statsA.totalEnrollments} enrollments completed
                  </div>
                </div>

                <div className="period-vs">
                  <DeltaBadge delta={statsA.overallRate - statsB.overallRate} />
                </div>

                <div className="period-card period-b">
                  <div className="period-card-label">{periods.labelB}</div>
                  <div
                    className="period-card-rate"
                    style={{ color: getRateColor(statsB.overallRate) }}
                  >
                    {statsB.overallRate}%
                  </div>
                  <div className="period-card-detail">
                    {statsB.totalCompletions} / {statsB.totalEnrollments} enrollments completed
                  </div>
                </div>
              </div>

              {comparisonBarData.length > 0 && (
                <div className="trend-card">
                  <h3>Completion Rate by Course</h3>
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={comparisonBarData} margin={{ right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="course" angle={-35} textAnchor="end" height={80} tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} width={45} />
                      <Tooltip formatter={(val) => `${val}%`} />
                      <Legend />
                      <Bar dataKey={periods.labelA} fill="#0088FE" />
                      <Bar dataKey={periods.labelB} fill="#00C49F" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="trend-card">
                <h3>Course-by-Course Breakdown</h3>
                <div className="table-wrapper">
                  <table className="comparison-table">
                    <thead>
                      <tr>
                        <th>Course</th>
                        <th>{periods.labelA}</th>
                        <th>{periods.labelB}</th>
                        <th>Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonRows.map(row => (
                        <tr key={row.course}>
                          <td className="course-name">{row.course}</td>
                          <td>
                            {row.a ? (
                              showRawNumbers
                                ? `${row.a.completions}/${row.a.enrollments}`
                                : `${row.rateA}%`
                            ) : '—'}
                          </td>
                          <td>
                            {row.b ? (
                              showRawNumbers
                                ? `${row.b.completions}/${row.b.enrollments}`
                                : `${row.rateB}%`
                            ) : '—'}
                          </td>
                          <td><DeltaBadge delta={row.delta} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {(!statsA || statsA.totalEnrollments === 0) && (!statsB || statsB.totalEnrollments === 0) && (
            <div className="empty-state">
              <p>No enrollment data found for the selected periods. Try adjusting the date range.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
