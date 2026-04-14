import * as XLSX from 'xlsx';
import { formatCourseName, sortCoursesByPriority } from './courseConfig';

const FEEDBACK_FORM_URL = 'https://forms.office.com/r/qBfrHWQdAK';

/**
 * Get current date formatted as MMDDYYYY
 */
function getDateString() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const year = now.getFullYear();
  return `${month}${day}${year}`;
}

/**
 * Sanitize a name for use in filename (remove spaces and special chars)
 */
function sanitizeName(name) {
  return name.replace(/[^a-zA-Z0-9]/g, '');
}

/**
 * Add clickable Yes/No feedback hyperlinks to a sheet row using HYPERLINK formula
 * @param {Object} sheet - XLSX sheet object
 * @param {string} row - 1-based row number (e.g., '7' for row 7)
 */
function addFeedbackLinks(sheet, row) {
  sheet[`B${row}`] = { t: 's', v: 'Yes', l: { Target: FEEDBACK_FORM_URL } };
  sheet[`C${row}`] = { t: 's', v: 'No', l: { Target: FEEDBACK_FORM_URL } };

  // Expand sheet range to include column C if needed
  const range = XLSX.utils.decode_range(sheet['!ref']);
  if (range.e.c < 2) {
    range.e.c = 2;
    sheet['!ref'] = XLSX.utils.encode_range(range);
  }
}

/**
 * Apply Excel styling to headers
 * @param {Object} sheet - XLSX sheet object
 * @param {string} range - Range of header cells (e.g., 'A1:F1')
 */
function styleHeaders(sheet, range) {
  const cellRefs = XLSX.utils.decode_range(range);

  for (let col = cellRefs.s.c; col <= cellRefs.e.c; col++) {
    for (let row = cellRefs.s.r; row <= cellRefs.e.r; row++) {
      const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
      if (!sheet[cellRef]) continue;

      sheet[cellRef].s = {
        font: {
          name: 'Poppins',
          sz: 11,
          bold: true,
          color: { rgb: 'FFFFFF' }
        },
        fill: {
          fgColor: { rgb: '0088FE' }
        },
        alignment: {
          vertical: 'center',
          horizontal: 'left'
        }
      };
    }
  }
}

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
    ['Was this report helpful?'],
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
  addFeedbackLinks(summarySheet, 7);

  // Set column widths for summary sheet
  summarySheet['!cols'] = [
    { wch: 30 },
    { wch: 40 },
    { wch: 10 }
  ];

  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  // My Status Report Sheet (supervisor's own courses)
  const myStatusRows = [];
  const supervisor = reportData.supervisor;

  myStatusRows.push(['MY STATUS REPORT']);
  myStatusRows.push(['']);
  myStatusRows.push(['Name:', supervisor.displayName]);
  myStatusRows.push(['Email:', supervisor.isPlaceholder ? 'N/A' : supervisor.email]);
  myStatusRows.push(['']);

  // Headers for courses
  const myStatusHeaders = [
    'Course',
    'Percent Completed',
    'Date Hired',
    'Date Completed',
    'Status'
  ];
  myStatusRows.push(myStatusHeaders);

  // Add supervisor's courses
  if (supervisor.courses && supervisor.courses.length > 0) {
    const sortedCourses = sortCoursesByPriority(supervisor.courses);

    sortedCourses.forEach(course => {
      myStatusRows.push([
        formatCourseName(course.course),
        course.percentCompleted + '%',
        course.lastHireDate ? new Date(course.lastHireDate).toLocaleDateString() : '',
        course.dateCompleted ? new Date(course.dateCompleted).toLocaleDateString() : '',
        course.percentCompleted === 100 ? 'Completed' : 'In Progress'
      ]);
    });
  } else {
    myStatusRows.push(['No course enrollment data', '', '', '', '']);
  }

  // Add legend
  myStatusRows.push(['']);
  myStatusRows.push(['* Required/Compliance Course']);

  const myStatusSheet = XLSX.utils.aoa_to_sheet(myStatusRows);

  // Set column widths
  myStatusSheet['!cols'] = [
    { wch: 50 }, // Course
    { wch: 18 }, // Percent Completed
    { wch: 15 }, // Date Hired
    { wch: 15 }, // Date Completed
    { wch: 15 }  // Status
  ];

  // Style the headers (row 6)
  styleHeaders(myStatusSheet, 'A6:E6');

  XLSX.utils.book_append_sheet(workbook, myStatusSheet, 'My Status Report');

  // Direct Reports with Courses Sheet (grouped by person)
  const rows = [];

  // Add supervisor first
  rows.push(['SUPERVISOR:', supervisor.displayName]);
  rows.push(['Email:', supervisor.isPlaceholder ? 'N/A' : supervisor.email]);
  rows.push(['']); // Blank row

  // Add feedback section
  rows.push(['Was this report helpful?']);
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
    'Date Hired',
    'Date Completed',
    'Status'
  ];
  rows.push(detailHeaders);

  // For each team member, add their info and courses
  reportData.teamMembers.forEach((member, memberIndex) => {
    if (member.hasData && member.courses.length > 0) {
      // Sort courses by priority (required first)
      const sortedCourses = sortCoursesByPriority(member.courses);

      // Add each course as a row
      sortedCourses.forEach((course, courseIndex) => {
        rows.push([
          courseIndex === 0 ? member.displayName : '', // Only show name on first course
          formatCourseName(course.course), // Add asterisk for required courses
          course.percentCompleted + '%',
          course.lastHireDate ? new Date(course.lastHireDate).toLocaleDateString() : '',
          course.dateCompleted ? new Date(course.dateCompleted).toLocaleDateString() : '',
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
        ''
      ]);
    }

    // Add blank row between members
    rows.push(['', '', '', '', '', '']);
  });

  // Add legend for required courses
  rows.push(['']);
  rows.push(['* Required/Compliance Course']);

  const detailSheet = XLSX.utils.aoa_to_sheet(rows);
  addFeedbackLinks(detailSheet, 4);

  // Set column widths
  detailSheet['!cols'] = [
    { wch: 25 }, // Name
    { wch: 50 }, // Course (wider for asterisk)
    { wch: 18 }, // Percent Completed
    { wch: 15 }, // Date Hired
    { wch: 15 }, // Date Completed
    { wch: 15 }  // Status
  ];

  // Style the headers (row with column names)
  const headerRowIndex = rows.findIndex(row => row[0] === 'Name');
  if (headerRowIndex >= 0) {
    styleHeaders(detailSheet, `A${headerRowIndex + 1}:F${headerRowIndex + 1}`);
  }

  XLSX.utils.book_append_sheet(workbook, detailSheet, 'Direct Reports & Courses');

  // Add filterable list view sheet
  const listRows = [];
  const listHeaders = [
    'Name',
    'Email',
    'Course',
    'Percent Completed',
    'Status',
    'Date Hired',
    'Date Completed'
  ];
  listRows.push(listHeaders);

  // Flat list of all team members and their courses
  reportData.teamMembers.forEach(member => {
    if (member.hasData && member.courses.length > 0) {
      // Sort courses by priority
      const sortedCourses = sortCoursesByPriority(member.courses);

      sortedCourses.forEach(course => {
        listRows.push([
          member.displayName,
          member.isPlaceholder ? 'N/A' : member.email,
          formatCourseName(course.course), // Add asterisk for required courses
          course.percentCompleted + '%',
          course.percentCompleted === 100 ? 'Completed' : 'In Progress',
          course.lastHireDate ? new Date(course.lastHireDate).toLocaleDateString() : '',
          course.dateCompleted ? new Date(course.dateCompleted).toLocaleDateString() : ''
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
        ''
      ]);
    }
  });

  const listSheet = XLSX.utils.aoa_to_sheet(listRows);
  listSheet['!cols'] = [
    { wch: 25 },
    { wch: 35 },
    { wch: 50 },
    { wch: 18 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 }
  ];

  // Style the headers
  styleHeaders(listSheet, 'A1:G1');

  // Enable autofilter for the list view
  listSheet['!autofilter'] = { ref: `A1:G${listRows.length}` };

  XLSX.utils.book_append_sheet(workbook, listSheet, 'List View');

  // Write the workbook to file
  const reportType = reportData.cascading ? 'Cascading' : 'DirectOnly';
  const supervisorName = sanitizeName(reportData.supervisor.displayName);
  const excelFilename = `TrainingReport_${supervisorName}_${getDateString()}_${reportType}.xlsx`;
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

  // Add feedback section at the top
  rows.push(['All Supervisors - Direct Reports Summary']);
  rows.push(['']);
  rows.push(['Was this report helpful?']);
  rows.push(['']);

  // Headers
  const headers = [
    'Supervisor',
    'Name',
    'Role',
    'Course',
    'Percent Completed',
    'Date Hired',
    'Date Completed',
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

    // Add each team member (direct report) with their courses
    report.teamMembers.forEach(member => {
      if (member.hasData && member.courses.length > 0) {
        // Sort courses by priority
        const sortedCourses = sortCoursesByPriority(member.courses);

        sortedCourses.forEach((course, courseIndex) => {
          rows.push([
            supervisorName, // Supervisor column
            courseIndex === 0 ? member.displayName : '', // Name only on first row
            courseIndex === 0 ? (member.displayName === supervisorName ? 'Supervisor' : 'Direct Report') : '',
            formatCourseName(course.course), // Add asterisk for required courses
            course.percentCompleted + '%',
            course.lastHireDate ? new Date(course.lastHireDate).toLocaleDateString() : '',
            course.dateCompleted ? new Date(course.dateCompleted).toLocaleDateString() : '',
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
          ''
        ]);
      }

      // Add blank row after each member
      rows.push(['', '', '', '', '', '', '', '']);
    });

    // Add extra blank row between supervisor groups
    rows.push(['', '', '', '', '', '', '', '']);
  });

  // Add legend for required courses
  rows.push(['']);
  rows.push(['* Required/Compliance Course']);

  // Create the sheet
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  addFeedbackLinks(sheet, 3);

  // Set column widths
  sheet['!cols'] = [
    { wch: 25 }, // Supervisor
    { wch: 25 }, // Name
    { wch: 15 }, // Role
    { wch: 45 }, // Course
    { wch: 18 }, // Percent Completed
    { wch: 15 }, // Date Hired
    { wch: 15 }, // Date Completed
    { wch: 15 }  // Status
  ];

  // Style the headers (row 5 - after feedback section)
  styleHeaders(sheet, 'A5:H5');

  XLSX.utils.book_append_sheet(workbook, sheet, 'Direct Reports & Courses');

  // Add filterable list view sheet
  const listRows = [];

  // Add feedback section
  listRows.push(['All Supervisors - List View']);
  listRows.push(['']);
  listRows.push(['Was this report helpful?']);
  listRows.push(['']);

  const listHeaders = [
    'Supervisor',
    'Name',
    'Email',
    'Role',
    'Course',
    'Percent Completed',
    'Status',
    'Date Hired',
    'Date Completed'
  ];
  listRows.push(listHeaders);

  // Flat list of all direct reports with courses
  sortedReports.forEach(report => {
    const supervisorName = report.supervisor.displayName;

    report.teamMembers.forEach(member => {
      if (member.hasData && member.courses.length > 0) {
        // Sort courses by priority
        const sortedCourses = sortCoursesByPriority(member.courses);

        sortedCourses.forEach(course => {
          listRows.push([
            supervisorName,
            member.displayName,
            member.isPlaceholder ? 'N/A' : member.email,
            member.displayName === supervisorName ? 'Supervisor' : 'Direct Report',
            formatCourseName(course.course), // Add asterisk for required courses
            course.percentCompleted + '%',
            course.percentCompleted === 100 ? 'Completed' : 'In Progress',
            course.lastHireDate ? new Date(course.lastHireDate).toLocaleDateString() : '',
            course.dateCompleted ? new Date(course.dateCompleted).toLocaleDateString() : ''
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
          ''
        ]);
      }
    });
  });

  const listSheet = XLSX.utils.aoa_to_sheet(listRows);
  addFeedbackLinks(listSheet, 3);

  listSheet['!cols'] = [
    { wch: 25 }, // Supervisor
    { wch: 25 }, // Name
    { wch: 35 }, // Email
    { wch: 15 }, // Role
    { wch: 45 }, // Course
    { wch: 18 }, // Percent Completed
    { wch: 15 }, // Status
    { wch: 15 }, // Date Hired
    { wch: 15 }  // Date Completed
  ];

  // Style the headers (row 5 - after feedback section)
  styleHeaders(listSheet, 'A5:I5');

  // Enable autofilter for the list view (starting from row 5)
  listSheet['!autofilter'] = { ref: `A5:I${listRows.length}` };

  XLSX.utils.book_append_sheet(workbook, listSheet, 'List View');

  // Write the workbook to file
  const excelFilename = `TrainingReport_AllSupervisors_${getDateString()}_DirectReports.xlsx`;
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
  const excelFilename = `TrainingReport_AllSupervisors_${getDateString()}_Summary.xlsx`;
  XLSX.writeFile(workbook, excelFilename);
}

/**
 * Export a single cost center report to Excel
 * Sheets: Summary, Staff & Courses, List View
 * @param {Object} reportData - From getCostCenterReport
 */
export function exportCostCenterReportToExcel(reportData) {
  if (!reportData) return;

  const workbook = XLSX.utils.book_new();
  const { program, employees, statistics } = reportData;

  // --- Summary Sheet ---
  const summaryData = [
    ['Cost Center Report'],
    [''],
    ['Program:', program.programName],
    ['Program Code:', program.programCode],
    ['Region:', program.regionName],
    [''],
    ['Was this report helpful?'],
    [''],
    ['Statistics:'],
    ['Total Employees:', statistics.totalEmployees],
    ['Total Enrollments:', statistics.totalEnrollments],
    ['Total Completions:', statistics.totalCompletions],
    ['Overall Completion Rate:', `${statistics.overallCompletionRate}%`],
    [''],
    ['Generated:', new Date().toLocaleString()]
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  addFeedbackLinks(summarySheet, 7);
  summarySheet['!cols'] = [{ wch: 30 }, { wch: 45 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  // --- Staff & Courses Sheet (grouped by person) ---
  const detailRows = [];
  detailRows.push(['COST CENTER:', program.programName]);
  detailRows.push(['Region:', program.regionName]);
  detailRows.push(['']);
  detailRows.push(['Was this report helpful?']);
  detailRows.push(['']);
  detailRows.push(['STAFF AND THEIR COURSES:']);
  detailRows.push(['']);

  const detailHeaders = ['Name', 'Course', 'Percent Completed', 'Date Hired', 'Date Completed', 'Status'];
  detailRows.push(detailHeaders);

  employees.forEach(member => {
    if (member.hasData && member.courses.length > 0) {
      const sortedCourses = sortCoursesByPriority(member.courses);
      sortedCourses.forEach((course, idx) => {
        detailRows.push([
          idx === 0 ? member.displayName : '',
          formatCourseName(course.course),
          course.percentCompleted + '%',
          course.lastHireDate ? new Date(course.lastHireDate).toLocaleDateString() : '',
          course.dateCompleted ? new Date(course.dateCompleted).toLocaleDateString() : '',
          course.percentCompleted === 100 ? 'Completed' : 'In Progress'
        ]);
      });
    } else {
      detailRows.push([member.displayName, 'No course enrollment data', '', '', '', '']);
    }
    detailRows.push(['', '', '', '', '', '']);
  });

  detailRows.push(['']);
  detailRows.push(['* Required/Compliance Course']);

  const detailSheet = XLSX.utils.aoa_to_sheet(detailRows);
  addFeedbackLinks(detailSheet, 4);
  detailSheet['!cols'] = [
    { wch: 25 }, { wch: 50 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 15 }
  ];
  const headerRowIdx = detailRows.findIndex(r => r[0] === 'Name');
  if (headerRowIdx >= 0) styleHeaders(detailSheet, `A${headerRowIdx + 1}:F${headerRowIdx + 1}`);
  XLSX.utils.book_append_sheet(workbook, detailSheet, 'Staff & Courses');

  // --- List View Sheet ---
  const listRows = [];
  const listHeaders = ['Name', 'Email', 'Course', 'Percent Completed', 'Status', 'Date Hired', 'Date Completed'];
  listRows.push(listHeaders);

  employees.forEach(member => {
    if (member.hasData && member.courses.length > 0) {
      const sortedCourses = sortCoursesByPriority(member.courses);
      sortedCourses.forEach(course => {
        listRows.push([
          member.displayName,
          member.email,
          formatCourseName(course.course),
          course.percentCompleted + '%',
          course.percentCompleted === 100 ? 'Completed' : 'In Progress',
          course.lastHireDate ? new Date(course.lastHireDate).toLocaleDateString() : '',
          course.dateCompleted ? new Date(course.dateCompleted).toLocaleDateString() : ''
        ]);
      });
    } else {
      listRows.push([member.displayName, member.email, 'No course enrollment data', '', '', '', '']);
    }
  });

  const listSheet = XLSX.utils.aoa_to_sheet(listRows);
  listSheet['!cols'] = [
    { wch: 25 }, { wch: 35 }, { wch: 50 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 15 }
  ];
  styleHeaders(listSheet, `A1:G1`);
  listSheet['!autofilter'] = { ref: `A1:G${listRows.length}` };
  XLSX.utils.book_append_sheet(workbook, listSheet, 'List View');

  const programSafe = sanitizeName(program.programName);
  XLSX.writeFile(workbook, `TrainingReport_${programSafe}_${getDateString()}_CostCenter.xlsx`);
}

/**
 * Export all cost centers to a single Excel file (grouped view + list view)
 * @param {Array} allReports - Array of report objects from getCostCenterReport
 */
export function exportAllCostCentersToExcel(allReports) {
  if (!allReports || allReports.length === 0) return;

  const workbook = XLSX.utils.book_new();

  // --- Grouped Sheet ---
  const rows = [];
  rows.push(['All Cost Centers - Staff & Courses Summary']);
  rows.push(['']);
  rows.push(['Was this report helpful?']);
  rows.push(['']);

  const headers = ['Program', 'Region', 'Name', 'Course', 'Percent Completed', 'Date Hired', 'Date Completed', 'Status'];
  rows.push(headers);

  const sorted = [...allReports].sort((a, b) => a.program.programName.localeCompare(b.program.programName));

  sorted.forEach(report => {
    report.employees.forEach(member => {
      if (member.hasData && member.courses.length > 0) {
        const sortedCourses = sortCoursesByPriority(member.courses);
        sortedCourses.forEach((course, idx) => {
          rows.push([
            idx === 0 ? report.program.programName : '',
            idx === 0 ? report.program.regionName : '',
            idx === 0 ? member.displayName : '',
            formatCourseName(course.course),
            course.percentCompleted + '%',
            course.lastHireDate ? new Date(course.lastHireDate).toLocaleDateString() : '',
            course.dateCompleted ? new Date(course.dateCompleted).toLocaleDateString() : '',
            course.percentCompleted === 100 ? 'Completed' : 'In Progress'
          ]);
        });
      } else {
        rows.push([report.program.programName, report.program.regionName, member.displayName, 'No course enrollment data', '', '', '', '']);
      }
      rows.push(['', '', '', '', '', '', '', '']);
    });
    rows.push(['', '', '', '', '', '', '', '']);
  });

  rows.push(['']);
  rows.push(['* Required/Compliance Course']);

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  addFeedbackLinks(sheet, 3);
  sheet['!cols'] = [
    { wch: 35 }, { wch: 25 }, { wch: 25 }, { wch: 45 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 15 }
  ];
  styleHeaders(sheet, 'A5:H5');
  XLSX.utils.book_append_sheet(workbook, sheet, 'Staff & Courses');

  // --- List View Sheet ---
  const listRows = [];
  listRows.push(['All Cost Centers - List View']);
  listRows.push(['']);
  listRows.push(['Was this report helpful?']);
  listRows.push(['']);

  const listHeaders = ['Program', 'Region', 'Name', 'Email', 'Course', 'Percent Completed', 'Status', 'Date Hired', 'Date Completed'];
  listRows.push(listHeaders);

  sorted.forEach(report => {
    report.employees.forEach(member => {
      if (member.hasData && member.courses.length > 0) {
        const sortedCourses = sortCoursesByPriority(member.courses);
        sortedCourses.forEach(course => {
          listRows.push([
            report.program.programName,
            report.program.regionName,
            member.displayName,
            member.email,
            formatCourseName(course.course),
            course.percentCompleted + '%',
            course.percentCompleted === 100 ? 'Completed' : 'In Progress',
            course.lastHireDate ? new Date(course.lastHireDate).toLocaleDateString() : '',
            course.dateCompleted ? new Date(course.dateCompleted).toLocaleDateString() : ''
          ]);
        });
      } else {
        listRows.push([report.program.programName, report.program.regionName, member.displayName, member.email, 'No course enrollment data', '', '', '', '']);
      }
    });
  });

  const listSheet = XLSX.utils.aoa_to_sheet(listRows);
  addFeedbackLinks(listSheet, 3);
  listSheet['!cols'] = [
    { wch: 35 }, { wch: 25 }, { wch: 25 }, { wch: 35 }, { wch: 45 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 15 }
  ];
  styleHeaders(listSheet, 'A5:I5');
  listSheet['!autofilter'] = { ref: `A5:I${listRows.length}` };
  XLSX.utils.book_append_sheet(workbook, listSheet, 'List View');

  XLSX.writeFile(workbook, `TrainingReport_AllCostCenters_${getDateString()}.xlsx`);
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
  const excelFilename = `TrainingReport_Team_${getDateString()}_Roster.xlsx`;
  XLSX.writeFile(workbook, excelFilename);
}
