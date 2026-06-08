CREATE TABLE IF NOT EXISTS gym_group_enquiries (
  id SERIAL PRIMARY KEY,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  company_name TEXT NOT NULL,
  locations TEXT NOT NULL,
  phone TEXT,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT gym_group_enquiries_locations_check
    CHECK (locations IN ('1-5', '6-10', '11-20', '21-50', '50+'))
);
