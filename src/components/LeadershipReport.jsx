import { useState, useMemo } from 'react';
import { buildHierarchy } from '../data/hierarchy';
import {
  buildLeadershipReport,
  getLeadersUnder,
  buildCascadeRollup
} from '../reports/leadership';
import { exportLeadershipReportToExcel } from '../export/excel';
import { useToggleSet } from '../hooks/useToggleSet';
import { useCourseFilter } from '../hooks/useCourseFilter';
import { useSortComparator } from '../hooks/useSortComparator';
import '../styles/LeadershipReport.css';

const STATUS_META = {
  complete: { label: '✓', title: 'Complete', cls: 'complete' },
  incomplete: { label: '◐', title: 'In Progress', cls: 'incomplete' },
  missing: { label: '✗', title: 'Not Started', cls: 'missing' },
  na: { label: 'N/A', title: 'Not applicable', cls: 'na' }
};

/** Recompute a leader's stats over only the selected (in-scope) tracked courses. */
function recomputeForCourses(leader, selectedCourses) {
  const applicable = selectedCourses.filter(
    c => leader.courseStatus[c] && leader.courseStatus[c].status !== 'na'
  );
  const completedCount = applicable.filter(
    c => leader.courseStatus[c].status === 'complete'
  ).length;
  const missingCount = applicable.length - completedCount;
  const complianceRate = applicable.length > 0
    ? Number(((completedCount / applicable.length) * 100).toFixed(1))
    : 0;
  return {
    ...leader,
    applicableCount: applicable.length,
    completedCount,
    missingCount,
    complianceRate
  };
}

function complianceLevel(rate) {
  if (rate === 100) return 'high';
  if (rate >= 70) return 'medium';
  if (rate > 0) return 'low';
  return 'none';
}

export default function LeadershipReport({ data }) {
  const [topNode, setTopNode] = useState(''); // '' = All Leaders
  const [showCourseFilter, setShowCourseFilter] = useState(false);
  const { set: selectedEmails, toggle: toggleEmail } = useToggleSet();
  const { sortBy, setSortBy, comparator: leaderComparator } = useSortComparator('name', {
    name: (a, b) => a.displayName.localeCompare(b.displayName),
    compliance: (a, b) => b.complianceRate - a.complianceRate,
    missing: (a, b) => b.missingCount - a.missingCount,
  });

  // Build hierarchy + base report.
  const hierarchy = useMemo(() => {
    if (!data || data.length === 0) return null;
    return buildHierarchy(data);
  }, [data]);

  const report = useMemo(() => {
    if (!hierarchy) return { leaders: [], trackedCourses: [] };
    return buildLeadershipReport(hierarchy);
  }, [hierarchy]);

  // In-scope course filter (defaults to all tracked courses).
  const {
    selected: selectedCourses,
    toggle: toggleCourse,
    selectAll: selectAllCourses,
    deselectAll: deselectAllCourses,
  } = useCourseFilter(report.trackedCourses);

  // All leaders recomputed for the in-scope courses (used for rollup lookups too).
  const allViewLeaders = useMemo(
    () => report.leaders.map(l => recomputeForCourses(l, selectedCourses)),
    [report.leaders, selectedCourses]
  );

  const leaderByEmail = useMemo(() => {
    const map = new Map();
    allViewLeaders.forEach(l => map.set(l.email, l));
    return map;
  }, [allViewLeaders]);

  // Page 1: filter to the chosen cascade node, then sort.
  const sortedLeaders = useMemo(() => {
    if (!hierarchy) return [];
    const filtered = getLeadersUnder(topNode, hierarchy, allViewLeaders);
    return [...filtered].sort(leaderComparator);
  }, [hierarchy, topNode, allViewLeaders, leaderComparator]);

  // Page 2 drill-down: checked leaders, or the current view if none checked.
  const detailLeaders = useMemo(() => {
    if (selectedEmails.size === 0) return sortedLeaders;
    return sortedLeaders.filter(l => selectedEmails.has(l.email));
  }, [sortedLeaders, selectedEmails]);

  const rollup = useMemo(() => {
    if (!hierarchy) return [];
    return buildCascadeRollup(detailLeaders, hierarchy, leaderByEmail);
  }, [detailLeaders, hierarchy, leaderByEmail]);

  // Overall stats for the current page-1 view.
  const stats = useMemo(() => {
    const totalLeaders = sortedLeaders.length;
    const fullyCompliant = sortedLeaders.filter(l => l.complianceRate === 100).length;
    const totalApplicable = sortedLeaders.reduce((s, l) => s + l.applicableCount, 0);
    const totalCompleted = sortedLeaders.reduce((s, l) => s + l.completedCount, 0);
    const overall = totalApplicable > 0
      ? Number(((totalCompleted / totalApplicable) * 100).toFixed(1))
      : 0;
    return { totalLeaders, fullyCompliant, overall };
  }, [sortedLeaders]);

  const handleExport = () => {
    exportLeadershipReportToExcel(
      { leaders: sortedLeaders, trackedCourses: selectedCourses },
      { detailLeaders, rollup }
    );
  };

  if (!hierarchy) {
    return (
      <div className="leadership-report">
        <div className="info-message">
          <p>⚠️ No supervisor data found in the uploaded file.</p>
          <p>Please ensure your CSV file includes a "Supervisor" column so leaders can be identified.</p>
        </div>
      </div>
    );
  }

  if (report.leaders.length === 0) {
    return (
      <div className="leadership-report">
        <div className="info-message">
          <p>⚠️ No leaders found in the data.</p>
          <p>Leaders are employees who have at least one direct report.</p>
        </div>
      </div>
    );
  }

  // Course columns currently in scope (preserve tracked-course order).
  const visibleCourses = report.trackedCourses.filter(c => selectedCourses.includes(c));

  return (
    <div className="leadership-report">
      <div className="controls-section">
        <div className="control-group">
          <label htmlFor="cascade-select">Cascade under:</label>
          <select
            id="cascade-select"
            value={topNode}
            onChange={(e) => setTopNode(e.target.value)}
            className="cascade-select"
          >
            <option value="">— All Leaders —</option>
            {[...report.leaders]
              .sort((a, b) => b.totalReportCount - a.totalReportCount)
              .map(l => (
                <option key={l.email} value={l.email}>
                  {l.displayName} ({l.totalReportCount} total reports)
                </option>
              ))}
          </select>
          <p className="toggle-description">
            Pick the top of a branch (e.g. the CEO/President) to hold an entire leadership line accountable.
          </p>
        </div>

        <div className="control-group">
          <div className="course-filter-header">
            <label>Courses in scope:</label>
            <button
              className="filter-toggle-button"
              onClick={() => setShowCourseFilter(!showCourseFilter)}
            >
              {showCourseFilter ? '▼ Hide' : '▶ Show'} ({selectedCourses.length} of {report.trackedCourses.length} selected)
            </button>
          </div>
          {showCourseFilter && (
            <div className="course-filter-panel">
              <div className="course-filter-actions">
                <button className="filter-action-button" onClick={selectAllCourses}>
                  Select All
                </button>
                <button className="filter-action-button" onClick={deselectAllCourses}>
                  Deselect All
                </button>
              </div>
              <div className="course-checkboxes">
                {report.trackedCourses.map(course => (
                  <label key={course} className="course-checkbox-label">
                    <input
                      type="checkbox"
                      checked={selectedCourses.includes(course)}
                      onChange={() => toggleCourse(course)}
                    />
                    <span>{course}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="export-buttons">
          <button onClick={handleExport} className="export-button">
            📥 Export Leadership Report to Excel
          </button>
        </div>
      </div>

      <div className="report-summary">
        <h2>Leadership Compliance</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.totalLeaders}</div>
            <div className="stat-label">Leaders</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.fullyCompliant}</div>
            <div className="stat-label">Fully Compliant</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.overall}%</div>
            <div className="stat-label">Overall Compliance</div>
          </div>
        </div>
      </div>

      <div className="leaders-section">
        <div className="section-header">
          <h3>All Leaders ({sortedLeaders.length})</h3>
          <div className="sort-controls">
            <label>Sort by:</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="name">Name</option>
              <option value="compliance">Compliance %</option>
              <option value="missing"># Missing</option>
            </select>
          </div>
        </div>
        <p className="selection-hint">
          {selectedEmails.size > 0
            ? `${selectedEmails.size} leader(s) selected — the breakdown below reflects your selection.`
            : 'Check leaders to drive the breakdown below. With none checked, it reflects the current filter.'}
        </p>

        <div className="table-container">
          <table className="leaders-table">
            <thead>
              <tr>
                <th></th>
                <th>Leader</th>
                <th>Supervisor(s)</th>
                <th>Hire Date</th>
                {visibleCourses.map(c => <th key={c} className="course-col">{c}</th>)}
                <th>Compliance</th>
              </tr>
            </thead>
            <tbody>
              {sortedLeaders.map(leader => (
                <tr key={leader.email}>
                  <td className="center-cell">
                    <input
                      type="checkbox"
                      checked={selectedEmails.has(leader.email)}
                      onChange={() => toggleEmail(leader.email)}
                      aria-label={`Select ${leader.displayName}`}
                    />
                  </td>
                  <td className="name-cell">{leader.displayName}</td>
                  <td className="supervisor-cell">
                    {leader.supervisors.map(s => s.name).join(', ') || '—'}
                  </td>
                  <td className="center-cell">
                    {leader.hireDate ? new Date(leader.hireDate).toLocaleDateString() : '—'}
                  </td>
                  {visibleCourses.map(c => {
                    const meta = STATUS_META[leader.courseStatus[c].status];
                    return (
                      <td key={c} className="center-cell">
                        <span className={`status-pill ${meta.cls}`} title={meta.title}>
                          {meta.label}
                        </span>
                      </td>
                    );
                  })}
                  <td className="center-cell">
                    <span className={`completion-badge completion-${complianceLevel(leader.complianceRate)}`}>
                      {leader.complianceRate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="breakdown-section">
        <h3>Selection Breakdown ({detailLeaders.length})</h3>

        <h4>Per-Course Detail</h4>
        <div className="table-container">
          <table className="leaders-table">
            <thead>
              <tr>
                <th>Leader</th>
                <th>Hire Date</th>
                {visibleCourses.map(c => <th key={c} className="course-col">{c}</th>)}
                <th>Compliance</th>
              </tr>
            </thead>
            <tbody>
              {detailLeaders.map(leader => (
                <tr key={leader.email}>
                  <td className="name-cell">{leader.displayName}</td>
                  <td className="center-cell">
                    {leader.hireDate ? new Date(leader.hireDate).toLocaleDateString() : '—'}
                  </td>
                  {visibleCourses.map(c => {
                    const meta = STATUS_META[leader.courseStatus[c].status];
                    return (
                      <td key={c} className="center-cell">
                        <span className={`status-pill ${meta.cls}`} title={meta.title}>
                          {meta.label}
                        </span>
                      </td>
                    );
                  })}
                  <td className="center-cell">
                    <span className={`completion-badge completion-${complianceLevel(leader.complianceRate)}`}>
                      {leader.complianceRate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h4>Cascade Roll-up</h4>
        <div className="table-container">
          <table className="leaders-table">
            <thead>
              <tr>
                <th>Leader</th>
                <th>Own Compliance</th>
                <th>Downstream Leaders</th>
                <th>Branch Leaders</th>
                <th>Branch Compliance</th>
              </tr>
            </thead>
            <tbody>
              {rollup.map(r => (
                <tr key={r.email}>
                  <td className="name-cell">{r.displayName}</td>
                  <td className="center-cell">
                    <span className={`completion-badge completion-${complianceLevel(r.ownComplianceRate)}`}>
                      {r.ownComplianceRate}%
                    </span>
                  </td>
                  <td className="center-cell">{r.downstreamLeaderCount}</td>
                  <td className="center-cell">{r.branchLeaderCount}</td>
                  <td className="center-cell">
                    <span className={`completion-badge completion-${complianceLevel(r.branchComplianceRate)}`}>
                      {r.branchComplianceRate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
