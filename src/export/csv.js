import Papa from 'papaparse';
import { getDateString } from '../data/dataModel';

export { getDateString };

/**
 * Export an array of row objects to a downloaded CSV file.
 * Column order follows the keys of the first row (Papa default) — unchanged.
 * @param {Array<Object>} data - Rows to export
 * @param {string} [filename] - Download filename
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
