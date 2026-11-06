import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { GarageScreen } from '@/features/garage/GarageScreen';
import type { GarageVehicle } from '@/schemas/vehicle';

import { ApiError, mockApi, type ApiCall } from '../helpers/api';
import { CAMRY, CIVIC } from '../helpers/fixtures';
import { mockRouter, renderScreen, resetAppState } from '../helpers/render';

/** A fake server that remembers which vehicles exist and which is active. */
function garageServer(initial: GarageVehicle[], extra: Record<string, unknown> = {}) {
  let vehicles = initial.map((v) => ({ ...v }));
  return mockApi({
    'GET /api/vehicles': () => vehicles,
    'PATCH /api/vehicles/*': ({ path }: ApiCall) => {
      const id = decodeURIComponent(path.split('/').pop()!);
      vehicles = vehicles.map((v) => ({ ...v, isActive: v.id === id }));
      return null;
    },
    'DELETE /api/vehicles/*': ({ path }: ApiCall) => {
      const id = decodeURIComponent(path.split('/').pop()!);
      vehicles = vehicles.filter((v) => v.id !== id);
      return null;
    },
    'PUT /api/vehicle-profile': ({ body }: ApiCall) => body,
    ...extra,
  });
}

beforeEach(resetAppState);

describe('Garage with vehicles', () => {
  test('lists every vehicle with a count in the subtitle', async () => {
    garageServer([CAMRY, CIVIC]);
    await renderScreen(<GarageScreen />);

    expect(await screen.findByText('Camry LE/SE')).toBeTruthy();
    expect(screen.getByText('Civic EX')).toBeTruthy();
    expect(screen.getByText('2 vehicles · costs update every trip')).toBeTruthy();
  });

  test('uses the singular for one vehicle', async () => {
    garageServer([CAMRY]);
    await renderScreen(<GarageScreen />);
    expect(await screen.findByText('1 vehicle · costs update every trip')).toBeTruthy();
  });

  test('marks the active vehicle "Selected" and offers "Use this car" on the others', async () => {
    garageServer([CAMRY, CIVIC]);
    await renderScreen(<GarageScreen />);
    await screen.findByText('Camry LE/SE');

    expect(screen.getAllByText('Selected')).toHaveLength(1);
    expect(screen.getAllByText('Use this car')).toHaveLength(1);
  });

  test("shows each vehicle's own specs", async () => {
    garageServer([CAMRY, CIVIC]);
    await renderScreen(<GarageScreen />);
    await screen.findByText('Camry LE/SE');

    expect(screen.getByText('24 MPG')).toBeTruthy();
    expect(screen.getByText('36 MPG')).toBeTruthy();
    expect(screen.getByText('$0.18/mi')).toBeTruthy(); // Camry's depreciation
    expect(screen.getByText('$0.12/mi')).toBeTruthy(); // Civic's depreciation
  });

  test('estimates cost per mile from that vehicle: fuel price ÷ MPG + depreciation', async () => {
    garageServer([CAMRY, CIVIC]);
    await renderScreen(<GarageScreen />);
    await screen.findByText('Camry LE/SE');

    // Camry: 3.60 / 24 + 0.18 = 0.33.  Civic: 3.60 / 36 + 0.12 = 0.22.
    expect(screen.getByText('$0.33')).toBeTruthy();
    expect(screen.getByText('$0.22')).toBeTruthy();
  });

  test('"Use this car" activates that vehicle on the server', async () => {
    const api = garageServer([CAMRY, CIVIC]);
    await renderScreen(<GarageScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Use this car' }));

    await waitFor(() => expect(api.callsTo('PATCH /api/vehicles/veh_civic')).toHaveLength(1));
    // The list refreshes, so the Civic is now the selected one.
    await waitFor(() => expect(screen.queryByText('Use this car')).toBeTruthy());
    expect(screen.getAllByText('Selected')).toHaveLength(1);
  });

  test('"Add Vehicle" opens the add-vehicle flow', async () => {
    garageServer([CAMRY]);
    await renderScreen(<GarageScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: /Add Vehicle/ }));
    expect(mockRouter.push).toHaveBeenCalledWith('/add-vehicle');
  });
});

describe('Removing a vehicle', () => {
  test('asks for confirmation before deleting anything', async () => {
    const api = garageServer([CAMRY, CIVIC]);
    await renderScreen(<GarageScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Remove Honda Civic EX' }));

    expect(screen.getByText('Remove this vehicle?')).toBeTruthy();
    expect(api.callsTo('DELETE')).toHaveLength(0);
  });

  test('"Keep" cancels without deleting', async () => {
    const api = garageServer([CAMRY, CIVIC]);
    await renderScreen(<GarageScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Remove Honda Civic EX' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Keep' }));

    expect(screen.queryByText('Remove this vehicle?')).toBeNull();
    expect(api.callsTo('DELETE')).toHaveLength(0);
    expect(screen.getByText('Civic EX')).toBeTruthy();
  });

  test('"Remove" deletes it and it leaves the list', async () => {
    const api = garageServer([CAMRY, CIVIC]);
    await renderScreen(<GarageScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Remove Honda Civic EX' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Remove' }));

    await waitFor(() => expect(api.callsTo('DELETE /api/vehicles/veh_civic')).toHaveLength(1));
    await waitFor(() => expect(screen.queryByText('Civic EX')).toBeNull());
    expect(screen.getByText('1 vehicle · costs update every trip')).toBeTruthy();
  });
});

describe('Editing a vehicle', () => {
  test('editing a non-active vehicle switches to it first, then opens the editor', async () => {
    const api = garageServer([CAMRY, CIVIC]);
    await renderScreen(<GarageScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Edit Honda Civic EX' }));

    await waitFor(() => expect(api.callsTo('PATCH /api/vehicles/veh_civic')).toHaveLength(1));
    expect(await screen.findByText('Edit Honda Civic EX')).toBeTruthy();
  });

  test('editing the active vehicle does not switch anything', async () => {
    const api = garageServer([CAMRY, CIVIC]);
    await renderScreen(<GarageScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Edit Toyota Camry LE/SE' }));

    expect(await screen.findByText('Edit Toyota Camry LE/SE')).toBeTruthy();
    expect(api.callsTo('PATCH')).toHaveLength(0);
  });
});

describe('Empty and error states', () => {
  test('with no vehicles, offers to add one', async () => {
    garageServer([]);
    await renderScreen(<GarageScreen />);

    expect(await screen.findByText('Add a vehicle to see real costs')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Add Vehicle' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/add-vehicle');
  });

  test('a failed load shows an error instead of an empty garage', async () => {
    mockApi({ 'GET /api/vehicles': new ApiError(500) });
    await renderScreen(<GarageScreen />);

    expect(await screen.findByText(/Couldn't load your garage/)).toBeTruthy();
    expect(screen.queryByText('Add a vehicle to see real costs')).toBeNull();
  });

  test('a failed switch tells the user and keeps the list', async () => {
    mockApi({
      'GET /api/vehicles': [CAMRY, CIVIC],
      'PATCH /api/vehicles/*': new ApiError(500),
    });
    await renderScreen(<GarageScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Use this car' }));

    expect(await screen.findByText("Couldn't switch vehicles. Try again.")).toBeTruthy();
    expect(screen.getByText('Civic EX')).toBeTruthy();
  });
});

describe('Saving an edit', () => {
  const edit = async (label: string) => {
    await fireEvent.press(await screen.findByRole('button', { name: `Edit ${label}` }));
    await screen.findByText(`Edit ${label}`);
  };
  const saveChanges = () => fireEvent.press(screen.getByRole('button', { name: 'Save changes' }));

  test('shows the vehicle in the form, ready to change', async () => {
    garageServer([CAMRY]);
    await renderScreen(<GarageScreen />);
    await edit('Toyota Camry LE/SE');

    expect(screen.getByText('2024 Toyota Camry LE/SE')).toBeTruthy(); // the vehicle field
    expect(screen.getByRole('button', { name: 'Regular', selected: true })).toBeTruthy();
    expect(screen.getByLabelText('Gas price per gallon').props.value).toBe('3.6'); // the vehicle's own override
  });

  test('saves the edited MPG and fuel type onto the active vehicle, keeping its depreciation and price', async () => {
    const api = garageServer([CAMRY, CIVIC]);
    await renderScreen(<GarageScreen />);
    await edit('Toyota Camry LE/SE');
    await fireEvent.press(screen.getByRole('button', { name: 'Increase MPG' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Increase MPG' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Premium' }));
    await saveChanges();

    await waitFor(() => expect(api.callsTo('PUT /api/vehicle-profile')).toHaveLength(1));
    expect(api.callsTo('PUT /api/vehicle-profile')[0].body).toMatchObject({
      year: '2024',
      makeModel: 'Toyota Camry LE/SE',
      mpg: 25,
      fuelGrade: 'premium',
      gasPriceOverride: 3.6,
      depreciationPerMile: 0.18,
      updatedAt: expect.any(String),
    });
  });

  test("keeps another vehicle's own depreciation when it is edited", async () => {
    const api = garageServer([CAMRY, CIVIC]);
    await renderScreen(<GarageScreen />);
    await edit('Honda Civic EX'); // switches to the Civic first
    await saveChanges();

    await waitFor(() => expect(api.callsTo('PUT /api/vehicle-profile')).toHaveLength(1));
    expect(api.callsTo('PUT /api/vehicle-profile')[0].body).toMatchObject({
      makeModel: 'Honda Civic EX',
      depreciationPerMile: 0.12,
    });
  });

  test('closes the editor once saved', async () => {
    garageServer([CAMRY]);
    await renderScreen(<GarageScreen />);
    await edit('Toyota Camry LE/SE');
    await saveChanges();

    await waitFor(() => expect(screen.queryByText('Edit Toyota Camry LE/SE')).toBeNull());
  });

  test('a failed save says so and keeps the editor open with the changes', async () => {
    garageServer([CAMRY], { 'PUT /api/vehicle-profile': new ApiError(500) });
    await renderScreen(<GarageScreen />);
    await edit('Toyota Camry LE/SE');
    await fireEvent.press(screen.getByRole('button', { name: 'Increase MPG' }));
    await saveChanges();

    expect(await screen.findByText("Couldn't save your changes. Try again.")).toBeTruthy();
    expect(screen.getByText('Edit Toyota Camry LE/SE')).toBeTruthy();
    expect(screen.getByText('9.6 L/100km equiv.')).toBeTruthy(); // 24.5 MPG is still what the user set
  });

  test('typing a custom gas price saves it straight away', async () => {
    const api = garageServer([CAMRY]);
    await renderScreen(<GarageScreen />);
    await edit('Toyota Camry LE/SE');
    await fireEvent.changeText(screen.getByLabelText('Gas price per gallon'), '4.2');

    await waitFor(() => expect(api.callsTo('PUT /api/vehicle-profile')).toHaveLength(1));
    expect(api.callsTo('PUT /api/vehicle-profile')[0].body).toMatchObject({ gasPriceOverride: 4.2, mpg: 24 });
  });

  test('"Reset to estimated" clears the custom price', async () => {
    const api = garageServer([CAMRY]);
    await renderScreen(<GarageScreen />);
    await edit('Toyota Camry LE/SE');
    await fireEvent.press(screen.getByRole('button', { name: 'Reset to estimated' }));

    await waitFor(() => expect(api.callsTo('PUT /api/vehicle-profile')).toHaveLength(1));
    expect(api.callsTo('PUT /api/vehicle-profile')[0].body).toMatchObject({ gasPriceOverride: null });
  });

  test('the editor can be closed without saving', async () => {
    const api = garageServer([CAMRY]);
    await renderScreen(<GarageScreen />);
    await edit('Toyota Camry LE/SE');
    await fireEvent.press(screen.getByRole('button', { name: 'Close editor' }));

    expect(screen.queryByText('Edit Toyota Camry LE/SE')).toBeNull();
    expect(api.callsTo('PUT')).toHaveLength(0);
  });
});
