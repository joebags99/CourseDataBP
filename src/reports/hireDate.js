import { ONBOARDING_WINDOW_DAYS } from '../config/onboarding';

/**
 * Hire-date / tenure helpers.
 * (Required-course config now lives in ../config/onboarding.js.)
 */

/**
 * Calculate days since hire date
 * @param {Date|null} hireDate
 * @returns {number|null} Days since hire, or null if no hire date
 */
export function calculateDaysSinceHire(hireDate) {
  if (!hireDate) return null;

  const now = new Date();
  const diffTime = now - hireDate;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Calculate tenure bracket
 * @param {number|null} daysSinceHire
 * @returns {string}
 */
export function getTenureBracket(daysSinceHire) {
  if (daysSinceHire === null) return 'Unknown';
  if (daysSinceHire < 180) return '0-6 months';
  if (daysSinceHire < 365) return '6-12 months';
  if (daysSinceHire < 730) return '1-2 years';
  return '2+ years';
}

/**
 * Get hire year from hire date
 * @param {Date|null} hireDate
 * @returns {number|null}
 */
export function getHireYear(hireDate) {
  if (!hireDate) return null;
  return hireDate.getFullYear();
}

/**
 * Check if staff member is within onboarding window
 * @param {Date|null} hireDate
 * @returns {boolean}
 */
export function isWithinOnboardingWindow(hireDate) {
  const daysSinceHire = calculateDaysSinceHire(hireDate);
  return daysSinceHire !== null && daysSinceHire <= ONBOARDING_WINDOW_DAYS;
}

/**
 * Check if staff member is past onboarding window
 * @param {Date|null} hireDate
 * @returns {boolean}
 */
export function isPastOnboardingWindow(hireDate) {
  const daysSinceHire = calculateDaysSinceHire(hireDate);
  return daysSinceHire !== null && daysSinceHire > ONBOARDING_WINDOW_DAYS;
}
