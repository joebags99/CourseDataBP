import { useState } from 'react';

/**
 * Manage a Set of "active" keys with a single toggle — used for expand/collapse
 * rows and multi-select selections that previously reimplemented this 6×.
 * @param {Iterable} [initial] - Initial keys
 * @returns {{ set: Set, toggle: (key:any)=>void, has: (key:any)=>boolean, setSet: Function, clear: ()=>void }}
 */
export function useToggleSet(initial = []) {
  const [set, setSet] = useState(() => new Set(initial));

  const toggle = (key) => {
    setSet(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const has = (key) => set.has(key);
  const clear = () => setSet(new Set());

  return { set, toggle, has, setSet, clear };
}
