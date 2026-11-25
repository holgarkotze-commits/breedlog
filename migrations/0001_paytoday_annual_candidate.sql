-- PREPARED ONLY. Never auto-apply at application startup or to production.
-- Existing livestock, accounts, pricing and commercial settings are unchanged.
CREATE TABLE IF NOT EXISTS breedlog_provider_transactions (
  transaction_hash varchar(64) PRIMARY KEY,
  binding jsonb NOT NULL
);
-- Provider-wide registry: no product/tenant/intent partition in the unique key.
-- Future product adapters must claim this same registry in their grant transaction.
CREATE TABLE IF NOT EXISTS breedlog_payment_orders (
  id varchar(64) PRIMARY KEY CHECK (id ~ '^BREEDLOG-[A-F0-9]{32}$'),
  workspace varchar(160) NOT NULL,
  snapshot jsonb NOT NULL,
  state jsonb NOT NULL,
  payment_hash varchar(64) UNIQUE,
  CHECK (snapshot->>'workspace' = workspace),
  CHECK (snapshot->>'id' = id),
  CHECK (snapshot->'offer'->>'product' IN ('breedlog_premium_annual', 'breedlog_premium_monthly')),
  CHECK (snapshot->'offer'->>'provider' = 'paytoday')
);
-- An uncertain provider outcome is not a lease: time/browser expiry never frees
-- this reservation. Existing duplicate unresolved rows make preparation fail
-- closed for explicit review; never delete or rewrite them automatically.
CREATE UNIQUE INDEX IF NOT EXISTS breedlog_one_unresolved_annual_checkout
  ON breedlog_payment_orders (workspace)
  WHERE COALESCE(state->>'status','') NOT IN ('paid','revoked')
    AND (state->>'checkoutResolved') IS DISTINCT FROM 'true';
CREATE OR REPLACE FUNCTION breedlog_keep_payment_snapshot() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.workspace IS DISTINCT FROM OLD.workspace
     OR NEW.snapshot IS DISTINCT FROM OLD.snapshot THEN
    RAISE EXCEPTION 'Payment order snapshot is immutable';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS breedlog_payment_snapshot_immutable ON breedlog_payment_orders;
CREATE TRIGGER breedlog_payment_snapshot_immutable BEFORE UPDATE ON breedlog_payment_orders
FOR EACH ROW EXECUTE FUNCTION breedlog_keep_payment_snapshot();
-- Snapshot columns are immutable through the only application write API.
-- State/unique payment binding and existing commercial settings commit together.

-- Candidate-only, explicit migration: widen an existing annual-only check when
-- this prepared script is rerun against an earlier candidate test database.
DO $$
DECLARE old_check record;
BEGIN
  FOR old_check IN SELECT conname FROM pg_constraint WHERE conrelid='breedlog_payment_orders'::regclass
    AND contype='c' AND pg_get_constraintdef(oid) LIKE '%breedlog_premium_annual%'
    AND pg_get_constraintdef(oid) NOT LIKE '%breedlog_premium_monthly%'
  LOOP EXECUTE format('ALTER TABLE breedlog_payment_orders DROP CONSTRAINT %I', old_check.conname); END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='breedlog_payment_orders'::regclass AND conname='breedlog_payment_product') THEN
    ALTER TABLE breedlog_payment_orders ADD CONSTRAINT breedlog_payment_product
      CHECK (snapshot->'offer'->>'product' IN ('breedlog_premium_annual','breedlog_premium_monthly'));
  END IF;
END;
$$;
