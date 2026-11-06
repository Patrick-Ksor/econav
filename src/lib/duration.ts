/**
 * Formats a duration in minutes for display, stepping up to the coarsest unit
 * that keeps it readable: minutes under an hour, hours+minutes under a day,
 * days+hours beyond that. A trailing zero remainder is dropped (e.g. "2h", not
 * "2h 0m") rather than always showing both units.
 */
export function formatDuration(totalMinutes: number): string {
  const minutes = Math.round(totalMinutes);

  if (minutes < 60) {
    return `${minutes} min`;
  }

  if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes === 0 ? `${hours}h` : `${hours}h ${remainingMinutes}m`;
  }

  const days = Math.floor(minutes / 1440);
  const remainingHours = Math.floor((minutes % 1440) / 60);
  return remainingHours === 0 ? `${days}d` : `${days}d ${remainingHours}h`;
}
