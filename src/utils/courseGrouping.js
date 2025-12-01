/**
 * Intelligently group course versions together
 * Identifies patterns like "(2025 update)", "v2", "- 2024", etc.
 */

/**
 * Extract base course name by removing version indicators
 * @param {string} courseName - Full course name
 * @returns {string} Base course name
 */
export function extractBaseCourse(courseName) {
  if (!courseName) return '';

  // Remove common version patterns
  let baseName = courseName;

  // Patterns to remove (in order of specificity)
  const patterns = [
    /\s*\(\d{4}\s+update\)/gi,           // (2025 update)
    /\s*\(\d{4}\)/gi,                     // (2025)
    /\s*-\s*\d{4}\s+update/gi,           // - 2025 update
    /\s*-\s*\d{4}/gi,                     // - 2025
    /\s*v\d+(\.\d+)*/gi,                  // v2, v2.1
    /\s*version\s+\d+(\.\d+)*/gi,        // version 2, version 2.1
    /\s*\(v\d+(\.\d+)*\)/gi,             // (v2)
    /\s*\(version\s+\d+(\.\d+)*\)/gi,   // (version 2)
    /\s*\(revised\)/gi,                   // (revised)
    /\s*\(updated\)/gi,                   // (updated)
    /\s*\(new\)/gi,                       // (new)
    /\s*-\s*revised/gi,                   // - revised
    /\s*-\s*updated/gi,                   // - updated
    /\s*\d{4}\s*$/gi,                     // trailing year
  ];

  patterns.forEach(pattern => {
    baseName = baseName.replace(pattern, '');
  });

  return baseName.trim();
}

/**
 * Group courses by their base name
 * @param {Array} courses - Array of unique course names
 * @returns {Object} Map of base course name to array of versions
 */
export function groupCourseVersions(courses) {
  const groups = {};

  courses.forEach(course => {
    const baseName = extractBaseCourse(course);

    if (!groups[baseName]) {
      groups[baseName] = {
        baseName,
        versions: [],
        courseNames: []
      };
    }

    groups[baseName].versions.push(course);
    groups[baseName].courseNames.push(course);
  });

  return groups;
}

/**
 * Get all unique courses from data
 * @param {Array} data - Training data
 * @returns {Array} Sorted array of unique course names
 */
export function getUniqueCourses(data) {
  const courses = new Set(data.map(row => row.course));
  return Array.from(courses).sort();
}

/**
 * Check if a course name matches a base course (for filtering)
 * @param {string} courseName - Course name to check
 * @param {string} baseCourse - Base course name
 * @param {Object} courseGroups - Course grouping data
 * @returns {boolean}
 */
export function courseMatchesBase(courseName, baseCourse, courseGroups) {
  if (!courseGroups[baseCourse]) {
    return courseName === baseCourse;
  }

  return courseGroups[baseCourse].versions.includes(courseName);
}

/**
 * Get display name for a course (with version count if grouped)
 * @param {string} baseName - Base course name
 * @param {Object} courseGroups - Course grouping data
 * @param {boolean} isGrouped - Whether to show grouped view
 * @returns {string}
 */
export function getCourseDisplayName(baseName, courseGroups, isGrouped) {
  if (!isGrouped || !courseGroups[baseName]) {
    return baseName;
  }

  const versionCount = courseGroups[baseName].versions.length;
  if (versionCount > 1) {
    return `${baseName} (${versionCount} versions)`;
  }

  return baseName;
}
