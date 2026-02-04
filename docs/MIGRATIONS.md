# Database Migrations (Medusa v2)

This repo uses **Medusa v2 module migrations** (MikroORM migrations) plus Medusa **migration scripts**.

## Migration types in this repo

1) **Module migrations (MikroORM)**
- Location: `src/modules/*/migrations/*.ts`
- Applied by: `npx medusa db:migrate`
- Rolled back by: `npx medusa db:rollback --modules <moduleName>`

Custom module names (used with `db:rollback`):
- `financialsModuleService`
- `complianceModuleService`
- `businessModuleService`
- `consultationModuleService`

2) **Migration scripts**
- Applied by: `npx medusa db:migrate` (unless `--skip-scripts`) or `npx medusa db:migrate:scripts`
- These are shipped by Medusa core and tracked in the `script_migrations` table.

## Clean database: reproducible workflow (verified)

### Prereqs

- Docker Desktop running
- From repo root: `d:\\GitHub\\TheRxSpot_Marketplace`

Start dependencies:
```powershell
docker compose up -d
docker compose ps
```

### Option A: One-command workflow (recommended)

Runs:
1) create/drop clean DB via dockerized Postgres
2) `npx medusa db:migrate --execute-safe-links --all-or-nothing`
3) schema verification via `scripts/db/verify-schema.sql`

```powershell
npm run db:clean-migrate
```

Optional: use a different database name:
```powershell
node scripts/db/clean-migrate.mjs --db medusa_clean_migrations_2
```

### Option B: Manual step-by-step (PowerShell copy/paste)

Pick a clean DB name:
```powershell
$DB_NAME = "medusa_clean_migrations"
```

Drop + create the database:
```powershell
docker compose exec -T postgres psql -U medusa -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ""$DB_NAME"" WITH (FORCE);"
docker compose exec -T postgres psql -U medusa -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE ""$DB_NAME"";"
```

Run Medusa migrations (uses `DATABASE_URL`):
```powershell
$env:DATABASE_URL = "postgres://medusa:medusa@localhost:5432/$DB_NAME"
npx medusa db:migrate --execute-safe-links --all-or-nothing
```

Verify expected schema exists:
```powershell
Get-Content -Raw scripts/db/verify-schema.sql | docker compose exec -T postgres psql -U medusa -d $DB_NAME -v ON_ERROR_STOP=1
```

## Migration order dependencies

Medusa decides migration order based on module dependency graph. In practice:

1) Core Medusa module migrations run first (create baseline tables like `tax_provider`, `payment_provider`, `currency`, `region_country`).
2) Custom module migrations run (this repo’s `src/modules/*/migrations/*.ts`).
3) Link tables are synced (unless `--skip-links`).
4) Migration scripts are executed (unless `--skip-scripts`).

When debugging ordering problems, rerun with `--verbose`:
```powershell
npx medusa db:migrate --execute-safe-links --all-or-nothing --verbose
```

## Rollback strategy

### Preferred: Medusa rollback (uses migration `down()` methods)

Rollback the last batch for a module:
```powershell
npx medusa db:rollback --modules financialsModuleService
npx medusa db:rollback --modules complianceModuleService
npx medusa db:rollback --modules businessModuleService
npx medusa db:rollback --modules consultationModuleService
```

### Emergency fallback: explicit SQL rollback scripts

If you cannot use `db:rollback` (or need manual recovery), run the matching script:

```powershell
$DB_NAME = "medusa_clean_migrations"
Get-Content -Raw scripts/rollback/20250203000001_financials.sql | docker compose exec -T postgres psql -U medusa -d $DB_NAME -v ON_ERROR_STOP=1
Get-Content -Raw scripts/rollback/20250203000002_compliance.sql | docker compose exec -T postgres psql -U medusa -d $DB_NAME -v ON_ERROR_STOP=1
Get-Content -Raw scripts/rollback/20250203000003_business.sql | docker compose exec -T postgres psql -U medusa -d $DB_NAME -v ON_ERROR_STOP=1
Get-Content -Raw scripts/rollback/20250203000004_consultation.sql | docker compose exec -T postgres psql -U medusa -d $DB_NAME -v ON_ERROR_STOP=1
```

Notes:
- These scripts drop tables created by the migration and attempt to remove the migration record from `mikro_orm_migrations` **if** it has a `name` column.
- Prefer `db:rollback` whenever possible to keep migration state consistent.
