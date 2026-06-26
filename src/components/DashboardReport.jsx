import { useMemo } from 'react';
import { buildHierarchy } from '../data/hierarchy';
import { buildDashboardReport } from '../reports/dashboard';
import { exportDashboardReportToExcel } from '../export/excel';
import '../styles/DashboardReport.css';

function completionLevel(rate) {
  if (rate === 100) return 'high';
  if (rate >= 70) return 'medium';
  if (rate > 0) return 'low';
  return 'none';
}

/** Aggregate completion rate across a set of course rows. */
function overallRate(rows) {
  const totalEnrolled = rows.reduce((s, r) => s + r.enrolled, 0);
  const totalCompleted = rows.reduce((s, r) => s + r.completed, 0);
  return totalEnrolled > 0
    ? Number(((totalCompleted / totalEnrolled) * 100).toFixed(1))
    : 0;
}

function CourseTable({ rows }) {
  if (rows.length === 0) {
    return <p className="no-courses-message">No courses configured for this section.</p>;
  }
  return (
    <div className="table-container">
      <table className="dashboard-table">
        <thead>
          <tr>
            <th>Course</th>
            <th className="number-cell">Total Enrolled</th>
            <th className="number-cell">Completed</th>
            <th className="number-cell">Completion %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.course}>
              <td className="name-cell">{row.course}</td>
              <td className="number-cell">{row.enrolled}</td>
              <td className="number-cell">{row.completed}</td>
              <td className="number-cell">
                <span className={`completion-badge completion-${completionLevel(row.completionRate)}`}>
                  {row.completionRate}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DashboardReport({ data }) {
  const hierarchy = useMemo(() => {
    if (!data || data.length === 0) return null;
    return buildHierarchy(data);
  }, [data]);

  const report = useMemo(() => {
    if (!hierarchy) return null;
    return buildDashboardReport(hierarchy);
  }, [hierarchy]);

  const coreRate = useMemo(() => (report ? overallRate(report.coreTrainings) : 0), [report]);
  const leadershipRate = useMemo(
    () => (report ? overallRate(report.leadershipCourses) : 0),
    [report]
  );

  if (!report) {
    return (
      <div className="dashboard-report">
        <div className="info-message">
          <p>No data loaded. Please upload a CSV file first.</p>
        </div>
      </div>
    );
  }

  const handleExport = () => exportDashboardReportToExcel(report);

  return (
    <div className="dashboard-report">
      <div className="controls-section">
        <div className="report-summary">
          <h2>Overall Completion Dashboard</h2>
          <p className="toggle-description">
            At-a-glance completion rates for core trainings (all staff) and leadership courses (leaders only).
          </p>
        </div>
        <div className="export-buttons">
          <button onClick={handleExport} className="export-button">
            📥 Export Dashboard to Excel
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card info">
          <div className="stat-value">{coreRate}%</div>
          <div className="stat-label">Core Trainings Completion</div>
        </div>
        <div className="stat-card info">
          <div className="stat-value">{leadershipRate}%</div>
          <div className="stat-label">Leadership Courses Completion</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{report.coreStaffCount}</div>
          <div className="stat-label">Staff</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{report.leaderCount}</div>
          <div className="stat-label">Leaders</div>
        </div>
      </div>

      <div className="dashboard-section">
        <div className="section-header">
          <h3>Core Trainings (All Staff)</h3>
        </div>
        <CourseTable rows={report.coreTrainings} />
      </div>

      <div className="dashboard-section">
        <div className="section-header">
          <h3>Leadership Courses (Leaders Only)</h3>
        </div>
        <CourseTable rows={report.leadershipCourses} />
        <p className="dashboard-note">
          Intro to Leadership excludes leaders hired before Jan 1, 2025 (grandfathered) from the denominator.
        </p>
      </div>
    </div>
  );
}
