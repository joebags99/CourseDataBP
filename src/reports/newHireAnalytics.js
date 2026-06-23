import { aggregateByEmail } from '../data/aggregate';
import { buildDisplayName, isCourseComplete, completionRate } from '../data/dataModel';
import {
  ONBOARDING_REQUIRED_COURSES,
  isOnboardingRequiredCourse
} from '../config/onboarding';
import {
  calculateDaysSinceHire,
  getHireYear,
  isWithinOnboardingWindow,
  isPastOnboardingWindow
} from './hireDate';

/**
 * Get staff hired within a specific number of days
 * @param {Array} data - Training data
 * @param {Object} courseGroups - Course grouping data
 * @param {number} daysBack - Number of days to look back
 * @returns {Array} Staff data with hire info
 */
export function getRecentHires(data, courseGroups, daysBack) {
  const baseName = (record) => courseGroups[record.course]?.baseName || record.course;

  const staffMap = aggregateByEmail(data, {
    keyOf: (record) => record.email,
    skip: (record) => {
      if (!record.lastHireDate) return true;
      const days = calculateDaysSinceHire(record.lastHireDate);
      return days === null || days > daysBack;
    },
    identity: (record) => ({
      email: record.email,
      displayName: buildDisplayName(record),
      lastHireDate: record.lastHireDate,
      daysSinceHire: calculateDaysSinceHire(record.lastHireDate),
      requiredCourses: [],
      completedRequired: 0,
      totalRequired: ONBOARDING_REQUIRED_COURSES.length,
      totalEnrollments: 0,
      totalCompletions: 0
    }),
    onRecord: (staff, record) => {
      const courseName = baseName(record);
      const isCompleted = isCourseComplete(record);
      const isRequired = isOnboardingRequiredCourse(courseName);

      staff.courses.push({
        course: courseName,
        percentCompleted: record.percentCompleted,
        isCompleted,
        isRequired,
        enrolledAt: record.enrolledAt,
        dateCompleted: record.dateCompleted
      });

      staff.totalEnrollments++;
      if (isCompleted) {
        staff.totalCompletions++;
        if (isRequired) staff.completedRequired++;
      }

      if (isRequired) {
        staff.requiredCourses.push({
          course: courseName,
          isCompleted,
          percentCompleted: record.percentCompleted,
          enrolledAt: record.enrolledAt,
          dateCompleted: record.dateCompleted
        });
      }
    }
  });

  return Array.from(staffMap.values()).sort((a, b) =>
    a.daysSinceHire - b.daysSinceHire
  );
}

/**
 * Calculate compliance status for new hires
 * @param {Array} data - Training data
 * @param {Object} courseGroups - Course grouping data
 * @returns {Object} Compliance statistics
 */
export function calculateOnboardingCompliance(data, courseGroups) {
  const staffMap = new Map();

  // Collect all staff with hire dates
  data.forEach(record => {
    if (!record.lastHireDate) return;

    const staffKey = record.email;
    const courseName = courseGroups[record.course]?.baseName || record.course;
    const isRequired = isOnboardingRequiredCourse(courseName);
    const isCompleted = isCourseComplete(record);

    if (!staffMap.has(staffKey)) {
      staffMap.set(staffKey, {
        email: record.email,
        displayName: buildDisplayName(record),
        lastHireDate: record.lastHireDate,
        daysSinceHire: calculateDaysSinceHire(record.lastHireDate),
        requiredCoursesCompleted: new Set(),
        requiredCoursesEnrolled: new Set(),
        isWithinOnboarding: isWithinOnboardingWindow(record.lastHireDate),
        isPastOnboarding: isPastOnboardingWindow(record.lastHireDate)
      });
    }

    const staff = staffMap.get(staffKey);

    if (isRequired) {
      staff.requiredCoursesEnrolled.add(courseName);
      if (isCompleted) {
        staff.requiredCoursesCompleted.add(courseName);
      }
    }
  });

  const staffList = Array.from(staffMap.values());

  // Calculate compliance stats
  const compliant = staffList.filter(s =>
    s.requiredCoursesCompleted.size === ONBOARDING_REQUIRED_COURSES.length
  );

  const nonCompliantWithinWindow = staffList.filter(s =>
    s.isWithinOnboarding && s.requiredCoursesCompleted.size < ONBOARDING_REQUIRED_COURSES.length
  );

  const nonCompliantPastWindow = staffList.filter(s =>
    s.isPastOnboarding && s.requiredCoursesCompleted.size < ONBOARDING_REQUIRED_COURSES.length
  );

  return {
    totalStaff: staffList.length,
    compliant: compliant.length,
    nonCompliantWithinWindow: nonCompliantWithinWindow.length,
    nonCompliantPastWindow: nonCompliantPastWindow.length,
    complianceRate: completionRate(compliant.length, staffList.length, { mode: 'int' }),
    nonCompliantPastWindowList: nonCompliantPastWindow.map(s => ({
      ...s,
      missingCourses: ONBOARDING_REQUIRED_COURSES.filter(
        req => !Array.from(s.requiredCoursesCompleted).some(completed =>
          completed.toLowerCase().includes(req.toLowerCase())
        )
      )
    }))
  };
}

/**
 * Calculate cohort analysis by hire year
 * @param {Array} data - Training data
 * @param {Object} courseGroups - Course grouping data
 * @returns {Object} Cohort statistics by year
 */
export function calculateCohortAnalysis(data, courseGroups) {
  const cohorts = {};

  data.forEach(record => {
    if (!record.lastHireDate) return;

    const hireYear = getHireYear(record.lastHireDate);
    if (!hireYear || hireYear < 2020) return; // Only show recent hires

    const courseName = courseGroups[record.course]?.baseName || record.course;
    const isCompleted = isCourseComplete(record);

    if (!cohorts[hireYear]) {
      cohorts[hireYear] = {
        year: hireYear,
        staff: new Set(),
        enrollments: 0,
        completions: 0,
        completionRate: 0
      };
    }

    cohorts[hireYear].staff.add(record.email);
    cohorts[hireYear].enrollments++;
    if (isCompleted) {
      cohorts[hireYear].completions++;
    }
  });

  // Calculate completion rates
  Object.values(cohorts).forEach(cohort => {
    cohort.staffCount = cohort.staff.size;
    cohort.completionRate = completionRate(cohort.completions, cohort.enrollments, { mode: 'int' });
    delete cohort.staff; // Remove Set for cleaner output
  });

  return cohorts;
}

/**
 * Get staff with incomplete required courses past onboarding window
 * @param {Array} data - Training data
 * @param {Object} courseGroups - Course grouping data
 * @returns {Array} Non-compliant staff
 */
export function getNonCompliantStaff(data, courseGroups) {
  const compliance = calculateOnboardingCompliance(data, courseGroups);
  return compliance.nonCompliantPastWindowList;
}
