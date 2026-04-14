import { sortCoursesByPriority } from './courseConfig';

/**
 * Build a map of all unique employees from raw CSV data.
 * Keyed by lowercase email. Does not require a Supervisor column.
 * @param {Array} rawData - Parsed CSV records
 * @returns {Map<string, Object>} email -> employee object
 */
export function buildEmployeeMap(rawData) {
  const map = new Map();

  rawData.forEach(record => {
    const email = record.email.toLowerCase();
    const displayName =
      `${record.preferredFirstname || record.legalFirstname} ${record.lastname}`.trim();

    if (!map.has(email)) {
      map.set(email, {
        email,
        displayName,
        legalFirstname: record.legalFirstname,
        preferredFirstname: record.preferredFirstname,
        lastname: record.lastname,
        lastHireDate: record.lastHireDate || null,
        supervisor: record.supervisor || '',
        program: record.program || '',
        courses: []
      });
    }

    const emp = map.get(email);

    // Keep the most recent (non-null) hire date
    if (!emp.lastHireDate && record.lastHireDate) {
      emp.lastHireDate = record.lastHireDate;
    }

    emp.courses.push({
      course: record.course,
      percentCompleted: record.percentCompleted,
      enrolledAt: record.enrolledAt,
      dateCompleted: record.dateCompleted,
      lastHireDate: record.lastHireDate,
      daysToComplete: record.daysToComplete
    });
  });

  return map;
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
  const completedCourses = sortedCourses.filter(c => c.percentCompleted === 100).length;
  const completionRate = totalCourses > 0
    ? (completedCourses / totalCourses * 100).toFixed(1)
    : 0;

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
    completionRate
  };
}
