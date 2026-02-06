# Admin Panel Stability Memory

Primary reference: `docs/ADMIN_PANEL_MISTAKE_LEDGER.md`

## Non-Negotiable Evidence Standard
Never claim an admin fix is done unless all are true in one run:
1. Post-login UI is visibly rendered (not blank shell).
2. No critical browser/runtime errors (including route render crashes).
3. Auth flow succeeds (`/auth/user/emailpass` and `/auth/session` success).
4. Behavior is repeatable in at least 2 clean runs.

## Known Failure Patterns
- URL changed but UI failed to render.
- Invalid/unsafe data assumptions causing route render exceptions.
- Launcher/runtime drift (wrong port, stale assets, wrong `admin.path` assumptions).
- Diagnostics written into watched directories causing accidental reload loops.

## Fast Recovery Workflow
1. Start via `Launch-Admin-Only.ps1`.
2. Confirm backend health is stable (`/health`).
3. Rebuild admin when routes/config changed.
4. Re-run automated login smoke in clean browser context.
5. Only then claim fix, with explicit evidence summary.

## Guardrails
- Treat `medusa-config.ts` (`admin.path`) as source of truth.
- Do not hardcode admin URL paths in tooling if config already owns them.
- Keep artifact/log outputs outside watched source directories.
- **CRITICAL: Port 9000 is reserved for the USER's IDE. NEVER kill processes on port 9000 or attempt to use it.**
