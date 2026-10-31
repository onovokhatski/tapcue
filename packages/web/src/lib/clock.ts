/** "2026-10-30T14:05:09.123Z" → "14:05:09.123" in the browser's time zone. */
export function clock(iso: string): string {
  const time = new Date(iso);
  const pad = (n: number, size = 2) => String(n).padStart(size, '0');
  return `${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}.${pad(time.getMilliseconds(), 3)}`;
}
