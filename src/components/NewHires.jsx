import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import {
  getRecentHires,
  calculateOnboardingCompliance,
  calculateCohortAnalysis,
  getNonCompliantStaff
} from '../reports/newHireAnalytics';
import { ONBOARDING_REQUIRED_COURSES as REQUIRED_COURSES, ONBOARDING_WINDOW_DAYS } from '../config/onboarding';
import { exportToCSV } from '../export/csv';
import '../styles/NewHires.css';

export default function NewHires({ data, courseGroups, groupVersions, showRawNumbers }) {
  const [daysFilter, setDaysFilter] = useState(90);
  const [expandedStaff, setExpandedStaff] = useState(new Set());
  const [nonCompliantSearch, setNonCompliantSearch] = useState('');
  const [missingCourseFilter, setMissingCourseFilter] = useState('all');
  const [nonCompliantSort, setNonCompliantSort] = useState('days');
  const [hireYearCutoff, setHireYearCutoff] = useState(null); // null = no filter

  // Debug: Check how many records have hire dates
  console.log('NewHires - Total records:', data.length);
  const recordsWithHireDate = data.filter(r => r.lastHireDate !== null);
  console.log('NewHires - Records with hire date:', recordsWithHireDate.length);
  if (recordsWithHireDate.length > 0) {
    console.log('NewHires - First hire date example:', recordsWithHireDate[0].lastHireDate);
  }

  // Filter data by hire year cutoff
  const filteredData = useMemo(() => {
    if (!hireYearCutoff) {
      return data; // No filter applied
    }

    return data.filter(record => {
      if (!record.lastHireDate) {
        return true; // Keep records without hire date
      }
      const hireYear = record.lastHireDate.getFullYear();
      return hireYear >= hireYearCutoff;
    });
  }, [data, hireYearCutoff]);

  // Count excluded records for display
  const excludedCount = useMemo(() => {
    if (!hireYearCutoff) return 0;
    return data.filter(record => {
      if (!record.lastHireDate) return false;
      return record.lastHireDate.getFullYear() < hireYearCutoff;
    }).length;
  }, [data, hireYearCutoff]);

  // Recent hires within selected timeframe
  const recentHires = useMemo(
    () => {
      const hires = getRecentHires(filteredData, courseGroups, daysFilter);
      console.log('NewHires - Recent hires found:', hires.length, 'for days filter:', daysFilter);
      return hires;
    },
    [filteredData, courseGroups, daysFilter]
  );

  // Compliance statistics
  const complianceStats = useMemo(
    () => {
      const stats = calculateOnboardingCompliance(filteredData, courseGroups);
      console.log('NewHires - Compliance stats:', stats);
      return stats;
    },
    [filteredData, courseGroups]
  );

  // Cohort analysis
  const cohortData = useMemo(() => {
    const cohorts = calculateCohortAnalysis(filteredData, courseGroups);
    return Object.values(cohorts).sort((a, b) => a.year - b.year);
  }, [filteredData, courseGroups]);

  // Non-compliant staff
  const nonCompliantStaff = useMemo(
    () => getNonCompliantStaff(filteredData, courseGroups),
    [filteredData, courseGroups]
  );

  // Filtered and sorted non-compliant staff
  const filteredNonCompliantStaff = useMemo(() => {
    let filtered = [...nonCompliantStaff];

    // Apply search filter
    if (nonCompliantSearch.trim() !== '') {
      const searchLower = nonCompliantSearch.toLowerCase();
      filtered = filtered.filter(staff =>
        staff.displayName.toLowerCase().includes(searchLower) ||
        staff.email.toLowerCase().includes(searchLower)
      );
    }

    // Apply missing course filter
    if (missingCourseFilter !== 'all') {
      filtered = filtered.filter(staff =>
        staff.missingCourses.some(course =>
          course.toLowerCase().includes(missingCourseFilter.toLowerCase())
        )
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (nonCompliantSort) {
        case 'name':
          return a.displayName.localeCompare(b.displayName);
        case 'days':
          return b.daysSinceHire - a.daysSinceHire; // Most days first
        case 'courses':
          return b.missingCourses.length - a.missingCourses.length; // Most missing first
        default:
          return 0;
      }
    });

    return filtered;
  }, [nonCompliantStaff, nonCompliantSearch, missingCourseFilter, nonCompliantSort]);

  const toggleExpanded = (email) => {
    const newExpanded = new Set(expandedStaff);
    if (newExpanded.has(email)) {
      newExpanded.delete(email);
    } else {
      newExpanded.add(email);
    }
    setExpandedStaff(newExpanded);
  };

  const exportRecentHires = () => {
    const exportData = recentHires.map(staff => ({
      Name: staff.displayName,
      Email: staff.email,
      'Hire Date': format(staff.lastHireDate, 'yyyy-MM-dd'),
      'Days Since Hire': staff.daysSinceHire,
      'Required Completed': `${staff.completedRequired}/${staff.totalRequired}`,
      'Total Enrollments': staff.totalEnrollments,
      'Total Completions': staff.totalCompletions
    }));

    exportToCSV(exportData, `new-hires-${daysFilter}-days.csv`);
  };

  const exportNonCompliant = () => {
    const exportData = nonCompliantStaff.map(staff => ({
      Name: staff.displayName,
      Email: staff.email,
      'Hire Date': format(staff.lastHireDate, 'yyyy-MM-dd'),
      'Days Since Hire': staff.daysSinceHire,
      'Missing Courses': staff.missingCourses.join(', ')
    }));

    exportToCSV(exportData, 'non-compliant-staff.csv');
  };

  return (
    <div className="new-hires">
      <h2>New Hire Onboarding & Compliance</h2>

      {/* Hire Year Filter */}
      <div className="hire-year-filter-section">
        <div className="filter-header">
          <label htmlFor="hire-year-cutoff">
            <strong>Exclude staff hired before:</strong>
          </label>
          <select
            id="hire-year-cutoff"
            value={hireYearCutoff || ''}
            onChange={(e) => setHireYearCutoff(e.target.value ? parseInt(e.target.value) : null)}
            className="year-cutoff-select"
          >
            <option value="">No Filter (Show All)</option>
            <option value="2000">2000</option>
            <option value="2005">2005</option>
            <option value="2010">2010</option>
            <option value="2015">2015</option>
            <option value="2020">2020</option>
          </select>
        </div>
        {excludedCount > 0 && (
          <div className="exclusion-notice">
            ℹ️ Excluding {excludedCount} staff member{excludedCount !== 1 ? 's' : ''} hired before {hireYearCutoff}
          </div>
        )}
      </div>

      {/* Compliance Summary */}
      <div className="compliance-summary">
        <div className="summary-cards">
          <div className="summary-card compliant">
            <div className="card-icon">✅</div>
            <div className="card-content">
              <div className="card-value">{complianceStats.compliant}</div>
              <div className="card-label">Fully Compliant</div>
            </div>
          </div>

          <div className="summary-card warning">
            <div className="card-icon">⏳</div>
            <div className="card-content">
              <div className="card-value">{complianceStats.nonCompliantWithinWindow}</div>
              <div className="card-label">Within {ONBOARDING_WINDOW_DAYS} Days</div>
            </div>
          </div>

          <div className="summary-card alert">
            <div className="card-icon">⚠️</div>
            <div className="card-content">
              <div className="card-value">{complianceStats.nonCompliantPastWindow}</div>
              <div className="card-label">Past {ONBOARDING_WINDOW_DAYS} Days (Action Needed)</div>
            </div>
          </div>

          <div className="summary-card info">
            <div className="card-icon">📊</div>
            <div className="card-content">
              <div className="card-value">{complianceStats.complianceRate}%</div>
              <div className="card-label">Overall Compliance Rate</div>
            </div>
          </div>
        </div>

        <div className="required-courses-info">
          <strong>Required Courses:</strong> {REQUIRED_COURSES.join(', ')}
        </div>
      </div>

      {/* Non-Compliant Alerts */}
      {nonCompliantStaff.length > 0 && (
        <div className="non-compliant-section">
          <div className="section-header">
            <h3>⚠️ Staff Past {ONBOARDING_WINDOW_DAYS} Days with Incomplete Required Training</h3>
            <button onClick={exportNonCompliant} className="export-button">
              📥 Export List
            </button>
          </div>

          <div className="filter-controls">
            <input
              type="text"
              placeholder="Search by name or email..."
              value={nonCompliantSearch}
              onChange={(e) => setNonCompliantSearch(e.target.value)}
              className="search-input"
            />
            <select
              value={missingCourseFilter}
              onChange={(e) => setMissingCourseFilter(e.target.value)}
              className="course-filter"
            >
              <option value="all">All Missing Courses</option>
              <option value="trauma">Missing Trauma 101</option>
              <option value="workplace">Missing Workplace Safety</option>
            </select>
            <select
              value={nonCompliantSort}
              onChange={(e) => setNonCompliantSort(e.target.value)}
              className="sort-select"
            >
              <option value="days">Sort by Days (Most First)</option>
              <option value="name">Sort by Name</option>
              <option value="courses">Sort by Missing Courses</option>
            </select>
          </div>

          {filteredNonCompliantStaff.length === 0 ? (
            <div className="empty-state">
              <p>No staff match the selected filters</p>
            </div>
          ) : (
            <div className="alert-list">
              {filteredNonCompliantStaff.map(staff => (
              <div key={staff.email} className="alert-card">
                <div className="alert-header">
                  <div>
                    <strong>{staff.displayName}</strong>
                    <span className="email-text">{staff.email}</span>
                  </div>
                  <div className="alert-meta">
                    <span className="days-badge">{staff.daysSinceHire} days since hire</span>
                    <span className="hired-date">
                      Hired: {format(staff.lastHireDate, 'MMM dd, yyyy')}
                    </span>
                  </div>
                </div>
                <div className="missing-courses">
                  <strong>Missing:</strong> {staff.missingCourses.join(', ')}
                </div>
              </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Cohort Analysis */}
      <div className="cohort-section">
        <h3>Cohort Analysis: Completion Rates by Hire Year</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={cohortData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="year" />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Legend />
            <Bar dataKey="completionRate" fill="#00C49F" name="Completion Rate (%)" />
          </BarChart>
        </ResponsiveContainer>

        <div className="cohort-table">
          <table>
            <thead>
              <tr>
                <th>Hire Year</th>
                <th>Staff Count</th>
                <th>Total Enrollments</th>
                <th>Completions</th>
                <th>Completion Rate</th>
              </tr>
            </thead>
            <tbody>
              {cohortData.map(cohort => (
                <tr key={cohort.year}>
                  <td>{cohort.year}</td>
                  <td>{cohort.staffCount}</td>
                  <td>{cohort.enrollments}</td>
                  <td>{cohort.completions}</td>
                  <td>
                    <span className={`rate-badge ${getRateBadge(cohort.completionRate)}`}>
                      {showRawNumbers
                        ? `${cohort.completions}/${cohort.enrollments}`
                        : `${cohort.completionRate}%`}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Hires */}
      <div className="recent-hires-section">
        <div className="section-header">
          <h3>Recent Hires</h3>
          <div className="controls">
            <select
              value={daysFilter}
              onChange={(e) => setDaysFilter(Number(e.target.value))}
              className="days-filter"
            >
              <option value={30}>Last 30 Days</option>
              <option value={60}>Last 60 Days</option>
              <option value={90}>Last 90 Days</option>
              <option value={180}>Last 180 Days</option>
              <option value={365}>Last Year</option>
            </select>
            <button onClick={exportRecentHires} className="export-button">
              📥 Export
            </button>
          </div>
        </div>

        {recentHires.length === 0 ? (
          <div className="empty-state">
            <p>No staff hired in the last {daysFilter} days</p>
          </div>
        ) : (
          <div className="recent-hires-table">
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th>Name</th>
                  <th>Hire Date</th>
                  <th>Days Since Hire</th>
                  <th>Required Training</th>
                  <th>All Courses</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentHires.map(staff => (
                  <>
                    <tr
                      key={staff.email}
                      className="staff-row"
                      onClick={() => toggleExpanded(staff.email)}
                    >
                      <td>
                        <button className="expand-button">
                          {expandedStaff.has(staff.email) ? '▼' : '▶'}
                        </button>
                      </td>
                      <td className="staff-name">{staff.displayName}</td>
                      <td>{format(staff.lastHireDate, 'MMM dd, yyyy')}</td>
                      <td>{staff.daysSinceHire} days</td>
                      <td>
                        <span className={`required-badge ${staff.completedRequired === staff.totalRequired ? 'complete' : 'incomplete'}`}>
                          {staff.completedRequired}/{staff.totalRequired}
                        </span>
                      </td>
                      <td>{staff.totalCompletions}/{staff.totalEnrollments}</td>
                      <td>
                        <span className={`status-badge ${getStatusBadge(staff)}`}>
                          {getStatusText(staff)}
                        </span>
                      </td>
                    </tr>

                    {expandedStaff.has(staff.email) && (
                      <tr className="expanded-row">
                        <td colSpan="7">
                          <div className="expanded-content">
                            <h4>Course Details</h4>
                            <div className="course-grid">
                              {staff.requiredCourses.map((course, idx) => (
                                <div key={idx} className={`course-card ${course.isCompleted ? 'completed' : 'incomplete'} required`}>
                                  <div className="course-header">
                                    <span className="course-name">{course.course}</span>
                                    <span className="required-tag">REQUIRED</span>
                                  </div>
                                  <div className="course-status">
                                    {course.isCompleted ? (
                                      <>
                                        <span className="status-icon">✅</span>
                                        <span>Completed {course.dateCompleted ? format(course.dateCompleted, 'MMM dd, yyyy') : ''}</span>
                                      </>
                                    ) : (
                                      <>
                                        <span className="status-icon">⏳</span>
                                        <span>{course.percentCompleted}% Complete</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              ))}

                              {staff.courses.filter(c => !c.isRequired).map((course, idx) => (
                                <div key={`optional-${idx}`} className={`course-card ${course.isCompleted ? 'completed' : 'incomplete'}`}>
                                  <div className="course-header">
                                    <span className="course-name">{course.course}</span>
                                  </div>
                                  <div className="course-status">
                                    {course.isCompleted ? (
                                      <>
                                        <span className="status-icon">✅</span>
                                        <span>Completed</span>
                                      </>
                                    ) : (
                                      <>
                                        <span className="status-icon">⏳</span>
                                        <span>{course.percentCompleted}% Complete</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function getRateBadge(rate) {
  if (rate >= 80) return 'high';
  if (rate >= 60) return 'medium';
  return 'low';
}

function getStatusBadge(staff) {
  if (staff.completedRequired === staff.totalRequired) return 'compliant';
  if (staff.daysSinceHire <= ONBOARDING_WINDOW_DAYS) return 'in-progress';
  return 'overdue';
}

function getStatusText(staff) {
  if (staff.completedRequired === staff.totalRequired) return 'Compliant';
  if (staff.daysSinceHire <= ONBOARDING_WINDOW_DAYS) return 'In Progress';
  return 'Overdue';
}
