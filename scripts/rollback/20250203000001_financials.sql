-- Emergency rollback for Migration20250203000001 (financials)
-- Drops tables created by the migration and removes migration record if present.
-- Run with:
--   PowerShell:
--     Get-Content -Raw scripts/rollback/20250203000001_financials.sql | docker compose exec -T postgres psql -U medusa -d <db> -v ON_ERROR_STOP=1
--   Cmd.exe (works from PowerShell too):
--     cmd /c "docker compose exec -T postgres psql -U medusa -d <db> -v ON_ERROR_STOP=1 < scripts\\rollback\\20250203000001_financials.sql"

\set ON_ERROR_STOP on

BEGIN;

DROP TABLE IF EXISTS "earning_entry" CASCADE;
DROP TABLE IF EXISTS "payout" CASCADE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'mikro_orm_migrations'
      AND column_name = 'name'
  ) THEN
    EXECUTE format(
      'DELETE FROM "mikro_orm_migrations" WHERE "name" = %L',
      'Migration20250203000001'
    );
  END IF;
END $$;

COMMIT;
