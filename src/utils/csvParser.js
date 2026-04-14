import Papa from 'papaparse';
import { parse, isValid } from 'date-fns';

/**
 * Parse date strings from UKG Learning Pro format (e.g., "2023-01-17 CST")
 * @param {string} dateStr - Date string to parse
 * @returns {Date|null} Parsed date or null if invalid
 */
export function parseDate(dateStr) {
  if (!dateStr || dateStr.trim() === '') {
    return null;
  }

  // Remove timezone abbreviations (CST, EST, UTC, etc.)
  const cleanDateStr = dateStr.replace(/\s+(CST|EST|PST|MST|CDT|EDT|PDT|MDT|UTC|GMT)$/i, '').trim();

  // Try parsing as ISO date format (YYYY-MM-DD)
  const date = parse(cleanDateStr, 'yyyy-MM-dd', new Date());

  if (isValid(date)) {
    return date;
  }

  // Try other common formats
  const formats = [
    'yyyy-MM-dd HH:mm:ss',
    'MM/dd/yyyy',
    'MM-dd-yyyy',
    'M/d/yyyy'
  ];

  for (const format of formats) {
    try {
      const parsedDate = parse(cleanDateStr, format, new Date());
      if (isValid(parsedDate)) {
        return parsedDate;
      }
    } catch (e) {
      // Continue to next format
    }
  }

  return null;
}

/**
 * Parse CSV file from UKG Learning Pro
 * @param {File} file - CSV file to parse
 * @returns {Promise<Array>} Array of parsed course completion records
 */
export function parseCSV(file) {
  return new Promise((resolve, reject) => {
    // First, parse without headers to get all rows
    // Use comma as delimiter (UKG exports are CSV, not TSV)
    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      delimiter: ',', // Comma delimiter for CSV files
      complete: (results) => {
        try {
          console.log('Total rows parsed:', results.data.length);
          console.log('First 10 rows:', results.data.slice(0, 10));

          // Find the header row by looking for "Legal Firstname" or "Email"
          // Must have at least 5 columns to avoid title rows
          let headerRowIndex = -1;
          for (let i = 0; i < Math.min(15, results.data.length); i++) {
            const row = results.data[i];
            console.log(`Row ${i} has ${row.length} columns:`, row);

            // Check if this row contains the expected headers AND has multiple columns
            if (row.length >= 5 && row.some(cell =>
              cell && (
                cell.includes('Legal Firstname') ||
                cell.includes('Email')
              )
            )) {
              headerRowIndex = i;
              console.log('Found header row at index:', i);
              break;
            }
          }

          if (headerRowIndex === -1) {
            reject(new Error('Could not find header row in CSV file. Expected columns: Legal Firstname, Email, Course'));
            return;
          }

          // Extract headers and normalize them
          const headerRow = results.data[headerRowIndex];
          console.log('Raw header row:', headerRow);
          console.log('Header row length:', headerRow.length);

          const headers = headerRow.map(h => {
            const trimmed = (h || '').trim().replace(/^"|"$/g, ''); // Remove quotes
            const headerMap = {
              'Legal Firstname': 'legalFirstname',
              'Preferred Firstname': 'preferredFirstname',
              'Lastname': 'lastname',
              'Email': 'email',
              'Course': 'course',
              '% Completed': 'percentCompleted',
              'Supervisor': 'supervisor',
              'Enrolled At': 'enrolledAt',
              'Date Completed': 'dateCompleted',
              'Last Hire Date': 'lastHireDate',
              'PROGRAM': 'program'
            };
            return headerMap[trimmed] || trimmed;
          });

          console.log('Normalized headers:', headers);
          console.log('Column count:', headers.length);

          // Get data rows (everything after header row)
          const dataRows = results.data.slice(headerRowIndex + 1);
          console.log('Data rows count:', dataRows.length);
          console.log('First data row:', dataRows[0]);

          // Transform and validate data
          const parsedData = dataRows
            .filter(row => {
              // Find email and course columns
              const emailIdx = headers.indexOf('email');
              const courseIdx = headers.indexOf('course');

              if (emailIdx === -1 || courseIdx === -1) return false;

              const hasEmail = row[emailIdx] && row[emailIdx].trim() !== '';
              const hasCourse = row[courseIdx] && row[courseIdx].trim() !== '';
              return hasEmail && hasCourse;
            })
            .map(row => {
              // Map row values to headers
              const rowData = {};
              headers.forEach((header, idx) => {
                rowData[header] = row[idx] || '';
              });

              return {
                legalFirstname: rowData.legalFirstname || '',
                preferredFirstname: rowData.preferredFirstname || '',
                lastname: rowData.lastname || '',
                email: rowData.email ? rowData.email.toLowerCase().trim() : '',
                course: rowData.course ? rowData.course.trim() : '',
                percentCompleted: parseFloat(rowData.percentCompleted) || 0,
                supervisor: rowData.supervisor ? rowData.supervisor.trim() : '',
                program: rowData.program ? rowData.program.trim() : '',
                enrolledAt: parseDate(rowData.enrolledAt),
                dateCompleted: parseDate(rowData.dateCompleted),
                lastHireDate: parseDate(rowData.lastHireDate),
                daysToComplete: calculateDaysToComplete(
                  parseDate(rowData.lastHireDate),
                  parseDate(rowData.dateCompleted)
                )
              };
            });

          console.log('Parsed data count:', parsedData.length);
          console.log('First parsed record:', parsedData[0]);

          if (parsedData.length === 0) {
            reject(new Error('No valid data found in CSV file. Please ensure the file has the correct format with Email and Course columns.'));
            return;
          }

          resolve(parsedData);
        } catch (error) {
          console.error('Parse error:', error);
          reject(new Error(`Failed to parse CSV: ${error.message}`));
        }
      },
      error: (error) => {
        console.error('Papa parse error:', error);
        reject(new Error(`CSV parsing error: ${error.message}`));
      }
    });
  });
}

/**
 * Calculate days between hire date and completion
 * @param {Date|null} hireDate
 * @param {Date|null} completedDate
 * @returns {number|null}
 */
function calculateDaysToComplete(hireDate, completedDate) {
  if (!hireDate || !completedDate) {
    return null;
  }

  const diffTime = Math.abs(completedDate - hireDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Export data to CSV
 * @param {Array} data - Data to export
 * @param {string} filename - Name of the file
 */
export function exportToCSV(data, filename = 'export.csv') {
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
