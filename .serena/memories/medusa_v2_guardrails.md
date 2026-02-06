# Medusa v2 Guardrails (Critical)

Source of truth: `MEDUSA_V2_CONTEXT.md`

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
- Verify `DATABASE_URL` + migrations when startup or data behavior is suspicious.

## Backend Edit Checklist
1. Confirm route placement and handler export shape.
2. Keep module boundaries clean.
3. Add/adjust workflow if write logic crosses domain boundaries.
4. Run lint/typecheck/tests relevant to changed behavior.
