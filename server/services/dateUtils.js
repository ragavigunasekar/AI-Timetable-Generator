/**
 * dateUtils.js — Shared date / working-day utilities (server-side)
 *
 * This is the canonical server implementation of parseWorkingDays.
 * Imported by timetableOptimizer.js.
 * The client-side mirror lives in client/src/utils/dateUtils.ts.
 */

const ORDERED_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Normalize any day abbreviation to canonical 3-letter short form.
 * @param {string} value
 * @returns {string|null}
 */
function normalizeDay(value) {
  if (!value) return null;
  const lower = value.toLowerCase().trim();
  if (lower.startsWith('mon')) return 'Mon';
  if (lower.startsWith('tue')) return 'Tue';
  if (lower.startsWith('wed')) return 'Wed';
  if (lower.startsWith('thu')) return 'Thu';
  if (lower.startsWith('fri')) return 'Fri';
  if (lower.startsWith('sat')) return 'Sat';
  if (lower.startsWith('sun')) return 'Sun';
  return null;
}

/**
 * Parse a working-days string into an ordered array of canonical day names.
 *
 * Supported formats (backwards-compatible with existing database values):
 *   • Range format:  "Mon-Fri"     → ['Mon','Tue','Wed','Thu','Fri']
 *   • Comma format:  "Mon,Wed,Fri" → ['Mon','Wed','Fri']
 *   • Empty / null / undefined     → ['Mon','Tue','Wed','Thu','Fri']
 *
 * @param {string|null|undefined} workingDays
 * @returns {string[]}
 */
function parseWorkingDays(workingDays) {
  const DEFAULT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const trimmed = workingDays?.trim();
  if (!trimmed) return DEFAULT;

  const clean = trimmed.replace(/\s+/g, '');

  // Range format: "Mon-Fri"
  const rangeMatch = clean.match(/^([A-Za-z]+)-([A-Za-z]+)$/);
  if (rangeMatch) {
    const from = normalizeDay(rangeMatch[1]);
    const to = normalizeDay(rangeMatch[2]);
    if (from && to) {
      const startIdx = ORDERED_DAYS.indexOf(from);
      const endIdx = ORDERED_DAYS.indexOf(to);
      if (startIdx >= 0 && endIdx >= startIdx) {
        return ORDERED_DAYS.slice(startIdx, endIdx + 1);
      }
    }
  }

  // Comma-separated format: "Mon,Tue,Wed"
  const parsed = clean
    .split(',')
    .map((d) => normalizeDay(d))
    .filter((d) => d !== null);

  // Deduplicate and restore calendar order
  const seen = new Set();
  const ordered = [];
  for (const day of ORDERED_DAYS) {
    if (parsed.includes(day) && !seen.has(day)) {
      ordered.push(day);
      seen.add(day);
    }
  }

  return ordered.length > 0 ? ordered : DEFAULT;
}

export { parseWorkingDays, normalizeDay, ORDERED_DAYS };
