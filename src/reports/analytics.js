import { format, getYear, startOfMonth } from 'date-fns';
import { aggregateByEmail } from '../data/aggregate';
import { buildDisplayName, isCourseComplete, completionRate } from '../data/dataModel';

/**
 * Calculate year-over-year statistics for courses
 * @param {Array} data - Training data
 * @param {Object} courseGroups - Course grouping data
 * @param {boolean} groupVersions - Whether to group course versions
 * @returns {Object} YoY statistics by course and year
 */
export function calculateYearOverYear(data, courseGroups, groupVersions = true) {
  const stats = {};

  data.forEach(record => {
    const courseName = groupVersions
      ? courseGroups[record.course]?.baseName || record.course
      : record.course;

    if (!stats[courseName]) {
      stats[courseName] = {};
    }

    // Process enrollment year
    if (record.enrolledAt) {
      const enrollYear = getYear(record.enrolledAt);

      // Filter out 2021 and 2022 data
      if (enrollYear < 2023) {
        return;
      }

      if (!stats[courseName][enrollYear]) {
        stats[courseName][enrollYear] = {
          year: enrollYear,
          totalEnrollments: 0,
          totalCompletions: 0,
          completionRate: 0,
          averageDaysToComplete: 0,
          daysToCompleteSum: 0,
          daysToCompleteCount: 0
        };
      }

      stats[courseName][enrollYear].totalEnrollments++;

      if (isCourseComplete(record)) {
        stats[courseName][enrollYear].totalCompletions++;

        if (record.daysToComplete !== null) {
          stats[courseName][enrollYear].daysToCompleteSum += record.daysToComplete;
          stats[courseName][enrollYear].daysToCompleteCount++;
        }
      }
    }
  });

  // Calculate completion rates and averages
  Object.keys(stats).forEach(course => {
    Object.keys(stats[course]).forEach(year => {
      const yearStats = stats[course][year];
      yearStats.completionRate = completionRate(
        yearStats.totalCompletions, yearStats.totalEnrollments, { mode: 'int' }
      );

      yearStats.averageDaysToComplete = yearStats.daysToCompleteCount > 0
        ? Math.round(yearStats.daysToCompleteSum / yearStats.daysToCompleteCount)
        : 0;
    });
  });

  return stats;
}

/**
 * Calculate monthly completion trends
 * @param {Array} data - Training data
 * @param {Object} courseGroups - Course grouping data
 * @param {boolean} groupVersions - Whether to group course versions
 * @returns {Array} Monthly trend data
 */
export function calculateMonthlyTrends(data, courseGroups, groupVersions = true) {
  const monthlyStats = {};

  data.forEach(record => {
    if (!record.dateCompleted) return;

    const courseName = groupVersions
      ? courseGroups[record.course]?.baseName || record.course
      : record.course;

    const monthKey = format(startOfMonth(record.dateCompleted), 'yyyy-MM');

    if (!monthlyStats[monthKey]) {
      monthlyStats[monthKey] = {
        month: monthKey,
        date: startOfMonth(record.dateCompleted),
        totalCompletions: 0,
        courses: {}
      };
    }

    monthlyStats[monthKey].totalCompletions++;

    if (!monthlyStats[monthKey].courses[courseName]) {
      monthlyStats[monthKey].courses[courseName] = 0;
    }

    monthlyStats[monthKey].courses[courseName]++;
  });

  // Convert to array and sort by date
  return Object.values(monthlyStats).sort((a, b) => a.date - b.date);
}

/**
 * Identify courses with low completion rates
 * @param {Array} data - Training data
 * @param {Object} courseGroups - Course grouping data
 * @param {number} threshold - Completion rate threshold (default 70%)
 * @param {boolean} groupVersions - Whether to group course versions
 * @returns {Array} Courses below threshold
 */
export function identifyLowCompletionCourses(data, courseGroups, threshold = 70, groupVersions = true) {
  const courseStats = {};

  data.forEach(record => {
    const courseName = groupVersions
      ? courseGroups[record.course]?.baseName || record.course
      : record.course;

    if (!courseStats[courseName]) {
      courseStats[courseName] = {
        course: courseName,
        enrollments: 0,
        completions: 0,
        completionRate: 0
      };
    }

    courseStats[courseName].enrollments++;

    if (isCourseComplete(record)) {
      courseStats[courseName].completions++;
    }
  });

  // Calculate completion rates
  Object.keys(courseStats).forEach(course => {
    const stats = courseStats[course];
    stats.completionRate = completionRate(stats.completions, stats.enrollments, { mode: 'int' });
  });

  // Filter and sort
  return Object.values(courseStats)
    .filter(stats => stats.completionRate < threshold && stats.enrollments >= 5) // At least 5 enrollments
    .sort((a, b) => a.completionRate - b.completionRate);
}

/**
 * Get staff-level completion data
 * @param {Array} data - Training data
 * @param {Object} courseGroups - Course grouping data
 * @param {boolean} groupVersions - Whether to group course versions
 * @returns {Array} Staff completion records
 */
export function getStaffCompletionData(data, courseGroups, groupVersions = true) {
  const baseName = (record) => groupVersions
    ? courseGroups[record.course]?.baseName || record.course
    : record.course;

  const staffMap = aggregateByEmail(data, {
    // NOTE: keyed by the raw email (not lowercased) to preserve original behavior
    keyOf: (record) => record.email,
    identity: (record) => ({
      email: record.email,
      legalFirstname: record.legalFirstname,
      preferredFirstname: record.preferredFirstname,
      lastname: record.lastname,
      displayName: buildDisplayName(record),
      totalEnrollments: 0,
      totalCompletions: 0,
      completionRate: 0
    }),
    mapCourse: (record) => ({
      course: baseName(record),
      originalCourse: record.course,
      percentCompleted: record.percentCompleted,
      enrolledAt: record.enrolledAt,
      dateCompleted: record.dateCompleted,
      daysToComplete: record.daysToComplete,
      isCompleted: isCourseComplete(record)
    }),
    onRecord: (staff, record) => {
      staff.totalEnrollments++;
      if (isCourseComplete(record)) staff.totalCompletions++;
    }
  });

  const staffList = Array.from(staffMap.values());
  staffList.forEach(staff => {
    staff.completionRate = completionRate(staff.totalCompletions, staff.totalEnrollments, { mode: 'int' });
  });

  return staffList.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

/**
 * Calculate overall summary statistics
 * @param {Array} data - Training data
 * @param {Object} courseGroups - Course grouping data
 * @returns {Object} Summary statistics
 */
export function calculateSummaryStats(data, courseGroups) {
  const uniqueStaff = new Set(data.map(r => r.email));
  const uniqueCourses = new Set(
    data.map(r => courseGroups[r.course]?.baseName || r.course)
  );

  const completions = data.filter(r => isCourseComplete(r));
  const overallCompletionRate = completionRate(completions.length, data.length, { mode: 'int' });

  const daysToComplete = completions
    .filter(r => r.daysToComplete !== null)
    .map(r => r.daysToComplete);

  const avgDaysToComplete = daysToComplete.length > 0
    ? Math.round(daysToComplete.reduce((sum, days) => sum + days, 0) / daysToComplete.length)
    : 0;

  return {
    totalStaff: uniqueStaff.size,
    totalCourses: uniqueCourses.size,
    totalEnrollments: data.length,
    totalCompletions: completions.length,
    overallCompletionRate,
    avgDaysToComplete
  };
}

/**
 * Filter data by date range
 * @param {Array} data - Training data
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Array} Filtered data
 */
export function filterByDateRange(data, startDate, endDate) {
  if (!startDate && !endDate) return data;

  return data.filter(record => {
    const checkDate = record.enrolledAt || record.dateCompleted;
    if (!checkDate) return false;

    if (startDate && checkDate < startDate) return false;
    if (endDate && checkDate > endDate) return false;

    return true;
  });
}
