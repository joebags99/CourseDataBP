/**
 * Leadership compliance configuration
 *
 * Defines the leadership-specific courses we hold leaders accountable for,
 * combined with the org-wide Required/compliance courses. Edit LEADERSHIP_COURSES
 * each reporting cycle as the curriculum changes.
 */
import { REQUIRED_COURSES } from './courses';

/**
 * Leadership-specific courses (in addition to the org-wide Required Courses).
 */
export const LEADERSHIP_COURSES = [
  'Intro to Leadership',
  'Relationship-Based Leading'
];

/**
 * Exact display name of the Intro to Leadership course used by the omit rule.
 */
export const INTRO_TO_LEADERSHIP = 'Intro to Leadership';

/**
 * Leaders hired BEFORE this date are not held accountable for "Intro to
 * Leadership" (they predate the requirement / are grandfathered out). Leaders
 * hired on or after this date must take it. Example: a Dec 30 2024 hire is
 * exempt; a Jan 1 2025 hire is required.
 */
export const INTRO_OMIT_CUTOFF = new Date('2025-01-01');

/**
 * All courses tracked for leadership compliance: leadership-specific courses
 * plus the org-wide Required Courses, de-duplicated (case-insensitive).
 */
export const TRACKED_COURSES = (() => {
  const combined = [...LEADERSHIP_COURSES, ...REQUIRED_COURSES];
  const seen = new Set();
  const result = [];
  combined.forEach(course => {
    const key = course.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(course);
    }
  });
  return result;
})();

/**
 * Fuzzy, bidirectional name match (same approach as isRequiredCourse in
 * courseConfig.js) so versioned titles like "Manager Essentials (2025 update)"
 * still match the tracked course "Manager Essentials".
 * @param {string} courseName - Course name from the data
 * @param {string} trackedCourse - Tracked course name to compare against
 * @returns {boolean}
 */
export function matchesTrackedCourse(courseName, trackedCourse) {
  if (!courseName || !trackedCourse) return false;
  const a = courseName.toLowerCase();
  const b = trackedCourse.toLowerCase();
  return a.includes(b) || b.includes(a);
}

/**
 * Whether a course name refers to the Intro to Leadership course.
 * @param {string} courseName - Course name from the data
 * @returns {boolean}
 */
export function isIntroToLeadership(courseName) {
  return matchesTrackedCourse(courseName, INTRO_TO_LEADERSHIP);
}
