# Agent Instructions (scope: `TheRxSpot_Marketplace-storefront/` and subdirectories)

## Ownership
- Next.js storefront, tenant-aware customer UI, web runtime behavior.

## Mandatory Pre-Flight
1. Read root `AGENTS.md` and `docs/AGENT_GROUNDING_PROTOCOL.md`.
2. Read `medusadocs/01_CONTEXT/YOUR_CODEBASE.md` for current backend/storefront coupling.
3. For integration changes, read `medusadocs/02_BUILDING/API_ROUTES.md` and confirm backend contract assumptions.
4. For admin login/render-related diagnostics crossing backend boundaries, read `docs/ADMIN_PANEL_MISTAKE_LEDGER.md`.

## Commands (run from this directory)
- Dev: `npm run dev`
- Build: `npm run build`
- Start: `npm run start`
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Full check: `npm run check`

## Environment + Integration
- Backend URL env:
  - `MEDUSA_BACKEND_URL`
  - `NEXT_PUBLIC_MEDUSA_BACKEND_URL`
- Default local backend often runs on `9000` or fallback `9001`; keep env aligned with launcher/runtime.
- **CRITICAL: Port 9000 is reserved for the USER's IDE. Use port 9001 or another alternate for Medusa.**

## Testing Notes
- Prefer deterministic smoke checks for critical user flows.
- Playwright is available in this module and can be used for login/render verification.
- Prefer Serena semantic navigation when tracing shared types or route usage across this module and backend.

## Do Not
- Do not assume backend port/path defaults; read runtime config or launcher output.
- Do not mark storefront/backend integration fixed from navigation-only checks.
