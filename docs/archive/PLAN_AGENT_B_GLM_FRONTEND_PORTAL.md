# TheRxSpot Marketplace - AGENT B PLAN (GLM 4.7)
## Frontend, Storefront & Tenant Portal
**Parallel Execution Track - Zero Conflict with Agent A (Claude)**

---

## SCOPE BOUNDARY (CRITICAL - DO NOT CROSS)

**AGENT B OWNS:**
- `D:\GitHub\TheRxSpot_Marketplace\TheRxSpot_Marketplace-storefront\src\` (entire storefront)
- `D:\GitHub\TheRxSpot_Marketplace\tenant-admin\src\` (entire tenant admin)
- `D:\GitHub\TheRxSpot_Marketplace\TheRxSpot_Marketplace-storefront\.env.local`
- `D:\GitHub\TheRxSpot_Marketplace\tenant-admin\.env.local`
- Frontend package.json files

**AGENT B DOES NOT TOUCH:**
- `D:\GitHub\TheRxSpot_Marketplace\src\` (Medusa backend)
- Any backend API routes
- Database models or migrations
- Backend configuration files

**CROSS-BOUNDARY COMMUNICATION:**
- If you need new backend endpoints, create requests in `.agent-b-requests/`
- Agent A will implement backend changes

---

## EXECUTIVE SUMMARY

**Mission:** Transform the frontend into a production-ready, multi-tenant telehealth marketplace with consolidated routing, complete tenant admin functionality, and full consult-to-purchase flow.

**Success Criteria:**
- [ ] Storefront routes consolidated to single hostname-based approach
- [ ] Build passes with ESLint and TypeScript strict mode enabled
- [ ] Tenant admin order detail page fully functional
- [ ] Consult status visible to patients
- [ ] Earnings dashboard visible to business owners
- [ ] All frontend tests pass
- [ ] No console errors in production build

**Estimated Duration:** 3-4 days of intensive development

---

## PHASE B1: STOREFOUNDATION & ROUTE CONSOLIDATION (Day 1)

### B1.1 CRITICAL: Fix Route Conflicts
**Priority:** P0 - BLOCKS ALL OTHER WORK
**Current Problem:**
```
CONFLICTING ROUTES:
Route A: app/[businessSlug]/
Route B: app/business/[businessSlug]/
Route C: app/[countryCode]/(tenant)/
```

**Solution:** Consolidate to hostname-based approach only

**Files to Modify:**

1. **DELETE (after backup):**
   - `src/app/[businessSlug]/page.tsx`
   - `src/app/[businessSlug]/products/page.tsx`
   - `src/app/[businessSlug]/products/[productId]/page.tsx`
   - `src/app/business/[businessSlug]/layout.tsx`

2. **MODIFY:**
   - `src/middleware.ts` - Clean up tenant resolution
   - `src/app/[countryCode]/(tenant)/layout.tsx` - Make robust
   - `src/app/[countryCode]/(tenant)/page.tsx` - Business homepage
   - `src/app/[countryCode]/(tenant)/products/page.tsx` - Product listing
   - `src/app/[countryCode]/(tenant)/products/[handle]/page.tsx` - Product detail

**Implementation Steps:**

```typescript
// src/middleware.ts - CLEANUP
// BEFORE: Complex logic with multiple resolution strategies
// AFTER: Clean hostname-based resolution only

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  
  // Skip static files and API
  if (isStaticFile(pathname)) return NextResponse.next()
  
  // Resolve tenant from hostname
  const hostname = request.headers.get('host') || ''
  const tenantConfig = await resolveTenantFromHostname(hostname)
  
  // Store in cookie for SSR
  const response = NextResponse.next()
  if (tenantConfig) {
    response.cookies.set('_tenant_config', JSON.stringify(tenantConfig), {
      maxAge: 300, // 5 minutes
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    })
  }
  
  // Add country code if missing
  if (!hasCountryCode(pathname)) {
    const countryCode = await getCountryCode(request)
    const url = request.nextUrl.clone()
    url.pathname = `/${countryCode}${pathname}`
    return NextResponse.redirect(url)
  }
  
  return response
}
```

**Checkpoint B1.1:**
- [ ] Deleted conflicting routes
- [ ] Middleware cleaned up
- [ ] All tenant pages under `/(tenant)/` work correctly
- [ ] No 404 errors for valid tenant routes

---

### B1.2 Enable Build-Time Type Safety
**Priority:** P0
**Files:**
- `next.config.js` (MODIFY)
- `package.json` (MODIFY - add type-check script)

**Changes:**
```javascript
// next.config.js
module.exports = {
  reactStrictMode: true,
  eslint: { 
    ignoreDuringBuilds: false  // CHANGED: true -> false
  },
  typescript: { 
    ignoreBuildErrors: false    // CHANGED: true -> false
  },
  // ... rest of config
}
```

**Fix TypeScript Errors:**
Run these commands and fix ALL errors:
```bash
yarn type-check 2>&1 | head -100
```

Common issues to fix:
- Missing type annotations on function parameters
- `any` types that should be specific
- Missing return type annotations
- Unused imports
- Missing props in component interfaces

**Checkpoint B1.2:**
- [ ] ESLint passes with zero errors
- [ ] TypeScript compilation succeeds
- [ ] Build completes successfully

---

### B1.3 Business Provider & Layout Hardening
**Priority:** P1
**Files:**
- `src/components/business-provider.tsx` (MODIFY)
- `src/app/[countryCode]/(tenant)/layout.tsx` (MODIFY)
- `src/app/[countryCode]/(tenant)/error.tsx` (NEW)
- `src/app/[countryCode]/(tenant)/loading.tsx` (NEW)

**Error Boundary Implementation:**
```typescript
// src/app/[countryCode]/(tenant)/error.tsx
'use client'

export default function TenantErrorBoundary({
  error,
  reset
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-red-600">Something went wrong</h1>
        <p className="mt-2 text-gray-600">We couldn't load this pharmacy's storefront.</p>
        <button 
          onClick={reset}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
```

**Loading State:**
```typescript
// src/app/[countryCode]/(tenant)/loading.tsx
export default function TenantLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  )
}
```

**Checkpoint B1.3:**
- [ ] Error boundary catches and displays errors
- [ ] Loading state shows during data fetch
- [ ] Business provider handles edge cases

---

### B1.4 Tenant-Specific SDK Integration
**Priority:** P1
**Files:**
- `src/lib/data/products.ts` (MODIFY)
- `src/lib/data/cart.ts` (MODIFY)
- `src/lib/config.ts` (already has createTenantSdk)

**Implementation:**
```typescript
// src/lib/data/products.ts
// Use tenant-specific SDK with publishable API key

import { createTenantSdk, sdk } from '@/lib/config'
import { getTenantConfig } from '@/lib/tenant'

export async function getProductsByBusinessSlug(slug: string) {
  const tenantConfig = await getTenantConfig(slug)
  
  // Use tenant SDK for proper sales channel filtering
  const tenantSdk = createTenantSdk(tenantConfig.publishable_api_key)
  
  const { products } = await tenantSdk.store.product.list({
    region_id: tenantConfig.region_id,
    fields: '*variants.calculated_price'
  })
  
  return products
}
```

**Checkpoint B1.4:**
- [ ] Tenant SDK used for product queries
- [ ] Sales channel filtering works correctly
- [ ] Cart operations use tenant context

---

## PHASE B2: CONSULTATION UI & STATUS TRACKING (Day 1-2)

### B2.1 Consult Status Components
**Priority:** P0
**Files:**
- `src/components/consult-status-badge.tsx` (NEW)
- `src/components/consult-status-tracker.tsx` (NEW)
- `src/app/[countryCode]/(tenant)/consultations/page.tsx` (NEW)
- `src/app/[countryCode]/(tenant)/consultations/[id]/page.tsx` (NEW)

**ConsultStatusBadge Component:**
```typescript
// src/components/consult-status-badge.tsx
interface ConsultStatusBadgeProps {
  status: 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'rejected' | 'cancelled'
  outcome?: 'approved' | 'rejected' | 'pending' | null
}

const statusConfig = {
  pending: { color: 'yellow', label: 'Pending Review' },
  scheduled: { color: 'blue', label: 'Scheduled' },
  in_progress: { color: 'purple', label: 'In Progress' },
  completed: { color: 'green', label: 'Completed' },
  rejected: { color: 'red', label: 'Rejected' },
  cancelled: { color: 'gray', label: 'Cancelled' }
}

export function ConsultStatusBadge({ status, outcome }: ConsultStatusBadgeProps) {
  const config = statusConfig[status]
  
  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium bg-${config.color}-100 text-${config.color}-800`}>
      {outcome === 'approved' ? 'Approved' : 
       outcome === 'rejected' ? 'Not Approved' : 
       config.label}
    </span>
  )
}
```

**ConsultStatusTracker Component:**
```typescript
// src/components/consult-status-tracker.tsx
// Visual timeline showing consult progress
// Steps: Submitted -> Under Review -> Approved/Rejected

interface ConsultStatusTrackerProps {
  consultation: {
    status: string
    outcome: string | null
    scheduled_at: string | null
    started_at: string | null
    completed_at: string | null
  }
}

export function ConsultStatusTracker({ consultation }: ConsultStatusTrackerProps) {
  const steps = [
    { id: 'submitted', label: 'Submitted', completed: true },
    { id: 'review', label: 'Under Review', completed: ['scheduled', 'in_progress', 'completed'].includes(consultation.status) },
    { id: 'decision', label: 'Decision', completed: consultation.status === 'completed' }
  ]
  
  return (
    <div className="flex items-center space-x-4">
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-center">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            step.completed ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
          }`}>
            {step.completed ? '✓' : index + 1}
          </div>
          <span className="ml-2 text-sm">{step.label}</span>
          {index < steps.length - 1 && (
            <div className={`w-12 h-0.5 mx-2 ${step.completed ? 'bg-green-500' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  )
}
```

**Checkpoint B2.1:**
- [ ] Status badge component renders correctly
- [ ] Status tracker shows progress
- [ ] Components handle all status variations

---

### B2.2 Patient Consultation Dashboard
**Priority:** P0
**Files:**
- `src/app/[countryCode]/(tenant)/consultations/page.tsx` (NEW)
- `src/app/[countryCode]/(tenant)/consultations/[id]/page.tsx` (NEW)
- `src/lib/data/consultations.ts` (NEW)

**Consultations List Page:**
```typescript
// src/app/[countryCode]/(tenant)/consultations/page.tsx
// Shows all patient's consultations for this business

export default async function ConsultationsPage() {
  const consultations = await getPatientConsultations()
  
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">My Consultations</h1>
      
      {consultations.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          {consultations.map(consult => (
            <ConsultationCard key={consult.id} consultation={consult} />
          ))}
        </div>
      )}
    </div>
  )
}
```

**Consultation Detail Page:**
```typescript
// src/app/[countryCode]/(tenant)/consultations/[id]/page.tsx
// Full consultation details with status history

interface ConsultationDetailPageProps {
  params: { id: string; countryCode: string }
}

export default async function ConsultationDetailPage({ params }: ConsultationDetailPageProps) {
  const consultation = await getConsultation(params.id)
  
  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">Consultation #{consultation.display_id}</h1>
          <p className="text-gray-600">Submitted on {formatDate(consultation.created_at)}</p>
        </div>
        <ConsultStatusBadge status={consultation.status} outcome={consultation.outcome} />
      </div>
      
      <ConsultStatusTracker consultation={consultation} />
      
      {/* Consultation details */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <ConsultationDetails consultation={consultation} />
        <PrescriptionDetails consultation={consultation} />
      </div>
      
      {/* Actions */}
      <ConsultationActions consultation={consultation} />
    </div>
  )
}
```

**Data Layer:**
```typescript
// src/lib/data/consultations.ts
import { sdk } from '@/lib/config'

export async function getPatientConsultations() {
  const { consultations } = await sdk.client.fetch('/store/consultations')
  return consultations
}

export async function getConsultation(id: string) {
  const { consultation } = await sdk.client.fetch(`/store/consultations/${id}`)
  return consultation
}
```

**Checkpoint B2.2:**
- [ ] Consultations list page works
- [ ] Consultation detail page shows all info
- [ ] Data layer fetches from correct endpoints

---

### B2.3 Account Section Consult Integration
**Priority:** P1
**Files:**
- `src/app/[countryCode]/(main)/account/@dashboard/page.tsx` (MODIFY)
- `src/app/[countryCode]/(main)/account/@dashboard/consultations/page.tsx` (NEW)

**Account Dashboard Update:**
```typescript
// Add consultation section to account dashboard
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
  <RecentOrders />
  <RecentConsultations />  // NEW
</div>
```

**Checkpoint B2.3:**
- [ ] Account dashboard shows recent consultations
- [ ] Link to full consultations page works
- [ ] Navigation between sections clear

---

## PHASE B3: TENANT ADMIN ORDER MANAGEMENT (Day 2-3)

### B3.1 Order Detail Page Implementation
**Priority:** P0
**Current State:** Route exists but is EMPTY
**Files:**
- `tenant-admin/src/app/dashboard/orders/[id]/page.tsx` (CREATE - currently empty)
- `tenant-admin/src/lib/api.ts` (MODIFY - add order detail functions)

**Order Detail Page:**
```typescript
// tenant-admin/src/app/dashboard/orders/[id]/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { getOrder, updateOrderStatus } from '@/lib/api'

export default function OrderDetailPage() {
  const { id } = useParams()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    loadOrder()
  }, [id])
  
  async function loadOrder() {
    const data = await getOrder(id as string)
    setOrder(data)
    setLoading(false)
  }
  
  if (loading) return <OrderDetailSkeleton />
  if (!order) return <OrderNotFound />
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <OrderHeader order={order} />
      
      {/* Status & Actions */}
      <OrderStatusCard order={order} onStatusChange={loadOrder} />
      
      {/* Order Info Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OrderItemsCard items={order.items} />
        <CustomerInfoCard customer={order.customer} />
      </div>
      
      {/* Shipping & Payment */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ShippingInfoCard shipping={order.shipping_address} />
        <PaymentInfoCard payment={order.payments[0]} />
      </div>
      
      {/* Consultation (if applicable) */}
      {order.consultation && (
        <ConsultationCard consultation={order.consultation} />
      )}
      
      {/* Order Timeline */}
      <OrderTimeline events={order.status_events} />
    </div>
  )
}
```

**Order Status Actions:**
```typescript
// Status action buttons based on current status
const statusActions: Record<string, { label: string; action: string; variant: string }[]> = {
  'consult_pending': [
    { label: 'Mark Consult Complete', action: 'consult_complete', variant: 'primary' },
    { label: 'Cancel Order', action: 'cancel', variant: 'danger' }
  ],
  'consult_complete': [
    { label: 'Mark Processing', action: 'processing', variant: 'primary' },
    { label: 'Cancel Order', action: 'cancel', variant: 'danger' }
  ],
  'processing': [
    { label: 'Mark Fulfilled', action: 'fulfilled', variant: 'primary' },
  ],
  'fulfilled': [
    { label: 'Mark Delivered', action: 'delivered', variant: 'primary' },
  ]
}
```

**API Functions:**
```typescript
// tenant-admin/src/lib/api.ts

export async function getOrder(id: string): Promise<Order | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/admin/tenant/orders/${id}`, {
      credentials: 'include'
    })
    return res.ok ? res.json() : null
  } catch {
    return null
  }
}

export async function updateOrderStatus(
  id: string, 
  status: string
): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND_URL}/admin/tenant/orders/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status })
    })
    return res.ok
  } catch {
    return false
  }
}
```

**Checkpoint B3.1:**
- [ ] Order detail page displays all order info
- [ ] Status actions work correctly
- [ ] Page refreshes after status change

---

### B3.2 Order List Improvements
**Priority:** P1
**Files:**
- `tenant-admin/src/app/dashboard/orders/page.tsx` (MODIFY)

**Add to Order List:**
```typescript
// Add these features:
// 1. Pagination
// 2. Status filter
// 3. Date range filter
// 4. Search by order ID or customer email
// 5. Sort by date/status/total

interface OrderFilters {
  status?: string
  startDate?: string
  endDate?: string
  search?: string
  page: number
  limit: number
}
```

**Checkpoint B3.2:**
- [ ] Pagination works
- [ ] Filters applied correctly
- [ ] Search functionality works

---

### B3.3 Tenant Admin Consultations View
**Priority:** P1
**Files:**
- `tenant-admin/src/app/dashboard/consultations/page.tsx` (NEW)
- `tenant-admin/src/app/dashboard/consultations/[id]/page.tsx` (NEW)
- `tenant-admin/src/lib/api.ts` (MODIFY)

**Consultations List:**
```typescript
// tenant-admin/src/app/dashboard/consultations/page.tsx
// Shows all consultations for this business

export default function ConsultationsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Consultations</h1>
      <ConsultationsTable />
    </div>
  )
}
```

**Consultation Detail (Admin View):**
```typescript
// Shows more details than patient view:
// - Full patient information
// - Clinician notes
// - Medical assessment
// - Approval/rejection controls
// - Link to related order
```

**Checkpoint B3.3:**
- [ ] Consultations list shows all business consultations
- [ ] Admin can view full consultation details
- [ ] Can update consultation status

---

## PHASE B4: EARNINGS DASHBOARD (Day 3)

### B4.1 Earnings Overview Components
**Priority:** P0
**Files:**
- `tenant-admin/src/app/dashboard/earnings/page.tsx` (NEW)
- `tenant-admin/src/components/earnings-summary-card.tsx` (NEW)
- `tenant-admin/src/components/earnings-chart.tsx` (NEW)
- `tenant-admin/src/lib/api.ts` (MODIFY)

**Earnings Page:**
```typescript
// tenant-admin/src/app/dashboard/earnings/page.tsx
export default function EarningsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Earnings & Payouts</h1>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <EarningsSummaryCard 
          title="Available for Payout" 
          amount={stats.available} 
          variant="primary"
        />
        <EarningsSummaryCard 
          title="Pending" 
          amount={stats.pending} 
          variant="secondary"
        />
        <EarningsSummaryCard 
          title="Lifetime Earnings" 
          amount={stats.lifetime} 
          variant="default"
        />
        <EarningsSummaryCard 
          title="YTD Payouts" 
          amount={stats.ytd_payouts} 
          variant="default"
        />
      </div>
      
      {/* Earnings Chart */}
      <EarningsChart data={chartData} />
      
      {/* Payout Request */}
      <PayoutRequestCard availableAmount={stats.available} />
      
      {/* Recent Earnings */}
      <RecentEarningsTable earnings={recentEarnings} />
      
      {/* Payout History */}
      <PayoutHistoryTable payouts={payouts} />
    </div>
  )
}
```

**API Functions:**
```typescript
// tenant-admin/src/lib/api.ts

export async function getEarningsSummary(): Promise<EarningsSummary | null> {
  const res = await fetch(`${BACKEND_URL}/admin/tenant/earnings/summary`, {
    credentials: 'include'
  })
  return res.ok ? res.json() : null
}

export async function getEarnings(params?: { 
  page?: number; 
  limit?: number;
  status?: string 
}): Promise<EarningsResponse | null> {
  const query = new URLSearchParams(params as Record<string, string>)
  const res = await fetch(`${BACKEND_URL}/admin/tenant/earnings?${query}`, {
    credentials: 'include'
  })
  return res.ok ? res.json() : null
}

export async function requestPayout(amount: number): Promise<boolean> {
  const res = await fetch(`${BACKEND_URL}/admin/tenant/payouts/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ amount })
  })
  return res.ok
}
```

**Checkpoint B4.1:**
- [ ] Earnings summary displays correctly
- [ ] Chart shows earnings over time
- [ ] Payout request button works

---

### B4.2 Earnings Detail View
**Priority:** P1
**Files:**
- `tenant-admin/src/components/earnings-table.tsx` (NEW)
- `tenant-admin/src/components/payout-history-table.tsx` (NEW)

**Earnings Table:**
```typescript
// Shows each earning entry:
// - Date
// - Type (product_sale, consultation_fee, etc.)
// - Order/Consultation reference
// - Gross amount
// - Fees breakdown
// - Net amount
// - Status
// - Available date
```

**Checkpoint B4.2:**
- [ ] Earnings table shows all entries
- [ ] Fees breakdown visible
- [ ] Payout history accurate

---

## PHASE B5: POLISH & INTEGRATION (Day 3-4)

### B5.1 Navigation & Routing Updates
**Priority:** P1
**Files:**
- `tenant-admin/src/components/sidebar.tsx` (MODIFY)

**Add to Sidebar:**
```typescript
// Add new navigation items:
// - Consultations
// - Earnings
// - Documents (placeholder)

const navigation = [
  { name: 'Overview', href: '/dashboard', icon: HomeIcon },
  { name: 'Orders', href: '/dashboard/orders', icon: ShoppingBagIcon },
  { name: 'Consultations', href: '/dashboard/consultations', icon: ChatBubbleLeftIcon },
  { name: 'Earnings', href: '/dashboard/earnings', icon: CurrencyDollarIcon },
  { name: 'Branding', href: '/dashboard/branding', icon: PaintBrushIcon },
  { name: 'Users', href: '/dashboard/users', icon: UsersIcon },
  { name: 'Settings', href: '/dashboard/settings', icon: CogIcon },
]
```

**Checkpoint B5.1:**
- [ ] All navigation links work
- [ ] Active state highlighted correctly
- [ ] Icons appropriate for each section

---

### B5.2 Error Handling & Toast Notifications
**Priority:** P1
**Files:**
- `tenant-admin/src/components/toast-provider.tsx` (NEW)
- `tenant-admin/src/app/layout.tsx` (MODIFY)
- `tenant-admin/src/hooks/use-toast.ts` (NEW)

**Toast System:**
```typescript
// Simple toast notification system for:
// - Success messages
// - Error messages
// - Loading states

export function useToast() {
  return {
    success: (message: string) => { /* ... */ },
    error: (message: string) => { /* ... */ },
    loading: (message: string) => { /* ... */ }
  }
}
```

**Checkpoint B5.2:**
- [ ] Toast notifications appear on actions
- [ ] Errors displayed to user
- [ ] Success confirmations shown

---

### B5.3 Build & Type Checking
**Priority:** P0
**Files:**
- `tenant-admin/package.json` (MODIFY)
- `tenant-admin/next.config.js` (MODIFY)

**Enable Strict Mode:**
```javascript
// tenant-admin/next.config.js
module.exports = {
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false }
}
```

**Scripts:**
```json
{
  "scripts": {
    "type-check": "tsc --noEmit",
    "lint": "eslint src --ext .ts,.tsx",
    "build:prod": "npm run type-check && npm run lint && next build"
  }
}
```

**Checkpoint B5.3:**
- [ ] TypeScript strict mode enabled
- [ ] ESLint passes
- [ ] Production build succeeds

---

## PHASE B6: TESTING & VERIFICATION (Day 4)

### B6.1 Frontend Testing
**Priority:** P0
**Files:**
- `src/tests/e2e/consult-flow.spec.ts` (NEW)
- `src/tests/e2e/tenant-resolution.spec.ts` (NEW)
- `tenant-admin/src/tests/orders.spec.ts` (NEW)

**Critical Test Cases:**

**Consult Flow E2E:**
```typescript
describe('Consultation to Purchase Flow', () => {
  it('should complete full consult-to-purchase journey', async () => {
    // 1. Visit tenant storefront
    await page.goto('http://localhost:8000/us')
    
    // 2. Navigate to product requiring consult
    await page.click('[data-testid="product-consult-required"]')
    
    // 3. Verify consult gate blocks add to cart
    await expect(page.locator('[data-testid="consult-required-banner"]')).toBeVisible()
    
    // 4. Start consultation
    await page.click('[data-testid="start-consultation"]')
    await fillConsultForm()
    await page.click('[data-testid="submit-consultation"]')
    
    // 5. Verify consultation created
    await expect(page.locator('[data-testid="consultation-submitted"]')).toBeVisible()
    
    // 6. Navigate to consultations page
    await page.goto('http://localhost:8000/us/account/consultations')
    await expect(page.locator('[data-testid="consultation-status"]')).toContainText('Pending')
  })
})
```

**Tenant Resolution E2E:**
```typescript
describe('Multi-tenant Resolution', () => {
  it('should resolve correct tenant by hostname', async () => {
    await page.goto('http://healthfirst.local:8000/us')
    await expect(page.locator('[data-testid="business-name"]')).toContainText('HealthFirst')
    
    await page.goto('http://meddirect.local:8000/us')
    await expect(page.locator('[data-testid="business-name"]')).toContainText('MedDirect')
  })
})
```

**Checkpoint B6.1:**
- [ ] E2E tests pass
- [ ] Consult flow test passes
- [ ] Tenant resolution test passes

---

### B6.2 Cross-Browser Testing
**Priority:** P1

Test in:
- [ ] Chrome/Edge
- [ ] Firefox
- [ ] Safari (if available)
- [ ] Mobile responsive (Chrome DevTools)

**Checkpoint B6.2:**
- [ ] All browsers render correctly
- [ ] Mobile layout works
- [ ] No console errors

---

## REQUESTS TO AGENT A

If you need backend changes, create files in `.agent-b-requests/`:

### Example Request File:
```markdown
# Request from Agent B
**Priority:** P0/P1/P2
**Date:** 2026-02-03

## Request: Add Consultation Endpoints for Tenant Admin

**Endpoint Needed:** `GET /admin/tenant/consultations`
**Purpose:** List consultations for tenant admin dashboard

**Expected Response:**
```json
{
  "consultations": [
    {
      "id": "consult_123",
      "patient_email": "patient@example.com",
      "status": "completed",
      "outcome": "approved",
      "scheduled_at": "2026-02-03T10:00:00Z",
      "completed_at": "2026-02-03T10:30:00Z",
      "clinician_name": "Dr. Smith"
    }
  ],
  "count": 50,
  "offset": 0,
  "limit": 20
}
```

**Query Parameters:**
- `status` - Filter by status
- `offset` - Pagination offset
- `limit` - Page size (default 20)
```

Save as: `.agent-b-requests/001-consultation-endpoints.md`

---

## DAILY CHECKPOINT SCHEDULE

### End of Day 1
- [ ] Route conflicts resolved
- [ ] ESLint and TypeScript pass
- [ ] Consult status components created
- [ ] Consultation list page works

### End of Day 2
- [ ] Consultation detail page complete
- [ ] Account section shows consultations
- [ ] Order detail page functional
- [ ] Status actions work

### End of Day 3
- [ ] Order list has pagination/filters
- [ ] Tenant admin consultations view works
- [ ] Earnings dashboard displays
- [ ] Payout request functional

### End of Day 4
- [ ] All navigation links work
- [ ] Toast notifications added
- [ ] Production build succeeds
- [ ] E2E tests pass
- [ ] Cross-browser tested

---

## VERIFICATION COMMANDS

Run these at the end of each day:

```bash
# Storefront
cd D:\GitHub\TheRxSpot_Marketplace\TheRxSpot_Marketplace-storefront
yarn type-check
yarn lint
yarn build

# Tenant Admin
cd D:\GitHub\TheRxSpot_Marketplace\tenant-admin
npm run type-check
npm run lint
npm run build

# Test build output
# No TypeScript errors
# No ESLint errors
# Build completes with exit code 0
```

---

## FINAL DELIVERABLE CHECKLIST

Before declaring "DONE":

### Storefront
- [ ] Single consolidated route structure (hostname-based)
- [ ] Build passes ESLint + TypeScript strict
- [ ] Consult status visible to patients
- [ ] Consultations list page works
- [ ] Consultation detail page works
- [ ] Account section integrated
- [ ] No console errors in production

### Tenant Admin
- [ ] Order detail page fully functional
- [ ] Order status actions work
- [ ] Order list has pagination/filters
- [ ] Consultations view complete
- [ ] Earnings dashboard displays data
- [ ] Payout request button works
- [ ] Navigation updated
- [ ] Toast notifications work
- [ ] Build passes all checks

### Integration
- [ ] Frontend connects to backend correctly
- [ ] All API requests succeed
- [ ] Error handling works
- [ ] E2E tests pass

---

**AGENT B - FRONTEND & TENANT PORTAL**
**Status:** READY TO EXECUTE
**Last Updated:** 2026-02-03
**Next Sync Point:** End of Day 1 with Agent A
