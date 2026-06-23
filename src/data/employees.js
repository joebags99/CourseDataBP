import { sortCoursesByPriority } from '../config/courses';
import { aggregateByEmail } from './aggregate';
import { buildDisplayName, mapCourseRecord, isCourseComplete, completionRate } from './dataModel';

/**
 * Build a map of all unique employees from raw CSV data.
 * Keyed by lowercase email. Does not require a Supervisor column.
 * @param {Array} rawData - Parsed CSV records
 * @returns {Map<string, Object>} email -> employee object
 */
export function buildEmployeeMap(rawData) {
  return aggregateByEmail(rawData, {
    identity: (record) => ({
      email: record.email.toLowerCase(),
      displayName: buildDisplayName(record, { trim: true }),
      legalFirstname: record.legalFirstname,
      preferredFirstname: record.preferredFirstname,
      lastname: record.lastname,
      lastHireDate: record.lastHireDate || null,
      supervisor: record.supervisor || '',
      program: record.program || ''
    }),
    mapCourse: mapCourseRecord,
    onRecord: (emp, record) => {
      // Keep the first (non-null) hire date encountered
      if (!emp.lastHireDate && record.lastHireDate) {
        emp.lastHireDate = record.lastHireDate;
      }
    }
  });
}

/**
 * Get a sorted list of all employees for display in the search dropdown.
 * @param {Map} employeeMap - From buildEmployeeMap
 * @returns {Array} Sorted array of { email, displayName }
 */
export function getAllEmployees(employeeMap) {
  return Array.from(employeeMap.values())
    .map(e => ({ email: e.email, displayName: e.displayName }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

/**
 * Get the full report data for one employee.
 * Courses are sorted: required first, then alphabetical.
 * @param {string} email - Lowercase email
 * @param {Map} employeeMap - From buildEmployeeMap
 * @returns {Object|null}
 */
export function getEmployeeReport(email, employeeMap) {
  const emp = employeeMap.get(email.toLowerCase());
  if (!emp) return null;

  const sortedCourses = sortCoursesByPriority(emp.courses);
  const totalCourses = sortedCourses.length;
  const completedCourses = sortedCourses.filter(c => isCourseComplete(c, { strict: true })).length;

  return {
    email: emp.email,
    displayName: emp.displayName,
    legalFirstname: emp.legalFirstname,
    lastname: emp.lastname,
    lastHireDate: emp.lastHireDate,
    supervisor: emp.supervisor,
    program: emp.program,
    courses: sortedCourses,
    totalCourses,
    completedCourses,
    completionRate: completionRate(completedCourses, totalCourses, { mode: 'fixed1' })
  };
}
