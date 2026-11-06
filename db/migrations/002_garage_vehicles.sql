-- Several vehicles per user, one active at a time. Depreciation now lives on the vehicle.
-- vehicle_profiles and route_preferences are left untouched (legacy); the API reads the
-- active row of garage_vehicles instead. Safe to re-run.
CREATE TABLE IF NOT EXISTS garage_vehicles (
  id                    text PRIMARY KEY,
  user_id               text NOT NULL,
  year                  text NOT NULL,
  make_model            text NOT NULL,
  mpg                   numeric(6, 2) NOT NULL CHECK (mpg > 0),
  fuel_grade            text NOT NULL CHECK (fuel_grade IN ('regular', 'premium', 'diesel')),
  gas_price_override    numeric(6, 3),
  depreciation_per_mile numeric(6, 3) NOT NULL DEFAULT 0.18 CHECK (depreciation_per_mile BETWEEN 0 AND 5),
  is_active             boolean NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS garage_vehicles_user_idx ON garage_vehicles (user_id);

-- At most one active vehicle per user.
CREATE UNIQUE INDEX IF NOT EXISTS garage_vehicles_one_active_idx ON garage_vehicles (user_id) WHERE is_active;

-- Copy each user's existing vehicle (and their saved depreciation) in as the active one.
INSERT INTO garage_vehicles (id, user_id, year, make_model, mpg, fuel_grade, gas_price_override, depreciation_per_mile, is_active, updated_at)
SELECT
  'veh_' || md5(vp.user_id),
  vp.user_id,
  vp.year,
  vp.make_model,
  vp.mpg,
  vp.fuel_grade,
  vp.gas_price_override,
  COALESCE(rp.depreciation_per_mile, 0.18),
  true,
  vp.updated_at
FROM vehicle_profiles vp
LEFT JOIN route_preferences rp ON rp.user_id = vp.user_id
WHERE NOT EXISTS (SELECT 1 FROM garage_vehicles g WHERE g.user_id = vp.user_id);
