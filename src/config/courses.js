/**
 * Required/compliance courses that must be completed
 */
export const REQUIRED_COURSES = [
  'Workplace Safety 101',
  'Trauma 101',
  'Foundations of Cultural Awareness'
];

/**
 * Check if a course is required/compliance
 * @param {string} courseName - Name of the course
 * @returns {boolean} True if course is required
 */
export function isRequiredCourse(courseName) {
  return REQUIRED_COURSES.some(reqCourse =>
    courseName.toLowerCase().includes(reqCourse.toLowerCase()) ||
    reqCourse.toLowerCase().includes(courseName.toLowerCase())
  );
}

/**
 * Add asterisk to required course names
 * @param {string} courseName - Name of the course
 * @returns {string} Course name with asterisk if required
 */
export function formatCourseName(courseName) {
  return isRequiredCourse(courseName) ? `${courseName} *` : courseName;
}

/**
 * Sort courses with required courses first, then alphabetical
 * @param {Array} courses - Array of course objects
 * @returns {Array} Sorted array
 */
export function sortCoursesByPriority(courses) {
  return [...courses].sort((a, b) => {
    const aRequired = isRequiredCourse(a.course);
    const bRequired = isRequiredCourse(b.course);

    // Required courses come first
    if (aRequired && !bRequired) return -1;
    if (!aRequired && bRequired) return 1;

    // Within same priority, sort alphabetically
    return a.course.localeCompare(b.course);
  });
}
