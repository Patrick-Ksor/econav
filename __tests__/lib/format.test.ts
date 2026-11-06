import { formatDuration } from '@/lib/duration';
import { formatSignedUsd, formatUsd } from '@/lib/format';
import { formatRelativeTripDate, getTimeOfDayGreeting } from '@/lib/relative-date';

describe('formatUsd', () => {
  test.each([
    [7.5, '$7.50'],
    [0, '$0.00'],
    [1284.45, '$1,284.45'],
    [3.695, '$3.70'], // half-up, so every screen shows the same price
    [0.005, '$0.01'],
  ])('formats %p as %p', (amount, expected) => {
    expect(formatUsd(amount)).toBe(expected);
  });

  test('uses a true minus sign for negatives, as in the design', () => {
    expect(formatUsd(-0.85)).toBe('−$0.85');
    expect(formatUsd(-1234.5)).toBe('−$1,234.50');
  });
});

describe('formatSignedUsd', () => {
  test('prefixes gains with +', () => {
    expect(formatSignedUsd(4.05)).toBe('+$4.05');
  });

  test('zero reads as a (non-negative) gain', () => {
    expect(formatSignedUsd(0)).toBe('+$0.00');
  });

  test('losses use the minus sign and no +', () => {
    expect(formatSignedUsd(-0.85)).toBe('−$0.85');
  });
});

describe('formatDuration', () => {
  test.each([
    [0, '0 min'],
    [45, '45 min'],
    [44.6, '45 min'], // rounds to the nearest minute
    [59, '59 min'],
    [60, '1h'],
    [90, '1h 30m'],
    [125, '2h 5m'],
    [1439, '23h 59m'],
    [1440, '1d'],
    [1500, '1d 1h'],
    [2880, '2d'],
  ])('%p minutes → %p', (minutes, expected) => {
    expect(formatDuration(minutes)).toBe(expected);
  });
});

describe('formatRelativeTripDate', () => {
  const now = new Date(2026, 9, 27, 18, 0); // Oct 27 2026, 6:00 PM local

  test('same day shows "Today" with the time', () => {
    const iso = new Date(2026, 9, 27, 10, 42).toISOString();
    expect(formatRelativeTripDate(iso, now)).toMatch(/^Today, 10:42\sAM$/);
  });

  test('previous day shows "Yesterday" with the time', () => {
    const iso = new Date(2026, 9, 26, 17, 40).toISOString();
    expect(formatRelativeTripDate(iso, now)).toMatch(/^Yesterday, 5:40\sPM$/);
  });

  test('anything older shows month and day', () => {
    const iso = new Date(2026, 9, 24, 9, 0).toISOString();
    expect(formatRelativeTripDate(iso, now)).toBe('Oct 24');
  });

  test('"yesterday" works across a month boundary', () => {
    const first = new Date(2026, 10, 1, 8, 0);
    const iso = new Date(2026, 9, 31, 20, 0).toISOString();
    expect(formatRelativeTripDate(iso, first)).toMatch(/^Yesterday,/);
  });
});

describe('getTimeOfDayGreeting', () => {
  test.each([
    [0, 'Good morning'],
    [11, 'Good morning'],
    [12, 'Good afternoon'],
    [17, 'Good afternoon'],
    [18, 'Good evening'],
    [23, 'Good evening'],
  ])('%p:00 → %p', (hour, expected) => {
    expect(getTimeOfDayGreeting(new Date(2026, 9, 27, hour))).toBe(expected);
  });
});
