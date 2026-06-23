import { useState, useEffect } from 'react';

/**
 * Course multi-select filter state, standardized as an array. Selection defaults
 * to "all courses" once the list is available (the behavior every report used).
 * Replaces the per-component copies of toggle / select-all / deselect-all.
 * @param {string[]} allCourses - The full (memoized) list of course names
 * @returns {{ selected: string[], setSelected: Function, toggle, selectAll, deselectAll, isSelected }}
 */
export function useCourseFilter(allCourses) {
  const [selected, setSelected] = useState([]);

  // Initialize/refresh to all courses whenever the available list changes.
  useEffect(() => {
    if (allCourses.length > 0) {
      setSelected(allCourses);
    }
  }, [allCourses]);

  const toggle = (course) => {
    setSelected(prev =>
      prev.includes(course) ? prev.filter(c => c !== course) : [...prev, course]
    );
  };

  const selectAll = () => setSelected(allCourses);
  const deselectAll = () => setSelected([]);
  const isSelected = (course) => selected.includes(course);

  return { selected, setSelected, toggle, selectAll, deselectAll, isSelected };
}
