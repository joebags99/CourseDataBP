import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import {
  buildCostCenterData,
  getAllCostCenters,
  getAllRegions,
  getCostCenterReport,
  getMultiCostCenterReport
} from '../utils/costCenterUtils';
import {
  exportCostCenterReportToExcel,
  exportAllCostCentersToExcel
} from '../utils/excelExporter';
import '../styles/CostCenterReports.css';

export default function CostCenterReports({ data, courseGroups, groupVersions }) {
  const [viewMode, setViewMode] = useState('overview'); // 'overview' | 'detail'
  const [selectedPrograms, setSelectedPrograms] = useState([]); // array of keys
  const [selectedRegion, setSelectedRegion] = useState('');
  const [showProgramSelector, setShowProgramSelector] = useState(true);
  const [expandedMembers, setExpandedMembers] = useState(new Set());
  const [sortBy, setSortBy] = useState('name');
  const [overviewSortBy, setOverviewSortBy] = useState('name'); // 'name' | 'rate' | 'employees'
  const [overviewSortDir, setOverviewSortDir] = useState('asc');
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [showCourseFilter, setShowCourseFilter] = useState(false);

  // Build cost center map from data
  const programMap = useMemo(() => {
    if (data.length === 0) return new Map();
    return buildCostCenterData(data);
  }, [data]);

  const allCostCenters = useMemo(() => getAllCostCenters(programMap), [programMap]);
  const allRegions = useMemo(() => getAllRegions(programMap), [programMap]);

  // Cost centers visible in the selector (filtered by region)
  const visibleCostCenters = useMemo(() => {
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

  // Initialize selectedCourses to all when data loads
  useMemo(() => {
    if (allCourses.length > 0 && selectedCourses.length === 0) {
      setSelectedCourses(allCourses);
    }
  }, [allCourses]);

  // Combined report for all selected programs
  const costCenterReport = useMemo(() => {
    if (selectedPrograms.length === 0) return null;
    return getMultiCostCenterReport(selectedPrograms, programMap, selectedCourses);
  }, [selectedPrograms, programMap, selectedCourses]);

  // Show a "Program" column whenever more than one program is selected
  const showProgramColumn = selectedPrograms.length > 1;

  // Sorted employees
  const sortedEmployees = useMemo(() => {
    if (!costCenterReport) return [];
    const sorted = [...costCenterReport.employees];
    sorted.sort((a, b) => {
      if (sortBy === 'name') return a.displayName.localeCompare(b.displayName);
      if (sortBy === 'completionRate') return parseFloat(b.completionRate) - parseFloat(a.completionRate);
      if (sortBy === 'courses') return b.totalCourses - a.totalCourses;
      if (sortBy === 'program') return a.programName.localeCompare(b.programName);
      return 0;
    });
    return sorted;
  }, [costCenterReport, sortBy]);

  // Overview: one row per cost center visible under the current region filter
  const overviewRows = useMemo(() => {
    const rows = visibleCostCenters.map(cc => {
      const report = getCostCenterReport(cc.key, programMap, selectedCourses);
      if (!report) return null;
      return {
        key: cc.key,
        programName: cc.programName,
        regionName: cc.regionName,
        employees: report.statistics.totalEmployees,
        enrollments: report.statistics.totalEnrollments,
        completions: report.statistics.totalCompletions,
        rate: parseFloat(report.statistics.overallCompletionRate),
      };
    }).filter(Boolean);

    rows.sort((a, b) => {
      let cmp = 0;
      if (overviewSortBy === 'name') cmp = a.programName.localeCompare(b.programName);
      else if (overviewSortBy === 'rate') cmp = a.rate - b.rate;
      else if (overviewSortBy === 'employees') cmp = a.employees - b.employees;
      return overviewSortDir === 'asc' ? cmp : -cmp;
    });

    return rows;
  }, [visibleCostCenters, programMap, selectedCourses, overviewSortBy, overviewSortDir]);

  const handleOverviewSort = (col) => {
    if (overviewSortBy === col) {
      setOverviewSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setOverviewSortBy(col);
      setOverviewSortDir(col === 'rate' ? 'desc' : 'asc');
    }
  };

  const openDetail = (key) => {
    setSelectedPrograms([key]);
    setViewMode('detail');
    setExpandedMembers(new Set());
  };

  // ── Program selection helpers ──────────────────────────────────────────────

  const toggleProgram = (key) => {
    setSelectedPrograms(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
    setExpandedMembers(new Set());
  };

  const selectAllVisible = () => {
    const visibleKeys = visibleCostCenters.map(cc => cc.key);
    setSelectedPrograms(prev => Array.from(new Set([...prev, ...visibleKeys])));
    setExpandedMembers(new Set());
  };

  const deselectAllVisible = () => {
    const visibleKeys = new Set(visibleCostCenters.map(cc => cc.key));
    setSelectedPrograms(prev => prev.filter(k => !visibleKeys.has(k)));
    setExpandedMembers(new Set());
  };

  const handleRegionChange = (regionCode) => {
    setSelectedRegion(regionCode);
    // Clear selections that are no longer in the new region view
    if (regionCode) {
      const regionKeys = new Set(
        allCostCenters
          .filter(cc => cc.regionCode === regionCode)
          .map(cc => cc.key)
      );
      setSelectedPrograms(prev => prev.filter(k => regionKeys.has(k)));
    }
    setExpandedMembers(new Set());
  };

  // ── Course filter helpers ──────────────────────────────────────────────────

  const toggleCourseSelection = (courseName) => {
    setSelectedCourses(prev =>
      prev.includes(courseName)
        ? prev.filter(c => c !== courseName)
        : [...prev, courseName]
    );
  };

  // ── Export helpers ─────────────────────────────────────────────────────────

  const handleExportSelected = () => {
    if (!costCenterReport) return;
    if (selectedPrograms.length === 1) {
      exportCostCenterReportToExcel(costCenterReport.programs
        ? { ...getCostCenterReport(selectedPrograms[0], programMap, selectedCourses) }
        : costCenterReport);
    } else {
      exportAllCostCentersToExcel(
        selectedPrograms
          .map(k => getCostCenterReport(k, programMap, selectedCourses))
          .filter(Boolean)
      );
    }
  };

  const handleExportAll = () => {
    if (allCostCenters.length === 0) return;
    exportAllCostCentersToExcel(
      allCostCenters.map(cc => getCostCenterReport(cc.key, programMap, selectedCourses)).filter(Boolean)
    );
  };

  // ── Member expand ──────────────────────────────────────────────────────────

  const toggleMemberExpansion = (rowKey) => {
    const next = new Set(expandedMembers);
    if (next.has(rowKey)) next.delete(rowKey);
    else next.add(rowKey);
    setExpandedMembers(next);
  };

  // ── Report title ───────────────────────────────────────────────────────────

  const reportTitle = useMemo(() => {
    if (!costCenterReport) return '';
    if (costCenterReport.programs.length === 1) return costCenterReport.programs[0].programName;
    return `${costCenterReport.programs.length} Cost Centers Selected`;
  }, [costCenterReport]);

  const reportSubtitle = useMemo(() => {
    if (!costCenterReport || costCenterReport.programs.length !== 1) return '';
    return costCenterReport.programs[0].regionName;
  }, [costCenterReport]);

  // ── No data guard ──────────────────────────────────────────────────────────

  if (programMap.size === 0) {
    return (
      <div className="cost-center-reports">
        <div className="info-message">
          <p>No program/cost center data found in the uploaded file.</p>
          <p>Please ensure your CSV export includes a "PROGRAM" column from UKG.</p>
        </div>
      </div>
    );
  }

  const colSpan = showProgramColumn ? 8 : 7;

  return (
    <div className="cost-center-reports">

      {/* View mode toggle */}
      <div className="view-toggle">
        <button
          className={`view-toggle-btn${viewMode === 'overview' ? ' active' : ''}`}
          onClick={() => setViewMode('overview')}
        >
          Overview
        </button>
        <button
          className={`view-toggle-btn${viewMode === 'detail' ? ' active' : ''}`}
          onClick={() => setViewMode('detail')}
        >
          Detail
        </button>
      </div>

      <div className="controls-section">

        {/* Region filter */}
        {allRegions.length > 1 && (
          <div className="control-group">
            <label htmlFor="region-select">Filter by Region:</label>
            <select
              id="region-select"
              value={selectedRegion}
              onChange={(e) => handleRegionChange(e.target.value)}
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

        {/* Program multi-select checkbox panel — detail mode only */}
        {viewMode === 'detail' && <div className="control-group">
          <div className="course-filter-header">
            <label>Select Cost Centers / Programs:</label>
            <button
              className="filter-toggle-button"
              onClick={() => setShowProgramSelector(!showProgramSelector)}
            >
              {showProgramSelector ? '▼ Hide' : '▶ Show'} ({selectedPrograms.length} of {visibleCostCenters.length} selected)
            </button>
          </div>
          {showProgramSelector && (
            <div className="course-filter-panel">
              <div className="course-filter-actions">
                <button className="filter-action-button" onClick={selectAllVisible}>
                  Select All
                </button>
                <button className="filter-action-button" onClick={deselectAllVisible}>
                  Deselect All
                </button>
              </div>
              <div className="program-checkboxes">
                {visibleCostCenters.map(cc => (
                  <label key={cc.key} className="course-checkbox-label">
                    <input
                      type="checkbox"
                      checked={selectedPrograms.includes(cc.key)}
                      onChange={() => toggleProgram(cc.key)}
                    />
                    <span className="program-checkbox-name">
                      {cc.programName}
                      {cc.regionName && <span className="program-checkbox-region"> · {cc.regionName}</span>}
                      <span className="program-checkbox-count"> ({cc.employeeCount})</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>}

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

        {/* Export buttons — detail only */}
        {viewMode === 'detail' && (
          <div className="export-buttons">
            <button
              onClick={handleExportSelected}
              disabled={!costCenterReport}
              className="export-button"
            >
              Export Selected to Excel
            </button>
            <button
              onClick={handleExportAll}
              className="export-button secondary"
              title="Export every cost center to a single Excel file"
            >
              Export All Cost Centers
            </button>
          </div>
        )}
      </div>

      {/* ── Overview table ─────────────────────────────────────────── */}
      {viewMode === 'overview' && (
        <div className="overview-section">
          <div className="section-header">
            <h3>Cost Center Overview ({overviewRows.length})</h3>
          </div>
          <div className="table-container">
            <table className="team-table overview-table">
              <thead>
                <tr>
                  <th
                    className="sortable-th"
                    onClick={() => handleOverviewSort('name')}
                  >
                    Cost Center {overviewSortBy === 'name' ? (overviewSortDir === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th>Region</th>
                  <th
                    className="sortable-th number-cell"
                    onClick={() => handleOverviewSort('employees')}
                  >
                    Employees {overviewSortBy === 'employees' ? (overviewSortDir === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th className="number-cell">Enrollments</th>
                  <th className="number-cell">Completions</th>
                  <th
                    className="sortable-th"
                    onClick={() => handleOverviewSort('rate')}
                  >
                    Completion Rate {overviewSortBy === 'rate' ? (overviewSortDir === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {overviewRows.map(row => (
                  <tr key={row.key}>
                    <td className="name-cell">{row.programName}</td>
                    <td className="program-cell">{row.regionName || '—'}</td>
                    <td className="number-cell">{row.employees}</td>
                    <td className="number-cell">{row.enrollments}</td>
                    <td className="number-cell">{row.completions}</td>
                    <td className="rate-cell">
                      <div className="rate-bar-wrap">
                        <div
                          className={`rate-bar rate-bar-${getCompletionLevel(row.rate)}`}
                          style={{ width: `${row.rate}%` }}
                        />
                        <span className={`completion-badge completion-${getCompletionLevel(row.rate)}`}>
                          {row.rate}%
                        </span>
                      </div>
                    </td>
                    <td>
                      <button
                        className="detail-link-btn"
                        onClick={() => openDetail(row.key)}
                      >
                        View Detail →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {viewMode === 'detail' && costCenterReport && (
        <>
          {/* Summary stats */}
          <div className="report-summary">
            <h2>{reportTitle}</h2>
            {reportSubtitle && <p className="region-label">{reportSubtitle}</p>}
            {showProgramColumn && (
              <div className="selected-programs-list">
                {costCenterReport.programs.map(p => (
                  <span key={p.key} className="program-tag">{p.programName}</span>
                ))}
              </div>
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
                  {showProgramColumn && <option value="program">Program</option>}
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
                    {showProgramColumn && <th>Program</th>}
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
                        key={member.rowKey}
                        className={expandedMembers.has(member.rowKey) ? 'expanded' : ''}
                      >
                        <td>
                          {member.hasData && member.courses.length > 0 ? (
                            <button
                              className="expand-button"
                              onClick={() => toggleMemberExpansion(member.rowKey)}
                              aria-label={expandedMembers.has(member.rowKey) ? 'Collapse' : 'Expand'}
                            >
                              {expandedMembers.has(member.rowKey) ? '▼' : '▶'}
                            </button>
                          ) : (
                            <span className="no-data-indicator">—</span>
                          )}
                        </td>
                        <td className="name-cell">{member.displayName}</td>
                        <td className="email-cell">{member.email}</td>
                        {showProgramColumn && (
                          <td className="program-cell">{member.programName}</td>
                        )}
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
                        <td className="supervisor-cell">{member.supervisor || '—'}</td>
                      </tr>
                      {expandedMembers.has(member.rowKey) && member.hasData && (
                        <tr className="detail-row">
                          <td colSpan={colSpan}>
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
