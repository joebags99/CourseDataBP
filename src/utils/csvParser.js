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

  // Remove timezone abbreviations (CST, EST, etc.)
  const cleanDateStr = dateStr.replace(/\s+(CST|EST|PST|MST|CDT|EDT|PDT|MDT)$/i, '').trim();

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
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => {
        // Normalize header names
        const headerMap = {
          'Legal Firstname': 'legalFirstname',
          'Preferred Firstname': 'preferredFirstname',
          'Lastname': 'lastname',
          'Email': 'email',
          'Course': 'course',
          '% Completed': 'percentCompleted',
          'Enrolled At': 'enrolledAt',
          'Date Completed': 'dateCompleted'
        };
        return headerMap[header] || header;
      },
      complete: (results) => {
        try {
          // Skip first 7 rows (metadata)
          const dataRows = results.data.slice(7);

          // Transform and validate data
          const parsedData = dataRows
            .filter(row => row.email && row.course) // Filter out invalid rows
            .map(row => ({
              legalFirstname: row.legalFirstname || '',
              preferredFirstname: row.preferredFirstname || '',
              lastname: row.lastname || '',
              email: row.email ? row.email.toLowerCase().trim() : '',
              course: row.course ? row.course.trim() : '',
              percentCompleted: parseFloat(row.percentCompleted) || 0,
              enrolledAt: parseDate(row.enrolledAt),
              dateCompleted: parseDate(row.dateCompleted),
              // Calculate days to completion
              daysToComplete: calculateDaysToComplete(
                parseDate(row.enrolledAt),
                parseDate(row.dateCompleted)
              )
            }));

          resolve(parsedData);
        } catch (error) {
          reject(new Error(`Failed to parse CSV: ${error.message}`));
        }
      },
      error: (error) => {
        reject(new Error(`CSV parsing error: ${error.message}`));
      }
    });
  });
}

/**
 * Calculate days between enrollment and completion
 * @param {Date|null} enrolledDate
 * @param {Date|null} completedDate
 * @returns {number|null}
 */
function calculateDaysToComplete(enrolledDate, completedDate) {
  if (!enrolledDate || !completedDate) {
    return null;
  }

  const diffTime = Math.abs(completedDate - enrolledDate);
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
