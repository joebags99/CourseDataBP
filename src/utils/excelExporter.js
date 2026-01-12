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

  // Team Members Sheet
  const teamHeaders = [
    'Display Name',
    'Legal First Name',
    'Last Name',
    'Email',
    'Total Courses',
    'Completed Courses',
    'Completion Rate (%)',
    'Has Direct Reports',
    'Immediate Supervisor(s)'
  ];

  const teamRows = reportData.teamMembers.map(member => [
    member.displayName,
    member.legalFirstname,
    member.lastname,
    member.email,
    member.totalCourses,
    member.completedCourses,
    member.completionRate,
    member.hasDirectReports ? 'Yes' : 'No',
    member.supervisors.map(s => s.name).join(', ')
  ]);

  const teamData = [teamHeaders, ...teamRows];
  const teamSheet = XLSX.utils.aoa_to_sheet(teamData);

  // Set column widths for team sheet
  teamSheet['!cols'] = [
    { wch: 25 }, // Display Name
    { wch: 20 }, // Legal First Name
    { wch: 20 }, // Last Name
    { wch: 30 }, // Email
    { wch: 15 }, // Total Courses
    { wch: 18 }, // Completed Courses
    { wch: 18 }, // Completion Rate
    { wch: 18 }, // Has Direct Reports
    { wch: 35 }  // Immediate Supervisor(s)
  ];

  XLSX.utils.book_append_sheet(workbook, teamSheet, 'Team Members');

  // Course Details Sheet
  const courseDetailsHeaders = [
    'Display Name',
    'Email',
    'Course',
    'Percent Completed',
    'Enrolled At',
    'Date Completed',
    'Days to Complete'
  ];

  const courseDetailsRows = [];

  reportData.teamMembers.forEach(member => {
    member.courses.forEach(course => {
      courseDetailsRows.push([
        member.displayName,
        member.email,
        course.course,
        course.percentCompleted,
        course.enrolledAt ? new Date(course.enrolledAt).toLocaleDateString() : '',
        course.dateCompleted ? new Date(course.dateCompleted).toLocaleDateString() : '',
        course.daysToComplete || ''
      ]);
    });
  });

  const courseDetailsData = [courseDetailsHeaders, ...courseDetailsRows];
  const courseDetailsSheet = XLSX.utils.aoa_to_sheet(courseDetailsData);

  // Set column widths for course details sheet
  courseDetailsSheet['!cols'] = [
    { wch: 25 }, // Display Name
    { wch: 30 }, // Email
    { wch: 40 }, // Course
    { wch: 18 }, // Percent Completed
    { wch: 15 }, // Enrolled At
    { wch: 15 }, // Date Completed
    { wch: 18 }  // Days to Complete
  ];

  XLSX.utils.book_append_sheet(workbook, courseDetailsSheet, 'Course Details');

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
