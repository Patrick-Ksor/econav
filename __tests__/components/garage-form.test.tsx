import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { FuelGradeSelector } from '@/features/garage/FuelGradeSelector';
import { GasPriceField } from '@/features/garage/GasPriceField';
import { MpgStepper } from '@/features/garage/MpgStepper';
import { VehicleForm } from '@/features/garage/VehicleForm';
import { VehicleLookupModal } from '@/features/garage/VehicleLookupModal';
import { useGasPrice } from '@/services/gas-price';
import { Text } from 'react-native';

import { RawBody, mockApi } from '../helpers/api';
import { TRIM_EV, TRIM_GAS, TRIM_NO_DATA, TRIM_PREMIUM, epaRoutes, menu } from '../helpers/epa';
import { renderScreen, resetAppState } from '../helpers/render';

jest.mock('@/services/gas-price', () => ({ useGasPrice: jest.fn() }));
const gas = useGasPrice as jest.Mock;

beforeEach(() => {
  resetAppState();
  gas.mockReset().mockReturnValue({ data: undefined, isLoading: false, isError: false });
});

describe('MpgStepper', () => {
  const show = (value = 24, onChange = jest.fn()) => renderScreen(<MpgStepper value={value} onChange={onChange} />, { settle: false }).then(() => onChange);

  test('shows the rating and its European equivalent', async () => {
    await show(24);
    expect(screen.getByText('Average MPG Rating')).toBeTruthy();
    expect(screen.getAllByText('24')).toHaveLength(2); // the value, and the "24" preset
    expect(screen.getByText('9.8 L/100km equiv.')).toBeTruthy(); // 235.214 ÷ 24
  });

  test('the equivalent updates with the value', async () => {
    await show(47);
    expect(screen.getByText('5.0 L/100km equiv.')).toBeTruthy();
  });

  test('+ and − move in half-MPG steps', async () => {
    const onChange = await show(24);
    await fireEvent.press(screen.getByRole('button', { name: 'Increase MPG' }));
    expect(onChange).toHaveBeenLastCalledWith(24.5);
    await fireEvent.press(screen.getByRole('button', { name: 'Decrease MPG' }));
    expect(onChange).toHaveBeenLastCalledWith(23.5);
  });

  test('cannot go below 1 MPG', async () => {
    const onChange = await show(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Decrease MPG' }));
    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  test.each([24, 33, 43, 52])('the %p preset sets that value', async (preset) => {
    const onChange = await show(30);
    await fireEvent.press(screen.getByRole('button', { name: String(preset) }));
    expect(onChange).toHaveBeenLastCalledWith(preset);
  });
});

describe('FuelGradeSelector', () => {
  test('offers Regular, Premium and Diesel with the current one selected', async () => {
    await renderScreen(<FuelGradeSelector value="premium" onChange={() => {}} />, { settle: false });

    expect(screen.getByRole('button', { name: 'Premium', selected: true })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Regular', selected: false })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Diesel', selected: false })).toBeTruthy();
  });

  test('choosing one reports it', async () => {
    const onChange = jest.fn();
    await renderScreen(<FuelGradeSelector value="regular" onChange={onChange} />, { settle: false });
    await fireEvent.press(screen.getByRole('button', { name: 'Diesel' }));
    expect(onChange).toHaveBeenCalledWith('diesel');
  });
});

describe('GasPriceField', () => {
  const show = (props: Partial<React.ComponentProps<typeof GasPriceField>> = {}) => {
    const onOverrideChange = jest.fn();
    return renderScreen(
      <GasPriceField fuelGrade="regular" override={null} onOverrideChange={onOverrideChange} {...props} />,
      { settle: false },
    ).then(() => onOverrideChange);
  };
  const input = () => screen.getByLabelText('Gas price per gallon');

  test('shows the looked-up price and where it came from', async () => {
    gas.mockReturnValue({ data: { pricePerGallon: 3.695, source: 'api' }, isLoading: false, isError: false });
    await show({ location: { lat: 1, lng: 2 } });

    expect(input().props.value).toBe('3.70'); // shown to the cent, rounded half-up like every other price
    expect(screen.getByText('EIA weekly regional average')).toBeTruthy();
  });

  test('without a location the source is the national average', async () => {
    gas.mockReturnValue({ data: { pricePerGallon: 3.9, source: 'api' }, isLoading: false, isError: false });
    await show();
    expect(screen.getByText('EIA weekly national average')).toBeTruthy();
  });

  test('a stub price says it is only an estimate', async () => {
    gas.mockReturnValue({ data: { pricePerGallon: 3.49, source: 'stub' }, isLoading: false, isError: false });
    await show();
    expect(screen.getByText('Estimated — no live source configured')).toBeTruthy();
  });

  test('asks for the price of the chosen fuel near the user', async () => {
    await show({ fuelGrade: 'diesel', location: { lat: 35.1, lng: -80.9 } });
    expect(gas).toHaveBeenCalledWith('diesel', { lat: 35.1, lng: -80.9 });
  });

  test('typing a price overrides the estimate', async () => {
    const onOverrideChange = await show();
    await fireEvent.changeText(input(), '4.25');
    expect(onOverrideChange).toHaveBeenLastCalledWith(4.25);
  });

  test.each([[''], ['  '], ['abc']])('clearing or garbling the price (%p) removes the override', async (text) => {
    const onOverrideChange = await show({ override: 4.25 });
    await fireEvent.changeText(input(), text);
    expect(onOverrideChange).toHaveBeenLastCalledWith(null);
  });

  test('an override replaces the estimate in the field, and hides the source caption', async () => {
    gas.mockReturnValue({ data: { pricePerGallon: 3.5, source: 'api' }, isLoading: false, isError: false });
    await show({ override: 4.25 });

    expect(input().props.value).toBe('4.25');
    expect(screen.queryByText('EIA weekly national average')).toBeNull();
  });

  test('"Reset to estimated" appears only with an override, and clears it', async () => {
    const onOverrideChange = await show({ override: 4.25 });
    await fireEvent.press(screen.getByRole('button', { name: 'Reset to estimated' }));
    expect(onOverrideChange).toHaveBeenCalledWith(null);
  });

  test('no reset button without an override', async () => {
    await show({ override: null });
    expect(screen.queryByRole('button', { name: 'Reset to estimated' })).toBeNull();
  });

  test('says when the price is still loading', async () => {
    gas.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    await show();
    expect(screen.getByText('Loading current price…')).toBeTruthy();
  });

  test('a failed lookup asks the user to enter a price', async () => {
    gas.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    await show();
    expect(screen.getByText("Couldn't fetch a price estimate — enter one manually.")).toBeTruthy();
  });

  test('loading and error messages are hidden once the user has entered a price', async () => {
    gas.mockReturnValue({ data: undefined, isLoading: true, isError: true });
    await show({ override: 4 });
    expect(screen.queryByText('Loading current price…')).toBeNull();
    expect(screen.queryByText(/Couldn't fetch a price estimate/)).toBeNull();
  });
});

describe('VehicleForm', () => {
  const DEFAULTS = { year: '2021', makeModel: 'Toyota RAV4', mpg: 30, fuelGrade: 'regular' as const };

  const show = (props: Partial<React.ComponentProps<typeof VehicleForm>> = {}) => {
    const onSubmit = jest.fn();
    mockApi(epaRoutes());
    return renderScreen(
      <VehicleForm
        onSubmit={onSubmit}
        renderGasPriceField={(grade) => <Text testID="gas-field">{`gas for ${grade}`}</Text>}
        {...props}
      />,
    ).then(() => onSubmit);
  };
  const submit = (label = 'Save vehicle') => fireEvent.press(screen.getByRole('button', { name: label }));
  const submitted = (onSubmit: jest.Mock) => onSubmit.mock.calls[0][0];

  test('starts empty, asking the user to search', async () => {
    await show();
    expect(screen.getByText('Search for your vehicle…')).toBeTruthy();
    expect(screen.queryByText('Change')).toBeNull();
  });

  test('shows an existing vehicle with a Change link', async () => {
    await show({ defaultValues: DEFAULTS });
    expect(screen.getByText('2021 Toyota RAV4')).toBeTruthy();
    expect(screen.getByText('Change')).toBeTruthy();
  });

  test('cannot be submitted without a vehicle, and says why', async () => {
    const onSubmit = await show();
    await submit();

    expect(await screen.findByText('Search for your vehicle to continue.')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('submits the vehicle, MPG and fuel grade', async () => {
    const onSubmit = await show({ defaultValues: DEFAULTS });
    await submit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(submitted(onSubmit)).toEqual(DEFAULTS);
  });

  test('includes edits made to MPG and fuel type', async () => {
    const onSubmit = await show({ defaultValues: DEFAULTS });
    await fireEvent.press(screen.getByRole('button', { name: 'Increase MPG' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Increase MPG' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Premium' }));
    await submit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(submitted(onSubmit)).toMatchObject({ mpg: 31, fuelGrade: 'premium' });
  });

  test('defaults MPG to 33 and fuel to regular for a new vehicle', async () => {
    await show();
    expect(screen.getByText('7.1 L/100km equiv.')).toBeTruthy(); // 33 MPG
    expect(screen.getByRole('button', { name: 'Regular', selected: true })).toBeTruthy();
  });

  test('gives the gas-price field the currently chosen fuel', async () => {
    await show({ defaultValues: DEFAULTS });
    expect(screen.getByTestId('gas-field').props.children).toBe('gas for regular');

    await fireEvent.press(screen.getByRole('button', { name: 'Diesel' }));
    expect(screen.getByTestId('gas-field').props.children).toBe('gas for diesel');
  });

  test('the button label can be customised, with a reassuring caption', async () => {
    await show({ defaultValues: DEFAULTS, submitLabel: 'Save changes' });
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeTruthy();
    expect(screen.getByText('You can update these details anytime.')).toBeTruthy();
  });

  describe('looking the vehicle up', () => {
    const pick = async (trimLabel: string) => {
      await fireEvent.press(screen.getByText('Search for your vehicle…'));
      await fireEvent.press(screen.getByText('Year'));
      await fireEvent.press(await screen.findByRole('button', { name: '2021' }));
      await fireEvent.press(screen.getByText('Make'));
      await fireEvent.press(await screen.findByRole('button', { name: 'Toyota' }));
      await fireEvent.press(screen.getByText('Model'));
      await fireEvent.press(await screen.findByRole('button', { name: 'RAV4' }));
      await fireEvent.press(screen.getByText('Trim'));
      await fireEvent.press(await screen.findByRole('button', { name: trimLabel }));
    };

    test('opens the lookup from the vehicle field', async () => {
      await show();
      await fireEvent.press(screen.getByText('Search for your vehicle…'));
      expect(screen.getByText('Look Up Vehicle')).toBeTruthy();
    });

    test('fills in the vehicle, MPG and fuel grade from the EPA record', async () => {
      const onSubmit = await show();
      await pick('Auto (S8), 4cyl, 2.5 L, Premium');

      expect(await screen.findByText('2021 Toyota RAV4')).toBeTruthy();
      expect(screen.queryByText('Look Up Vehicle')).toBeNull(); // the modal closed itself
      expect(screen.getByText('9.0 L/100km equiv.')).toBeTruthy(); // 26 MPG
      expect(screen.getByRole('button', { name: 'Premium', selected: true })).toBeTruthy();

      await submit();
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(submitted(onSubmit)).toEqual({ year: '2021', makeModel: 'Toyota RAV4', mpg: 26, fuelGrade: 'premium' });
    });
  });
});

describe('VehicleLookupModal', () => {
  const show = (visible = true) => {
    const onClose = jest.fn();
    const onResolved = jest.fn();
    return renderScreen(<VehicleLookupModal visible={visible} onClose={onClose} onResolved={onResolved} />).then(() => ({
      onClose,
      onResolved,
    }));
  };
  const open = (label: string) => fireEvent.press(screen.getByText(label));
  const choose = async (step: string, option: string) => {
    await open(step);
    await fireEvent.press(await screen.findByRole('button', { name: option }));
  };
  const chooseThroughTrim = async (trim: string) => {
    await choose('Year', '2021');
    await choose('Make', 'Toyota');
    await choose('Model', 'RAV4');
    await choose('Trim', trim);
  };

  beforeEach(() => {
    mockApi(epaRoutes());
  });

  test('renders nothing while hidden', async () => {
    await show(false);
    expect(screen.queryByText('Look Up Vehicle')).toBeNull();
  });

  test('explains what it does', async () => {
    await show();
    expect(screen.getByText('Look Up Vehicle')).toBeTruthy();
    expect(screen.getByText('EPA fuel economy data — auto-fills your MPG and fuel grade.')).toBeTruthy();
  });

  test('later steps are locked until the earlier ones are chosen', async () => {
    await show();
    // Make, Model and Trim show a dash and can't be opened yet.
    expect(screen.getAllByText('—')).toHaveLength(3);
    expect(screen.getByText('Make')).toBeTruthy();
  });

  test('choosing a year unlocks Make and shows the year', async () => {
    await show();
    await choose('Year', '2021');

    expect(screen.getByText('2021')).toBeTruthy();
    expect(screen.getAllByText('—')).toHaveLength(2);
  });

  test('changing an earlier choice clears the later ones', async () => {
    await show();
    await choose('Year', '2021');
    await choose('Make', 'Toyota');
    expect(screen.getByText('Toyota')).toBeTruthy();

    await choose('Year', '2020');
    expect(screen.queryByText('Toyota')).toBeNull();
    expect(screen.getAllByText('—')).toHaveLength(2); // Model and Trim locked again
  });

  test('resolves a gasoline trim: reports year, make+model, MPG and fuel, then closes', async () => {
    const { onResolved, onClose } = await show();
    await chooseThroughTrim('Auto (S8), 4cyl, 2.5 L');

    await waitFor(() => expect(onResolved).toHaveBeenCalledTimes(1));
    expect(onResolved).toHaveBeenCalledWith({ year: '2021', makeModel: 'Toyota RAV4', mpg: 30, fuelGrade: 'regular' });
    expect(onClose).toHaveBeenCalled();
  });

  test('carries a premium fuel grade through', async () => {
    const { onResolved } = await show();
    await chooseThroughTrim('Auto (S8), 4cyl, 2.5 L, Premium');
    await waitFor(() => expect(onResolved).toHaveBeenCalled());
    expect(onResolved.mock.calls[0][0]).toMatchObject({ mpg: 26, fuelGrade: 'premium' });
  });

  test('refuses an electric trim, with an explanation, and stays open', async () => {
    const { onResolved, onClose } = await show();
    await chooseThroughTrim('Electric');

    expect(await screen.findByText(/doesn't support EV cost estimates yet/)).toBeTruthy();
    expect(onResolved).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  test('refuses a trim with no EPA data', async () => {
    const { onResolved } = await show();
    await chooseThroughTrim('Prototype');

    expect(await screen.findByText(/No EPA fuel economy data for this trim/)).toBeTruthy();
    expect(onResolved).not.toHaveBeenCalled();
  });

  test('reports a network failure during the lookup', async () => {
    mockApi({ ...epaRoutes(), 'GET /ws/rest/vehicle/*': new RawBody('') as never });
    // An unparsable record is fine; a failed request is what we want here.
    mockApi({ ...epaRoutes(), 'GET /ws/rest/vehicle/*': ((): never => { throw new Error('offline'); }) as never });
    const { onResolved } = await show();
    await chooseThroughTrim('Auto (S8), 4cyl, 2.5 L');

    expect(await screen.findByText("Couldn't reach fueleconomy.gov — try again.")).toBeTruthy();
    expect(onResolved).not.toHaveBeenCalled();
  });

  test('shows progress while looking up fuel economy', async () => {
    mockApi({ ...epaRoutes(), 'GET /ws/rest/vehicle/*': (() => new Promise(() => {})) as never });
    await show();
    await chooseThroughTrim('Auto (S8), 4cyl, 2.5 L');
    expect(await screen.findByText('Looking up fuel economy…')).toBeTruthy();
  });

  test('a long list gets a search box that filters it', async () => {
    mockApi({
      ...epaRoutes(),
      'GET /ws/rest/vehicle/menu/year': menu(['2027', '2026', '2025', '2024', '2023', '2022', '2021'].map((y) => [y, y])),
    });
    await show();
    await open('Year');

    await fireEvent.changeText(await screen.findByLabelText('Search Year'), '202');
    await fireEvent.changeText(screen.getByLabelText('Search Year'), '2027');
    expect(screen.getByRole('button', { name: '2027' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '2026' })).toBeNull();
  });

  test('a short list has no search box', async () => {
    await show();
    await open('Year');
    await screen.findByRole('button', { name: '2021' });
    expect(screen.queryByLabelText('Search Year')).toBeNull();
  });

  test('a failed list load says so when opened', async () => {
    mockApi({ 'GET /ws/rest/vehicle/menu/year': new RawBody('') as never });
    mockApi({});
    await show();
    await open('Year');
    expect(await screen.findByText("Couldn't load options — try again.")).toBeTruthy();
  });

  test('Close dismisses it and forgets the choices', async () => {
    const { onClose } = await show();
    await choose('Year', '2021');
    await fireEvent.press(screen.getAllByRole('button', { name: 'Close' })[1]); // the X (the first is the backdrop)

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('2021')).toBeNull();
  });

  test('tapping the backdrop also closes it', async () => {
    const { onClose } = await show();
    await fireEvent.press(screen.getAllByRole('button', { name: 'Close' })[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// Keep the unused trim ids referenced so the catalog and these tests stay in sync.
void [TRIM_GAS, TRIM_PREMIUM, TRIM_EV, TRIM_NO_DATA];
