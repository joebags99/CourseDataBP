/**
 * Parse the UKG "Program" field string into structured data.
 * Format: "PROGRAM - 70200 - 70200 SIBLING FOSTER CARE,REGION - 70 - 70 NORTHERN REGION"
 * @param {string} programStr - Raw program string from CSV
 * @returns {Object|null} Parsed program object or null if empty
 */
export function parseProgramString(programStr) {
  if (!programStr || !programStr.trim()) return null;

  const str = programStr.trim();

  // Match: PROGRAM - {code} - {display name},{REGION - {code} - {display name}}
  const match = str.match(
    /^PROGRAM\s*-\s*(\d+)\s*-\s*(.+?),REGION\s*-\s*(\d+)\s*-\s*(.+)$/i
  );

  if (match) {
    return {
      programCode: match[1].trim(),
      programName: match[2].trim(),
      regionCode: match[3].trim(),
      regionName: match[4].trim(),
      raw: str
    };
  }

  // Fallback: try PROGRAM only (no REGION part)
  const programOnly = str.match(/^PROGRAM\s*-\s*(\d+)\s*-\s*(.+)$/i);
  if (programOnly) {
    return {
      programCode: programOnly[1].trim(),
      programName: programOnly[2].trim(),
      regionCode: '',
      regionName: '',
      raw: str
    };
  }

  // Last resort: use the raw string as the name
  return {
    programCode: '',
    programName: str,
    regionCode: '',
    regionName: '',
    raw: str
  };
}

/**
 * Build a map of cost centers from raw CSV data.
 * Each unique program code becomes one cost center entry.
 * @param {Array} rawData - Parsed CSV records (must include program field)
 * @returns {Map} programCode -> { info, employees: Map<email, employee> }
 */
export function buildCostCenterData(rawData) {
  const programMap = new Map();

  rawData.forEach(record => {
    if (!record.program) return;

    const parsed = parseProgramString(record.program);
    if (!parsed) return;

    // Use programCode as key if available, otherwise fall back to raw string
    const key = parsed.programCode || parsed.raw;

    if (!programMap.has(key)) {
      programMap.set(key, {
        programCode: parsed.programCode,
        programName: parsed.programName,
        regionCode: parsed.regionCode,
        regionName: parsed.regionName,
        raw: parsed.raw,
        employees: new Map()
      });
    }

    const program = programMap.get(key);
    const email = record.email.toLowerCase();
    const displayName = `${record.preferredFirstname || record.legalFirstname} ${record.lastname}`.trim();

    if (!program.employees.has(email)) {
      program.employees.set(email, {
        email,
        displayName,
        legalFirstname: record.legalFirstname,
        preferredFirstname: record.preferredFirstname,
        lastname: record.lastname,
        supervisor: record.supervisor,
        courses: []
      });
    }

    program.employees.get(email).courses.push({
      course: record.course,
      percentCompleted: record.percentCompleted,
      enrolledAt: record.enrolledAt,
      dateCompleted: record.dateCompleted,
      lastHireDate: record.lastHireDate,
      daysToComplete: record.daysToComplete
    });
  });

  return programMap;
}

/**
 * Get a sorted list of all cost centers for display in a dropdown.
 * @param {Map} programMap - From buildCostCenterData
 * @returns {Array} Sorted array of cost center summary objects
 */
export function getAllCostCenters(programMap) {
  const result = [];
  programMap.forEach((program, key) => {
    result.push({
      key,
      programCode: program.programCode,
      programName: program.programName,
      regionCode: program.regionCode,
      regionName: program.regionName,
      employeeCount: program.employees.size
    });
  });
  return result.sort((a, b) => a.programName.localeCompare(b.programName));
}

/**
 * Get all unique regions from the program map.
 * @param {Map} programMap - From buildCostCenterData
 * @returns {Array} Sorted array of region objects { regionCode, regionName }
 */
export function getAllRegions(programMap) {
  const regionMap = new Map();
  programMap.forEach(program => {
    if (!program.regionCode) return;
    const key = program.regionCode;
    if (!regionMap.has(key)) {
      regionMap.set(key, {
        regionCode: program.regionCode,
        regionName: program.regionName
      });
    }
  });
  return Array.from(regionMap.values()).sort((a, b) =>
    a.regionName.localeCompare(b.regionName)
  );
}

/**
 * Generate a combined report for multiple cost centers.
 * Each employee entry includes a programName and a unique rowKey.
 * @param {Array<string>} programKeys - Keys to include
 * @param {Map} programMap - From buildCostCenterData
 * @param {Array} selectedCourses - Course names to include (all if empty)
 * @returns {Object|null} Combined report data object
 */
export function getMultiCostCenterReport(programKeys, programMap, selectedCourses = []) {
  if (!programKeys || programKeys.length === 0) return null;

  const reports = programKeys
    .map(key => getCostCenterReport(key, programMap, selectedCourses))
    .filter(Boolean);

  if (reports.length === 0) return null;

  // Flatten employees across all programs, tagging each with its program
  const allEmployees = [];
  reports.forEach(report => {
    report.employees.forEach(emp => {
      allEmployees.push({
        ...emp,
        programName: report.program.programName,
        programKey: report.program.key,
        rowKey: `${report.program.key}__${emp.email}`
      });
    });
  });

  const totalEnrollments = allEmployees.reduce((sum, e) => sum + e.totalCourses, 0);
  const totalCompletions = allEmployees.reduce((sum, e) => sum + e.completedCourses, 0);
  const overallCompletionRate = totalEnrollments > 0
    ? (totalCompletions / totalEnrollments * 100).toFixed(1)
    : 0;

  return {
    programs: reports.map(r => r.program),
    employees: allEmployees,
    statistics: {
      totalEmployees: allEmployees.length,
      totalEnrollments,
      totalCompletions,
      overallCompletionRate
    }
  };
}

/**
 * Generate report data for a specific cost center.
 * @param {string} programKey - Key from getAllCostCenters
 * @param {Map} programMap - From buildCostCenterData
 * @param {Array} selectedCourses - Array of course names to include (all if empty)
 * @returns {Object|null} Report data object
 */
export function getCostCenterReport(programKey, programMap, selectedCourses = []) {
  const program = programMap.get(programKey);
  if (!program) return null;

  const employees = Array.from(program.employees.values());

  const employeeData = employees.map(emp => {
    const courses = selectedCourses.length > 0
      ? emp.courses.filter(c => selectedCourses.includes(c.course))
      : emp.courses;

    const totalCourses = courses.length;
    const completedCourses = courses.filter(c => c.percentCompleted === 100).length;
    const completionRate = totalCourses > 0
      ? (completedCourses / totalCourses * 100).toFixed(1)
      : 0;

    return {
      email: emp.email,
      displayName: emp.displayName,
      legalFirstname: emp.legalFirstname,
      lastname: emp.lastname,
      supervisor: emp.supervisor,
      courses,
      totalCourses,
      completedCourses,
      completionRate,
      hasData: emp.courses.length > 0
    };
  }).sort((a, b) => a.displayName.localeCompare(b.displayName));

  const totalEnrollments = employeeData.reduce((sum, e) => sum + e.totalCourses, 0);
  const totalCompletions = employeeData.reduce((sum, e) => sum + e.completedCourses, 0);
  const overallCompletionRate = totalEnrollments > 0
    ? (totalCompletions / totalEnrollments * 100).toFixed(1)
    : 0;

  return {
    program: {
      key: programKey,
      programCode: program.programCode,
      programName: program.programName,
      regionCode: program.regionCode,
      regionName: program.regionName
    },
    employees: employeeData,
    statistics: {
      totalEmployees: employeeData.length,
      totalEnrollments,
      totalCompletions,
      overallCompletionRate
    }
  };
}
