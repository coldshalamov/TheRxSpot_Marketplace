# Troubleshooting Playbook

## Backend Hangs on Startup
- Check Redis availability first (Medusa v2 event bus dependency).
- Confirm `DATABASE_URL` connectivity and migration state.
- Re-run with clean logs and inspect startup error stream.

## Admin White Screen / Render Error
- Read `docs/ADMIN_PANEL_MISTAKE_LEDGER.md` first.
- Verify backend health and correct admin route path (`/app` from config).
- Rebuild admin assets if route/config changed.
- Use deterministic login smoke and collect browser/network evidence.

## Storefront Cannot Reach Backend
- Validate `MEDUSA_BACKEND_URL` and `NEXT_PUBLIC_MEDUSA_BACKEND_URL`.
- Confirm backend active port from launcher output/health probe.
- Check CORS/env drift after launcher changes.

## Serena MCP Not Responding
- Verify `uvx` exists and MCPO process started.
- Check local OpenAPI endpoint (`/openapi.json`) readiness.
- Confirm bearer token used by client matches server startup `--api-key`.
- Inspect logs for startup errors before retry loops.
