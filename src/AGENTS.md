# Agent Instructions (scope: `src/` and subdirectories)

## Ownership
- Backend Medusa code: modules, API routes, admin extensions, workflows, jobs.

## Key Directories
- `src/api/`: HTTP routes and middleware.
- `src/admin/`: Medusa admin custom routes/extensions.
- `src/modules/`: domain modules and models.
- `src/workflows/`, `src/jobs/`, `src/subscribers/`: async/business flow logic.
- `src/scripts/`: backend utility scripts.

## Commands (run from repo root)
- Dev: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Tests:
  - `npm run test`
  - `npm run test:integration:http`
  - targeted suites such as `npm run test:consultation`

## Backend-Specific Guardrails
- For admin white-screen/login issues:
  - review `docs/ADMIN_PANEL_MISTAKE_LEDGER.md`,
  - harden route rendering against bad API data (invalid dates, nullables),
  - avoid brittle assumptions in route configs.
- Keep launcher-sensitive behavior in sync with `medusa-config.ts` (`admin.path`).
- When changing auth/rate limiting, verify local dev loopback behavior is still usable.

## Do Not
- Do not hardcode admin URL paths in backend-adjacent scripts when config already owns them.
- Do not claim admin fix success without rendered UI evidence.
