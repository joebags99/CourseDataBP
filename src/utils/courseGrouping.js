/**
 * Intelligently group course versions together
 * Identifies patterns like "(2025 update)", "v2", "- 2024", etc.
 */

/**
 * Extract base course name by removing version indicators and normalizing variations
 * @param {string} courseName - Full course name
 * @returns {string} Base course name
 */
export function extractBaseCourse(courseName) {
  if (!courseName) return '';

  const originalName = courseName;
  let baseName = courseName;

  // Step 1: Remove version patterns (in order of specificity)
  const versionPatterns = [
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
    /\s*\(archived\)/gi,                  // (Archived)
    /\s*-\s*revised/gi,                   // - revised
    /\s*-\s*updated/gi,                   // - updated
    /\s*\d{4}\s*$/gi,                     // trailing year
  ];

  versionPatterns.forEach(pattern => {
    baseName = baseName.replace(pattern, '');
  });

  // Step 2: Remove common course suffixes
  const suffixPatterns = [
    /\s+training$/gi,                     // "LGBTQIA+ Basics training" -> "LGBTQIA+ Basics"
    /\s+course$/gi,                       // "First Aid course" -> "First Aid"
    /\s+class$/gi,                        // "CPR class" -> "CPR"
    /\s+workshop$/gi,                     // "Safety workshop" -> "Safety"
    /\s+seminar$/gi,                      // "Leadership seminar" -> "Leadership"
    /\s+certification$/gi,                // "CPR certification" -> "CPR"
    /\s+program$/gi,                      // "Mentoring program" -> "Mentoring"
  ];

  suffixPatterns.forEach(pattern => {
    baseName = baseName.replace(pattern, '');
  });

  // Step 3: Remove descriptive trailing text after common patterns
  // "Meaningful connections foundations of trauma" -> "Meaningful connections"
  const trailingDescriptors = [
    /\s+(foundations?|fundamentals?|essentials?|introduction|intro|overview|advanced|intermediate|beginner)\s+.*/gi,
    /\s+(part|module|section|chapter|level)\s+\d+.*/gi,
  ];

  trailingDescriptors.forEach(pattern => {
    baseName = baseName.replace(pattern, '');
  });

  // Step 4: Normalize plural/singular for common words
  // "connections" -> "connection", "basics" -> "basic"
  baseName = baseName.replace(/\bconnections\b/gi, 'Connection');
  baseName = baseName.replace(/\bconnection\b/gi, 'Connection');

  // Step 5: Trim and normalize whitespace
  baseName = baseName.trim().replace(/\s+/g, ' ');

  // Step 6: Remove trailing punctuation (colons, dashes, commas, semicolons)
  // "Meaningful Connection:" -> "Meaningful Connection"
  baseName = baseName.replace(/[\s:,;\-]+$/, '');

  // Debug log for troubleshooting
  if (originalName.toLowerCase().includes('meaningful')) {
    console.log(`Course grouping: "${originalName}" → "${baseName}"`);
  }

  return baseName;
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
