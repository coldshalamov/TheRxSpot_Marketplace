# CI/CD Quality Gate Gaps (Epic D3)
> Phase 0 audit of .github/workflows/ci-cd.yml

## Current Pipeline Structure
```
test -> security-scan -> build -> deploy-staging / deploy-production
```

## Existing Gates (Working)
- [x] Unit tests (npm run test:unit)
- [x] Integration tests - HTTP (npm run test:integration:http)
- [x] Integration tests - Custom (npm run test:integration:custom)
- [x] Trivy filesystem security scan (CRITICAL/HIGH)
- [x] Trivy dependency vulnerability scan (exit-code: 1 = fails on issues)
- [x] Backend build (npm run build)
- [x] Storefront build (npm -C storefront run build)
- [x] Docker image build + push to GHCR
- [x] Test coverage artifact upload

## Missing Gates (Must Add)

### Backend
- [ ] **TypeScript type-check**: `tsc --noEmit` not run separately from build
- [ ] **ESLint**: No lint configuration or lint step found
- [ ] **Module integration tests**: `npm run test:integration:modules` not in CI

### Storefront
- [ ] **TypeScript type-check**: No `tsc --noEmit` for storefront
- [ ] **ESLint/lint**: No storefront lint step
- [ ] **Storefront tests**: No test step for `TheRxSpot_Marketplace-storefront/`
- [ ] **E2E smoke tests**: No browser/E2E test step

### Post-Deploy Verification
- [ ] **Health check**: Deploy verification steps are stubs (`echo` only)
- [ ] **Ready endpoint check**: No `/ready` endpoint verification after deploy
- [ ] **Admin shell check**: No admin UI loading verification
- [ ] **Storefront shell check**: No storefront rendering verification
- [ ] **Protected route smoke**: No API smoke tests post-deploy

### Release Governance
- [ ] **Release blocker policy**: No mechanism to block releases on failed gates
- [ ] **Changelog generation**: No automated changelog
- [ ] **Deprecated action**: `actions/create-release@v1` is deprecated
- [ ] **Branch protection rules**: Not verified (GitHub settings, not in yml)

### Environment Smoke Gates
- [ ] Health endpoint responds 200
- [ ] Ready endpoint responds 200
- [ ] Admin shell loads (returns HTML with expected markers)
- [ ] Storefront shell loads for default tenant
- [ ] Auth endpoint responds to OPTIONS (CORS check)
- [ ] At least one protected admin route requires auth (returns 401 without token)

## Priority Implementation Order
1. Add `tsc --noEmit` for backend and storefront (quick win, catches type errors)
2. Add ESLint configuration + lint step for backend
3. Add post-deploy health/ready verification (replace echo stubs)
4. Add storefront lint + type-check
5. Add environment smoke gate job
6. Add e2e smoke suite (can use the existing `scripts/smoke/verify-local.ps1` as reference)
7. Update deprecated actions
