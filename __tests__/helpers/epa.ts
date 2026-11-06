import { RawBody } from './api';

// fueleconomy.gov answers in XML: flat <menuItems> lists, and a <vehicle> record per trim.
export const menu = (items: [text: string, value: string][]) =>
  new RawBody(
    `<menuItems>${items.map(([t, v]) => `<menuItem><text>${t}</text><value>${v}</value></menuItem>`).join('')}</menuItems>`,
  );

export const record = (mpg: number | string, fuel = 'Regular Gasoline', atv = '') =>
  new RawBody(`<vehicle><comb08>${mpg}</comb08><fuelType1>${fuel}</fuelType1><atvType>${atv}</atvType></vehicle>`);

export const TRIM_GAS = '46123';
export const TRIM_PREMIUM = '46124';
export const TRIM_EV = '46999';
export const TRIM_NO_DATA = '46000';

/** A small EPA catalog: 2021 Toyota RAV4 with a gas, a premium, an electric and a data-less trim. */
export const epaRoutes = () => ({
  'GET /ws/rest/vehicle/menu/year': menu([['2022', '2022'], ['2021', '2021'], ['2020', '2020']]),
  'GET /ws/rest/vehicle/menu/make': menu([['Honda', 'Honda'], ['Toyota', 'Toyota'], ['Ford', 'Ford']]),
  'GET /ws/rest/vehicle/menu/model': menu([['RAV4', 'RAV4'], ['Camry', 'Camry']]),
  'GET /ws/rest/vehicle/menu/options': menu([
    ['Auto (S8), 4cyl, 2.5 L', TRIM_GAS],
    ['Auto (S8), 4cyl, 2.5 L, Premium', TRIM_PREMIUM],
    ['Electric', TRIM_EV],
    ['Prototype', TRIM_NO_DATA],
  ]),
  'GET /ws/rest/vehicle/*': ({ path }: { path: string }) => {
    const id = path.split('?')[0].split('/').pop();
    if (id === TRIM_GAS) return record(30);
    if (id === TRIM_PREMIUM) return record(26, 'Premium Gasoline');
    if (id === TRIM_EV) return record(112, 'Electricity', 'EV');
    return record(0);
  },
});
