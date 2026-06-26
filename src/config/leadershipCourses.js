/**
 * Leadership compliance configuration
 *
 * Defines the leadership-specific courses we hold leaders accountable for,
 * combined with the org-wide Required/compliance courses. Edit LEADERSHIP_COURSES
 * each reporting cycle as the curriculum changes.
 */
import { REQUIRED_COURSES } from './courses';
import { isCourseComplete } from '../data/dataModel';

/**
 * Leadership-specific courses (in addition to the org-wide Required Courses).
 */
export const LEADERSHIP_COURSES = [
  'Introduction to Leadership',
  'Relationship-Based Leading'
];

/**
 * Display name of the Introduction to Leadership course used by the omit rule.
 * Must stay in sync with the LEADERSHIP_COURSES entry above so the exemption
 * matching recognizes the same course.
 */
export const INTRO_TO_LEADERSHIP = 'Introduction to Leadership';

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

/**
 * Whether a raw enrollment record is an Intro to Leadership enrollment that
 * should be EXCLUDED from all tracking. Intro to Leadership only applies to
 * people hired on/after the cutoff (Jan 1, 2025). For someone hired earlier:
 *   - if they have NOT completed it  -> exclude (it doesn't apply to them; it
 *     must not count as not-completed anywhere, and surfaces as N/A)
 *   - if they HAVE completed it      -> keep it, so it still counts as a
 *     completion.
 *
 * A record with no known hire date is NOT excluded (we can't prove the person
 * predates the requirement), matching the leadership report's 'na' rule.
 *
 * @param {Object} record - Raw CSV record ({ course, lastHireDate, ... })
 * @returns {boolean}
 */
export function isIntroExemptRecord(record) {
  if (!record || !isIntroToLeadership(record.course)) return false;
  const raw = record.lastHireDate;
  if (!raw) return false;
  const hire = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(hire.getTime())) return false;
  if (hire >= INTRO_OMIT_CUTOFF) return false;     // hired on/after cutoff -> applies
  return !isCourseComplete(record);                // pre-cutoff: drop only if not completed
}
