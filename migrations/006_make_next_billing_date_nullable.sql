-- Free tier subscriptions have no billing cycle; next_billing_date must be nullable.
ALTER TABLE subscriptions
  ALTER COLUMN next_billing_date DROP NOT NULL;
