/**
 * New-hire onboarding configuration.
 *
 * NOTE: this required-course list is intentionally DISTINCT from the org-wide
 * REQUIRED_COURSES in ./courses.js. The New Hires onboarding report has always
 * used this shorter, loosely-matched list; it is kept separate (and clearly
 * named) so that report's numbers stay exactly as they were.
 */

/** Days a new hire has to complete onboarding-required courses. */
export const ONBOARDING_WINDOW_DAYS = 90;

/** Courses required for onboarding compliance (loose substring match). */
export const ONBOARDING_REQUIRED_COURSES = [
  'Trauma 101',
  'Workplace Safety'
];

/**
 * Whether a course satisfies an onboarding requirement.
 * Loose, one-directional match (course name contains the required name) —
 * preserved exactly from the original behavior.
 * @param {string} courseName
 * @returns {boolean}
 */
export function isOnboardingRequiredCourse(courseName) {
  return ONBOARDING_REQUIRED_COURSES.some(required =>
    courseName.toLowerCase().includes(required.toLowerCase())
  );
}
