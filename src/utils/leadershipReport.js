/**
 * Leadership compliance report builder
 *
 * Produces the data behind the Leadership Compliance tab and its Excel export:
 * the list of leaders (anyone with direct reports), each leader's status on the
 * tracked leadership/compliance courses, and cascade-based filtering/roll-up.
 */
import { getCascadingReports } from './supervisorHierarchy';
import {
  TRACKED_COURSES,
  INTRO_OMIT_CUTOFF,
  matchesTrackedCourse,
  isIntroToLeadership
} from './leadershipConfig';

/**
 * Course status values used throughout the report.
 * - 'complete'   : leader finished the course
 * - 'incomplete' : leader enrolled but has not finished
 * - 'missing'    : no enrollment found
 * - 'na'         : not applicable (e.g. Intro to Leadership omitted for recent hires)
 */

/**
 * Determine a leader's hire date from their course records.
 * Uses the first non-null lastHireDate found (the parser populates this from
 * the optional "Last Hire Date" column).
 * @param {Array} courses - Leader's course records
 * @returns {Date|null}
 */
function deriveHireDate(courses) {
  for (const course of courses) {
    if (course.lastHireDate) {
      return course.lastHireDate instanceof Date
        ? course.lastHireDate
        : new Date(course.lastHireDate);
    }
  }
  return null;
}

/**
 * Get all leaders (employees who have at least one direct report), returning
 * the full employee objects so callers have access to courses/allReports.
 * @param {Object} hierarchy - Hierarchy from buildHierarchy
 * @returns {Array} Leader employee objects
 */
export function getLeaders(hierarchy) {
  const leaders = [];
  hierarchy.employeeMap.forEach(employee => {
    if (employee.directReports && employee.directReports.size > 0) {
      leaders.push(employee);
    }
  });
  return leaders;
}

/**
 * Compute a leader's status for a single tracked course.
 * @param {Object} leaderCoursesByMatch - the leader's course records
 * @param {string} trackedCourse - tracked course name
 * @param {Date|null} hireDate - leader's hire date
 * @returns {{status: string, enrollment: Object|null}}
 */
function getCourseStatus(courses, trackedCourse, hireDate) {
  // Intro to Leadership is omitted for leaders hired on/after the cutoff.
  if (
    isIntroToLeadership(trackedCourse) &&
    hireDate &&
    hireDate >= INTRO_OMIT_CUTOFF
  ) {
    return { status: 'na', enrollment: null };
  }

  // Find any enrollment that matches this tracked course; prefer a completed one.
  const matches = courses.filter(c => matchesTrackedCourse(c.course, trackedCourse));
  if (matches.length === 0) {
    return { status: 'missing', enrollment: null };
  }

  const completed = matches.find(
    c => c.percentCompleted === 100 || c.dateCompleted
  );
  if (completed) {
    return { status: 'complete', enrollment: completed };
  }
  return { status: 'incomplete', enrollment: matches[0] };
}

/**
 * Build the per-leader compliance record.
 * @param {Object} leader - Leader employee object
 * @returns {Object}
 */
function buildLeaderRecord(leader) {
  const hireDate = deriveHireDate(leader.courses || []);

  const courseStatus = {};
  TRACKED_COURSES.forEach(tracked => {
    courseStatus[tracked] = getCourseStatus(leader.courses || [], tracked, hireDate);
  });

  // Compliance rate: completed / applicable (exclude 'na').
  const applicable = TRACKED_COURSES.filter(
    tracked => courseStatus[tracked].status !== 'na'
  );
  const completedCount = applicable.filter(
    tracked => courseStatus[tracked].status === 'complete'
  ).length;
  const missingCount = applicable.filter(
    tracked => courseStatus[tracked].status !== 'complete'
  ).length;
  const complianceRate = applicable.length > 0
    ? Number(((completedCount / applicable.length) * 100).toFixed(1))
    : 0;

  return {
    email: leader.email,
    displayName: leader.displayName,
    supervisors: leader.supervisors || [],
    directReportCount: leader.directReports ? leader.directReports.size : 0,
    totalReportCount: leader.allReports ? leader.allReports.size : 0,
    hireDate,
    hasData: leader.hasData,
    isPlaceholder: leader.isPlaceholder || false,
    courseStatus,
    applicableCount: applicable.length,
    completedCount,
    missingCount,
    complianceRate
  };
}

/**
 * Build the full leadership report: every leader and the tracked course set.
 * @param {Object} hierarchy - Hierarchy from buildHierarchy
 * @returns {{leaders: Array, trackedCourses: Array}}
 */
export function buildLeadershipReport(hierarchy) {
  if (!hierarchy) return { leaders: [], trackedCourses: TRACKED_COURSES };

  const leaders = getLeaders(hierarchy)
    .map(buildLeaderRecord)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  return { leaders, trackedCourses: TRACKED_COURSES };
}

/**
 * Suggest the top-of-org leader (the one with the most cascading reports,
 * e.g. the CEO/President) to use as the default cascade node.
 * @param {Array} leaders - Leader records from buildLeadershipReport
 * @returns {string|null} email of the top leader, or null
 */
export function getTopLeaderEmail(leaders) {
  if (!leaders || leaders.length === 0) return null;
  let top = leaders[0];
  leaders.forEach(leader => {
    if (leader.totalReportCount > top.totalReportCount) {
      top = leader;
    }
  });
  return top.email;
}

/**
 * Filter leaders to those within a top node's cascade (the node itself plus
 * every leader beneath it). Reuses getCascadingReports for the hierarchy walk.
 * @param {string} topEmail - email of the cascade root
 * @param {Object} hierarchy - Hierarchy from buildHierarchy
 * @param {Array} leaders - Leader records from buildLeadershipReport
 * @returns {Array} subset of leaders within the cascade
 */
export function getLeadersUnder(topEmail, hierarchy, leaders) {
  if (!topEmail) return leaders;

  const cascade = getCascadingReports(topEmail, hierarchy);
  const inCascade = new Set(cascade.map(emp => emp.email));
  inCascade.add(topEmail.toLowerCase());

  return leaders.filter(leader => inCascade.has(leader.email));
}

/**
 * Build a cascade roll-up for the selected leaders: for each selected leader,
 * summarize the leaders beneath them so weak branches surface.
 * @param {Array} selectedLeaders - Leader records that are selected
 * @param {Object} hierarchy - Hierarchy from buildHierarchy
 * @param {Map} leaderByEmail - Map of email -> leader record
 * @returns {Array} roll-up rows
 */
export function buildCascadeRollup(selectedLeaders, hierarchy, leaderByEmail) {
  return selectedLeaders.map(leader => {
    const cascade = getCascadingReports(leader.email, hierarchy);

    // Downstream people who are themselves leaders (have a leader record).
    const downstreamLeaders = cascade
      .map(emp => leaderByEmail.get(emp.email))
      .filter(Boolean);

    const branchLeaders = [leader, ...downstreamLeaders];
    const totalApplicable = branchLeaders.reduce((sum, l) => sum + l.applicableCount, 0);
    const totalCompleted = branchLeaders.reduce((sum, l) => sum + l.completedCount, 0);
    const branchComplianceRate = totalApplicable > 0
      ? Number(((totalCompleted / totalApplicable) * 100).toFixed(1))
      : 0;

    return {
      email: leader.email,
      displayName: leader.displayName,
      ownComplianceRate: leader.complianceRate,
      downstreamLeaderCount: downstreamLeaders.length,
      branchLeaderCount: branchLeaders.length,
      branchComplianceRate
    };
  });
}
