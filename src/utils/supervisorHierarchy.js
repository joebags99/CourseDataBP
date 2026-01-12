/**
 * Parse supervisor string from UKG data
 * Format: "Supervisor Name - ID" or "Supervisor1 - ID1, Supervisor2 - ID2"
 * @param {string} supervisorStr - Raw supervisor string from CSV
 * @returns {Array<{name: string, id: string}>} Array of supervisor objects
 */
export function parseSupervisors(supervisorStr) {
  if (!supervisorStr || supervisorStr.trim() === '') {
    return [];
  }

  // Split by comma to handle multiple supervisors
  const supervisorParts = supervisorStr.split(',').map(s => s.trim());

  return supervisorParts
    .map(part => {
      // Match pattern: "Name - ID"
      const match = part.match(/^(.+?)\s*-\s*(\d+)$/);
      if (match) {
        return {
          name: match[1].trim(),
          id: match[2].trim()
        };
      }
      return null;
    })
    .filter(sup => sup !== null);
}

/**
 * Build organizational hierarchy from raw data
 * @param {Array} rawData - Parsed CSV data with supervisor information
 * @returns {Object} Hierarchy data structure
 */
export function buildHierarchy(rawData) {
  // Create a map of email -> employee data
  const employeeMap = new Map();

  // First pass: collect all unique employees
  rawData.forEach(record => {
    const email = record.email.toLowerCase();

    if (!employeeMap.has(email)) {
      const supervisors = parseSupervisors(record.supervisor);

      employeeMap.set(email, {
        email,
        legalFirstname: record.legalFirstname,
        preferredFirstname: record.preferredFirstname,
        lastname: record.lastname,
        displayName: `${record.preferredFirstname || record.legalFirstname} ${record.lastname}`,
        supervisors: supervisors, // Array of {name, id}
        directReports: new Set(),
        allReports: new Set(),
        courses: []
      });
    }

    // Add course data to employee
    const employee = employeeMap.get(email);
    employee.courses.push({
      course: record.course,
      percentCompleted: record.percentCompleted,
      enrolledAt: record.enrolledAt,
      dateCompleted: record.dateCompleted,
      daysToComplete: record.daysToComplete
    });
  });

  // Create a map of supervisor name -> Set of employee emails
  const supervisorToEmployees = new Map();

  employeeMap.forEach((employee, email) => {
    if (employee.supervisors && employee.supervisors.length > 0) {
      employee.supervisors.forEach(supervisor => {
        const supervisorKey = supervisor.name.toLowerCase();

        if (!supervisorToEmployees.has(supervisorKey)) {
          supervisorToEmployees.set(supervisorKey, new Set());
        }

        supervisorToEmployees.get(supervisorKey).add(email);
      });
    }
  });

  // Populate direct reports for each employee
  employeeMap.forEach((employee, email) => {
    const employeeKey = employee.displayName.toLowerCase();

    if (supervisorToEmployees.has(employeeKey)) {
      employee.directReports = supervisorToEmployees.get(employeeKey);
    }
  });

  // Build cascading reports recursively
  function getCascadingReports(email, visited = new Set()) {
    if (visited.has(email)) {
      return new Set(); // Prevent circular references
    }

    visited.add(email);
    const employee = employeeMap.get(email);

    if (!employee) {
      return new Set();
    }

    const allReports = new Set(employee.directReports);

    // Recursively get reports of reports
    employee.directReports.forEach(reportEmail => {
      const subReports = getCascadingReports(reportEmail, visited);
      subReports.forEach(subEmail => allReports.add(subEmail));
    });

    return allReports;
  }

  // Populate all cascading reports
  employeeMap.forEach((employee, email) => {
    employee.allReports = getCascadingReports(email);
  });

  return {
    employeeMap,
    supervisorToEmployees
  };
}

/**
 * Get direct reports for a supervisor
 * @param {string} supervisorEmail - Email of the supervisor
 * @param {Object} hierarchy - Hierarchy data from buildHierarchy
 * @returns {Array} Array of employee objects who directly report to this supervisor
 */
export function getDirectReports(supervisorEmail, hierarchy) {
  const supervisor = hierarchy.employeeMap.get(supervisorEmail.toLowerCase());

  if (!supervisor || !supervisor.directReports || supervisor.directReports.size === 0) {
    return [];
  }

  return Array.from(supervisor.directReports)
    .map(email => hierarchy.employeeMap.get(email))
    .filter(emp => emp !== undefined);
}

/**
 * Get all cascading reports for a supervisor (including indirect reports)
 * @param {string} supervisorEmail - Email of the supervisor
 * @param {Object} hierarchy - Hierarchy data from buildHierarchy
 * @returns {Array} Array of employee objects who report to this supervisor (directly or indirectly)
 */
export function getCascadingReports(supervisorEmail, hierarchy) {
  const supervisor = hierarchy.employeeMap.get(supervisorEmail.toLowerCase());

  if (!supervisor || !supervisor.allReports || supervisor.allReports.size === 0) {
    return [];
  }

  return Array.from(supervisor.allReports)
    .map(email => hierarchy.employeeMap.get(email))
    .filter(emp => emp !== undefined);
}

/**
 * Get all supervisors (employees who have direct reports)
 * @param {Object} hierarchy - Hierarchy data from buildHierarchy
 * @returns {Array} Array of supervisor employee objects sorted by name
 */
export function getAllSupervisors(hierarchy) {
  const supervisors = [];

  hierarchy.employeeMap.forEach((employee) => {
    if (employee.directReports && employee.directReports.size > 0) {
      supervisors.push({
        email: employee.email,
        displayName: employee.displayName,
        directReportCount: employee.directReports.size,
        totalReportCount: employee.allReports.size
      });
    }
  });

  return supervisors.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

/**
 * Get report data for a supervisor with course completion details
 * @param {string} supervisorEmail - Email of the supervisor
 * @param {Object} hierarchy - Hierarchy data from buildHierarchy
 * @param {boolean} cascading - Whether to include indirect reports
 * @returns {Object} Report data with team members and statistics
 */
export function getSupervisorReport(supervisorEmail, hierarchy, cascading = true) {
  const supervisor = hierarchy.employeeMap.get(supervisorEmail.toLowerCase());

  if (!supervisor) {
    return null;
  }

  // Get team members based on cascading setting
  const teamMembers = cascading
    ? getCascadingReports(supervisorEmail, hierarchy)
    : getDirectReports(supervisorEmail, hierarchy);

  // Calculate statistics
  const teamData = teamMembers.map(member => {
    const totalCourses = member.courses.length;
    const completedCourses = member.courses.filter(c => c.percentCompleted === 100).length;
    const completionRate = totalCourses > 0 ? (completedCourses / totalCourses * 100).toFixed(1) : 0;

    return {
      email: member.email,
      displayName: member.displayName,
      legalFirstname: member.legalFirstname,
      lastname: member.lastname,
      totalCourses,
      completedCourses,
      completionRate,
      courses: member.courses,
      supervisors: member.supervisors,
      hasDirectReports: member.directReports && member.directReports.size > 0
    };
  });

  // Sort by display name
  teamData.sort((a, b) => a.displayName.localeCompare(b.displayName));

  // Calculate overall statistics
  const totalTeamMembers = teamData.length;
  const totalEnrollments = teamData.reduce((sum, member) => sum + member.totalCourses, 0);
  const totalCompletions = teamData.reduce((sum, member) => sum + member.completedCourses, 0);
  const overallCompletionRate = totalEnrollments > 0
    ? (totalCompletions / totalEnrollments * 100).toFixed(1)
    : 0;

  return {
    supervisor: {
      email: supervisor.email,
      displayName: supervisor.displayName
    },
    cascading,
    teamMembers: teamData,
    statistics: {
      totalTeamMembers,
      totalEnrollments,
      totalCompletions,
      overallCompletionRate,
      directReportCount: supervisor.directReports.size,
      totalReportCount: supervisor.allReports.size
    }
  };
}
