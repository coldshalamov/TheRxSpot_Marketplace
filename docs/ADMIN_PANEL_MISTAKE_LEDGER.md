# Admin Panel Mistake Ledger

Date: 2026-02-06
Scope: Medusa admin login/post-login white-screen and "unexpected error while rendering this page"

## What Made This Hard
- Multiple failure modes looked the same in the browser (blank/white screen).
- We accepted URL transitions as "success" instead of requiring rendered UI evidence.
- Launcher/runtime behavior could intermittently serve stale assets or race startup stability.
- One bad datum (invalid timestamp) could crash a route render and trigger the generic error page.

## Concrete Mistakes We Made
1. Declared fixes without strict render proof.
2. Relied on one-time checks instead of repeatable evidence.
3. Let diagnostics write artifacts inside watched folders (triggered dev server reloads).
4. Underestimated launcher drift risks (ports/path/runtime config mismatches).

## Root Causes and Fixes Applied
1. Fragile route rendering for date fields:
   - Added safe date formatting guards in admin routes (`users`, `consultations/[id]`) to prevent runtime crashes on invalid dates.
2. Launcher/runtime drift:
   - Launchers now handle admin path consistently, update runtime config with `adminPath`, and avoid stale link targets.
   - Added stronger backend readiness gating (consecutive health checks, not one transient pass).
3. Stale/incorrect admin bundle risk:
   - Rebuild checks improved around admin path/source freshness.

## Evidence Standard Going Forward
Never claim "working" unless all are true in the same run:
1. Post-login screen visibly renders non-empty app UI (sidebar + page content).
2. No `pageerror` and no failed critical requests.
3. Auth endpoints succeed (`/auth/user/emailpass`, `/auth/session`).
4. Repeatability: at least 2 clean runs.

## Fast Triage Workflow (Do This First)
1. Start with launcher (`Launch-Admin-Only.ps1`) and confirm backend port.
2. Verify `http://localhost:<port>/health` is stable.
3. Rebuild admin (`npm run build`) after admin route/launcher changes.
4. Run automated login smoke in a clean browser context.
5. If white-screen persists, collect console + network + route-level stack traces before code changes.

## Guardrails
- Do not treat "reached URL" as proof of rendered success.
- Keep diagnostic artifacts outside watched source directories.
- Prefer deterministic scripts over manual spot checks for regressions.
