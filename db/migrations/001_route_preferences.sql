-- Per-user routing preferences (priority, time value, depreciation, tolls).
-- Run once against the Neon database. Safe to re-run.
CREATE TABLE IF NOT EXISTS route_preferences (
  user_id               text PRIMARY KEY,
  priority              text NOT NULL DEFAULT 'balance'
                          CHECK (priority IN ('cost', 'balance', 'fast')),
  time_value_per_hour   numeric(6, 2) NOT NULL DEFAULT 18 CHECK (time_value_per_hour BETWEEN 0 AND 100),
  depreciation_per_mile numeric(6, 3) NOT NULL DEFAULT 0.18 CHECK (depreciation_per_mile BETWEEN 0 AND 5),
  include_tolls         boolean NOT NULL DEFAULT true,
  updated_at            timestamptz NOT NULL DEFAULT now()
);
