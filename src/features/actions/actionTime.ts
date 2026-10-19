export const CALENDAR_TIME_ZONE = "Asia/Seoul";
export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "0001-01-01") return false;
  const parsed = new Date(value + "T00:00:00Z");
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
export function validTime(value: string): boolean { return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value); }
export function validTimeZone(value: string): boolean {
  try { new Intl.DateTimeFormat("en", { timeZone: value }).format(); return true; } catch { return false; }
}
function localParts(instant: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(instant));
  const get = (type: string) => parts.find(part => part.type === type)!.value;
  return { date: get("year") + "-" + get("month") + "-" + get("day"), time: get("hour") + ":" + get("minute") };
}
const instantCache = new Map<string, number | null>();
// Resolve wall-clock time by checking actual zone offsets. Gaps and folds return null.
export function exactInstant(date: string, time: string, timeZone: string): number | null {
  const key = JSON.stringify([date, time, timeZone]);
  if (instantCache.has(key)) return instantCache.get(key)!;
  if (!validDate(date) || !validTime(time) || !validTimeZone(timeZone)) return null;
  const wall = Date.parse(date + "T" + time + ":00Z");
  const offsets = new Set<number>();
  for (let hours = -36; hours <= 36; hours += 6) {
    const instant = wall + hours * 3_600_000;
    const parts = localParts(instant, timeZone);
    offsets.add(Date.parse(parts.date + "T" + parts.time + ":00Z") - instant);
  }
  const matches = [...offsets].map(offset => wall - offset).filter(instant => {
    const parts = localParts(instant, timeZone);
    return parts.date === date && parts.time === time;
  });
  const result = matches.length === 1 ? matches[0] : null;
  if (instantCache.size > 4000) instantCache.clear();
  instantCache.set(key, result);
  return result;
}
export function calendarDate(instant: number = Date.now(), zone = CALENDAR_TIME_ZONE): string {
  return localParts(instant, zone).date;
}
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(date + "T00:00:00Z") + days * 86_400_000).toISOString().slice(0, 10);
}
