/**
 * Domain primitives — the single source of truth for the small calculations that
 * used to be copy-pasted across utils, reports, and the exporter.
 *
 * Several reports intentionally use DIFFERENT rules (e.g. some count a course
 * "complete" only at 100%, others also accept a completion date). To keep every
 * export byte-identical, those differences are expressed here as explicit
 * options rather than as divergent copies.
 */

/**
 * Build an employee's display name: preferred (falling back to legal) + lastname.
 * @param {Object} record - A row/record with name fields
 * @param {{trim?: boolean}} [opts] - Whether to trim (some call sites do, some don't)
 * @returns {string}
 */
export function buildDisplayName(record, { trim = false } = {}) {
  const name = `${record.preferredFirstname || record.legalFirstname} ${record.lastname}`;
  return trim ? name.trim() : name;
}

/**
 * Whether a course enrollment counts as complete.
 * @param {Object} course - { percentCompleted, dateCompleted }
 * @param {{strict?: boolean}} [opts] - strict ⇒ 100% only; otherwise 100% OR has a completion date
 * @returns {boolean}
 */
export function isCourseComplete(course, { strict = false } = {}) {
  if (strict) return course.percentCompleted === 100;
  return course.percentCompleted === 100 || course.dateCompleted !== null;
}

/**
 * Format a completion rate the way the various reports expect.
 * Returns the number 0 when there is nothing to divide (matches existing code).
 * @param {number} completed
 * @param {number} total
 * @param {{mode?: 'int'|'fixed1'|'number1'}} [opts]
 *   - 'int'     → Math.round integer (analytics / new-hire / YoY)
 *   - 'fixed1'  → toFixed(1) string (supervisor / cost center / individual)
 *   - 'number1' → Number(toFixed(1)) (leadership)
 * @returns {number|string}
 */
export function completionRate(completed, total, { mode = 'fixed1' } = {}) {
  if (total <= 0) return 0;
  const pct = (completed / total) * 100;
  if (mode === 'int') return Math.round(pct);
  if (mode === 'number1') return Number(pct.toFixed(1));
  return pct.toFixed(1);
}

/**
 * The "Completed" / "In Progress" label used throughout the Excel exporter and
 * some component tables (strict 100% rule).
 * @param {Object} course - { percentCompleted }
 * @returns {'Completed'|'In Progress'}
 */
export function completionStatusLabel(course) {
  return course.percentCompleted === 100 ? 'Completed' : 'In Progress';
}

/**
 * Normalize the raw record's course fields into the standard course object used
 * by the hierarchy, cost-center, and individual builders.
 * @param {Object} record
 * @returns {Object}
 */
export function mapCourseRecord(record) {
  return {
    course: record.course,
    percentCompleted: record.percentCompleted,
    enrolledAt: record.enrolledAt,
    dateCompleted: record.dateCompleted,
    lastHireDate: record.lastHireDate,
    daysToComplete: record.daysToComplete
  };
}

// ----- name matching (moved here from the old supervisorHierarchy.js) -----

/** Lowercase + collapse whitespace. */
export function normalizeName(name) {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Drop middle names/initials for flexible matching:
 * "Kari N Daniel" -> "kari daniel".
 */
export function removeMiddleName(name) {
  const normalized = normalizeName(name);
  const parts = normalized.split(' ');
  if (parts.length <= 2) return normalized;
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

/** Whether two names refer to the same person (handles middle initials). */
export function namesMatch(employeeName, supervisorName) {
  const empNorm = normalizeName(employeeName);
  const supNorm = normalizeName(supervisorName);
  if (empNorm === supNorm) return true;
  return removeMiddleName(employeeName) === removeMiddleName(supervisorName);
}

/**
 * Current date as MMDDYYYY, used for export filenames.
 * @returns {string}
 */
export function getDateString() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const year = now.getFullYear();
  return `${month}${day}${year}`;
}
