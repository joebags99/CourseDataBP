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
    'Course',
    'Percent Completed',
    'Hire Date',
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
          course.course,
          course.percentCompleted + '%',
          course.lastHireDate ? new Date(course.lastHireDate).toLocaleDateString() : '',
          course.dateCompleted ? new Date(course.dateCompleted).toLocaleDateString() : '',
          course.daysToComplete || '',
          course.percentCompleted === 100 ? 'Completed' : 'In Progress'
        ]);
      });
    } else {
      // Member has no course data
      rows.push([
        member.displayName,
        'No course enrollment data',
        '',
        '',
        '',
        '',
        ''
      ]);
    }

    // Add blank row between members
    rows.push(['', '', '', '', '', '', '']);
  });

  const detailSheet = XLSX.utils.aoa_to_sheet(rows);

  // Set column widths
  detailSheet['!cols'] = [
    { wch: 25 }, // Name
    { wch: 45 }, // Course
    { wch: 18 }, // Percent Completed
    { wch: 15 }, // Hire Date
    { wch: 15 }, // Date Completed
    { wch: 18 }, // Days to Complete
    { wch: 15 }  // Status
  ];

  XLSX.utils.book_append_sheet(workbook, detailSheet, 'Direct Reports & Courses');

  // Add filterable list view sheet
  const listRows = [];
  const listHeaders = [
    'Name',
    'Email',
    'Course',
    'Percent Completed',
    'Status',
    'Hire Date',
    'Date Completed',
    'Days to Complete'
  ];
  listRows.push(listHeaders);

  // Flat list of all team members and their courses
  reportData.teamMembers.forEach(member => {
    if (member.hasData && member.courses.length > 0) {
      member.courses.forEach(course => {
        listRows.push([
          member.displayName,
          member.isPlaceholder ? 'N/A' : member.email,
          course.course,
          course.percentCompleted + '%',
          course.percentCompleted === 100 ? 'Completed' : 'In Progress',
          course.lastHireDate ? new Date(course.lastHireDate).toLocaleDateString() : '',
          course.dateCompleted ? new Date(course.dateCompleted).toLocaleDateString() : '',
          course.daysToComplete || ''
        ]);
      });
    } else {
      listRows.push([
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
  });

  const listSheet = XLSX.utils.aoa_to_sheet(listRows);
  listSheet['!cols'] = [
    { wch: 25 },
    { wch: 35 },
    { wch: 45 },
    { wch: 18 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 18 }
  ];

  // Enable autofilter for the list view
  listSheet['!autofilter'] = { ref: `A1:H${listRows.length}` };

  XLSX.utils.book_append_sheet(workbook, listSheet, 'List View');

  // Write the workbook to file
  const excelFilename = `${filename}.xlsx`;
  XLSX.writeFile(workbook, excelFilename);
}

/**
 * Export all supervisors with their direct reports grouped by supervisor
 * Each supervisor appears first, followed by their direct reports
 * @param {Array} supervisorReports - Array of report objects from getSupervisorReport (with filters applied)
 * @param {string} filename - Base filename (without extension)
 */
export function exportDirectReportsBySupervisor(supervisorReports, filename = 'direct-reports-by-supervisor') {
  if (!supervisorReports || supervisorReports.length === 0) {
    console.error('No supervisor reports provided');
    return;
  }

  const workbook = XLSX.utils.book_new();

  // Build the data rows grouped by supervisor with course details
  const rows = [];

  // Headers
  const headers = [
    'Supervisor',
    'Name',
    'Role',
    'Course',
    'Percent Completed',
    'Hire Date',
    'Date Completed',
    'Days to Complete',
    'Status'
  ];

  rows.push(headers);

  // Sort supervisor reports by supervisor name
  const sortedReports = [...supervisorReports].sort((a, b) =>
    a.supervisor.displayName.localeCompare(b.supervisor.displayName)
  );

  // For each supervisor report, add supervisor and their direct reports with course details
  sortedReports.forEach(report => {
    const supervisorName = report.supervisor.displayName;

    // Add the supervisor themselves first (if they have course data)
    // Note: The supervisor is not in the teamMembers list, so we need to check if we should add them
    // For now, we'll just add the team members

    // Add each team member (direct report) with their courses
    report.teamMembers.forEach(member => {
      if (member.hasData && member.courses.length > 0) {
        member.courses.forEach((course, courseIndex) => {
          rows.push([
            supervisorName, // Supervisor column
            courseIndex === 0 ? member.displayName : '', // Name only on first row
            courseIndex === 0 ? (member.displayName === supervisorName ? 'Supervisor' : 'Direct Report') : '',
            course.course,
            course.percentCompleted + '%',
            course.lastHireDate ? new Date(course.lastHireDate).toLocaleDateString() : '',
            course.dateCompleted ? new Date(course.dateCompleted).toLocaleDateString() : '',
            course.daysToComplete || '',
            course.percentCompleted === 100 ? 'Completed' : 'In Progress'
          ]);
        });
      } else {
        // Member has no course data
        rows.push([
          supervisorName,
          member.displayName,
          member.displayName === supervisorName ? 'Supervisor' : 'Direct Report',
          'No course enrollment data',
          '',
          '',
          '',
          '',
          ''
        ]);
      }

      // Add blank row after each member
      rows.push(['', '', '', '', '', '', '', '', '']);
    });

    // Add extra blank row between supervisor groups
    rows.push(['', '', '', '', '', '', '', '', '']);
  });

  // Create the sheet
  const sheet = XLSX.utils.aoa_to_sheet(rows);

  // Set column widths
  sheet['!cols'] = [
    { wch: 25 }, // Supervisor
    { wch: 25 }, // Name
    { wch: 15 }, // Role
    { wch: 45 }, // Course
    { wch: 18 }, // Percent Completed
    { wch: 15 }, // Hire Date
    { wch: 15 }, // Date Completed
    { wch: 18 }, // Days to Complete
    { wch: 15 }  // Status
  ];

  XLSX.utils.book_append_sheet(workbook, sheet, 'Direct Reports & Courses');

  // Add filterable list view sheet
  const listRows = [];
  const listHeaders = [
    'Supervisor',
    'Name',
    'Email',
    'Role',
    'Course',
    'Percent Completed',
    'Status',
    'Hire Date',
    'Date Completed',
    'Days to Complete'
  ];
  listRows.push(listHeaders);

  // Flat list of all direct reports with courses
  sortedReports.forEach(report => {
    const supervisorName = report.supervisor.displayName;

    report.teamMembers.forEach(member => {
      if (member.hasData && member.courses.length > 0) {
        member.courses.forEach(course => {
          listRows.push([
            supervisorName,
            member.displayName,
            member.isPlaceholder ? 'N/A' : member.email,
            member.displayName === supervisorName ? 'Supervisor' : 'Direct Report',
            course.course,
            course.percentCompleted + '%',
            course.percentCompleted === 100 ? 'Completed' : 'In Progress',
            course.lastHireDate ? new Date(course.lastHireDate).toLocaleDateString() : '',
            course.dateCompleted ? new Date(course.dateCompleted).toLocaleDateString() : '',
            course.daysToComplete || ''
          ]);
        });
      } else {
        listRows.push([
          supervisorName,
          member.displayName,
          member.isPlaceholder ? 'N/A' : member.email,
          member.displayName === supervisorName ? 'Supervisor' : 'Direct Report',
          'No course enrollment data',
          '',
          '',
          '',
          '',
          ''
        ]);
      }
    });
  });

  const listSheet = XLSX.utils.aoa_to_sheet(listRows);
  listSheet['!cols'] = [
    { wch: 25 },
    { wch: 25 },
    { wch: 35 },
    { wch: 15 },
    { wch: 45 },
    { wch: 18 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 18 }
  ];

  // Enable autofilter for the list view
  listSheet['!autofilter'] = { ref: `A1:J${listRows.length}` };

  XLSX.utils.book_append_sheet(workbook, listSheet, 'List View');

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
