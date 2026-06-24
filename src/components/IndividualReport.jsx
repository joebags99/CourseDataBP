import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { buildEmployeeMap, getAllEmployees, getEmployeeReport } from '../data/employees';
import { isRequiredCourse } from '../config/courses';
import { exportIndividualReportToExcel } from '../export/excel';
import '../styles/IndividualReport.css';

const FEEDBACK_FORM_URL = 'https://forms.office.com/r/qBfrHWQdAK';

export default function IndividualReport({ data }) {
  const [search, setSearch] = useState('');
  const [selectedEmail, setSelectedEmail] = useState('');

  // Build employee map once
  const employeeMap = useMemo(() => {
    if (data.length === 0) return new Map();
    return buildEmployeeMap(data);
  }, [data]);

  const allEmployees = useMemo(() => getAllEmployees(employeeMap), [employeeMap]);

  // Filter employees by search text
  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allEmployees;
    return allEmployees.filter(
      e =>
        e.displayName.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q)
    );
  }, [allEmployees, search]);

  // Report for the selected employee
  const report = useMemo(() => {
    if (!selectedEmail) return null;
    return getEmployeeReport(selectedEmail, employeeMap);
  }, [selectedEmail, employeeMap]);

  const handleSelectEmployee = (email) => {
    setSelectedEmail(email);
    // Put the chosen name in the search box and clear the dropdown
    const emp = employeeMap.get(email);
    if (emp) setSearch(emp.displayName);
  };

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setSelectedEmail(''); // clear report while typing
  };

  const handleExport = () => {
    if (report) exportIndividualReportToExcel(report);
  };

  if (data.length === 0) {
    return (
      <div className="individual-report">
        <div className="info-message">
          <p>No data loaded yet.</p>
        </div>
      </div>
    );
  }

  // Show dropdown list only when typing and no employee is selected yet
  const showDropdown = search.trim() !== '' && !selectedEmail && filteredEmployees.length > 0;

  return (
    <div className="individual-report">
      {/* Search / select */}
      <div className="ir-search-section">
        <label htmlFor="ir-search" className="ir-search-label">
          Search for an employee:
        </label>
        <div className="ir-search-wrapper">
          <input
            id="ir-search"
            type="text"
            className="ir-search-input"
            placeholder="Type a name or email…"
            value={search}
            onChange={handleSearchChange}
            autoComplete="off"
          />
          {showDropdown && (
            <ul className="ir-dropdown">
              {filteredEmployees.slice(0, 50).map(emp => (
                <li
                  key={emp.email}
                  className="ir-dropdown-item"
                  onMouseDown={() => handleSelectEmployee(emp.email)}
                >
                  <span className="ir-dropdown-name">{emp.displayName}</span>
                  <span className="ir-dropdown-email">{emp.email}</span>
                </li>
              ))}
              {filteredEmployees.length > 50 && (
                <li className="ir-dropdown-more">
                  {filteredEmployees.length - 50} more — keep typing to narrow results
                </li>
              )}
            </ul>
          )}
        </div>
        {selectedEmail && (
          <button
            className="ir-clear-button"
            onClick={() => { setSearch(''); setSelectedEmail(''); }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Report card */}
      {report && (
        <div className="ir-report-card">
          {/* Header */}
          <div className="ir-report-header">
            <div className="ir-report-header-left">
              <h2 className="ir-report-title">My Status Report</h2>
              <div className="ir-employee-info">
                <div className="ir-employee-name">{report.displayName}</div>
                <div className="ir-employee-email">{report.email}</div>
                {report.lastHireDate && (
                  <div className="ir-employee-meta">
                    Date Hired: {format(new Date(report.lastHireDate), 'MM/dd/yyyy')}
                  </div>
                )}
                {report.program && (
                  <div className="ir-employee-meta">Program: {report.program}</div>
                )}
              </div>
            </div>

            <div className="ir-report-header-right">
              <div className="ir-completion-ring">
                <svg viewBox="0 0 36 36" className="ir-ring-svg">
                  <path
                    className="ir-ring-bg"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className={`ir-ring-fill rate-${getRateClass(report.completionRate)}`}
                    strokeDasharray={`${report.completionRate}, 100`}
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="ir-ring-label">
                  <span className="ir-ring-pct">{report.completionRate}%</span>
                  <span className="ir-ring-sub">complete</span>
                </div>
              </div>
              <div className="ir-header-stats">
                <div className="ir-header-stat">
                  <span className="ir-header-stat-value">{report.completedCourses}</span>
                  <span className="ir-header-stat-label">of {report.totalCourses} completed</span>
                </div>
              </div>
            </div>
          </div>

          {/* Feedback section */}
          <div className="ir-feedback-section">
            <span className="ir-feedback-label">Was this report helpful?</span>
            <a href={FEEDBACK_FORM_URL} target="_blank" rel="noopener noreferrer" className="ir-feedback-link yes">
              Yes
            </a>
            <a href={FEEDBACK_FORM_URL} target="_blank" rel="noopener noreferrer" className="ir-feedback-link no">
              No
            </a>
          </div>

          {/* Course table */}
          <div className="ir-courses-section">
            <table className="ir-course-table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>% Completed</th>
                  <th>Date Hired</th>
                  <th>Date Completed</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {report.courses.map((course, idx) => {
                  const required = isRequiredCourse(course.course);
                  return (
                    <tr key={idx} className={required ? 'required-row' : ''}>
                      <td className="ir-course-name">
                        {course.course}
                        {required && <span className="ir-required-star" title="Required/Compliance Course"> *</span>}
                      </td>
                      <td className="ir-pct-cell">{course.percentCompleted}%</td>
                      <td>
                        {course.lastHireDate
                          ? format(new Date(course.lastHireDate), 'MM/dd/yyyy')
                          : '—'}
                      </td>
                      <td>
                        {course.dateCompleted
                          ? format(new Date(course.dateCompleted), 'MM/dd/yyyy')
                          : '—'}
                      </td>
                      <td>
                        <span className={`ir-status-badge ${course.percentCompleted === 100 ? 'completed' : 'in-progress'}`}>
                          {course.percentCompleted === 100 ? 'Completed' : 'In Progress'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="ir-legend">* Required / Compliance Course</p>
          </div>

          {/* Export */}
          <div className="ir-export-row">
            <button className="ir-export-button" onClick={handleExport}>
              📥 Export to Excel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function getRateClass(rate) {
  const n = parseFloat(rate);
  if (n === 100) return 'high';
  if (n >= 70) return 'medium';
  if (n > 0) return 'low';
  return 'none';
}
