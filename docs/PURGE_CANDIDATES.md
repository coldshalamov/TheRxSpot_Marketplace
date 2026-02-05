# Purge candidates — TheRxSpot_Marketplace

Goal: reduce repo surface area and remove template/import leftovers **without breaking builds or onboarding**.

## What appears to be “real product code”

- `src/` — Medusa backend + custom modules (business, consultation, compliance, financials).
- `TheRxSpot_Marketplace-storefront/` — Next.js storefront (Medusa starter-derived).
- `docs/` — operational + implementation docs.
- `docker-compose.yml`, `Dockerfile`, `medusa-config.ts` — local/dev + deployment.

## Safe-to-remove (after confirming you don’t use them)

These are common template/import leftovers. Before deleting, run:
- `npm run test:integration:custom`
- `npm run build`
- `npm -C TheRxSpot_Marketplace-storefront run build`

### Dev launcher artifacts
- `Launch-Marketplace.ps1`, `Launch-Marketplace.bat`, `Marketplace-Launcher.html`, `launcher_assets/`
  - Keep only if you use the local launcher workflow.

### Legacy / archival docs
- `docs/archive/`
  - Contains planning/history. Safe to delete if you don’t want it in the production repo.

### Seed scripts and seed fixtures
- `src/scripts/`, `seed-data/`
  - Keep if you rely on demo data or staging seeding.
  - Remove from production repo if you never run them (or move to a separate “ops” repo).

### Old integration test harness
- `integration-tests/`
  - If you only use `src/tests/integration/**`, you can remove this folder.

## Already removed / good to keep removed

- `packages/mcp-server/` — removed from the repo (was scaffolding, not part of the MVP runtime).
- Storefront checkout routes — removed (MVP has no checkout yet).

## What should never be committed (verify ignored)

These should be local-only artifacts:
- `node_modules/` (root + storefront)
- `.medusa/`
- `uploads/`
- `reports/`, `coverage/`

`.gitignore` already includes most of these; confirm the storefront has its own ignore rules as well.

