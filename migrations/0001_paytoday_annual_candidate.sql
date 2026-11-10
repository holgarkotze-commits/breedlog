-- PREPARED ONLY. Never auto-apply at application startup or to production.
-- Existing livestock, accounts, pricing and commercial settings are unchanged.
CREATE TABLE IF NOT EXISTS breedlog_payment_orders (
  id varchar(64) PRIMARY KEY CHECK (id ~ '^BREEDLOG-[A-F0-9]{32}$'),
  workspace varchar(160) NOT NULL,
  snapshot jsonb NOT NULL,
  state jsonb NOT NULL,
  payment_hash varchar(64) UNIQUE,
  CHECK (snapshot->>'workspace' = workspace),
  CHECK (snapshot->>'id' = id),
  CHECK (snapshot->'offer'->>'product' = 'breedlog_premium_annual'),
  CHECK (snapshot->'offer'->>'provider' = 'paytoday')
);
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
