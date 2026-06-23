import { useState } from 'react';

/**
 * Sort-state plumbing: holds the active sort key and returns the matching
 * comparator from a map. Replaces the per-component `useState` + switch.
 * @param {string} defaultKey - Initial sort key
 * @param {Object<string, (a:any,b:any)=>number>} comparators - key -> comparator
 * @returns {{ sortBy: string, setSortBy: Function, comparator: Function }}
 */
export function useSortComparator(defaultKey, comparators) {
  const [sortBy, setSortBy] = useState(defaultKey);
  const comparator = comparators[sortBy] || (() => 0);
  return { sortBy, setSortBy, comparator };
}
