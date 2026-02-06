# Production Readiness Runbook

## Scope
This runbook covers local and staging hardening for:
1. Medusa backend + admin (`src/`).
2. Next.js storefront (`TheRxSpot_Marketplace-storefront/`).
3. Tenant/auth/url operational contract checks.

## Windows Startup
1. Start dependencies:
   - `.\Start-Dependencies.bat`
2. Start backend/admin:
   - `.\Launch-Admin-Only.bat`
3. Start storefront:
   - `.\Launch-Storefront-Only.bat`

Notes:
1. The launchers may fallback to alternate ports if defaults are occupied.
2. Runtime-selected ports are written to `launcher_assets/runtime-config.js`.

## Required Environment Variables (Names Only)
Backend (`.env`):
1. `DATABASE_URL`
2. `REDIS_URL`
3. `JWT_SECRET`
4. `COOKIE_SECRET`
5. `STORE_CORS`
6. `ADMIN_CORS`
7. `AUTH_CORS`
8. `MEDUSA_BACKEND_URL`
9. `ENCRYPTION_KEY_CURRENT` (or legacy equivalent for local compatibility)

Storefront (`TheRxSpot_Marketplace-storefront/.env.local`):
1. `MEDUSA_BACKEND_URL`
2. `NEXT_PUBLIC_MEDUSA_BACKEND_URL`
3. `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`
4. `NEXT_PUBLIC_DEFAULT_REGION`

## Full Check Pipeline
Primary baseline:
1. `npm run check`

Smoke and integrity gates:
1. `npm run check:schema`
2. `npm run check:admin-integrity`
3. `npm run diagnose:smoke`
4. `npm run prod:gate`

## Known Failure Modes and Fixes
1. Admin spinner/blank due asset drift:
   - Symptom: `/app/login` references hashed asset not present in `public/admin/assets`.
   - Fix: `npm run build`, restart backend, re-run `npm run check:admin-integrity`.
2. Port drift / wrong backend target:
   - Symptom: launchers start but storefront/admin talk to wrong port.
   - Fix: verify `launcher_assets/runtime-config.js`, re-run launchers, then `npm run diagnose:smoke`.
3. Schema mismatch (runtime column missing):
   - Symptom: backend logs SQL errors like missing `audit_log.updated_at`.
   - Fix: run migration strategy for environment and confirm with `npm run check:schema`.
4. Redis unavailable causing backend hang:
   - Symptom: `medusa start/develop` hangs on startup.
   - Fix: ensure Redis is reachable on configured `REDIS_URL`.
5. Storefront publishable key mismatch:
   - Symptom: storefront store API requests fail auth/validation.
   - Fix: verify launcher-provisioned key and backend URL alignment.

## Intentional Gaps / Not Fully Implemented Yet
1. Tenant + auth + URL staging contract still requires live seeded tenant-domain fixtures for full positive-path proof in every environment.
2. Global React HTMLAttributes augmentation for table cells remains as technical debt and should be replaced by a scoped typing solution.
3. CDN/proxy production cache invalidation strategy for admin bundle hashes is not fully formalized in this repository.

## Release Recommendation
Before production deployment:
1. Run `npm run prod:gate` twice on clean processes.
2. Validate admin login + critical route navigation twice.
3. Validate tenant-domain positive and negative contract cases in staging with real HTTPS subdomains.
