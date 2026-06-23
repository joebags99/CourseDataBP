/**
 * Single per-employee aggregation primitive.
 *
 * The same "walk rows once, build an identity per email, push a course object,
 * tally as you go" pattern was previously reimplemented in five places. This is
 * the one shared implementation; callers supply how to key, what the identity
 * looks like, and how to map/observe each record.
 *
 * @param {Array} rawData - Parsed CSV records
 * @param {Object} opts
 * @param {(record:Object)=>string} [opts.keyOf] - Map key (defaults to lowercased email)
 * @param {(record:Object)=>Object} opts.identity - Built once per key from its first record
 * @param {(record:Object, entry:Object)=>Object} [opts.mapCourse] - Pushed onto entry.courses
 * @param {(entry:Object, record:Object)=>void} [opts.onRecord] - Runs for every record (tallies)
 * @param {(record:Object)=>boolean} [opts.skip] - Skip records returning true
 * @returns {Map<string, Object>} key -> { ...identity, courses: [] }
 */
export function aggregateByEmail(rawData, { keyOf, identity, mapCourse, onRecord, skip } = {}) {
  const key = keyOf || ((r) => r.email.toLowerCase());
  const map = new Map();

  for (const record of rawData) {
    if (skip && skip(record)) continue;

    const k = key(record);
    if (!map.has(k)) {
      map.set(k, { ...identity(record), courses: [] });
    }
    const entry = map.get(k);

    if (mapCourse) entry.courses.push(mapCourse(record, entry));
    if (onRecord) onRecord(entry, record);
  }

  return map;
}
