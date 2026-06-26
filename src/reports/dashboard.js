/**
 * Overall Completion Dashboard report builder
 *
 * Produces an at-a-glance completion rate for every tracked course in two
 * scopes, reusing the existing config and matching logic so there is a single
 * source of truth for course names:
 *   - Core Trainings (All Staff)      — the org-wide REQUIRED_COURSES
 *   - Leadership Courses (Leaders)     — the LEADERSHIP_COURSES, scoped to the
 *                                        leader population (reuses getLeaders),
 *                                        honoring the Intro to Leadership
 *                                        pre-cutoff hire exemption.
 *
 * This is additive and independent of the Leadership Compliance report.
 */
import { getLeaders } from './leadership';
import { isCourseComplete, completionRate } from '../data/dataModel';
import { REQUIRED_COURSES } from '../config/courses';
import {
  LEADERSHIP_COURSES,
  INTRO_OMIT_CUTOFF,
  matchesTrackedCourse,
  isIntroToLeadership
} from '../config/leadershipCourses';

/**
 * Determine a person's hire date from their course records (first non-null
 * lastHireDate). Mirrors the leadership report's derivation.
 * @param {Array} courses
 * @returns {Date|null}
 */
function deriveHireDate(courses) {
  for (const course of courses || []) {
    if (course.lastHireDate) {
      return course.lastHireDate instanceof Date
        ? course.lastHireDate
        : new Date(course.lastHireDate);
    }
  }
  return null;
}

/**
 * Summarize one course over a population of people (each with a `courses` array).
 * Counts distinct people enrolled (≥1 matching record) and those who completed.
 * @param {Array} people - employee objects with a `courses` array
 * @param {string} courseName - tracked course name
 * @param {{isExempt?: (person: Object) => boolean}} [opts] - exclude exempt
 *   people from the enrolled/completed counts (i.e. from the denominator)
 * @returns {{course: string, enrolled: number, completed: number, completionRate: number}}
 */
function summarizeCourse(people, courseName, { isExempt } = {}) {
  let enrolled = 0;
  let completed = 0;

  people.forEach(person => {
    if (isExempt && isExempt(person)) return;

    const matches = (person.courses || []).filter(c =>
      matchesTrackedCourse(c.course, courseName)
    );
    if (matches.length === 0) return;

    enrolled++;
    if (matches.some(c => isCourseComplete(c))) completed++;
  });

  return {
    course: courseName,
    enrolled,
    completed,
    completionRate: completionRate(completed, enrolled, { mode: 'number1' })
  };
}

/**
 * Build the Overall Completion Dashboard.
 * @param {Object} hierarchy - Hierarchy from buildHierarchy
 * @returns {{
 *   coreTrainings: Array,
 *   leadershipCourses: Array,
 *   coreStaffCount: number,
 *   leaderCount: number
 * }}
 */
export function buildDashboardReport(hierarchy) {
  if (!hierarchy) {
    return { coreTrainings: [], leadershipCourses: [], coreStaffCount: 0, leaderCount: 0 };
  }

  // All staff = every employee with actual course data (placeholders excluded).
  const allStaff = [];
  hierarchy.employeeMap.forEach(employee => {
    if (employee.hasData) allStaff.push(employee);
  });

  // Leaders = anyone with direct reports (reuse the leadership population).
  const leaders = getLeaders(hierarchy);

  const coreTrainings = REQUIRED_COURSES.map(course =>
    summarizeCourse(allStaff, course)
  );

  const leadershipCourses = LEADERSHIP_COURSES.map(course => {
    // Intro to Leadership is exempt for leaders hired before the cutoff;
    // those leaders are excluded from the denominator entirely.
    const isExempt = isIntroToLeadership(course)
      ? (leader) => {
          const hireDate = deriveHireDate(leader.courses);
          return hireDate && hireDate < INTRO_OMIT_CUTOFF;
        }
      : null;
    return summarizeCourse(leaders, course, { isExempt });
  });

  return {
    coreTrainings,
    leadershipCourses,
    coreStaffCount: allStaff.length,
    leaderCount: leaders.length
  };
}
