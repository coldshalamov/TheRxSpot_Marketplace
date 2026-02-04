-- Verify expected tables/columns exist after a clean migrate.
-- Intended to be run via:
--   docker compose exec -T postgres psql -U medusa -d <db> -v ON_ERROR_STOP=1 -f scripts/db/verify-schema.sql

\set ON_ERROR_STOP on

DO $$
BEGIN
  -- Core tables that were missing pre-migrate in a fresh DB.
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tax_provider') THEN
    RAISE EXCEPTION 'Missing core table: tax_provider';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payment_provider') THEN
    RAISE EXCEPTION 'Missing core table: payment_provider';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'currency') THEN
    RAISE EXCEPTION 'Missing core table: currency';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'region_country') THEN
    RAISE EXCEPTION 'Missing core table: region_country';
  END IF;

  -- Migration tracking.
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'mikro_orm_migrations') THEN
    RAISE EXCEPTION 'Missing migrations table: mikro_orm_migrations';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'script_migrations') THEN
    RAISE EXCEPTION 'Missing migrations table: script_migrations';
  END IF;

  -- Custom module tables.
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'earning_entry') THEN
    RAISE EXCEPTION 'Missing custom table: earning_entry';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'earning_entry' AND column_name = 'business_id') THEN
    RAISE EXCEPTION 'Missing earning_entry.business_id';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'earning_entry' AND column_name = 'gross_amount') THEN
    RAISE EXCEPTION 'Missing earning_entry.gross_amount';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payout') THEN
    RAISE EXCEPTION 'Missing custom table: payout';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payout' AND column_name = 'business_id') THEN
    RAISE EXCEPTION 'Missing payout.business_id';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'document') THEN
    RAISE EXCEPTION 'Missing custom table: document';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'document' AND column_name = 'storage_key') THEN
    RAISE EXCEPTION 'Missing document.storage_key';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_log') THEN
    RAISE EXCEPTION 'Missing custom table: audit_log';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_log' AND column_name = 'risk_level') THEN
    RAISE EXCEPTION 'Missing audit_log.risk_level';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_status_event') THEN
    RAISE EXCEPTION 'Missing custom table: order_status_event';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'clinician_schedule') THEN
    RAISE EXCEPTION 'Missing custom table: clinician_schedule';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'clinician_availability_exception') THEN
    RAISE EXCEPTION 'Missing custom table: clinician_availability_exception';
  END IF;

  -- A representative link table created by `medusa db:sync-links` (part of db:migrate unless skipped).
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'businessmodule_business_cart_cart'
  ) THEN
    RAISE EXCEPTION 'Missing links table: businessmodule_business_cart_cart';
  END IF;

END $$;

SELECT 'schema verification OK' AS status;

