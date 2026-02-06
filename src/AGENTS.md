# Agent Instructions (scope: `src/` and subdirectories)

## Ownership
- Backend Medusa code: modules, API routes, admin extensions, workflows, jobs.

## Mandatory Pre-Flight
1. Read root `AGENTS.md` and `docs/AGENT_GROUNDING_PROTOCOL.md`.
2. Read backend guardrails in `MEDUSA_V2_CONTEXT.md`.
3. Route task-specific reading via:
   - `medusadocs/02_BUILDING/MODULES.md`
   - `medusadocs/02_BUILDING/WORKFLOWS.md`
   - `medusadocs/02_BUILDING/API_ROUTES.md`
   - `medusadocs/02_BUILDING/AUTH_SECURITY.md`
4. For admin login/render regressions, read `docs/ADMIN_PANEL_MISTAKE_LEDGER.md` first.

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
- Use Serena semantic tooling first for cross-file symbol tracing/refactors; use `rg` for literal or path search.
- If guidance is unclear in `medusadocs/`, run targeted `llms-full.txt` searches before inventing patterns.

## Do Not
- Do not hardcode admin URL paths in backend-adjacent scripts when config already owns them.
- Do not claim admin fix success without rendered UI evidence.
- Do not introduce V1 patterns (`src/services`, Express `router.use`, cross-module service imports).
