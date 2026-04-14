import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import {
  buildCostCenterData,
  getAllCostCenters,
  getAllRegions,
  getCostCenterReport
} from '../utils/costCenterUtils';
import {
  exportCostCenterReportToExcel,
  exportAllCostCentersToExcel
} from '../utils/excelExporter';
import '../styles/CostCenterReports.css';

export default function CostCenterReports({ data, courseGroups, groupVersions }) {
  const [selectedProgram, setSelectedProgram] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [expandedMembers, setExpandedMembers] = useState(new Set());
  const [sortBy, setSortBy] = useState('name');
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [showCourseFilter, setShowCourseFilter] = useState(false);

  // Build cost center map from data
  const programMap = useMemo(() => {
    if (data.length === 0) return new Map();
    return buildCostCenterData(data);
  }, [data]);

  // All cost centers sorted
  const allCostCenters = useMemo(() => getAllCostCenters(programMap), [programMap]);

  // All regions for the region filter
  const allRegions = useMemo(() => getAllRegions(programMap), [programMap]);

  // Cost centers filtered by selected region
  const filteredCostCenters = useMemo(() => {
    if (!selectedRegion) return allCostCenters;
    return allCostCenters.filter(cc => cc.regionCode === selectedRegion);
  }, [allCostCenters, selectedRegion]);

  // All unique courses across the entire dataset
  const allCourses = useMemo(() => {
    const coursesSet = new Set();
    programMap.forEach(program => {
      program.employees.forEach(employee => {
        employee.courses.forEach(c => coursesSet.add(c.course));
      });
    });
    return Array.from(coursesSet).sort();
  }, [programMap]);

  // Initialize selectedCourses to all courses when data loads
  useMemo(() => {
    if (allCourses.length > 0 && selectedCourses.length === 0) {
      setSelectedCourses(allCourses);
    }
  }, [allCourses]);

  // Report for the selected cost center
  const costCenterReport = useMemo(() => {
    if (!selectedProgram) return null;
    return getCostCenterReport(selectedProgram, programMap, selectedCourses);
  }, [selectedProgram, programMap, selectedCourses]);

  // Sorted employees
  const sortedEmployees = useMemo(() => {
    if (!costCenterReport) return [];
    const sorted = [...costCenterReport.employees];
    sorted.sort((a, b) => {
      if (sortBy === 'name') return a.displayName.localeCompare(b.displayName);
      if (sortBy === 'completionRate') return parseFloat(b.completionRate) - parseFloat(a.completionRate);
      if (sortBy === 'courses') return b.totalCourses - a.totalCourses;
      return 0;
    });
    return sorted;
  }, [costCenterReport, sortBy]);

  const toggleMemberExpansion = (email) => {
    const next = new Set(expandedMembers);
    if (next.has(email)) next.delete(email);
    else next.add(email);
    setExpandedMembers(next);
  };

  const toggleCourseSelection = (courseName) => {
    setSelectedCourses(prev =>
      prev.includes(courseName)
        ? prev.filter(c => c !== courseName)
        : [...prev, courseName]
    );
  };

  const handleExportReport = () => {
    if (!costCenterReport) return;
    exportCostCenterReportToExcel(costCenterReport);
  };

  const handleExportAll = () => {
    if (allCostCenters.length === 0) return;
    const allReports = allCostCenters.map(cc =>
      getCostCenterReport(cc.key, programMap, selectedCourses)
    ).filter(Boolean);
    exportAllCostCentersToExcel(allReports);
  };

  if (programMap.size === 0) {
    return (
      <div className="cost-center-reports">
        <div className="info-message">
          <p>No program/cost center data found in the uploaded file.</p>
          <p>Please ensure your CSV export includes a "Program" column from UKG.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="cost-center-reports">
      <div className="controls-section">

        {/* Region filter */}
        {allRegions.length > 1 && (
          <div className="control-group">
            <label htmlFor="region-select">Filter by Region:</label>
            <select
              id="region-select"
              value={selectedRegion}
              onChange={(e) => {
                setSelectedRegion(e.target.value);
                setSelectedProgram('');
              }}
              className="cc-select"
            >
              <option value="">-- All Regions --</option>
              {allRegions.map(r => (
                <option key={r.regionCode} value={r.regionCode}>
                  {r.regionName}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Program / cost center dropdown */}
        <div className="control-group">
          <label htmlFor="program-select">Select Cost Center / Program:</label>
          <select
            id="program-select"
            value={selectedProgram}
            onChange={(e) => setSelectedProgram(e.target.value)}
            className="cc-select"
          >
            <option value="">-- Select a Cost Center --</option>
            {filteredCostCenters.map(cc => (
              <option key={cc.key} value={cc.key}>
                {cc.programName}{cc.regionName ? ` · ${cc.regionName}` : ''} ({cc.employeeCount} {cc.employeeCount === 1 ? 'employee' : 'employees'})
              </option>
            ))}
          </select>
        </div>

        {/* Course filter */}
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
                <button className="filter-action-button" onClick={() => setSelectedCourses(allCourses)}>
                  Select All
                </button>
                <button className="filter-action-button" onClick={() => setSelectedCourses([])}>
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

        {/* Export buttons */}
        <div className="export-buttons">
          <button
            onClick={handleExportReport}
            disabled={!costCenterReport}
            className="export-button"
          >
            Export Report to Excel
          </button>
          <button
            onClick={handleExportAll}
            className="export-button secondary"
            title="Export all cost centers to a single Excel file"
          >
            Export All Cost Centers
          </button>
        </div>
      </div>

      {costCenterReport && (
        <>
          {/* Summary stats */}
          <div className="report-summary">
            <h2>{costCenterReport.program.programName}</h2>
            {costCenterReport.program.regionName && (
              <p className="region-label">{costCenterReport.program.regionName}</p>
            )}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{costCenterReport.statistics.totalEmployees}</div>
                <div className="stat-label">Employees</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{costCenterReport.statistics.totalEnrollments}</div>
                <div className="stat-label">Total Enrollments</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{costCenterReport.statistics.totalCompletions}</div>
                <div className="stat-label">Total Completions</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{costCenterReport.statistics.overallCompletionRate}%</div>
                <div className="stat-label">Completion Rate</div>
              </div>
            </div>
          </div>

          {/* Employee table */}
          <div className="team-members-section">
            <div className="section-header">
              <h3>Employees ({sortedEmployees.length})</h3>
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
                    <th>Supervisor</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedEmployees.map((member) => (
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
                            <span className="no-data-indicator">—</span>
                          )}
                        </td>
                        <td className="name-cell">{member.displayName}</td>
                        <td className="email-cell">{member.email}</td>
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
                        <td className="supervisor-cell">
                          {member.supervisor || '—'}
                        </td>
                      </tr>
                      {expandedMembers.has(member.email) && member.hasData && (
                        <tr className="detail-row">
                          <td colSpan="7">
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
                                <p className="no-courses-message">No course enrollments match the current filter.</p>
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
  const n = parseFloat(rate);
  if (n === 100) return 'high';
  if (n >= 70) return 'medium';
  if (n > 0) return 'low';
  return 'none';
}
