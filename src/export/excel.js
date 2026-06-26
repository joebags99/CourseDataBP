import XLSX from 'xlsx-js-style';
import { formatCourseName, sortCoursesByPriority } from '../config/courses';
import { getDateString, completionStatusLabel } from '../data/dataModel';

const FEEDBACK_FORM_URL = 'https://forms.office.com/r/qBfrHWQdAK';

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

/* =====================================================================
   Excel visual styling
   Uses xlsx-js-style so cell .s styles are actually written. Brand blue
   matches the app/exports (#0088FE). Helpers below decorate sheets in
   place WITHOUT changing any cell values, layout, or sheet names.
   ===================================================================== */
const FONT = 'Poppins';
const PALETTE = {
  brand: '0088FE', white: 'FFFFFF', title: '1F2937', body: '24292F',
  border: 'D0D7DE', band: 'F6F8FB',
  greenBg: 'DCFCE7', green: '166534',
  amberBg: 'FEF9C3', amber: '854D0E',
  orangeBg: 'FFEDD5', orange: '9A3412',
  redBg: 'FEE2E2', red: '991B1B',
  grayBg: 'F1F3F5', gray: '6B7280',
};
const THIN = { style: 'thin', color: { rgb: PALETTE.border } };
const ALL_BORDERS = { top: THIN, bottom: THIN, left: THIN, right: THIN };

function ensureCell(sheet, r, c) {
  const ref = XLSX.utils.encode_cell({ r, c });
  if (!sheet[ref]) sheet[ref] = { t: 's', v: '' };
  return sheet[ref];
}

function rowHasContent(sheet, r, c0, c1) {
  for (let c = c0; c <= c1; c++) {
    const ref = XLSX.utils.encode_cell({ r, c });
    if (sheet[ref] && sheet[ref].v !== '' && sheet[ref].v != null) return true;
  }
  return false;
}

/** Pick a {bg, fg} for a status string or a percentage value, else null. */
function conditionalColor(type, value) {
  if (value == null || value === '') return null;
  if (type === 'status') {
    const v = String(value).toLowerCase();
    if (v.includes('not started') || v.includes('missing')) return { bg: PALETTE.redBg, fg: PALETTE.red };
    if (v.includes('in progress') || v.includes('incomplete')) return { bg: PALETTE.amberBg, fg: PALETTE.amber };
    if (v === 'n/a' || v.includes('n/a')) return { bg: PALETTE.grayBg, fg: PALETTE.gray };
    if (v.includes('complet')) return { bg: PALETTE.greenBg, fg: PALETTE.green };
    return null;
  }
  // percentage
  const n = parseFloat(String(value).replace('%', ''));
  if (Number.isNaN(n)) return null;
  if (n >= 100) return { bg: PALETTE.greenBg, fg: PALETTE.green };
  if (n >= 70) return { bg: PALETTE.amberBg, fg: PALETTE.amber };
  if (n > 0) return { bg: PALETTE.orangeBg, fg: PALETTE.orange };
  return { bg: PALETTE.redBg, fg: PALETTE.red };
}

/**
 * Style a table-shaped sheet in place: brand header row, hairline borders,
 * zebra banding, and conditional coloring on status / percentage columns.
 * Pure presentation — never changes values.
 *
 * @param {Object} sheet
 * @param {string} headerRange - e.g. 'A1:G1' (only the row matters; columns
 *   span the full sheet). Identifies which row holds the column headers.
 * @param {Object} [opts]
 * @param {number[]} [opts.statusCols] - 0-based columns to color as statuses
 * @param {number[]} [opts.pctCols] - 0-based columns to color as percentages
 * @param {number[]} [opts.titleRows] - 0-based rows above the header to bold as titles
 */
function styleTable(sheet, headerRange, opts = {}) {
  if (!sheet['!ref']) return;
  const full = XLSX.utils.decode_range(sheet['!ref']);
  const headerRow = XLSX.utils.decode_range(headerRange).s.r;
  const c0 = full.s.c, c1 = full.e.c;

  // Title rows (above the header)
  (opts.titleRows || []).forEach(r => {
    const cell = sheet[XLSX.utils.encode_cell({ r, c: c0 })];
    if (cell) cell.s = { font: { name: FONT, sz: 14, bold: true, color: { rgb: PALETTE.title } } };
  });

  // Column type map (auto-detect by header text, then merge forced cols)
  const colType = {};
  for (let c = c0; c <= c1; c++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: headerRow, c })];
    const h = cell ? String(cell.v || '').toLowerCase() : '';
    if (!h) continue;
    // Only true percentage columns (every one contains %, "percent", or "rate").
    // Deliberately NOT "completion"/"compliance" alone, so count columns like
    // "Total Completions" are not mistaken for percentages.
    if (h === 'status') colType[c] = 'status';
    else if (h.includes('%') || h.includes('percent') || h.includes('rate')) colType[c] = 'pct';
  }
  (opts.statusCols || []).forEach(c => { colType[c] = 'status'; });
  (opts.pctCols || []).forEach(c => { colType[c] = 'pct'; });

  // Header row
  for (let c = c0; c <= c1; c++) {
    const cell = ensureCell(sheet, headerRow, c);
    cell.s = {
      font: { name: FONT, sz: 11, bold: true, color: { rgb: PALETTE.white } },
      fill: { patternType: 'solid', fgColor: { rgb: PALETTE.brand } },
      alignment: { vertical: 'center', horizontal: 'left', wrapText: true },
      border: ALL_BORDERS,
    };
  }

  // Data rows
  let band = 0;
  for (let r = headerRow + 1; r <= full.e.r; r++) {
    if (!rowHasContent(sheet, r, c0, c1)) { band = 0; continue; } // reset at separators
    const banded = band % 2 === 1;
    for (let c = c0; c <= c1; c++) {
      const cell = ensureCell(sheet, r, c);
      const cond = colType[c] ? conditionalColor(colType[c], cell.v) : null;
      if (cond) {
        cell.s = {
          font: { name: FONT, sz: 10, bold: true, color: { rgb: cond.fg } },
          fill: { patternType: 'solid', fgColor: { rgb: cond.bg } },
          alignment: { vertical: 'center', horizontal: 'center' },
          border: ALL_BORDERS,
        };
      } else {
        cell.s = {
          font: { name: FONT, sz: 10, color: { rgb: PALETTE.body } },
          alignment: { vertical: 'center' },
          border: ALL_BORDERS,
          ...(banded ? { fill: { patternType: 'solid', fgColor: { rgb: PALETTE.band } } } : {}),
        };
      }
    }
    band++;
  }
}

/**
 * Light styling for key/value "summary" sheets: bold title row(s) and bold
 * any left-column label ending in ':'. Pure presentation.
 * @param {Object} sheet
 * @param {Object} [opts]
 * @param {number[]} [opts.titleRows] - 0-based title rows (default [0])
 */
function styleSummary(sheet, opts = {}) {
  if (!sheet['!ref']) return;
  const titleRows = opts.titleRows || [0];
  const full = XLSX.utils.decode_range(sheet['!ref']);
  for (let r = full.s.r; r <= full.e.r; r++) {
    const aRef = XLSX.utils.encode_cell({ r, c: 0 });
    const a = sheet[aRef];
    if (titleRows.includes(r)) {
      if (a) a.s = { font: { name: FONT, sz: 14, bold: true, color: { rgb: PALETTE.title } } };
      continue;
    }
    if (a && a.v != null && String(a.v).trim().endsWith(':')) {
      a.s = { font: { name: FONT, sz: 10, bold: true, color: { rgb: PALETTE.title } } };
      const bRef = XLSX.utils.encode_cell({ r, c: 1 });
      if (sheet[bRef]) {
        const isRate = String(a.v).toLowerCase().includes('rate');
        const cond = isRate ? conditionalColor('pct', sheet[bRef].v) : null;
        sheet[bRef].s = cond
          ? { font: { name: FONT, sz: 10, bold: true, color: { rgb: cond.fg } }, fill: { patternType: 'solid', fgColor: { rgb: cond.bg } } }
          : { font: { name: FONT, sz: 10, color: { rgb: PALETTE.body } } };
      }
    }
  }
}

/**
 * Back-compat shim: older call sites styled only the header range. Now routes
 * to the full table styler so every table gets borders + banding + coloring.
 */
function styleHeaders(sheet, range) {
  styleTable(sheet, range);
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

  styleSummary(summarySheet, { titleRows: [0] });
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
        completionStatusLabel(course)
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

  // Style the headers (row 6) + the key/value header block
  styleHeaders(myStatusSheet, 'A6:E6');
  styleSummary(myStatusSheet, { titleRows: [0] });

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
          completionStatusLabel(course)
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
  styleSummary(detailSheet, { titleRows: [0] });

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
          completionStatusLabel(course),
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
            completionStatusLabel(course)
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
  styleSummary(sheet, { titleRows: [0] });

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
            completionStatusLabel(course),
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
  styleSummary(listSheet, { titleRows: [0] });

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

  styleTable(summarySheet, 'A4:H4');
  styleSummary(summarySheet, { titleRows: [0] });
  summarySheet['!autofilter'] = { ref: `A4:H${summaryData.length}` };
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  // Write the workbook to file
  const excelFilename = `TrainingReport_AllSupervisors_${getDateString()}_Summary.xlsx`;
  XLSX.writeFile(workbook, excelFilename);
}

/**
 * Export an individual employee's status report to Excel.
 * Matches the "My Status Report" sheet style from the supervisor report.
 * @param {Object} reportData - From getEmployeeReport
 */
export function exportIndividualReportToExcel(reportData) {
  if (!reportData) return;

  const workbook = XLSX.utils.book_new();

  const rows = [];
  rows.push(['MY STATUS REPORT']);
  rows.push(['']);
  rows.push(['Name:', reportData.displayName]);
  rows.push(['Email:', reportData.email]);
  if (reportData.lastHireDate) {
    rows.push(['Date Hired:', new Date(reportData.lastHireDate).toLocaleDateString()]);
  }
  rows.push(['']);
  rows.push(['Was this report helpful?']);
  rows.push(['']);

  const headers = ['Course', 'Percent Completed', 'Date Hired', 'Date Completed', 'Status'];
  rows.push(headers);

  if (reportData.courses && reportData.courses.length > 0) {
    reportData.courses.forEach(course => {
      rows.push([
        formatCourseName(course.course),
        course.percentCompleted + '%',
        course.lastHireDate ? new Date(course.lastHireDate).toLocaleDateString() : '',
        course.dateCompleted ? new Date(course.dateCompleted).toLocaleDateString() : '',
        completionStatusLabel(course)
      ]);
    });
  } else {
    rows.push(['No course enrollment data', '', '', '', '']);
  }

  rows.push(['']);
  rows.push(['* Required/Compliance Course']);

  const sheet = XLSX.utils.aoa_to_sheet(rows);

  // Feedback Yes / No links on row 8 (index 7)
  addFeedbackLinks(sheet, 8);

  sheet['!cols'] = [
    { wch: 50 }, // Course
    { wch: 18 }, // Percent Completed
    { wch: 15 }, // Date Hired
    { wch: 15 }, // Date Completed
    { wch: 15 }  // Status
  ];

  // Style the header row
  const headerRowIndex = rows.findIndex(r => r[0] === 'Course');
  if (headerRowIndex >= 0) {
    styleHeaders(sheet, `A${headerRowIndex + 1}:E${headerRowIndex + 1}`);
  }
  styleSummary(sheet, { titleRows: [0] });

  XLSX.utils.book_append_sheet(workbook, sheet, 'My Status Report');

  const nameSafe = sanitizeName(reportData.displayName);
  XLSX.writeFile(workbook, `StatusReport_${nameSafe}_${getDateString()}.xlsx`);
}

/**
 * Build an Overview sheet row array for one or more cost center reports.
 * Columns: Cost Center, Region, Employees, Enrollments, Completions, Completion Rate
 * @param {Array} reports - Array of getCostCenterReport results
 * @returns {Object} { sheet, colWidths }
 */
function buildCostCenterOverviewSheet(reports) {
  const overviewRows = [
    ['Cost Center Overview'],
    ['Generated:', new Date().toLocaleString()],
    [''],
    ['Cost Center', 'Region', 'Employees', 'Enrollments', 'Completions', 'Completion Rate'],
  ];

  const sorted = [...reports].sort((a, b) => a.program.programName.localeCompare(b.program.programName));

  sorted.forEach(r => {
    overviewRows.push([
      r.program.programName,
      r.program.regionName || '',
      r.statistics.totalEmployees,
      r.statistics.totalEnrollments,
      r.statistics.totalCompletions,
      `${r.statistics.overallCompletionRate}%`,
    ]);
  });

  const sheet = XLSX.utils.aoa_to_sheet(overviewRows);
  styleHeaders(sheet, 'A4:F4');
  styleSummary(sheet, { titleRows: [0] });
  sheet['!cols'] = [
    { wch: 40 }, { wch: 25 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 16 }
  ];
  sheet['!autofilter'] = { ref: `A4:F${overviewRows.length}` };
  return sheet;
}

/**
 * Export a single cost center report to Excel
 * Sheets: Overview, Staff & Courses, List View
 * @param {Object} reportData - From getCostCenterReport
 */
export function exportCostCenterReportToExcel(reportData) {
  if (!reportData) return;

  const workbook = XLSX.utils.book_new();
  const { program, employees, statistics } = reportData;

  // --- Overview Sheet (single cost center) ---
  const overviewSheet = buildCostCenterOverviewSheet([reportData]);
  XLSX.utils.book_append_sheet(workbook, overviewSheet, 'Overview');

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
  styleSummary(summarySheet, { titleRows: [0] });
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
          completionStatusLabel(course)
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
  styleSummary(detailSheet, { titleRows: [0] });
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
          completionStatusLabel(course),
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

  // --- Overview Sheet (one row per cost center) ---
  const overviewSheet = buildCostCenterOverviewSheet(allReports);
  XLSX.utils.book_append_sheet(workbook, overviewSheet, 'Overview');

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
            completionStatusLabel(course)
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
  styleSummary(sheet, { titleRows: [0] });
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
            completionStatusLabel(course),
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
  styleSummary(listSheet, { titleRows: [0] });
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

  styleTable(sheet, 'A5:I5');
  styleSummary(sheet, { titleRows: [0] });
  sheet['!autofilter'] = { ref: `A5:I${data.length}` };
  XLSX.utils.book_append_sheet(workbook, sheet, 'Team Roster');

  // Write the workbook to file
  const excelFilename = `TrainingReport_Team_${getDateString()}_Roster.xlsx`;
  XLSX.writeFile(workbook, excelFilename);
}

/**
 * Render a leader's per-course status as a short cell label.
 */
function statusLabel(status) {
  switch (status) {
    case 'complete': return 'Complete';
    case 'incomplete': return 'In Progress';
    case 'missing': return 'Not Started';
    case 'na': return 'N/A';
    default: return '';
  }
}

/**
 * Export the Leadership Compliance report to Excel.
 *
 * Produces three sheets:
 *   1. "All Leaders"      - every leader (or current filter) with per-tracked-course status
 *   2. "Selected Detail"  - the selected/filtered leaders, per-course status grid
 *   3. "Cascade Roll-up"  - selected leaders with downstream leader counts + branch compliance
 *
 * @param {Object} reportData - { leaders, trackedCourses } (already filtered for page 1)
 * @param {Object} selection - { detailLeaders: Array, rollup: Array } drill-down for page 2
 * @param {string} [filename] - optional base filename (without extension)
 */
export function exportLeadershipReportToExcel(reportData, selection, filename) {
  if (!reportData || !reportData.leaders) {
    console.error('No leadership report data provided');
    return;
  }

  const { leaders, trackedCourses } = reportData;
  const { detailLeaders = [], rollup = [] } = selection || {};

  const workbook = XLSX.utils.book_new();

  const formatHire = (d) => (d ? new Date(d).toLocaleDateString() : '—');

  // Column letter for the last column given a count (supports up to 26+ via XLSX helper).
  const lastCol = (count) => XLSX.utils.encode_col(count - 1);

  // ---- Sheet 1: All Leaders ----
  const leaderHeader = ['Leader', 'Email', 'Supervisor(s)', 'Hire Date', ...trackedCourses, 'Compliance %'];
  const leaderRows = [
    leaderHeader,
    ...leaders.map(l => [
      l.displayName,
      l.isPlaceholder ? '—' : l.email,
      l.supervisors.map(s => s.name).join(', ') || '—',
      formatHire(l.hireDate),
      ...trackedCourses.map(c => statusLabel(l.courseStatus[c].status)),
      `${l.complianceRate}%`
    ])
  ];
  const allSheet = XLSX.utils.aoa_to_sheet(leaderRows);
  allSheet['!cols'] = [
    { wch: 28 }, { wch: 30 }, { wch: 28 }, { wch: 14 },
    ...trackedCourses.map(() => ({ wch: 18 })),
    { wch: 14 }
  ];
  // Course columns start after Leader/Email/Supervisor(s)/Hire Date (cols 0-3).
  const allCourseCols = trackedCourses.map((_, i) => 4 + i);
  styleTable(allSheet, `A1:${lastCol(leaderHeader.length)}1`, { statusCols: allCourseCols });
  allSheet['!autofilter'] = { ref: `A1:${lastCol(leaderHeader.length)}${leaderRows.length}` };
  XLSX.utils.book_append_sheet(workbook, allSheet, 'All Leaders');

  // ---- Sheet 2: Selected Detail ----
  const detailHeader = ['Leader', 'Hire Date', ...trackedCourses, 'Compliance %'];
  const detailRows = [
    detailHeader,
    ...detailLeaders.map(l => [
      l.displayName,
      formatHire(l.hireDate),
      ...trackedCourses.map(c => statusLabel(l.courseStatus[c].status)),
      `${l.complianceRate}%`
    ])
  ];
  const detailSheet = XLSX.utils.aoa_to_sheet(detailRows);
  detailSheet['!cols'] = [
    { wch: 28 }, { wch: 14 },
    ...trackedCourses.map(() => ({ wch: 18 })),
    { wch: 14 }
  ];
  // Course columns start after Leader/Hire Date (cols 0-1).
  const detailCourseCols = trackedCourses.map((_, i) => 2 + i);
  styleTable(detailSheet, `A1:${lastCol(detailHeader.length)}1`, { statusCols: detailCourseCols });
  detailSheet['!autofilter'] = { ref: `A1:${lastCol(detailHeader.length)}${detailRows.length}` };
  XLSX.utils.book_append_sheet(workbook, detailSheet, 'Selected Detail');

  // ---- Sheet 3: Cascade Roll-up ----
  const rollupHeader = ['Leader', 'Own Compliance %', 'Downstream Leaders', 'Branch Leaders', 'Branch Compliance %'];
  const rollupRows = [
    rollupHeader,
    ...rollup.map(r => [
      r.displayName,
      `${r.ownComplianceRate}%`,
      r.downstreamLeaderCount,
      r.branchLeaderCount,
      `${r.branchComplianceRate}%`
    ])
  ];
  const rollupSheet = XLSX.utils.aoa_to_sheet(rollupRows);
  rollupSheet['!cols'] = [{ wch: 28 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 20 }];
  styleHeaders(rollupSheet, 'A1:E1');
  rollupSheet['!autofilter'] = { ref: `A1:E${rollupRows.length}` };
  XLSX.utils.book_append_sheet(workbook, rollupSheet, 'Cascade Roll-up');

  const base = filename ? sanitizeName(filename) : `LeadershipCompliance_${getDateString()}`;
  XLSX.writeFile(workbook, `${base}.xlsx`);
}

/**
 * Export the Overall Completion Dashboard to Excel.
 *
 * Produces three sheets:
 *   1. "Core Trainings"     - org-wide required courses across all staff
 *   2. "Leadership Courses" - leadership courses scoped to leaders only
 *      (both: Course | Total Enrolled | Completed | Completion %)
 *   3. "All Employees"      - one row per employee with per-tracked-course
 *      status (Complete / In Progress / Not Started / N/A) + overall %.
 *
 * @param {Object} report - From buildDashboardReport
 *   ({ coreTrainings, leadershipCourses, employees, trackedCourses })
 * @param {string} [filename] - optional base filename (without extension)
 */
export function exportDashboardReportToExcel(report, filename) {
  if (!report) {
    console.error('No dashboard report data provided');
    return;
  }

  const workbook = XLSX.utils.book_new();

  const buildSummarySheet = (rows) => {
    const header = ['Course', 'Total Enrolled', 'Completed', 'Completion %'];
    const aoa = [
      header,
      ...rows.map(r => [r.course, r.enrolled, r.completed, `${r.completionRate}%`])
    ];
    const sheet = XLSX.utils.aoa_to_sheet(aoa);
    sheet['!cols'] = [{ wch: 45 }, { wch: 16 }, { wch: 14 }, { wch: 16 }];
    styleHeaders(sheet, 'A1:D1');
    sheet['!autofilter'] = { ref: `A1:D${aoa.length}` };
    return sheet;
  };

  XLSX.utils.book_append_sheet(
    workbook,
    buildSummarySheet(report.coreTrainings || []),
    'Core Trainings'
  );
  XLSX.utils.book_append_sheet(
    workbook,
    buildSummarySheet(report.leadershipCourses || []),
    'Leadership Courses'
  );

  // ---- Sheet 3: All Employees (per-course status grid) ----
  const trackedCourses = report.trackedCourses || [];
  const employees = report.employees || [];
  const empHeader = ['Name', 'Email', 'Leader', 'Hire Date', ...trackedCourses, 'Completion %'];
  const empAoa = [
    empHeader,
    ...employees.map(e => [
      e.displayName,
      e.email || '—',
      e.isLeader ? 'Yes' : 'No',
      e.hireDate ? new Date(e.hireDate).toLocaleDateString() : '—',
      ...trackedCourses.map(c => statusLabel(e.courseStatus[c])),
      `${e.completionRate}%`
    ])
  ];
  const empSheet = XLSX.utils.aoa_to_sheet(empAoa);
  empSheet['!cols'] = [
    { wch: 26 }, { wch: 30 }, { wch: 10 }, { wch: 14 },
    ...trackedCourses.map(() => ({ wch: 18 })),
    { wch: 14 }
  ];
  // Course status columns start after Name/Email/Leader/Hire Date (cols 0-3).
  const empCourseCols = trackedCourses.map((_, i) => 4 + i);
  const lastEmpCol = XLSX.utils.encode_col(empHeader.length - 1);
  styleTable(empSheet, `A1:${lastEmpCol}1`, { statusCols: empCourseCols });
  empSheet['!autofilter'] = { ref: `A1:${lastEmpCol}${empAoa.length}` };
  XLSX.utils.book_append_sheet(workbook, empSheet, 'All Employees');

  const base = filename ? sanitizeName(filename) : `CompletionDashboard_${getDateString()}`;
  XLSX.writeFile(workbook, `${base}.xlsx`);
}
