CREATE TABLE IF NOT EXISTS investor_enquiries (
  id SERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  investment_range TEXT,
  message TEXT,
  investor_pack_sent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT investor_enquiries_investment_range_check
    CHECK (
      investment_range IS NULL
      OR investment_range IN ('under-100k', '100k-500k', '500k-1m', '1m-plus', 'strategic')
    )
);
