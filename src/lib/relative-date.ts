const TIME_FORMAT = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
const MONTH_DAY_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

function isSameCalendarDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** "Today, 5:15 PM" / "Yesterday, 5:15 PM" / "Oct 24" for anything older. */
export function formatRelativeTripDate(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (isSameCalendarDay(date, now)) {
    return `Today, ${TIME_FORMAT.format(date)}`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameCalendarDay(date, yesterday)) {
    return `Yesterday, ${TIME_FORMAT.format(date)}`;
  }
  return MONTH_DAY_FORMAT.format(date);
}

export function getTimeOfDayGreeting(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
