import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { getStaffCompletionData } from '../reports/analytics';
import { exportToCSV } from '../export/csv';
import { useToggleSet } from '../hooks/useToggleSet';
import { useSortComparator } from '../hooks/useSortComparator';
import '../styles/StaffAnalysis.css';

export default function StaffAnalysis({ data, courseGroups, groupVersions, showRawNumbers }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [completionFilter, setCompletionFilter] = useState('all'); // 'all', 'completed', 'partial', 'notStarted'
  const { set: expandedStaff, toggle: toggleStaffExpansion } = useToggleSet();
  const { sortBy, setSortBy, comparator: sortComparator } = useSortComparator('name', {
    name: (a, b) => a.displayName.localeCompare(b.displayName),
    completionRate: (a, b) => b.completionRate - a.completionRate,
    courses: (a, b) => b.totalEnrollments - a.totalEnrollments,
  });

  const staffData = useMemo(
    () => getStaffCompletionData(data, courseGroups, groupVersions),
    [data, courseGroups, groupVersions]
  );

  const filteredStaff = useMemo(() => {
    let filtered = staffData;

    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        staff =>
          staff.displayName.toLowerCase().includes(search) ||
          staff.email.toLowerCase().includes(search)
      );
    }

    // Apply completion filter
    if (completionFilter !== 'all') {
      filtered = filtered.filter(staff => {
        if (completionFilter === 'completed') {
          return staff.completionRate === 100;
        } else if (completionFilter === 'partial') {
          return staff.completionRate > 0 && staff.completionRate < 100;
        } else if (completionFilter === 'notStarted') {
          return staff.completionRate === 0;
        }
        return true;
      });
    }

    // Apply sorting
    filtered.sort(sortComparator);

    return filtered;
  }, [staffData, searchTerm, completionFilter, sortComparator]);

  const exportStaffData = () => {
    const exportRows = filteredStaff.flatMap(staff =>
      staff.courses.map(course => ({
        Name: staff.displayName,
        Email: staff.email,
        Course: course.course,
        'Percent Completed': course.percentCompleted,
        'Enrolled At': course.enrolledAt ? format(course.enrolledAt, 'yyyy-MM-dd') : '',
        'Date Completed': course.dateCompleted ? format(course.dateCompleted, 'yyyy-MM-dd') : '',
        'Days to Complete': course.daysToComplete || '',
        Status: course.isCompleted ? 'Completed' : 'In Progress'
      }))
    );

    exportToCSV(exportRows, 'staff-analysis.csv');
  };

  const exportFilteredStaff = () => {
    const exportRows = filteredStaff.map(staff => ({
      Name: staff.displayName,
      Email: staff.email,
      'Total Enrollments': staff.totalEnrollments,
      'Total Completions': staff.totalCompletions,
      'Completion Rate (%)': staff.completionRate
    }));

    exportToCSV(exportRows, 'staff-summary.csv');
  };

  return (
    <div className="staff-analysis">
      <div className="section-header">
        <h2>Staff-Level Analysis</h2>
        <div className="header-controls">
          <button onClick={exportFilteredStaff} className="export-button">
            📥 Export Summary
          </button>
          <button onClick={exportStaffData} className="export-button">
            📥 Export Details
          </button>
        </div>
      </div>

      <div className="filters-bar">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <select
          value={completionFilter}
          onChange={(e) => setCompletionFilter(e.target.value)}
          className="filter-select"
        >
          <option value="all">All Staff</option>
          <option value="completed">100% Complete</option>
          <option value="partial">Partial Completion</option>
          <option value="notStarted">Not Started (0%)</option>
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="filter-select"
        >
          <option value="name">Sort by Name</option>
          <option value="completionRate">Sort by Completion Rate</option>
          <option value="courses">Sort by # of Courses</option>
        </select>

        <div className="results-count">
          Showing {filteredStaff.length} of {staffData.length} staff
        </div>
      </div>

      <div className="staff-table-container">
        <table className="staff-table">
          <thead>
            <tr>
              <th></th>
              <th>Name</th>
              <th>Email</th>
              <th>Courses</th>
              <th>Completed</th>
              <th>Completion Rate</th>
            </tr>
          </thead>
          <tbody>
            {filteredStaff.map(staff => (
              <>
                <tr
                  key={staff.email}
                  className="staff-row"
                  onClick={() => toggleStaffExpansion(staff.email)}
                >
                  <td className="expand-cell">
                    <button className="expand-button">
                      {expandedStaff.has(staff.email) ? '▼' : '▶'}
                    </button>
                  </td>
                  <td className="staff-name">{staff.displayName}</td>
                  <td className="staff-email">{staff.email}</td>
                  <td>{staff.totalEnrollments}</td>
                  <td>{staff.totalCompletions}</td>
                  <td>
                    <div className="completion-cell">
                      <div className="completion-bar-container">
                        <div
                          className="completion-bar-fill"
                          style={{
                            width: `${staff.completionRate}%`,
                            backgroundColor: getCompletionColor(staff.completionRate)
                          }}
                        />
                      </div>
                      <span className="completion-percentage">
                        {showRawNumbers
                          ? `${staff.totalCompletions}/${staff.totalEnrollments}`
                          : `${staff.completionRate}%`}
                      </span>
                    </div>
                  </td>
                </tr>

                {expandedStaff.has(staff.email) && (
                  <tr className="expanded-row">
                    <td colSpan="6">
                      <div className="course-details">
                        <h4>Course Enrollment Details</h4>
                        <table className="course-details-table">
                          <thead>
                            <tr>
                              <th>Course</th>
                              <th>Status</th>
                              <th>% Complete</th>
                              <th>Enrolled</th>
                              <th>Completed</th>
                              <th>Days to Complete</th>
                            </tr>
                          </thead>
                          <tbody>
                            {staff.courses.map((course, idx) => (
                              <tr key={idx}>
                                <td>{course.course}</td>
                                <td>
                                  <span className={`status-badge ${course.isCompleted ? 'completed' : 'in-progress'}`}>
                                    {course.isCompleted ? '✓ Completed' : '⏳ In Progress'}
                                  </span>
                                </td>
                                <td>{course.percentCompleted}%</td>
                                <td>
                                  {course.enrolledAt ? format(course.enrolledAt, 'MMM dd, yyyy') : '-'}
                                </td>
                                <td>
                                  {course.dateCompleted ? format(course.dateCompleted, 'MMM dd, yyyy') : '-'}
                                </td>
                                <td>{course.daysToComplete !== null ? `${course.daysToComplete} days` : '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>

        {filteredStaff.length === 0 && (
          <div className="empty-state">
            <p>No staff members match the current filters</p>
          </div>
        )}
      </div>
    </div>
  );
}

function getCompletionColor(rate) {
  if (rate === 100) return '#10B981'; // Green
  if (rate >= 70) return '#00C49F'; // Teal
  if (rate >= 40) return '#FFBB28'; // Yellow
  return '#FF8042'; // Orange
}
