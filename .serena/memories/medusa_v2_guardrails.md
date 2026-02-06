# Medusa v2 Guardrails (Critical)

Source of truth: `MEDUSA_V2_CONTEXT.md`
Companion guidance: `docs/AGENT_GROUNDING_PROTOCOL.md` and `medusadocs/`

## Mandatory Patterns
- Use `src/modules` + `src/workflows` for business logic.
- Use file-based API handlers in `src/api/**/route.ts` (`export const GET/POST/...`).
- Use Query/workflows for cross-module reads/writes.

## Anti-Patterns to Avoid
- No new legacy monolithic `src/services` patterns.
- No Express `router.use` route registration for new API flow.
- Do not assume v1 service injection conventions.

## Stability Dependencies
- Redis is required for Medusa v2 event bus startup.
- If server hangs, check Redis/container state first.
- **CRITICAL: Port 9000 is reserved for the USER's IDE. Avoid port 9000 for all service bindings.**
- Verify `DATABASE_URL` + migrations when startup or data behavior is suspicious.

## Backend Edit Checklist
1. Confirm route placement and handler export shape.
2. Keep module boundaries clean.
3. Add/adjust workflow if write logic crosses domain boundaries.
4. Run lint/typecheck/tests relevant to changed behavior.
5. If docs are insufficient, run targeted `llms-full.txt` queries before introducing unfamiliar patterns.
