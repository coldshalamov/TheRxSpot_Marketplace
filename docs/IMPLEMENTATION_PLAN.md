# Implementation Plan - TheRxSpot Marketplace

**Goal:** Build white-label telehealth platform to replace partner service

**Timeline:** 6-8 weeks to production MVP

---

## Phase 1: Backend API (Week 1-2) ✅ COMPLETE

### Status: All APIs Implemented

- [x] Multi-tenant business management
- [x] User/client management
- [x] Consultation tracking
- [x] Order management with consult-gating
- [x] Earnings & payout system
- [x] Document upload with virus scanning
- [x] Audit logging for compliance
- [x] Rate limiting with Redis
- [x] Custom domain support

**Files Created:** 156 TypeScript files in `src/`

---

## Phase 2: Admin Dashboard (Week 3-4) 🟡 IN PROGRESS

### What Exists
- ✅ Backend admin routes in `src/admin/routes/`
- ✅ Business management page
- ✅ Orders global view

### What's Needed

#### Priority 1: Core Pages
Build these Medusa Admin pages:

1. **Dashboard Home** (`src/admin/routes/home/`)
   - Snapshot cards: today's consultations, pending reviews, orders
   - Quick links to key sections
   - Earnings summary widget

2. **Users Page** (`src/admin/routes/users/`)
   - Client list with search
   - Filters: status, role, date range
   - User detail view with order history

3. **Consultations Page** (`src/admin/routes/consultations/`)
   - Consultation list with search
   - Filters: status, mode, business, date
   - Detail view with patient data, eligibility, documents
   - Actions: assign clinician, update status

4. **Orders Page** (expand `src/admin/routes/orders-global/`)
   - Order list with advanced search
   - Filters: status, product, location, date
   - Order detail with items, fulfillment, consult status

5. **Earnings Page** (`src/admin/routes/earnings/`)
   - Commission summary
   - Pending payouts
   - Balance tracking
   - Payout history

6. **Coupons Page** (`src/admin/routes/coupons/`)
   - Create/edit coupons
   - Fixed amount discounts
   - Active/inactive toggle
   - Usage tracking

#### Priority 2: Business Management
7. **Business Detail** (expand `src/admin/routes/businesses/[id]/`)
   - General settings (name, phone, tagline, description)
   - Brand customization (logo, colors)
   - Platform service fees
   - Custom tracking scripts
   - Location management

8. **Location Management**
   - CRUD locations per business
   - Serviceable states multi-select
   - Address configuration
   - Product enablement per location

#### Priority 3: Products
9. **Product Management**
   - Use Medusa's built-in product admin
   - Add custom fields: requires_consult, consult_fee
   - Category management
   - Sales channel assignment

**Estimated Effort:** 40-60 hours

---

## Phase 3: Storefront (Week 5-6) 🟡 NEEDS CUSTOMIZATION

### Current State
- ✅ `TheRxSpot_Marketplace-storefront/` - Medusa Next.js template exists
- ✅ Basic pages: home, products, cart, checkout

### Required Customization

#### Step 1: Tenant Resolution
**File:** `src/middleware.ts`
```typescript
// Resolve tenant by domain or path
// Set tenant context for all API calls
// Load tenant branding configuration
```

#### Step 2: Multi-Tenant Branding
**Component:** `src/components/Layout.tsx`
- Dynamic logo from tenant config
- Custom colors from tenant settings
- Tagline/description injection
- Custom tracking scripts in <head>

#### Step 3: Product Catalog
**Pages:** `src/app/[business]/[location]/`
- Product listing filtered by tenant
- Category pages
- Product detail with dosage selection
- Consult-required indicator

#### Step 4: Consult-Gating
**Component:** `src/components/ConsultGate.tsx`
- Check if product requires consultation
- Show eligibility form or schedule link
- Block cart addition until consult approved
- Display consult fee + medication fee breakdown

#### Step 5: Cart & Checkout
**Pages:** `src/app/cart` and `src/app/checkout`
- Show consult fee as separate line item
- Calculate total: consult fee + medication fee
- Stripe payment integration
- Order confirmation

#### Step 6: Customer Portal
**Pages:** `src/app/account`
- Order history
- Consultation history
- Document downloads
- Profile management

**Estimated Effort:** 60-80 hours

---

## Phase 4: Payment Integration (Week 6) ⏳ PENDING

### Stripe Setup
1. Create Stripe Connect accounts for platform
2. Configure payment intents for orders
3. Handle consult fee + medication fee split
4. Set up webhooks for payment status

### Implementation
**File:** `src/modules/payment/stripe-service.ts`
- Create payment intent
- Capture payment on order confirmation
- Handle refunds
- Record transaction in earnings

**API Route:** `src/api/store/checkout/complete/route.ts`
- Validate cart
- Create payment intent
- Create order
- Trigger fulfillment workflow

**Estimated Effort:** 20-30 hours

---

## Phase 5: Custom Domain Setup (Week 7) ⏳ PENDING

### DNS Automation
1. Verify domain ownership (TXT record)
2. Configure CNAME for `patients.{domain}`
3. Provision SSL certificates (Let's Encrypt)
4. Update routing to serve tenant by domain

### Implementation
**Job:** `src/jobs/domain-verification.ts` (exists, needs testing)
- Poll pending domain verifications
- Check TXT record
- Update business.domain_verified status

**Middleware:** `src/api/middlewares/tenant-resolution.ts` (exists)
- Resolve business by hostname
- Load tenant branding
- Set publishable API key

**Admin UI:** Add domain verification instructions page

**Estimated Effort:** 30-40 hours

---

## Phase 6: Testing & QA (Week 7-8) 🟡 PARTIAL

### Current Tests
- ✅ 7 integration tests for backend

### Additional Testing Needed
1. **E2E Tests** (Playwright)
   - Customer journey: browse → consult → cart → checkout → order
   - Admin workflows: create business → manage products → process order

2. **Manual Testing Checklist**
   - Multi-tenant isolation (can't access other tenant's data)
   - Consult-gating works correctly
   - Earnings calculations accurate
   - Payment processing end-to-end
   - Custom domain routing

3. **Load Testing**
   - 100 concurrent users on storefront
   - Admin dashboard under typical load
   - Database query performance

**Estimated Effort:** 30-40 hours

---

## Phase 7: Deployment (Week 8) ⏳ PENDING

### Infrastructure Setup
1. **Database**
   - PostgreSQL on AWS RDS or similar
   - Automated backups
   - Replica for read scaling

2. **Redis**
   - AWS ElastiCache or managed Redis
   - Rate limiting and session storage

3. **Storage**
   - AWS S3 for documents
   - Encryption at rest
   - Presigned URLs for downloads

4. **Application**
   - Docker containers for backend
   - Next.js deployed to Vercel or AWS
   - Environment variables management

5. **Monitoring**
   - CloudWatch or Datadog
   - Error tracking (Sentry)
   - Uptime monitoring

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment guide.

**Estimated Effort:** 40-50 hours

---

## Summary Timeline

| Phase | Duration | Status | Effort |
|-------|----------|--------|--------|
| 1. Backend API | Week 1-2 | ✅ Complete | Done |
| 2. Admin Dashboard | Week 3-4 | 🟡 In Progress | 40-60h |
| 3. Storefront | Week 5-6 | ⏳ Pending | 60-80h |
| 4. Payment Integration | Week 6 | ⏳ Pending | 20-30h |
| 5. Custom Domains | Week 7 | ⏳ Pending | 30-40h |
| 6. Testing & QA | Week 7-8 | 🟡 Partial | 30-40h |
| 7. Deployment | Week 8 | ⏳ Pending | 40-50h |

**Total Remaining:** ~220-290 hours (5-7 weeks at 40h/week)

---

## Next Actions

### Immediate (This Week)
1. Build admin dashboard pages (Priority 1 list above)
2. Test backend APIs with Postman
3. Set up local development database

### Short-term (Next 2 Weeks)
1. Customize storefront template
2. Implement tenant resolution
3. Build consult-gating flow

### Medium-term (Weeks 4-6)
1. Stripe payment integration
2. Custom domain automation
3. E2E testing

### Before Production
1. Security audit
2. Load testing
3. Documentation review
4. Deployment rehearsal

---

## Success Criteria

### MVP Launch Checklist
- [ ] Admin can create new tenant businesses
- [ ] Tenant gets custom domain (e.g., patients.therxspot.com)
- [ ] Customers can browse products on tenant site
- [ ] Consult-gating blocks cart for consult-required products
- [ ] Customers can complete checkout with Stripe
- [ ] Orders appear in admin dashboard
- [ ] Earnings are tracked correctly
- [ ] Payouts can be requested
- [ ] All security features active (rate limiting, audit logs, encryption)

### Production Ready Checklist
- [ ] All MVP criteria met
- [ ] E2E tests passing
- [ ] Load tested to 100+ concurrent users
- [ ] Deployed to production infrastructure
- [ ] Monitoring and alerts configured
- [ ] Backup and disaster recovery tested
- [ ] Security audit completed
- [ ] Documentation complete

---

## Risk Mitigation

### Technical Risks
1. **Custom domain DNS** - Complex automation, fallback to manual setup
2. **Payment processing** - Use Stripe sandbox extensively before production
3. **Multi-tenant isolation** - Thorough testing of data scoping

### Business Risks
1. **Partner transition** - Gradual migration, run both systems in parallel
2. **Feature parity** - Document any features partner has that we don't

### Mitigation Strategy
- Build MVP first, iterate with real users
- Keep partner as fallback for 30 days
- Aggressive testing in staging environment
