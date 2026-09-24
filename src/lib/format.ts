/**
 * Nigeria wall-clock formatting (Africa/Lagos, UTC+1, no DST).
 * Matches the convention used across the admin pages: shift +1h, format in UTC.
 */
export function formatKickoffWat(iso: string): string {
  const shifted = new Date(new Date(iso).getTime() + 3600_000);
  return `${shifted.toLocaleString("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })} WAT`;
}
