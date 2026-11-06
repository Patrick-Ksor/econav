import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { AddVehicleScreen } from '@/features/garage/AddVehicleScreen';

import { ApiError, RawBody, mockApi, type ApiCall } from '../helpers/api';
import { CAMRY } from '../helpers/fixtures';
import { mockRouter, renderScreen, resetAppState } from '../helpers/render';

// fueleconomy.gov answers in XML: flat <menuItems> lists, and a <vehicle> record per trim.
const menu = (items: [text: string, value: string][]) =>
  new RawBody(
    `<menuItems>${items.map(([t, v]) => `<menuItem><text>${t}</text><value>${v}</value></menuItem>`).join('')}</menuItems>`,
  );
const record = (mpg: number, fuel = 'Regular Gasoline', atv = '') =>
  new RawBody(`<vehicle><comb08>${mpg}</comb08><fuelType1>${fuel}</fuelType1><atvType>${atv}</atvType></vehicle>`);

const TRIM_GAS = '46123';
const TRIM_PREMIUM = '46124';
const TRIM_EV = '46999';
const TRIM_NO_DATA = '46000';

function server(garage: unknown[] = [], extra: Record<string, unknown> = {}) {
  return mockApi({
    'GET /api/vehicles': garage,
    'POST /api/vehicles': ({ body }: ApiCall) => body,
    'GET /ws/rest/vehicle/menu/year': menu([['2022', '2022'], ['2021', '2021'], ['2020', '2020']]),
    'GET /ws/rest/vehicle/menu/make': menu([['Honda', 'Honda'], ['Toyota', 'Toyota'], ['Ford', 'Ford']]),
    'GET /ws/rest/vehicle/menu/model': menu([['RAV4', 'RAV4'], ['Camry', 'Camry']]),
    'GET /ws/rest/vehicle/menu/options': menu([
      ['Auto (S8), 4cyl, 2.5 L', TRIM_GAS],
      ['Auto (S8), 4cyl, 2.5 L, Premium', TRIM_PREMIUM],
      ['Electric', TRIM_EV],
      ['Prototype', TRIM_NO_DATA],
    ]),
    // Per-trim records; the id is the last path segment.
    'GET /ws/rest/vehicle/*': ({ path }: ApiCall) => {
      const id = path.split('/').pop();
      if (id === TRIM_GAS) return record(30);
      if (id === TRIM_PREMIUM) return record(26, 'Premium Gasoline');
      if (id === TRIM_EV) return record(112, 'Electricity', 'EV');
      return record(0);
    },
    ...extra,
  });
}

const button = (name: string | RegExp) => screen.getByRole('button', { name });
const press = (name: string | RegExp) => fireEvent.press(button(name));

/** Picks 2021 → Toyota → RAV4 and the given trim row (0-based), then waits for the EPA lookup. */
async function pickVehicle(trimIndex = 0) {
  await fireEvent.press(await screen.findByRole('button', { name: '2021' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Toyota' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'RAV4' }));
  await fireEvent.press((await screen.findAllByRole('radio'))[trimIndex]);
}

const goToCosts = async () => {
  await waitFor(() => expect(button('Continue')).toBeEnabled());
  await press('Continue'); // → step 2
  await press('Continue'); // → step 3
};

beforeEach(resetAppState);

describe('Step 1: find your vehicle', () => {
  test('starts with the years, newest first from the EPA list', async () => {
    server();
    await renderScreen(<AddVehicleScreen />);

    expect(screen.getByText('Find your vehicle')).toBeTruthy();
    expect(screen.getByText('1/3')).toBeTruthy();
    expect(await screen.findByRole('button', { name: '2021' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '2022' })).toBeTruthy();
  });

  test('Continue stays disabled until a trim has been chosen', async () => {
    server();
    await renderScreen(<AddVehicleScreen />);
    expect(button('Continue')).toBeDisabled();

    await fireEvent.press(await screen.findByRole('button', { name: '2021' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Toyota' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'RAV4' }));
    expect(button('Continue')).toBeDisabled(); // trim list is showing, nothing picked yet
  });

  test('drills down year → make → model → trim, showing each choice as a chip', async () => {
    server();
    await renderScreen(<AddVehicleScreen />);
    await pickVehicle();

    expect(screen.getByRole('button', { name: 'Change year' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Change make' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Change model' })).toBeTruthy();
    await waitFor(() => expect(button('Continue')).toBeEnabled());
  });

  test('searching narrows the list', async () => {
    server();
    await renderScreen(<AddVehicleScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: '2021' }));
    await screen.findByRole('button', { name: 'Toyota' });

    await fireEvent.changeText(screen.getByLabelText('Search make'), 'toy');
    expect(screen.getByRole('button', { name: 'Toyota' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Honda' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ford' })).toBeNull();
  });

  test('removing a chip goes back to that level and clears the choices after it', async () => {
    server();
    await renderScreen(<AddVehicleScreen />);
    await pickVehicle();
    await press('Change make');

    expect(await screen.findByRole('button', { name: 'Honda' })).toBeTruthy(); // the make list again
    expect(screen.queryByRole('button', { name: 'Change model' })).toBeNull();
    expect(button('Continue')).toBeDisabled();
  });

  test("an electric trim is refused with an explanation, since EV costs aren't supported", async () => {
    server();
    await renderScreen(<AddVehicleScreen />);
    await pickVehicle(2); // "Electric"

    expect(await screen.findByText(/doesn't support EV cost estimates/)).toBeTruthy();
    expect(button('Continue')).toBeDisabled();
  });

  test('a trim with no EPA data is refused too', async () => {
    server();
    await renderScreen(<AddVehicleScreen />);
    await pickVehicle(3); // "Prototype"

    expect(await screen.findByText(/No EPA fuel economy data for this trim/)).toBeTruthy();
    expect(button('Continue')).toBeDisabled();
  });

  test('a failed lookup says it could not reach the EPA', async () => {
    server([], { 'GET /ws/rest/vehicle/*': new ApiError(500) });
    await renderScreen(<AddVehicleScreen />);
    await pickVehicle();

    expect(await screen.findByText(/Couldn't reach fueleconomy.gov/)).toBeTruthy();
    expect(button('Continue')).toBeDisabled();
  });
});

describe('Step 2: confirm the details', () => {
  test('summarises the chosen vehicle and prefills the fuel type from the EPA record', async () => {
    server();
    await renderScreen(<AddVehicleScreen />);
    await pickVehicle(1); // premium trim
    await waitFor(() => expect(button('Continue')).toBeEnabled());
    await press('Continue');

    expect(screen.getByText('Confirm the details')).toBeTruthy();
    expect(screen.getByText('2021 Toyota')).toBeTruthy();
    expect(screen.getByText('RAV4')).toBeTruthy();
    expect(screen.getByText('2/3')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Premium', selected: true })).toBeTruthy();
  });

  test('the back arrow returns to the previous step, then leaves the flow', async () => {
    server();
    await renderScreen(<AddVehicleScreen />);
    await pickVehicle();
    await waitFor(() => expect(button('Continue')).toBeEnabled());
    await press('Continue');

    await press('Back');
    expect(screen.getByText('Find your vehicle')).toBeTruthy();
    await press('Back');
    expect(mockRouter.back).toHaveBeenCalled();
  });
});

describe('Step 3: set your costs', () => {
  test('prefills MPG from the EPA record, and the standard costs', async () => {
    server();
    await renderScreen(<AddVehicleScreen />);
    await pickVehicle();
    await goToCosts();

    expect(screen.getByText('Set your costs')).toBeTruthy();
    expect(screen.getByLabelText('Combined MPG').props.value).toBe('30');
    expect(screen.getByLabelText('Fuel price per gallon').props.value).toBe('3.49'); // stub local average
    expect(screen.getByLabelText('Depreciation per mile').props.value).toBe('0.18');
    expect(screen.getByText('Prefilled for a 2021 Toyota RAV4. Adjust anything that doesn\'t match your driving.')).toBeTruthy();
  });

  test('shows the estimated cost per mile: fuel price ÷ MPG + depreciation', async () => {
    server();
    await renderScreen(<AddVehicleScreen />);
    await pickVehicle();
    await goToCosts();

    expect(screen.getByText('Estimated cost per mile: $0.30')).toBeTruthy(); // 3.49 / 30 + 0.18
  });

  test.each(['4', '151', 'abc', ''])('an MPG of %p blocks saving', async (mpg) => {
    server();
    await renderScreen(<AddVehicleScreen />);
    await pickVehicle();
    await goToCosts();
    await fireEvent.changeText(screen.getByLabelText('Combined MPG'), mpg);

    expect(button('Save vehicle')).toBeDisabled();
    if (mpg !== '') expect(screen.getByText('Enter an MPG between 5 and 150.')).toBeTruthy();
  });

  test.each(['5', '150', '42.5'])('an MPG of %p is accepted', async (mpg) => {
    server();
    await renderScreen(<AddVehicleScreen />);
    await pickVehicle();
    await goToCosts();
    await fireEvent.changeText(screen.getByLabelText('Combined MPG'), mpg);
    expect(button('Save vehicle')).toBeEnabled();
  });

  test('a negative or oversized depreciation blocks saving', async () => {
    server();
    await renderScreen(<AddVehicleScreen />);
    await pickVehicle();
    await goToCosts();

    await fireEvent.changeText(screen.getByLabelText('Depreciation per mile'), '6');
    expect(button('Save vehicle')).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Depreciation per mile'), '0');
    expect(button('Save vehicle')).toBeEnabled(); // zero depreciation is allowed
  });
});

describe('Save vehicle', () => {
  test('adds the vehicle to the garage with the EPA specs and default costs', async () => {
    const api = server();
    await renderScreen(<AddVehicleScreen />);
    await pickVehicle();
    await goToCosts();
    await press('Save vehicle');

    await waitFor(() => expect(api.callsTo('POST /api/vehicles')).toHaveLength(1));
    expect(api.callsTo('POST /api/vehicles')[0].body).toMatchObject({
      year: '2021',
      makeModel: 'Toyota RAV4',
      mpg: 30,
      fuelGrade: 'regular',
      gasPriceOverride: null, // left at the local average, so live pricing keeps applying
      depreciationPerMile: 0.18,
    });
    expect((api.callsTo('POST /api/vehicles')[0].body as { id: string }).id).toEqual(expect.any(String));
  });

  test('never replaces or deletes the existing vehicle', async () => {
    const api = server([CAMRY]);
    await renderScreen(<AddVehicleScreen />);
    await pickVehicle();
    await goToCosts();
    await press('Save vehicle');

    await waitFor(() => expect(api.callsTo('POST /api/vehicles')).toHaveLength(1));
    expect(api.callsTo('DELETE')).toHaveLength(0);
    expect(api.callsTo('PUT')).toHaveLength(0);
  });

  test('tells the user their current vehicle stays in the garage', async () => {
    server([CAMRY]);
    await renderScreen(<AddVehicleScreen />);
    await pickVehicle();
    await goToCosts();

    expect(screen.getByText(/This is added to your garage and becomes your active vehicle/)).toBeTruthy();
    expect(screen.getByText(/2024 Toyota Camry LE\/SE stays in your garage/)).toBeTruthy();
  });

  test('a custom fuel price is saved as an override; the default is not', async () => {
    const api = server();
    await renderScreen(<AddVehicleScreen />);
    await pickVehicle();
    await goToCosts();
    await fireEvent.changeText(screen.getByLabelText('Fuel price per gallon'), '4.25');
    await press('Save vehicle');

    await waitFor(() => expect(api.callsTo('POST /api/vehicles')).toHaveLength(1));
    expect(api.callsTo('POST /api/vehicles')[0].body).toMatchObject({ gasPriceOverride: 4.25 });
  });

  test('edited MPG and depreciation are saved on the vehicle', async () => {
    const api = server();
    await renderScreen(<AddVehicleScreen />);
    await pickVehicle();
    await goToCosts();
    await fireEvent.changeText(screen.getByLabelText('Combined MPG'), '28.5');
    await fireEvent.changeText(screen.getByLabelText('Depreciation per mile'), '0.25');
    await press('Save vehicle');

    await waitFor(() => expect(api.callsTo('POST /api/vehicles')).toHaveLength(1));
    expect(api.callsTo('POST /api/vehicles')[0].body).toMatchObject({ mpg: 28.5, depreciationPerMile: 0.25 });
  });

  test('a first vehicle goes straight to Home; later ones show the garage', async () => {
    server([]);
    await renderScreen(<AddVehicleScreen />);
    await pickVehicle();
    await goToCosts();
    await press('Save vehicle');
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/home'));

    mockRouter.replace.mockClear();
    server([CAMRY]);
    await renderScreen(<AddVehicleScreen />);
    await pickVehicle();
    await goToCosts();
    await press('Save vehicle');
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/garage'));
  });

  test('a failed save shows an error and stays on the screen', async () => {
    server([], { 'POST /api/vehicles': new ApiError(500) });
    await renderScreen(<AddVehicleScreen />);
    await pickVehicle();
    await goToCosts();
    await press('Save vehicle');

    expect(await screen.findByText("Couldn't save your vehicle. Check your connection and try again.")).toBeTruthy();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});

describe('entering a vehicle manually', () => {
  const startManual = async () => {
    await press(/Can't find it\? Enter details manually/);
  };

  test('skips the lookup and asks for year and make/model', async () => {
    server();
    await renderScreen(<AddVehicleScreen />);
    await startManual();

    expect(screen.getByText('Confirm the details')).toBeTruthy();
    expect(screen.getByLabelText('Year')).toBeTruthy();
    expect(screen.getByLabelText('Make and model')).toBeTruthy();
  });

  test('needs a four-digit year and a name before continuing', async () => {
    server();
    await renderScreen(<AddVehicleScreen />);
    await startManual();
    expect(button('Continue')).toBeDisabled();

    await fireEvent.changeText(screen.getByLabelText('Year'), '21');
    await fireEvent.changeText(screen.getByLabelText('Make and model'), 'Toyota Corolla');
    expect(button('Continue')).toBeDisabled(); // two-digit year

    await fireEvent.changeText(screen.getByLabelText('Year'), '2021');
    expect(button('Continue')).toBeEnabled();
  });

  test('saves what was typed, with an MPG the user must supply', async () => {
    const api = server();
    await renderScreen(<AddVehicleScreen />);
    await startManual();
    await fireEvent.changeText(screen.getByLabelText('Year'), '2012');
    await fireEvent.changeText(screen.getByLabelText('Make and model'), 'Mazda 3');
    await press('Continue');

    expect(screen.getByLabelText('Combined MPG').props.value).toBe(''); // nothing to prefill from
    expect(button('Save vehicle')).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Combined MPG'), '31');
    await press('Save vehicle');

    await waitFor(() => expect(api.callsTo('POST /api/vehicles')).toHaveLength(1));
    expect(api.callsTo('POST /api/vehicles')[0].body).toMatchObject({
      year: '2012',
      makeModel: 'Mazda 3',
      mpg: 31,
    });
  });
});
