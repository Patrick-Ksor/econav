import { fireEvent, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { ProfileScreen } from '@/features/profile/ProfileScreen';
import { useAppearanceStore } from '@/stores/appearance-store';

import { mockApi } from '../helpers/api';
import { CAMRY } from '../helpers/fixtures';
import { mockRouter, renderScreen, resetAppState } from '../helpers/render';

const clerk = jest.requireMock('@clerk/expo') as { __signOut: jest.Mock };

const PREFS = { priority: 'balance', timeValuePerHour: 18, includeTolls: true };

function server(opts: { vehicle?: unknown; prefs?: unknown } = {}) {
  return mockApi({
    'GET /api/vehicle-profile': opts.vehicle === undefined ? CAMRY : opts.vehicle,
    'GET /api/route-preferences': opts.prefs ?? PREFS,
  });
}

beforeEach(() => {
  resetAppState();
  clerk.__signOut.mockClear();
});

describe('account', () => {
  test('shows who is signed in', async () => {
    server();
    await renderScreen(<ProfileScreen />);

    expect(screen.getByText('Maya Chen')).toBeTruthy();
    expect(screen.getByText('maya.chen@example.com')).toBeTruthy();
    expect(screen.getByText('Member since May 2026')).toBeTruthy();
    expect(screen.getByText('MC')).toBeTruthy();
  });

  test('"Log out" signs out', async () => {
    server();
    await renderScreen(<ProfileScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Log out' }));
    expect(clerk.__signOut).toHaveBeenCalledTimes(1);
  });
});

describe('driving settings', () => {
  test('summarise the active vehicle, routing priority and fuel price', async () => {
    server();
    await renderScreen(<ProfileScreen />);

    expect(screen.getByText('2024 Toyota Camry LE/SE')).toBeTruthy();
    expect(screen.getByText('Balanced · $18/hr')).toBeTruthy();
    expect(screen.getByText('Custom · $3.60')).toBeTruthy();
  });

  test('describe the priority in words', async () => {
    server({ prefs: { ...PREFS, priority: 'fast', timeValuePerHour: 40 } });
    await renderScreen(<ProfileScreen />);
    expect(screen.getByText('Fastest · $40/hr')).toBeTruthy();
  });

  test('say "Local average" when no custom fuel price is set', async () => {
    server({ vehicle: { ...CAMRY, gasPriceOverride: null } });
    await renderScreen(<ProfileScreen />);
    expect(screen.getByText('Local average')).toBeTruthy();
  });

  test('say "Not set" without a vehicle', async () => {
    server({ vehicle: null });
    await renderScreen(<ProfileScreen />);
    expect(screen.getByText('Not set')).toBeTruthy();
  });

  test.each([
    ['Default vehicle', '/garage'],
    ['Route optimization', '/route-preferences'],
    ['Fuel price', '/route-preferences'],
  ])('"%s" opens %s', async (row, route) => {
    server();
    await renderScreen(<ProfileScreen />);
    await fireEvent.press(screen.getByText(row));
    expect(mockRouter.push).toHaveBeenCalledWith(route);
  });
});

describe('Appearance', () => {
  test('offers System, Light and Dark, with the current choice selected', async () => {
    server();
    useAppearanceStore.setState({ mode: 'dark' });
    await renderScreen(<ProfileScreen />);

    expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Light' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'System' })).not.toBeChecked();
  });

  test.each(['light', 'dark', 'system'] as const)('choosing %s updates the saved setting', async (mode) => {
    server();
    useAppearanceStore.setState({ mode: mode === 'light' ? 'dark' : 'light' });
    await renderScreen(<ProfileScreen />);
    await fireEvent.press(screen.getByRole('radio', { name: mode[0].toUpperCase() + mode.slice(1) }));

    expect(useAppearanceStore.getState().mode).toBe(mode);
    expect(screen.getByRole('radio', { name: mode[0].toUpperCase() + mode.slice(1) })).toBeChecked();
  });
});

describe('Privacy', () => {
  test('"Location access" opens the system settings', async () => {
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    server();
    await renderScreen(<ProfileScreen />);
    await fireEvent.press(screen.getByText('Location access'));

    expect(openSettings).toHaveBeenCalledTimes(1);
    openSettings.mockRestore();
  });
});
