-- migrations/001_create_payments.sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  order_id UUID NOT NULL,
  amount_kobo BIGINT NOT NULL CHECK (amount_kobo > 0),
  currency TEXT NOT NULL CHECK (currency IN ('NGN', 'USD', 'GHS', 'KES')),
  gateway TEXT NOT NULL CHECK (gateway IN ('paystack', 'flutterwave', 'stripe')),
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed','cancelled')),
  gateway_transaction_id TEXT,
  gateway_reference TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX payments_idempotency_key_idx ON payments(idempotency_key);
CREATE INDEX payments_user_id_status_idx ON payments(user_id, status);
CREATE INDEX payments_order_id_idx ON payments(order_id);
CREATE INDEX payments_status_created_at_idx ON payments(status, created_at);
CREATE INDEX payments_gateway_transaction_id_idx ON payments(gateway_transaction_id) WHERE gateway_transaction_id IS NOT NULL;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
