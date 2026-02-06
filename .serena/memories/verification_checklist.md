# Verification Checklist

Use this as a minimum evidence gate before claiming fixes.

## General
1. Lint passes for touched scope.
2. Typecheck passes for touched scope.
3. Relevant tests or smoke checks pass.
4. No new critical runtime errors in logs.

## Admin/Login Specific
1. Post-login UI visibly renders actual app content.
2. No critical browser `pageerror`/render crash.
3. Auth endpoints succeed (`/auth/user/emailpass`, `/auth/session`).
4. Same success confirmed on at least two clean runs.

## Integration Specific (Storefront + Backend)
1. Backend health stable on active port.
2. Storefront uses correct backend URL env.
3. No tenant routing regressions in middleware/business context.

## Evidence Discipline
- Do not treat URL change as success evidence.
- Summarize concrete checks performed when reporting completion.
