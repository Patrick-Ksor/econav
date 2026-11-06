import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';

import { RoutesScreen } from '@/features/routes/RoutesScreen';
import { getPlaceDetailsRaw, searchPlacesRaw } from '@/services/mapbox';
import { useTripStore } from '@/stores/trip-store';

import { mockApi } from '../helpers/api';
import { CAMRY } from '../helpers/fixtures';
import { mockRouter, renderScreen, resetAppState } from '../helpers/render';

jest.mock('@/services/mapbox', () => ({
  ...jest.requireActual('@/services/mapbox'),
  searchPlacesRaw: jest.fn(),
  getPlaceDetailsRaw: jest.fn(),
}));

const search = searchPlacesRaw as jest.Mock;
const details = getPlaceDetailsRaw as jest.Mock;
const requestPermission = Location.requestForegroundPermissionsAsync as jest.Mock;

const GPS = { lat: 35.15, lng: -80.93 }; // from the expo-location mock in jest.setup.ts
const TARGET = { placeId: 'p1', primaryText: 'Target', secondaryText: '9531 South Blvd, Charlotte, NC' };
const HARBOR = { placeId: 'p2', primaryText: 'Harbor Freight', secondaryText: '601 N Polk St, Pineville, NC' };

const place = (placeId: string, lat: number, lng: number) => ({
  placeId,
  location: { lat, lng },
  formattedAddress: 'somewhere',
});

beforeEach(() => {
  resetAppState();
  mockApi({ 'GET /api/vehicle-profile': CAMRY });
  search.mockReset().mockResolvedValue([TARGET, HARBOR]);
  details.mockReset().mockImplementation(async (id: string) =>
    id === 'p1' ? place('p1', 35.1, -80.88) : place('p2', 35.2, -80.8),
  );
  requestPermission.mockResolvedValue({ status: 'granted' });
});

const field = () => screen.getByLabelText('Destination search');
const compare = () => screen.getByRole('button', { name: 'Compare routes' });
const typeQuery = (text: string) => fireEvent.changeText(field(), text);

/** Types a query, waits out the 300ms debounce, and picks a suggestion by name. */
async function chooseSuggestion(name: string) {
  await typeQuery('targ');
  await fireEvent.press(await screen.findByText(name));
}

describe('the search card', () => {
  test('starts at the current location with an empty destination', async () => {
    await renderScreen(<RoutesScreen />);

    expect(screen.getByText('Current location')).toBeTruthy();
    expect(field().props.value).toBe('');
    expect(field().props.placeholder).toBe('Where are you going?');
  });

  test('shows the active vehicle and opens the Garage from it', async () => {
    await renderScreen(<RoutesScreen />);

    expect(screen.getByText('Toyota Camry LE/SE')).toBeTruthy();
    expect(screen.getByText('24 MPG')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Change vehicle' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/garage');
  });

  test('"Compare routes" is disabled until a destination is chosen', async () => {
    await renderScreen(<RoutesScreen />);
    expect(compare()).toBeDisabled();
  });

  test('the back arrow goes back, or home when there is no history', async () => {
    await renderScreen(<RoutesScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockRouter.back).toHaveBeenCalled();

    mockRouter.canGoBack.mockReturnValue(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/home');
  });
});

describe('searching', () => {
  test('lists matching places once at least three characters are typed', async () => {
    await renderScreen(<RoutesScreen />);
    await typeQuery('targ');

    expect(await screen.findByText('Target')).toBeTruthy();
    expect(screen.getByText('9531 South Blvd, Charlotte, NC')).toBeTruthy();
    expect(screen.getByText('Harbor Freight')).toBeTruthy();
    expect(screen.getByText('Suggestions')).toBeTruthy();
  });

  test('does not search for one or two characters', async () => {
    await renderScreen(<RoutesScreen />);
    await typeQuery('ta');
    await new Promise((resolve) => setTimeout(resolve, 450)); // longer than the debounce

    expect(search).not.toHaveBeenCalled();
    expect(screen.queryByText('Suggestions')).toBeNull();
  });

  test('biases results toward where the user is', async () => {
    await renderScreen(<RoutesScreen />);
    await typeQuery('targ');
    await screen.findByText('Target');

    expect(search).toHaveBeenCalledWith('targ', expect.any(String), GPS);
  });

  test('says so when nothing matches', async () => {
    search.mockResolvedValue([]);
    await renderScreen(<RoutesScreen />);
    await typeQuery('zzzz');
    expect(await screen.findByText('No matches')).toBeTruthy();
  });

  test('says so when the search service fails', async () => {
    search.mockRejectedValue(new Error('mapbox down'));
    await renderScreen(<RoutesScreen />);
    await typeQuery('targ');
    expect(await screen.findByText("Couldn't search destinations right now.")).toBeTruthy();
  });

  test('the clear button empties the field', async () => {
    await renderScreen(<RoutesScreen />);
    await typeQuery('targ');
    await fireEvent.press(screen.getByRole('button', { name: 'Clear search' }));
    expect(field().props.value).toBe('');
  });
});

describe('choosing a destination', () => {
  test('shows the choice in the card and enables "Compare routes"', async () => {
    await renderScreen(<RoutesScreen />);
    await chooseSuggestion('Target');

    await waitFor(() => expect(compare()).toBeEnabled());
    expect(screen.queryByLabelText('Destination search')).toBeNull(); // the field is replaced by the choice
    expect(screen.getByText('Target')).toBeTruthy();
  });

  test('looks the place up for its coordinates', async () => {
    await renderScreen(<RoutesScreen />);
    await chooseSuggestion('Target');
    await waitFor(() => expect(details).toHaveBeenCalledWith('p1', expect.any(String)));
  });

  test('"Compare routes" stores the trip query and moves on', async () => {
    await renderScreen(<RoutesScreen />);
    await chooseSuggestion('Target');
    await waitFor(() => expect(compare()).toBeEnabled());
    await fireEvent.press(compare());

    expect(useTripStore.getState().lastRouteQuery).toEqual({
      origin: { label: 'Current location', location: GPS },
      destination: { label: 'Target', location: { lat: 35.1, lng: -80.88 } },
    });
    expect(mockRouter.push).toHaveBeenCalledWith('/route-compare');
  });

  test('remembers the destination in Recent', async () => {
    await renderScreen(<RoutesScreen />);
    await chooseSuggestion('Target');
    await waitFor(() => expect(compare()).toBeEnabled());
    await fireEvent.press(compare());

    const [recent] = useTripStore.getState().recentDestinations;
    expect(recent).toMatchObject({ placeId: 'p1', label: 'Target', location: { lat: 35.1, lng: -80.88 } });
  });

  test('clearing the destination brings the search field back and disables Compare', async () => {
    await renderScreen(<RoutesScreen />);
    await chooseSuggestion('Target');
    await waitFor(() => expect(compare()).toBeEnabled());
    await fireEvent.press(screen.getByRole('button', { name: 'Clear destination' }));

    expect(field().props.value).toBe('');
    expect(compare()).toBeDisabled();
  });

  test('a place that cannot be resolved shows an error and blocks Compare', async () => {
    details.mockRejectedValue(new Error('no details'));
    await renderScreen(<RoutesScreen />);
    await chooseSuggestion('Target');

    expect(await screen.findByText("Couldn't resolve that destination — try another search.")).toBeTruthy();
    expect(compare()).toBeDisabled();
  });
});

describe('recent destinations', () => {
  const seed = () =>
    useTripStore.setState({
      recentDestinations: [
        { placeId: 'r1', label: 'Greenway Market', location: { lat: 35.3, lng: -80.7 }, lastUsedAt: '2026-10-26T12:00:00.000Z' },
        { placeId: 'r2', label: 'Lakeside Stadium', location: { lat: 35.4, lng: -80.6 }, lastUsedAt: '2026-10-24T12:00:00.000Z' },
      ],
    });

  test('are listed when the user is not searching', async () => {
    seed();
    await renderScreen(<RoutesScreen />);

    expect(screen.getByText('Recent')).toBeTruthy();
    expect(screen.getByText('Greenway Market')).toBeTruthy();
    expect(screen.getByText('Lakeside Stadium')).toBeTruthy();
  });

  test('are hidden while a search is in progress', async () => {
    seed();
    await renderScreen(<RoutesScreen />);
    await typeQuery('targ');
    await screen.findByText('Suggestions');

    expect(screen.queryByText('Recent')).toBeNull();
  });

  test('picking one sets the destination without a place lookup', async () => {
    seed();
    await renderScreen(<RoutesScreen />);
    await fireEvent.press(screen.getByText('Greenway Market'));

    await waitFor(() => expect(compare()).toBeEnabled());
    expect(details).not.toHaveBeenCalled();
    await fireEvent.press(compare());
    expect(useTripStore.getState().lastRouteQuery!.destination).toEqual({
      label: 'Greenway Market',
      location: { lat: 35.3, lng: -80.7 },
    });
  });

  test('"Clear all" removes them', async () => {
    seed();
    await renderScreen(<RoutesScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Clear all' }));

    expect(useTripStore.getState().recentDestinations).toEqual([]);
    expect(screen.queryByText('Greenway Market')).toBeNull();
  });

  test('re-using a destination moves it to the top without duplicating it', async () => {
    seed();
    await renderScreen(<RoutesScreen />);
    await fireEvent.press(screen.getByText('Lakeside Stadium'));
    await waitFor(() => expect(compare()).toBeEnabled());
    await fireEvent.press(compare());

    const labels = useTripStore.getState().recentDestinations.map((d) => d.label);
    expect(labels).toEqual(['Lakeside Stadium', 'Greenway Market']);
  });
});

describe('location and vehicle prerequisites', () => {
  test('without location permission, says so and cannot compare', async () => {
    requestPermission.mockResolvedValue({ status: 'denied' });
    await renderScreen(<RoutesScreen />);

    expect(await screen.findByText('Location permission denied')).toBeTruthy();
    useTripStore.setState({
      recentDestinations: [{ placeId: 'r1', label: 'Greenway Market', location: { lat: 1, lng: 1 }, lastUsedAt: '2026-10-26T12:00:00.000Z' }],
    });
    await fireEvent.press(await screen.findByText('Greenway Market'));
    expect(compare()).toBeDisabled(); // a destination alone is not enough without a starting point
  });

  test('without a vehicle, asks the user to add one', async () => {
    mockApi({ 'GET /api/vehicle-profile': null });
    await renderScreen(<RoutesScreen />);

    expect(screen.getByText('Add a vehicle to see real costs')).toBeTruthy();
    expect(screen.queryByLabelText('Destination search')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Add Vehicle' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/add-vehicle');
  });
});
