import { fireEvent, screen } from '@testing-library/react-native';

import { SavingsScreen } from '@/features/savings/SavingsScreen';

import { mockApi } from '../helpers/api';
import { trip } from '../helpers/fixtures';
import { mockRouter, renderScreen, resetAppState } from '../helpers/render';

const SUMMARY = { tripCount: 26, totalSavingsDollars: 128.45, totalSavingsGallons: 8.4, monthSavingsDollars: 34.2 };
const EMPTY_SUMMARY = { tripCount: 0, totalSavingsDollars: 0, totalSavingsGallons: 0, monthSavingsDollars: 0 };

const hoursAgo = (n: number) => new Date(Date.now() - n * 3_600_000).toISOString();
const monthName = (d = new Date()) => new Intl.DateTimeFormat('en-US', { month: 'long' }).format(d);

const server = (trips: unknown[], summary: unknown = SUMMARY) =>
  mockApi({ 'GET /api/trips': trips, 'GET /api/trips/summary': summary });

beforeEach(resetAppState);

describe('lifetime summary', () => {
  test('shows total savings and how many trips they come from', async () => {
    server([]);
    await renderScreen(<SavingsScreen />);

    expect(screen.getByText('Lifetime estimated savings')).toBeTruthy();
    expect(screen.getAllByText('$128.45').length).toBeGreaterThan(0);
    expect(screen.getByText('Compared with the fastest route on each of your 26 confirmed trips.')).toBeTruthy();
  });

  test('uses the singular for a single trip', async () => {
    server([], { ...SUMMARY, tripCount: 1 });
    await renderScreen(<SavingsScreen />);
    expect(screen.getByText('Compared with the fastest route on each of your 1 confirmed trip.')).toBeTruthy();
  });

  test('invites a first confirmed trip when there are none', async () => {
    server([], EMPTY_SUMMARY);
    await renderScreen(<SavingsScreen />);
    expect(screen.getByText('Confirm a trip to start tracking what you save.')).toBeTruthy();
  });

  test('stat tiles: trips, fuel avoided, average per trip, best trip', async () => {
    server([trip({ id: 'a', savingsDollars: 2.09, createdAt: hoursAgo(1) }), trip({ id: 'b', savingsDollars: 0.6, createdAt: hoursAgo(2) })]);
    await renderScreen(<SavingsScreen />);

    expect(screen.getByText('26')).toBeTruthy();
    expect(screen.getByText('8.4 gal')).toBeTruthy();
    expect(screen.getByText('$4.94')).toBeTruthy(); // 128.45 ÷ 26
    expect(screen.getAllByText('$2.09').length).toBeGreaterThan(0); // best single trip
  });

  test('average and best are dashes when there is nothing yet', async () => {
    server([], EMPTY_SUMMARY);
    await renderScreen(<SavingsScreen />);
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });

  test('this month so far comes from the server summary', async () => {
    server([]);
    await renderScreen(<SavingsScreen />);
    expect(screen.getByText(`${monthName()} so far`)).toBeTruthy();
    expect(screen.getByText('$34.20')).toBeTruthy();
  });
});

describe('period tabs', () => {
  test('offer Week, Month, Year and All time, starting on Month', async () => {
    server([]);
    await renderScreen(<SavingsScreen />);

    expect(screen.getByRole('tab', { name: 'Week' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Year' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'All time' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Month', selected: true })).toBeTruthy();
  });

  test('switching tabs selects it and relabels the range', async () => {
    server([]);
    await renderScreen(<SavingsScreen />);

    await fireEvent.press(screen.getByRole('tab', { name: 'Year' }));
    expect(screen.getByRole('tab', { name: 'Year', selected: true })).toBeTruthy();
    expect(screen.getByText(String(new Date().getFullYear()))).toBeTruthy();

    await fireEvent.press(screen.getByRole('tab', { name: 'All time' }));
    expect(screen.getByRole('tab', { name: 'All time', selected: true })).toBeTruthy();
    expect(screen.getAllByText('All time')).toHaveLength(2); // the tab, and the range label above the chart
  });

  test('All time totals come from the server, not the loaded trips', async () => {
    server([trip({ savingsDollars: 1, createdAt: hoursAgo(1) })]);
    await renderScreen(<SavingsScreen />);
    await fireEvent.press(screen.getByRole('tab', { name: 'All time' }));

    expect(screen.getByText('26 trips')).toBeTruthy(); // summary.tripCount, not the 1 loaded trip
  });

  test('Month totals add up the trips in the period', async () => {
    // Anchored to "now" so they land in the current week and month whatever day the test runs.
    server([trip({ id: 'a', savingsDollars: 2, createdAt: hoursAgo(0.1) }), trip({ id: 'b', savingsDollars: 1.5, createdAt: hoursAgo(0.2) })]);
    await renderScreen(<SavingsScreen />);

    expect(screen.getByText('2 trips')).toBeTruthy();
    expect(screen.getAllByText('$3.50').length).toBeGreaterThan(0);
  });

  test('a period with no savings explains the empty chart instead of drawing one', async () => {
    server([]);
    await renderScreen(<SavingsScreen />);
    expect(screen.getByText('Nothing saved in this period yet. Confirm a trip to see it here.')).toBeTruthy();
  });

  test('warns when the chart is built from a capped list of trips', async () => {
    const thirty = Array.from({ length: 30 }, (_, i) => trip({ id: `t${i}`, createdAt: hoursAgo(i + 1) }));
    server(thirty);
    await renderScreen(<SavingsScreen />);
    await fireEvent.press(screen.getByRole('tab', { name: 'All time' }));

    expect(screen.getByText('Based on your 30 most recent trips; the total covers all of them.')).toBeTruthy();
  });
});

describe('recent activity', () => {
  test('lists trips in the period with their savings', async () => {
    server([
      trip({ id: 'a', destinationLabel: 'Greenway Market', savingsDollars: 1.16, createdAt: hoursAgo(1) }),
      trip({ id: 'b', destinationLabel: 'Lakeside Stadium', savingsDollars: -0.85, createdAt: hoursAgo(2) }),
    ]);
    await renderScreen(<SavingsScreen />);

    expect(screen.getByText('Greenway Market')).toBeTruthy();
    expect(screen.getByText('+$1.16')).toBeTruthy();
    expect(screen.getByText('Lakeside Stadium')).toBeTruthy();
    expect(screen.getByText('−$0.85')).toBeTruthy();
  });

  test('shows at most six rows', async () => {
    server(Array.from({ length: 9 }, (_, i) => trip({ id: `t${i}`, destinationLabel: `Stop ${i}`, createdAt: hoursAgo(i + 1) })));
    await renderScreen(<SavingsScreen />);
    expect(screen.getAllByText(/^Stop \d$/)).toHaveLength(6);
  });

  test('says so when the period has no trips', async () => {
    server([]);
    await renderScreen(<SavingsScreen />);
    expect(screen.getByText('No confirmed trips in this period yet.')).toBeTruthy();
  });

  test('"All trips" opens the history, and a row opens that trip', async () => {
    server([trip({ id: 'a', destinationLabel: 'Greenway Market', createdAt: hoursAgo(1) })]);
    await renderScreen(<SavingsScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'All trips' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/trip-history');

    await fireEvent.press(screen.getByText('Greenway Market'));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/trip-detail', params: { id: 'a' } });
  });
});
