import * as XLSX from 'xlsx';

/**
 * Export supervisor report to Excel file
 * @param {Object} reportData - Report data from getSupervisorReport
 * @param {string} filename - Base filename (without extension)
 */
export function exportSupervisorReportToExcel(reportData, filename = 'supervisor-report') {
  if (!reportData) {
    console.error('No report data provided');
    return;
  }

  // Create a new workbook
  const workbook = XLSX.utils.book_new();

  // Summary Sheet
  const summaryData = [
    ['Supervisor Report'],
    [''],
    ['Supervisor:', reportData.supervisor.displayName],
    ['Email:', reportData.supervisor.email],
    ['Report Type:', reportData.cascading ? 'Cascading (All Reports)' : 'Direct Reports Only'],
    [''],
    ['Team Statistics:'],
    ['Total Team Members:', reportData.statistics.totalTeamMembers],
    ['Direct Reports:', reportData.statistics.directReportCount],
    ['Total Reports (Cascading):', reportData.statistics.totalReportCount],
    ['Total Enrollments:', reportData.statistics.totalEnrollments],
    ['Total Completions:', reportData.statistics.totalCompletions],
    ['Overall Completion Rate:', `${reportData.statistics.overallCompletionRate}%`],
    [''],
    ['Generated:', new Date().toLocaleString()]
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);

  // Set column widths for summary sheet
  summarySheet['!cols'] = [
    { wch: 30 },
    { wch: 40 }
  ];

  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  // Direct Reports with Courses Sheet (grouped by person)
  const rows = [];

  // Add supervisor first
  const supervisor = reportData.supervisor;
  rows.push(['SUPERVISOR:', supervisor.displayName]);
  rows.push(['Email:', supervisor.isPlaceholder ? 'N/A' : supervisor.email]);
  rows.push(['']); // Blank row

  // Get supervisor's own data from the hierarchy if available
  // We need to find the supervisor in the team members or add them separately
  // For now, just add the header for direct reports

  rows.push(['DIRECT REPORTS AND THEIR COURSES:']);
  rows.push(['']); // Blank row

  // Headers for the detailed rows
  const detailHeaders = [
    'Name',
    'Email',
    'Course',
    'Percent Completed',
    'Enrolled At',
    'Date Completed',
    'Days to Complete',
    'Status'
  ];
  rows.push(detailHeaders);

  // For each team member, add their info and courses
  reportData.teamMembers.forEach((member, memberIndex) => {
    if (member.hasData && member.courses.length > 0) {
      // Add each course as a row
      member.courses.forEach((course, courseIndex) => {
        rows.push([
          courseIndex === 0 ? member.displayName : '', // Only show name on first course
          courseIndex === 0 ? member.email : '', // Only show email on first course
          course.course,
          course.percentCompleted + '%',
          course.enrolledAt ? new Date(course.enrolledAt).toLocaleDateString() : '',
          course.dateCompleted ? new Date(course.dateCompleted).toLocaleDateString() : '',
          course.daysToComplete || '',
          course.percentCompleted === 100 ? 'Completed' : 'In Progress'
        ]);
      });
    } else {
      // Member has no course data
      rows.push([
        member.displayName,
        member.isPlaceholder ? 'N/A' : member.email,
        'No course enrollment data',
        '',
        '',
        '',
        '',
        ''
      ]);
    }

    // Add blank row between members
    rows.push(['', '', '', '', '', '', '', '']);
  });

  const detailSheet = XLSX.utils.aoa_to_sheet(rows);

  // Set column widths
  detailSheet['!cols'] = [
    { wch: 25 }, // Name
    { wch: 35 }, // Email
    { wch: 45 }, // Course
    { wch: 18 }, // Percent Completed
    { wch: 15 }, // Enrolled At
    { wch: 15 }, // Date Completed
    { wch: 18 }, // Days to Complete
    { wch: 15 }  // Status
  ];

  XLSX.utils.book_append_sheet(workbook, detailSheet, 'Direct Reports & Courses');

  // Write the workbook to file
  const excelFilename = `${filename}.xlsx`;
  XLSX.writeFile(workbook, excelFilename);
}

/**
 * Export all supervisors with their direct reports grouped by supervisor
 * Each supervisor appears first, followed by their direct reports
 * @param {Object} hierarchy - Hierarchy data from buildHierarchy
 * @param {Array} supervisors - Array of all supervisors from getAllSupervisors
 * @param {string} filename - Base filename (without extension)
 */
export function exportDirectReportsBySupervisor(hierarchy, supervisors, filename = 'direct-reports-by-supervisor') {
  if (!hierarchy || !supervisors || supervisors.length === 0) {
    console.error('No hierarchy or supervisor data provided');
    return;
  }

  const workbook = XLSX.utils.book_new();

  // Build the data rows grouped by supervisor with course details
  const rows = [];

  // Headers
  const headers = [
    'Supervisor',
    'Name',
    'Email',
    'Role',
    'Course',
    'Percent Completed',
    'Enrolled At',
    'Date Completed',
    'Days to Complete',
    'Status'
  ];

  rows.push(headers);

  // Sort supervisors by name
  const sortedSupervisors = [...supervisors].sort((a, b) =>
    a.displayName.localeCompare(b.displayName)
  );

  // For each supervisor, add them and their direct reports with course details
  sortedSupervisors.forEach(supervisorInfo => {
    const supervisor = hierarchy.employeeMap.get(supervisorInfo.email);

    if (!supervisor) return;

    // Add the supervisor themselves first with their courses
    if (supervisor.hasData && supervisor.courses.length > 0) {
      supervisor.courses.forEach((course, courseIndex) => {
        rows.push([
          supervisor.displayName, // Supervisor column
          courseIndex === 0 ? supervisor.displayName : '', // Name only on first row
          courseIndex === 0 ? (supervisor.isPlaceholder ? 'N/A' : supervisor.email) : '', // Email only on first row
          courseIndex === 0 ? 'Supervisor' : '',
          course.course,
          course.percentCompleted + '%',
          course.enrolledAt ? new Date(course.enrolledAt).toLocaleDateString() : '',
          course.dateCompleted ? new Date(course.dateCompleted).toLocaleDateString() : '',
          course.daysToComplete || '',
          course.percentCompleted === 100 ? 'Completed' : 'In Progress'
        ]);
      });
    } else {
      // Supervisor has no course data
      rows.push([
        supervisor.displayName,
        supervisor.displayName,
        supervisor.isPlaceholder ? 'N/A' : supervisor.email,
        'Supervisor',
        'No course enrollment data',
        '',
        '',
        '',
        '',
        ''
      ]);
    }

    // Add blank row after supervisor
    rows.push(['', '', '', '', '', '', '', '', '', '']);

    // Get direct reports and sort by name
    const directReports = Array.from(supervisor.directReports)
      .map(email => hierarchy.employeeMap.get(email))
      .filter(emp => emp !== undefined)
      .sort((a, b) => a.displayName.localeCompare(b.displayName));

    // Add each direct report with their courses
    directReports.forEach(report => {
      if (report.hasData && report.courses.length > 0) {
        report.courses.forEach((course, courseIndex) => {
          rows.push([
            supervisor.displayName, // Supervisor column
            courseIndex === 0 ? report.displayName : '', // Name only on first row
            courseIndex === 0 ? (report.isPlaceholder ? 'N/A' : report.email) : '', // Email only on first row
            courseIndex === 0 ? 'Direct Report' : '',
            course.course,
            course.percentCompleted + '%',
            course.enrolledAt ? new Date(course.enrolledAt).toLocaleDateString() : '',
            course.dateCompleted ? new Date(course.dateCompleted).toLocaleDateString() : '',
            course.daysToComplete || '',
            course.percentCompleted === 100 ? 'Completed' : 'In Progress'
          ]);
        });
      } else {
        // Direct report has no course data
        rows.push([
          supervisor.displayName,
          report.displayName,
          report.isPlaceholder ? 'N/A' : report.email,
          'Direct Report',
          'No course enrollment data',
          '',
          '',
          '',
          '',
          ''
        ]);
      }

      // Add blank row after each direct report
      rows.push(['', '', '', '', '', '', '', '', '', '']);
    });

    // Add extra blank row between supervisor groups
    rows.push(['', '', '', '', '', '', '', '', '', '']);
  });

  // Create the sheet
  const sheet = XLSX.utils.aoa_to_sheet(rows);

  // Set column widths
  sheet['!cols'] = [
    { wch: 25 }, // Supervisor
    { wch: 25 }, // Name
    { wch: 35 }, // Email
    { wch: 15 }, // Role
    { wch: 45 }, // Course
    { wch: 18 }, // Percent Completed
    { wch: 15 }, // Enrolled At
    { wch: 15 }, // Date Completed
    { wch: 18 }, // Days to Complete
    { wch: 15 }  // Status
  ];

  XLSX.utils.book_append_sheet(workbook, sheet, 'Direct Reports & Courses');

  // Write the workbook to file
  const excelFilename = `${filename}.xlsx`;
  XLSX.writeFile(workbook, excelFilename);
}

/**
 * Export all supervisors' reports to Excel file (bulk export)
 * @param {Array} supervisorsReports - Array of report data objects
 * @param {string} filename - Base filename (without extension)
 */
export function exportAllSupervisorReportsToExcel(supervisorsReports, filename = 'all-supervisors-report') {
  if (!supervisorsReports || supervisorsReports.length === 0) {
    console.error('No supervisor reports provided');
    return;
  }

  const workbook = XLSX.utils.book_new();

  // Summary Sheet
  const summaryHeaders = [
    'Supervisor',
    'Email',
    'Direct Reports',
    'Total Reports (Cascading)',
    'Team Members in Report',
    'Total Enrollments',
    'Total Completions',
    'Completion Rate (%)'
  ];

  const summaryRows = supervisorsReports.map(report => [
    report.supervisor.displayName,
    report.supervisor.email,
    report.statistics.directReportCount,
    report.statistics.totalReportCount,
    report.statistics.totalTeamMembers,
    report.statistics.totalEnrollments,
    report.statistics.totalCompletions,
    report.statistics.overallCompletionRate
  ]);

  const summaryData = [
    ['All Supervisors Report'],
    ['Generated:', new Date().toLocaleString()],
    [''],
    summaryHeaders,
    ...summaryRows
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);

  // Set column widths
  summarySheet['!cols'] = [
    { wch: 25 },
    { wch: 30 },
    { wch: 15 },
    { wch: 22 },
    { wch: 20 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 }
  ];

  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  // Write the workbook to file
  const excelFilename = `${filename}.xlsx`;
  XLSX.writeFile(workbook, excelFilename);
}

/**
 * Export team roster (all team members across all supervisors) to Excel
 * @param {Array} allTeamMembers - Array of all team member objects
 * @param {string} filename - Base filename (without extension)
 */
export function exportTeamRosterToExcel(allTeamMembers, filename = 'team-roster') {
  if (!allTeamMembers || allTeamMembers.length === 0) {
    console.error('No team members provided');
    return;
  }

  const workbook = XLSX.utils.book_new();

  const headers = [
    'Display Name',
    'Legal First Name',
    'Last Name',
    'Email',
    'Immediate Supervisor(s)',
    'Has Direct Reports',
    'Total Courses',
    'Completed Courses',
    'Completion Rate (%)'
  ];

  const rows = allTeamMembers.map(member => [
    member.displayName,
    member.legalFirstname,
    member.lastname,
    member.email,
    member.supervisors.map(s => s.name).join(', '),
    member.hasDirectReports ? 'Yes' : 'No',
    member.totalCourses,
    member.completedCourses,
    member.completionRate
  ]);

  const data = [
    ['Team Roster'],
    ['Generated:', new Date().toLocaleString()],
    ['Total Members:', allTeamMembers.length],
    [''],
    headers,
    ...rows
  ];

  const sheet = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  sheet['!cols'] = [
    { wch: 25 },
    { wch: 20 },
    { wch: 20 },
    { wch: 30 },
    { wch: 35 },
    { wch: 18 },
    { wch: 15 },
    { wch: 18 },
    { wch: 18 }
  ];

  XLSX.utils.book_append_sheet(workbook, sheet, 'Team Roster');

  // Write the workbook to file
  const excelFilename = `${filename}.xlsx`;
  XLSX.writeFile(workbook, excelFilename);
}
