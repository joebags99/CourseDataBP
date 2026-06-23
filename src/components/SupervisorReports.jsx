import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { buildHierarchy, getAllSupervisors, getSupervisorReport } from '../data/hierarchy';
import { exportSupervisorReportToExcel, exportDirectReportsBySupervisor } from '../export/excel';
import { useToggleSet } from '../hooks/useToggleSet';
import { useCourseFilter } from '../hooks/useCourseFilter';
import { useSortComparator } from '../hooks/useSortComparator';
import '../styles/SupervisorReports.css';

export default function SupervisorReports({ data, courseGroups, groupVersions }) {
  const [selectedSupervisor, setSelectedSupervisor] = useState('');
  const [cascading, setCascading] = useState(true);
  const [showCourseFilter, setShowCourseFilter] = useState(false);
  const { set: expandedMembers, toggle: toggleMemberExpansion } = useToggleSet();
  const { sortBy, setSortBy, comparator: sortComparator } = useSortComparator('name', {
    name: (a, b) => a.displayName.localeCompare(b.displayName),
    completionRate: (a, b) => parseFloat(b.completionRate) - parseFloat(a.completionRate),
    courses: (a, b) => b.totalCourses - a.totalCourses,
  });

  // Build organizational hierarchy
  const hierarchy = useMemo(() => {
    if (data.length === 0) return null;
    return buildHierarchy(data);
  }, [data]);

  // Get list of all supervisors
  const supervisors = useMemo(() => {
    if (!hierarchy) return [];
    return getAllSupervisors(hierarchy);
  }, [hierarchy]);

  // Get all unique courses for filtering
  const allCourses = useMemo(() => {
    if (!hierarchy) return [];
    const coursesSet = new Set();
    hierarchy.employeeMap.forEach(employee => {
      employee.courses.forEach(course => {
        coursesSet.add(course.course);
      });
    });
    return Array.from(coursesSet).sort();
  }, [hierarchy]);

  // Course multi-select filter (defaults to all courses)
  const {
    selected: selectedCourses,
    toggle: toggleCourseSelection,
    selectAll: selectAllCourses,
    deselectAll: deselectAllCourses,
  } = useCourseFilter(allCourses);

  // Get selected supervisor's report with course filter applied
  const supervisorReport = useMemo(() => {
    if (!hierarchy || !selectedSupervisor) return null;
    const report = getSupervisorReport(selectedSupervisor, hierarchy, cascading);
    if (!report) return null;

    const selectedSet = new Set(selectedCourses);

    const filteredTeamMembers = report.teamMembers.map(member => {
      const courses = member.courses.filter(c => selectedSet.has(c.course));
      const totalCourses = courses.length;
      const completedCourses = courses.filter(c => c.percentCompleted === 100).length;
      const completionRate = totalCourses > 0
        ? (completedCourses / totalCourses * 100).toFixed(1)
        : 0;
      return { ...member, courses, totalCourses, completedCourses, completionRate };
    });

    // Recompute summary stats from filtered data
    const membersWithData = filteredTeamMembers.filter(m => m.hasData);
    const totalEnrollments = membersWithData.reduce((sum, m) => sum + m.totalCourses, 0);
    const totalCompletions = membersWithData.reduce((sum, m) => sum + m.completedCourses, 0);
    const overallCompletionRate = totalEnrollments > 0
      ? (totalCompletions / totalEnrollments * 100).toFixed(1)
      : 0;

    return {
      ...report,
      teamMembers: filteredTeamMembers,
      statistics: {
        ...report.statistics,
        totalEnrollments,
        totalCompletions,
        overallCompletionRate,
      },
    };
  }, [hierarchy, selectedSupervisor, cascading, selectedCourses]);

  // Sort team members
  const sortedTeamMembers = useMemo(() => {
    if (!supervisorReport) return [];

    return [...supervisorReport.teamMembers].sort(sortComparator);
  }, [supervisorReport, sortComparator]);

  const handleExportReport = () => {
    if (!supervisorReport) return;

    // Export with current cascading setting and course filters applied
    const filename = `supervisor-report-${supervisorReport.supervisor.displayName.replace(/\s+/g, '-')}-${cascading ? 'cascading' : 'direct'}`;
    exportSupervisorReportToExcel(supervisorReport, filename);
  };

  const handleExportAllSupervisors = () => {
    if (!hierarchy || supervisors.length === 0) return;

    const selectedSet = new Set(selectedCourses);
    const allReports = supervisors.map(sup => {
      const report = getSupervisorReport(sup.email, hierarchy, false);
      if (!report) return null;
      const filteredTeamMembers = report.teamMembers.map(member => {
        const courses = member.courses.filter(c => selectedSet.has(c.course));
        const totalCourses = courses.length;
        const completedCourses = courses.filter(c => c.percentCompleted === 100).length;
        const completionRate = totalCourses > 0
          ? (completedCourses / totalCourses * 100).toFixed(1)
          : 0;
        return { ...member, courses, totalCourses, completedCourses, completionRate };
      });
      return { ...report, teamMembers: filteredTeamMembers };
    }).filter(Boolean);

    exportDirectReportsBySupervisor(allReports, 'direct-reports-by-supervisor');
  };

  if (!hierarchy) {
    return (
      <div className="supervisor-reports">
        <div className="info-message">
          <p>⚠️ No supervisor data found in the uploaded file.</p>
          <p>Please ensure your CSV file includes a "Supervisor" column.</p>
        </div>
      </div>
    );
  }

  if (supervisors.length === 0) {
    return (
      <div className="supervisor-reports">
        <div className="info-message">
          <p>⚠️ No supervisors found in the data.</p>
          <p>Supervisors are employees who have direct reports.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="supervisor-reports">
      <div className="controls-section">
        <div className="control-group">
          <label htmlFor="supervisor-select">Select Supervisor:</label>
          <select
            id="supervisor-select"
            value={selectedSupervisor}
            onChange={(e) => setSelectedSupervisor(e.target.value)}
            className="supervisor-select"
          >
            <option value="">-- Select a Supervisor --</option>
            {supervisors.map((sup) => (
              <option key={sup.email} value={sup.email}>
                {sup.displayName} ({sup.directReportCount} direct, {sup.totalReportCount} total)
              </option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label className="toggle-control">
            <input
              type="checkbox"
              checked={cascading}
              onChange={(e) => setCascading(e.target.checked)}
            />
            <span>Include Cascading Reports</span>
          </label>
          <p className="toggle-description">
            {cascading
              ? 'Showing all direct and indirect reports (full hierarchy)'
              : 'Showing only direct reports (one level)'}
          </p>
        </div>

        <div className="control-group">
          <div className="course-filter-header">
            <label>Filter Courses:</label>
            <button
              className="filter-toggle-button"
              onClick={() => setShowCourseFilter(!showCourseFilter)}
            >
              {showCourseFilter ? '▼ Hide' : '▶ Show'} ({selectedCourses.length} of {allCourses.length} selected)
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
                {allCourses.map(course => (
                  <label key={course} className="course-checkbox-label">
                    <input
                      type="checkbox"
                      checked={selectedCourses.includes(course)}
                      onChange={() => toggleCourseSelection(course)}
                    />
                    <span>{course}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="export-buttons">
          <button
            onClick={handleExportReport}
            disabled={!supervisorReport}
            className="export-button"
          >
            📥 Export Report to Excel
          </button>
          <button
            onClick={handleExportAllSupervisors}
            className="export-button secondary"
            title="Export all supervisors with their direct reports grouped by supervisor"
          >
            📥 Export Direct Reports by Supervisor
          </button>
        </div>
      </div>

      {supervisorReport && (
        <>
          <div className="report-summary">
            <h2>Report for {supervisorReport.supervisor.displayName}</h2>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{supervisorReport.statistics.totalTeamMembers}</div>
                <div className="stat-label">Team Members</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{supervisorReport.statistics.directReportCount}</div>
                <div className="stat-label">Direct Reports</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{supervisorReport.statistics.totalReportCount}</div>
                <div className="stat-label">Total Reports (Cascading)</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{supervisorReport.statistics.totalEnrollments}</div>
                <div className="stat-label">Total Enrollments</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{supervisorReport.statistics.totalCompletions}</div>
                <div className="stat-label">Total Completions</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{supervisorReport.statistics.overallCompletionRate}%</div>
                <div className="stat-label">Completion Rate</div>
              </div>
            </div>
          </div>

          <div className="team-members-section">
            <div className="section-header">
              <h3>Team Members ({sortedTeamMembers.length})</h3>
              <div className="sort-controls">
                <label>Sort by:</label>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  <option value="name">Name</option>
                  <option value="completionRate">Completion Rate</option>
                  <option value="courses">Number of Courses</option>
                </select>
              </div>
            </div>

            <div className="table-container">
              <table className="team-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Total Courses</th>
                    <th>Completed</th>
                    <th>Completion Rate</th>
                    <th>Has Direct Reports</th>
                    <th>Immediate Supervisor(s)</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTeamMembers.map((member) => (
                    <>
                      <tr
                        key={member.email}
                        className={expandedMembers.has(member.email) ? 'expanded' : ''}
                      >
                        <td>
                          {member.hasData && member.courses.length > 0 ? (
                            <button
                              className="expand-button"
                              onClick={() => toggleMemberExpansion(member.email)}
                              aria-label={expandedMembers.has(member.email) ? 'Collapse' : 'Expand'}
                            >
                              {expandedMembers.has(member.email) ? '▼' : '▶'}
                            </button>
                          ) : (
                            <span className="no-data-indicator" title="No course enrollment data">—</span>
                          )}
                        </td>
                        <td className="name-cell">
                          {member.displayName}
                          {!member.hasData && <span className="badge-no-data" title="No course enrollment data">No Data</span>}
                        </td>
                        <td className="email-cell">
                          {member.isPlaceholder ? <span className="placeholder-email" title="Email not available">—</span> : member.email}
                        </td>
                        <td className="number-cell">{member.hasData ? member.totalCourses : '—'}</td>
                        <td className="number-cell">{member.hasData ? member.completedCourses : '—'}</td>
                        <td className="number-cell">
                          {member.hasData ? (
                            <span className={`completion-badge completion-${getCompletionLevel(member.completionRate)}`}>
                              {member.completionRate}%
                            </span>
                          ) : (
                            <span className="no-data-text">—</span>
                          )}
                        </td>
                        <td className="center-cell">{member.hasDirectReports ? '✓' : ''}</td>
                        <td className="supervisor-cell">
                          {member.supervisors.map(s => s.name).join(', ') || '—'}
                        </td>
                      </tr>
                      {expandedMembers.has(member.email) && member.hasData && (
                        <tr className="detail-row">
                          <td colSpan="8">
                            <div className="course-details">
                              <h4>Courses for {member.displayName}</h4>
                              {member.courses.length > 0 ? (
                                <table className="course-table">
                                  <thead>
                                    <tr>
                                      <th>Course</th>
                                      <th>% Completed</th>
                                      <th>Enrolled At</th>
                                      <th>Date Completed</th>
                                      <th>Days to Complete</th>
                                      <th>Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {member.courses.map((course, idx) => (
                                      <tr key={idx}>
                                        <td>{course.course}</td>
                                        <td>{course.percentCompleted}%</td>
                                        <td>
                                          {course.enrolledAt
                                            ? format(new Date(course.enrolledAt), 'yyyy-MM-dd')
                                            : '—'}
                                        </td>
                                        <td>
                                          {course.dateCompleted
                                            ? format(new Date(course.dateCompleted), 'yyyy-MM-dd')
                                            : '—'}
                                        </td>
                                        <td>{course.daysToComplete || '—'}</td>
                                        <td>
                                          <span className={`status-badge ${course.percentCompleted === 100 ? 'completed' : 'in-progress'}`}>
                                            {course.percentCompleted === 100 ? 'Completed' : 'In Progress'}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              ) : (
                                <p className="no-courses-message">No course enrollments found.</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function getCompletionLevel(rate) {
  const numRate = parseFloat(rate);
  if (numRate === 100) return 'high';
  if (numRate >= 70) return 'medium';
  if (numRate > 0) return 'low';
  return 'none';
}
