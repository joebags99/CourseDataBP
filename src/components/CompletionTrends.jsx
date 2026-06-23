import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { format } from 'date-fns';
import { calculateMonthlyTrends, identifyLowCompletionCourses } from '../reports/analytics';
import '../styles/CompletionTrends.css';

export default function CompletionTrends({ data, courseGroups, groupVersions, showRawNumbers }) {
  const [selectedView, setSelectedView] = useState('overall'); // 'overall' or 'byCourse'
  const [selectedCourse, setSelectedCourse] = useState('');

  const monthlyTrends = useMemo(
    () => calculateMonthlyTrends(data, courseGroups, groupVersions),
    [data, courseGroups, groupVersions]
  );

  const lowCompletionCourses = useMemo(
    () => identifyLowCompletionCourses(data, courseGroups, 70, groupVersions),
    [data, courseGroups, groupVersions]
  );

  const courses = useMemo(() => {
    if (monthlyTrends.length === 0) return [];
    const coursesSet = new Set();
    monthlyTrends.forEach(month => {
      Object.keys(month.courses).forEach(course => coursesSet.add(course));
    });
    return Array.from(coursesSet).sort();
  }, [monthlyTrends]);

  const chartData = useMemo(() => {
    if (selectedView === 'overall') {
      return monthlyTrends.map(month => ({
        month: format(month.date, 'MMM yyyy'),
        completions: month.totalCompletions
      }));
    } else if (selectedCourse) {
      return monthlyTrends.map(month => ({
        month: format(month.date, 'MMM yyyy'),
        completions: month.courses[selectedCourse] || 0
      }));
    }
    return [];
  }, [monthlyTrends, selectedView, selectedCourse]);

  // Calculate time-to-completion distribution
  const timeToCompletionData = useMemo(() => {
    const filtered = data.filter(r => r.daysToComplete !== null);

    const buckets = {
      '0-7 days': 0,
      '8-14 days': 0,
      '15-30 days': 0,
      '31-60 days': 0,
      '61-90 days': 0,
      '90+ days': 0
    };

    filtered.forEach(record => {
      const days = record.daysToComplete;
      if (days <= 7) buckets['0-7 days']++;
      else if (days <= 14) buckets['8-14 days']++;
      else if (days <= 30) buckets['15-30 days']++;
      else if (days <= 60) buckets['31-60 days']++;
      else if (days <= 90) buckets['61-90 days']++;
      else buckets['90+ days']++;
    });

    return Object.entries(buckets).map(([range, count]) => ({
      range,
      count,
      percentage: filtered.length > 0 ? Math.round((count / filtered.length) * 100) : 0
    }));
  }, [data]);

  return (
    <div className="completion-trends">
      <h2>Completion Trends</h2>

      <div className="trends-grid">
        {/* Monthly Trends Chart */}
        <div className="trend-card">
          <div className="card-header">
            <h3>Monthly Completions</h3>
            <div className="view-controls">
              <select
                value={selectedView}
                onChange={(e) => {
                  setSelectedView(e.target.value);
                  if (e.target.value === 'byCourse' && courses.length > 0) {
                    setSelectedCourse(courses[0]);
                  }
                }}
              >
                <option value="overall">Overall</option>
                <option value="byCourse">By Course</option>
              </select>

              {selectedView === 'byCourse' && (
                <select
                  value={selectedCourse}
                  onChange={(e) => setSelectedCourse(e.target.value)}
                >
                  {courses.map(course => (
                    <option key={course} value={course}>{course}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="month"
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="completions"
                stroke="#00C49F"
                fill="#00C49F"
                fillOpacity={0.6}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Time to Completion Distribution */}
        <div className="trend-card">
          <h3>Time to Completion Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={timeToCompletionData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="range" angle={-45} textAnchor="end" height={80} />
              <YAxis />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#0088FE"
                fill="#0088FE"
                fillOpacity={0.6}
              />
            </AreaChart>
          </ResponsiveContainer>

          <div className="distribution-details">
            {timeToCompletionData.map(bucket => (
              <div key={bucket.range} className="distribution-row">
                <span className="range-label">{bucket.range}</span>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${bucket.percentage}%` }}
                  />
                </div>
                <span className="percentage">{bucket.percentage}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Low Completion Courses */}
        <div className="trend-card full-width">
          <h3>Courses Needing Attention (Low Completion Rates)</h3>

          {lowCompletionCourses.length === 0 ? (
            <div className="empty-state">
              <p>✅ All courses have healthy completion rates!</p>
            </div>
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
    </div>
  );
}

function getRateColor(rate) {
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
