/**
 * dateUtils.ts — Shared date / working-day utilities (client-side)
 *
 * This is the SINGLE canonical implementation of `parseWorkingDays`.
 * All client-side code (store, pages, hooks) must import from here.
 *
 * The server-side mirror lives in server/services/dateUtils.js.
 */

export const ORDERED_DAYS = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
] as const;

export type WorkingDay = (typeof ORDERED_DAYS)[number];

/**
 * Normalize any day abbreviation to a canonical 3-letter form.
 * Returns null if the input cannot be recognized as a day.
 *
 * @example
 *   normalizeDay("monday")   → "Mon"
 *   normalizeDay("THURSDAY") → "Thu"
 *   normalizeDay("xyz")      → null
 */
export function normalizeDay(value: string): WorkingDay | null {
  if (!value) return null;
  const lower = value.toLowerCase().trim();
  if (lower.startsWith("mon")) return "Mon";
  if (lower.startsWith("tue")) return "Tue";
  if (lower.startsWith("wed")) return "Wed";
  if (lower.startsWith("thu")) return "Thu";
  if (lower.startsWith("fri")) return "Fri";
  if (lower.startsWith("sat")) return "Sat";
  if (lower.startsWith("sun")) return "Sun";
  return null;
}

/**
 * Parse a working-days string into an ordered array of canonical day names.
 *
 * Supported formats (backwards-compatible with existing database values):
 *   • Range format:  "Mon-Fri"        → ["Mon","Tue","Wed","Thu","Fri"]
 *   • Comma format:  "Mon,Wed,Fri"    → ["Mon","Wed","Fri"]
 *   • Mixed whitespace is stripped before parsing.
 *   • Empty / null / undefined → defaults to Mon–Fri.
 *
 * The result is always returned in calendar order (Mon first).
 *
 * @example
 *   parseWorkingDays("Mon-Fri")          → ["Mon","Tue","Wed","Thu","Fri"]
 *   parseWorkingDays("Mon,Tue,Wed")      → ["Mon","Tue","Wed"]
 *   parseWorkingDays("Mon-Sat")          → ["Mon","Tue","Wed","Thu","Fri","Sat"]
 *   parseWorkingDays("")                 → ["Mon","Tue","Wed","Thu","Fri"]
 */
export function parseWorkingDays(
  workingDays: string | null | undefined
): WorkingDay[] {
  const DEFAULT: WorkingDay[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const trimmed = workingDays?.trim();
  if (!trimmed) return DEFAULT;

  const clean = trimmed.replace(/\s+/g, "");

  // --- Range format: "Mon-Fri" ---
  const rangeMatch = clean.match(/^([A-Za-z]+)-([A-Za-z]+)$/);
  if (rangeMatch) {
    const from = normalizeDay(rangeMatch[1]);
    const to = normalizeDay(rangeMatch[2]);
    if (from && to) {
      const startIdx = ORDERED_DAYS.indexOf(from);
      const endIdx = ORDERED_DAYS.indexOf(to);
      if (startIdx >= 0 && endIdx >= startIdx) {
        return ORDERED_DAYS.slice(startIdx, endIdx + 1) as WorkingDay[];
      }
    }
  }

  // --- Comma-separated format: "Mon,Tue,Wed" ---
  const parsed = clean
    .split(",")
    .map((d) => normalizeDay(d))
    .filter((d): d is WorkingDay => d !== null);

  // Deduplicate and restore calendar order
  const seen = new Set<WorkingDay>();
  const ordered: WorkingDay[] = [];
  for (const day of ORDERED_DAYS) {
    if (parsed.includes(day) && !seen.has(day)) {
      ordered.push(day);
      seen.add(day);
    }
  }

  return ordered.length > 0 ? ordered : DEFAULT;
}

/**
 * Convert any working-days string (range or comma) to a canonical
 * comma-separated string suitable for persisting to the database.
 *
 * Always produces comma format on save so existing data migrates
 * transparently on first save.
 *
 * @example
 *   normalizeWorkingDaysString("Mon-Fri")   → "Mon,Tue,Wed,Thu,Fri"
 *   normalizeWorkingDaysString("Mon,Wed")   → "Mon,Wed"
 *   normalizeWorkingDaysString("")          → "Mon,Tue,Wed,Thu,Fri"
 */
export function normalizeWorkingDaysString(
  workingDays: string | null | undefined
): string {
  return parseWorkingDays(workingDays).join(",");
}
