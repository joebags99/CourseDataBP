/**
 * Parse supervisor string from UKG data
 * Format: "Supervisor Name - ID" or "Supervisor1 - ID1, Supervisor2 - ID2"
 * When someone is a manager, they appear as their own supervisor first, followed by their actual supervisor
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
 * Normalize a name for matching (lowercase, remove extra spaces)
 */
function normalizeName(name) {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Remove middle initials/names from a name for flexible matching
 * "Kari N Daniel" -> "Kari Daniel"
 * "John Q. Public" -> "John Public"
 */
function removeMiddleName(name) {
  const normalized = normalizeName(name);
  const parts = normalized.split(' ');

  // If only 2 parts (first + last), return as-is
  if (parts.length <= 2) {
    return normalized;
  }

  // If 3+ parts, try removing middle parts (assume first and last are most important)
  // Return first + last name
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

/**
 * Check if an employee's name matches a supervisor name
 * Handles middle initials/names by comparing with and without them
 */
function namesMatch(employeeName, supervisorName) {
  const empNorm = normalizeName(employeeName);
  const supNorm = normalizeName(supervisorName);

  // Direct match
  if (empNorm === supNorm) {
    return true;
  }

  // Try matching without middle names/initials
  const empNoMiddle = removeMiddleName(employeeName);
  const supNoMiddle = removeMiddleName(supervisorName);

  return empNoMiddle === supNoMiddle;
}

/**
 * Build organizational hierarchy from raw data
 * Handles the UKG pattern where managers list themselves as their own supervisor
 * @param {Array} rawData - Parsed CSV data with supervisor information
 * @returns {Object} Hierarchy data structure
 */
export function buildHierarchy(rawData) {
  // Create a map of employee identifier -> employee data
  // We'll use both email (if available) and name+ID for lookups
  const employeeMap = new Map();
  const employeeByNameId = new Map(); // Map of "name-id" -> employee
  const supervisorPlaceholders = new Map(); // Supervisors mentioned but not in data

  // First pass: collect all unique employees with course data
  rawData.forEach(record => {
    const email = record.email.toLowerCase();
    const displayName = `${record.preferredFirstname || record.legalFirstname} ${record.lastname}`;
    const supervisors = parseSupervisors(record.supervisor);

    // Filter out self-supervisor references
    // If employee's name matches one of the supervisors, that's a self-reference (indicates they're a manager)
    const actualSupervisors = supervisors.filter(sup => !namesMatch(displayName, sup.name));
    const isSelfSupervisor = supervisors.length > actualSupervisors.length;

    if (!employeeMap.has(email)) {
      const employee = {
        email,
        legalFirstname: record.legalFirstname,
        preferredFirstname: record.preferredFirstname,
        lastname: record.lastname,
        displayName,
        supervisors: actualSupervisors, // Only actual supervisors, not self-references
        isManager: isSelfSupervisor,
        directReports: new Set(),
        allReports: new Set(),
        courses: [],
        hasData: true
      };

      employeeMap.set(email, employee);

      // Also index by name for matching
      const nameKey = normalizeName(displayName);
      employeeByNameId.set(nameKey, employee);

      // If they have a supervisor ID in the data, also index by that
      supervisors.forEach(sup => {
        if (namesMatch(displayName, sup.name)) {
          const nameIdKey = `${normalizeName(sup.name)}-${sup.id}`;
          employeeByNameId.set(nameIdKey, employee);
        }
      });
    }

    // Add course data to employee
    const employee = employeeMap.get(email);
    employee.courses.push({
      course: record.course,
      percentCompleted: record.percentCompleted,
      enrolledAt: record.enrolledAt,
      dateCompleted: record.dateCompleted,
      lastHireDate: record.lastHireDate,
      daysToComplete: record.daysToComplete
    });
  });

  // Second pass: Create placeholder entries for supervisors mentioned but not in the data
  employeeMap.forEach((employee) => {
    employee.supervisors.forEach(sup => {
      const supNameNorm = normalizeName(sup.name);
      const supNameIdKey = `${supNameNorm}-${sup.id}`;

      // Check if this supervisor exists in our employee map
      let existingBySupervisorName = employeeByNameId.get(supNameNorm);
      let existingByNameId = employeeByNameId.get(supNameIdKey);

      // Try flexible matching if not found
      if (!existingBySupervisorName && !existingByNameId) {
        for (const [email, emp] of employeeMap) {
          if (namesMatch(emp.displayName, sup.name)) {
            existingBySupervisorName = emp;
            // Cache this match
            employeeByNameId.set(supNameNorm, emp);
            employeeByNameId.set(supNameIdKey, emp);
            break;
          }
        }
      }

      if (!existingBySupervisorName && !existingByNameId) {
        // Supervisor doesn't exist in our data, create a placeholder
        if (!supervisorPlaceholders.has(supNameIdKey)) {
          // Generate a placeholder email from the name
          const emailPart = sup.name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '');
          const placeholderEmail = `${emailPart}@placeholder.local`;

          const placeholder = {
            email: placeholderEmail,
            legalFirstname: sup.name.split(' ')[0] || '',
            preferredFirstname: sup.name.split(' ')[0] || '',
            lastname: sup.name.split(' ').slice(1).join(' ') || '',
            displayName: sup.name,
            supervisorId: sup.id,
            supervisors: [],
            isManager: true,
            directReports: new Set(),
            allReports: new Set(),
            courses: [],
            hasData: false, // This person has no course enrollment data
            isPlaceholder: true
          };

          supervisorPlaceholders.set(supNameIdKey, placeholder);
          employeeMap.set(placeholderEmail, placeholder);
          employeeByNameId.set(supNameNorm, placeholder);
          employeeByNameId.set(supNameIdKey, placeholder);
        }
      }
    });
  });

  // Third pass: Build supervisor -> employee relationships
  employeeMap.forEach((employee) => {
    employee.supervisors.forEach(sup => {
      const supNameNorm = normalizeName(sup.name);
      const supNameIdKey = `${supNameNorm}-${sup.id}`;

      // Find the supervisor (could be a real employee or a placeholder)
      // Try exact matches first
      let supervisor = employeeByNameId.get(supNameIdKey);
      if (!supervisor) {
        supervisor = employeeByNameId.get(supNameNorm);
      }

      // If still not found, try flexible matching (without middle names)
      if (!supervisor) {
        const supNoMiddle = removeMiddleName(sup.name);

        // Search through all employees for a name match
        for (const [email, emp] of employeeMap) {
          if (namesMatch(emp.displayName, sup.name)) {
            supervisor = emp;
            // Cache this match for future lookups
            employeeByNameId.set(supNameNorm, supervisor);
            employeeByNameId.set(supNameIdKey, supervisor);
            break;
          }
        }
      }

      if (supervisor) {
        // Add this employee as a direct report of the supervisor
        supervisor.directReports.add(employee.email);
      }
    });
  });

  // Fourth pass: Build cascading reports recursively
  function getCascadingReportsRecursive(email, visited = new Set()) {
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
      const subReports = getCascadingReportsRecursive(reportEmail, visited);
      subReports.forEach(subEmail => allReports.add(subEmail));
    });

    return allReports;
  }

  // Populate all cascading reports
  employeeMap.forEach((employee, email) => {
    employee.allReports = getCascadingReportsRecursive(email);
  });

  return {
    employeeMap,
    employeeByNameId,
    supervisorPlaceholders
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
        totalReportCount: employee.allReports.size,
        isPlaceholder: employee.isPlaceholder || false,
        hasData: employee.hasData
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
      hasDirectReports: member.directReports && member.directReports.size > 0,
      hasData: member.hasData,
      isPlaceholder: member.isPlaceholder || false
    };
  });

  // Sort by display name
  teamData.sort((a, b) => a.displayName.localeCompare(b.displayName));

  // Calculate overall statistics (only from members with data)
  const membersWithData = teamData.filter(m => m.hasData);
  const totalTeamMembers = teamData.length;
  const totalEnrollments = membersWithData.reduce((sum, member) => sum + member.totalCourses, 0);
  const totalCompletions = membersWithData.reduce((sum, member) => sum + member.completedCourses, 0);
  const overallCompletionRate = totalEnrollments > 0
    ? (totalCompletions / totalEnrollments * 100).toFixed(1)
    : 0;

  return {
    supervisor: {
      email: supervisor.email,
      displayName: supervisor.displayName,
      hasData: supervisor.hasData,
      isPlaceholder: supervisor.isPlaceholder || false,
      courses: supervisor.courses || []
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
