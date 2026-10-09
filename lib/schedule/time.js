// lib/schedule/time.js
//
// Central schedule date/time helper — the schedule domain's business
// timezone is FIXED to Africa/Cairo (see SCHEDULE_TIMEZONE). All teacher
// input and all display/recurrence math must go through this module so no
// code path silently falls back to the server/browser timezone.
//
// Implemented with Intl.DateTimeFormat only — no additional date library.
// Storage stays regular MongoDB Date (absolute instants); conversion from
// Cairo wall-clock happens here.

export const SCHEDULE_TIMEZONE = "Africa/Cairo";

let partsFormatter = null;
function formatter() {
  if (!partsFormatter) {
    partsFormatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: SCHEDULE_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }
  return partsFormatter;
}

/** Cairo wall-clock parts of an instant: { year, month, day, hour, minute }. */
export function getCairoParts(date) {
  const parts = Object.fromEntries(
    formatter()
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  );
  // Some ICU builds emit hour "24" for midnight — normalize to 0.
  const hour = parseInt(parts.hour, 10) % 24;
  return {
    year: parseInt(parts.year, 10),
    month: parseInt(parts.month, 10),
    day: parseInt(parts.day, 10),
    hour,
    minute: parseInt(parts.minute, 10),
  };
}

/** Offset (ms) of Africa/Cairo at the given instant (Cairo wall-clock − UTC). */
function cairoOffsetMs(date) {
  const p = getCairoParts(date);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - date.getTime();
}

/**
 * Convert a Cairo wall-clock date/time to an absolute Date.
 * `date` "YYYY-MM-DD", `time` "HH:mm" (teacher-entered Egypt time).
 * Two-pass resolution handles Egypt's DST transitions (UTC+2 / UTC+3).
 */
export function cairoToUTC({ date, time }) {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const asUTC = Date.UTC(y, m - 1, d, hh, mm);
  let ts = asUTC;
  for (let i = 0; i < 2; i++) {
    ts = asUTC - cairoOffsetMs(new Date(ts));
  }
  return new Date(ts);
}

/**
 * Shift an instant by whole CALENDAR days in Cairo (not 7*24h), preserving
 * the Cairo wall-clock time. This is what keeps "every Monday 6:00 PM
 * Cairo" on Monday 6:00 PM Cairo across DST transitions.
 */
export function addCairoDays(date, days) {
  const p = getCairoParts(date);
  const asUTC = Date.UTC(p.year, p.month - 1, p.day + days, p.hour, p.minute);
  let ts = asUTC;
  for (let i = 0; i < 2; i++) {
    ts = asUTC - cairoOffsetMs(new Date(ts));
  }
  return new Date(ts);
}

/** Weekday (0=Sun..6=Sat) of the CAIRO calendar date of an instant. */
export function cairoWeekday(date) {
  const p = getCairoParts(date);
  return new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
}

/** "YYYY-MM-DD" of the Cairo calendar date. */
export function cairoDateKey(date) {
  const p = getCairoParts(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** "HH:mm" of the Cairo wall-clock time. */
export function cairoTimeKey(date) {
  const p = getCairoParts(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** Display string "YYYY-MM-DD HH:mm" in Cairo (Latin digits). */
export function formatCairo(date) {
  return `${cairoDateKey(date)} ${cairoTimeKey(date)}`;
}
