CREATE TABLE IF NOT EXISTS pass_purchases (
  id SERIAL PRIMARY KEY,
  auth0_id TEXT NOT NULL,
  gym_id INTEGER NOT NULL REFERENCES gyms(id),
  pass_id INTEGER NULL REFERENCES gym_passes(id),
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'gbp',
  stripe_checkout_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pass_purchases_auth0_id ON pass_purchases(auth0_id);
CREATE INDEX IF NOT EXISTS idx_pass_purchases_session ON pass_purchases(stripe_checkout_session_id);

ALTER TABLE gym_passes
  ADD COLUMN IF NOT EXISTS purchase_id INTEGER NULL REFERENCES pass_purchases(id);
