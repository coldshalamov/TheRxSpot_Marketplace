# Admin Parity Checklist (Epic C1)
> Phase 0 freeze - route contract inventory

## Legend
- [x] Exists and functional
- [ ] Missing or incomplete
- [~] Exists but needs hardening

## Business Management
- [x] GET /admin/businesses - list
- [x] POST /admin/businesses - create + provision
- [x] GET /admin/businesses/:id - detail
- [x] PUT /admin/businesses/:id - update
- [x] POST /admin/businesses/:id/status - status change
- [x] POST /admin/businesses/:id/provision - re-provision
- [x] POST /admin/businesses/:id/restore - soft-delete restore
- [x] GET /admin/businesses/:id/qr-code - QR generation

## Location Management
- [x] GET /admin/businesses/:id/locations - list
- [x] POST /admin/businesses/:id/locations - create
- [x] GET /admin/businesses/:id/locations/:locationId - detail
- [x] PUT /admin/businesses/:id/locations/:locationId - update
- [x] POST /admin/businesses/:id/locations/:locationId/restore - restore
- [ ] Location serviceable states management (which states a location serves)
- [~] Location-product ordering (exists at /admin/locations/:locationId/products)

## Domain Management
- [x] GET /admin/businesses/:id/domains - list
- [x] POST /admin/businesses/:id/domains - create
- [x] GET /admin/businesses/:id/domains/:domainId - detail
- [x] PUT /admin/businesses/:id/domains/:domainId - update
- [x] POST /admin/businesses/:id/domains/:domainId/restore - restore
- [ ] Domain verification UX flow (job exists, no admin action endpoints)

## Coupon Management
- [ ] GET /admin/coupons - list
- [ ] POST /admin/coupons - create
- [ ] GET /admin/coupons/:id - detail
- [ ] PUT /admin/coupons/:id - update
- [ ] DELETE /admin/coupons/:id - delete
- [ ] Tenant-scoped coupon management

## Consultation Management
- [x] GET /admin/consultations - list with filters
- [x] GET /admin/consultations/:id - detail
- [x] PUT /admin/consultations/:id - update
- [x] POST /admin/consultations/:id/status - status transition
- [x] POST /admin/consultations/:id/assign - assign clinician
- [x] POST /admin/consultations/:id/complete - complete
- [x] POST /admin/consultations/:id/restore - restore
- [x] GET /admin/consultations/:id/documents - related documents
- [ ] Consultation -> order generation on approval

## Consult Submissions (Intake)
- [x] GET /admin/consult-submissions - list
- [x] GET /admin/consult-submissions/:id - detail

## Order Management
- [x] GET /admin/custom/orders - list
- [x] GET /admin/custom/orders/:id - detail
- [x] GET /admin/custom/orders/items - items view
- [x] POST /admin/custom/orders/:id/fulfillment - create fulfillment
- [x] POST /admin/custom/orders/bulk/fulfillment - bulk fulfill
- [x] POST /admin/custom/orders/:id/refund - refund (needs Stripe)
- [x] GET /admin/custom/orders/export - CSV export
- [x] GET /admin/custom/orders/packing-slips/export - packing slips
- [x] POST /admin/orders/:id/status - status transition

## Navigation/Route Integrity
- [ ] All admin dashboard sidebar links verified against existing routes
- [ ] No dead links to non-existent routes
- [ ] Consistent breadcrumb/back navigation

## Consultation Status Events
- [x] GET /admin/consultation-status-events - event history

## Category Management
- [x] GET /admin/categories - list
- [x] POST /admin/categories - create
- [x] GET /admin/categories/:id - detail
- [x] PUT /admin/categories/:id - update
- [x] POST /admin/categories/reorder - reorder

## User Management (Custom)
- [x] GET /admin/custom/users - list
- [x] GET /admin/custom/users/:id - detail
- [x] PUT /admin/custom/users/:id - update
- [x] POST /admin/custom/users/:id/status - status change
- [x] POST /admin/custom/users/bulk/status - bulk status
- [x] GET /admin/custom/users/export - export

## Dashboard
- [x] GET /admin/dashboard/home - home stats

## Summary
- **Total route groups**: 14
- **Complete**: 10
- **Partial/needs work**: 2 (locations, domains)
- **Missing entirely**: 2 (coupons, consult->order generation)
