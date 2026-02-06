# Building Admin UI Customizations

## TL;DR

Medusa V2 Admin UI can be extended in two ways:

1. **Widgets** - React components injected into existing pages (product details, order details, etc.)
2. **UI Routes** - New standalone pages accessible from the admin sidebar

**When to customize:**
- Adding small pieces of functionality to existing workflows (widgets)
- Building custom management interfaces for your modules (UI routes)
- Displaying related data from custom modules on core entity pages

**When NOT to customize (build separate admin instead):**
- Complex multi-step workflows that don't fit Medusa's admin design
- Heavy data visualization dashboards
- Features requiring custom authentication flows
- Mobile-first admin experiences

---

## Setup

### JS SDK Configuration

Create the SDK configuration file for your admin customizations:

**`src/admin/lib/sdk.ts`**
```typescript
import Medusa from "@medusajs/js-sdk"

export const sdk = new Medusa({
  baseUrl: import.meta.env.VITE_BACKEND_URL || "/",
  debug: import.meta.env.DEV,
  auth: {
    type: "session", // or "jwt" for token-based auth
  },
})
```

The SDK provides typed methods for interacting with the Medusa API from your admin components.

### Admin Development Mode

Admin extensions are automatically built when you run:

```bash
npm run dev
```

The admin UI will be available at the path configured in `medusa-config.ts` (default: `/app`).

---

## Widgets

### Adding Widgets to Existing Pages

Widgets are React components that get injected into specific zones on existing Medusa admin pages.

**Basic widget structure:**

**`src/admin/widgets/product-brand.tsx`**
```tsx
import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { sdk } from "../lib/sdk"

const ProductBrandWidget = () => {
  const { data, isLoading } = useQuery({
    queryFn: () => sdk.admin.product.list(),
    queryKey: ["products"],
  })

  return (
    <Container>
      <Heading level="h2">Brand Information</Heading>
      {isLoading ? <span>Loading...</span> : (
        <div>Widget content here</div>
      )}
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.before",
})

export default ProductBrandWidget
```

### Widget Zones

Available injection zones:

| Zone | Location |
|------|----------|
| `product.list.before` | Before product list table |
| `product.list.after` | After product list table |
| `product.details.before` | Before product details |
| `product.details.after` | After product details |
| `product.details.side.before` | Before sidebar on product page |
| `product.details.side.after` | After sidebar on product page |
| `order.list.before` | Before order list |
| `order.list.after` | After order list |
| `order.details.before` | Before order details |
| `order.details.after` | After order details |
| `customer.list.before` | Before customer list |
| `customer.list.after` | After customer list |
| `customer.details.before` | Before customer details |
| `customer.details.after` | After customer details |
| `login.after` | After login form |

> **Note:** Widget zones are limited. You cannot create new zones - only use the predefined ones.

### Widget Props (Data from Page)

Widgets on detail pages receive the entity data as props:

**`src/admin/widgets/product-brand.tsx`**
```tsx
import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { DetailWidgetProps, AdminProduct } from "@medusajs/framework/types"
import { Container, Heading } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"

const ProductBrandWidget = ({ data: product }: DetailWidgetProps<AdminProduct>) => {
  // product contains the product data from the page
  const { data } = useQuery({
    queryFn: () => sdk.admin.product.retrieve(product.id, {
      fields: "+brand.*", // Fetch custom linked data
    }),
    queryKey: [["product", product.id]],
  })

  return (
    <Container>
      <Heading level="h2">Brand</Heading>
      {/* Render brand info using product.id */}
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.before",
})

export default ProductBrandWidget
```

---

## UI Routes

### Creating New Admin Pages

UI routes are complete pages that appear in the admin sidebar navigation.

**Basic route structure:**

**`src/admin/routes/brands/page.tsx`**
```tsx
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Container, Heading } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { sdk } from "../../lib/sdk"

const BrandsPage = () => {
  const { data, isLoading } = useQuery({
    queryFn: () => sdk.client.fetch("/admin/brands"),
    queryKey: ["brands"],
  })

  return (
    <Container>
      <Heading level="h1">Brands</Heading>
      {isLoading ? <span>Loading...</span> : (
        <div>Your content here</div>
      )}
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Brands",
  icon: TagSolid, // Import from @medusajs/icons
})

export default BrandsPage
```

### Navigation Items

Routes with `defineRouteConfig` automatically appear in the admin sidebar.

**Route configuration options:**

```typescript
export const config = defineRouteConfig({
  label: "Businesses",           // Display name in sidebar
  icon: BuildingIcon,            // Icon component from @medusajs/icons
})
```

Icons can be imported from `@medusajs/icons`:
```tsx
import { TagSolid, Building, DocumentText } from "@medusajs/icons"
```

### Route Parameters

Create dynamic routes with path parameters:

**`src/admin/routes/businesses/[id]/page.tsx`**
```tsx
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Container, Heading } from "@medusajs/ui"
import { useParams, useNavigate } from "react-router-dom"
import { useEffect, useState } from "react"

const BusinessDetailPage = () => {
  const { id } = useParams() // Access route parameter
  const navigate = useNavigate()
  const isNew = id === "new"
  
  const [business, setBusiness] = useState<any>(null)
  const [loading, setLoading] = useState(!isNew)

  useEffect(() => {
    if (!isNew) {
      fetchBusiness()
    }
  }, [id])

  const fetchBusiness = async () => {
    const response = await fetch(`/admin/businesses/${id}`, {
      credentials: "include",
    })
    const data = await response.json()
    setBusiness(data.business)
    setLoading(false)
  }

  if (loading) return <Container><p>Loading...</p></Container>

  return (
    <Container>
      <Heading level="h1">
        {isNew ? "New Business" : business.name}
      </Heading>
      {/* Form fields */}
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Business Detail",
})

export default BusinessDetailPage
```

---

## Patterns

### Pattern: Data Table with Pagination

**Real example from this codebase** (`src/admin/routes/consultations/page.tsx`):

```tsx
import { Container, Heading, Table, Button } from "@medusajs/ui"
import { useState, useMemo } from "react"

const LIMIT = 25

const DataTablePage = () => {
  const [rows, setRows] = useState<any[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)

  const offset = page * LIMIT
  const totalPages = Math.max(1, Math.ceil(count / LIMIT))

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    params.set("limit", String(LIMIT))
    params.set("offset", String(offset))
    return params.toString()
  }, [offset])

  const fetchData = async () => {
    setLoading(true)
    const res = await fetch(`/admin/items?${queryString}`, {
      credentials: "include",
    })
    const json = await res.json()
    setRows(json.items || [])
    setCount(json.count || 0)
    setLoading(false)
  }

  return (
    <Container>
      <Heading level="h1">Items</Heading>
      
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Name</Table.HeaderCell>
            <Table.HeaderCell>Status</Table.HeaderCell>
            <Table.HeaderCell>Actions</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {loading ? (
            <Table.Row>
              <Table.Cell colSpan={3}>Loading...</Table.Cell>
            </Table.Row>
          ) : rows.length === 0 ? (
            <Table.Row>
              <Table.Cell colSpan={3}>No items found</Table.Cell>
            </Table.Row>
          ) : (
            rows.map((row) => (
              <Table.Row key={row.id}>
                <Table.Cell>{row.name}</Table.Cell>
                <Table.Cell>{row.status}</Table.Cell>
                <Table.Cell>
                  <Button size="small">Edit</Button>
                </Table.Cell>
              </Table.Row>
            ))
          )}
        </Table.Body>
      </Table>

      <div className="flex items-center justify-between mt-4">
        <div>Page {page + 1} / {totalPages}</div>
        <div className="flex gap-2">
          <Button 
            variant="secondary" 
            disabled={page <= 0} 
            onClick={() => setPage(p => p - 1)}
          >
            Previous
          </Button>
          <Button 
            variant="secondary" 
            disabled={page + 1 >= totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </Container>
  )
}
```

### Pattern: Form with Validation

**Real example from this codebase** (`src/admin/routes/businesses/[id]/page.tsx`):

```tsx
import { Container, Heading, Label, Input, Button, Toaster, toast } from "@medusajs/ui"
import { useState } from "react"
import { useParams, useNavigate } from "react-router-dom"

const FormPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = id === "new"
  
  const [data, setData] = useState({
    name: "",
    email: "",
    status: "active",
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    // Client-side validation
    if (!data.name.trim()) {
      toast.error("Name is required")
      return
    }

    setSaving(true)
    try {
      const url = isNew ? "/admin/items" : `/admin/items/${id}`
      const method = isNew ? "POST" : "PUT"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      })

      if (response.ok) {
        toast.success(isNew ? "Created" : "Updated")
        if (isNew) navigate("/items")
      } else {
        const error = await response.json()
        toast.error(error.message || "Save failed")
      }
    } catch (error) {
      toast.error("Network error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Container>
      <Toaster />
      <Heading level="h1">{isNew ? "New Item" : "Edit Item"}</Heading>
      
      <div className="space-y-4 max-w-md">
        <div>
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            value={data.name}
            onChange={(e) => setData({ ...data, name: e.target.value })}
            placeholder="Enter name"
          />
        </div>

        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={data.email}
            onChange={(e) => setData({ ...data, email: e.target.value })}
            placeholder="email@example.com"
          />
        </div>

        <Button 
          variant="primary" 
          onClick={handleSave} 
          disabled={saving}
        >
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>
    </Container>
  )
}
```

### Pattern: Detail View with Tabs

For complex entities, create a tabbed interface:

```tsx
import { Container, Tabs } from "@medusajs/ui"
import { useState } from "react"

const DetailPage = () => {
  const [activeTab, setActiveTab] = useState("general")

  return (
    <Container>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Trigger value="general">General</Tabs.Trigger>
          <Tabs.Trigger value="settings">Settings</Tabs.Trigger>
          <Tabs.Trigger value="history">History</Tabs.Trigger>
        </Tabs.List>
        
        <Tabs.Content value="general">
          <GeneralTab />
        </Tabs.Content>
        
        <Tabs.Content value="settings">
          <SettingsTab />
        </Tabs.Content>
        
        <Tabs.Content value="history">
          <HistoryTab />
        </Tabs.Content>
      </Tabs>
    </Container>
  )
}
```

### Pattern: Widget Showing Related Data

**Example from this codebase** - Display related entity data in a widget:

```tsx
import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { DetailWidgetProps, AdminProduct } from "@medusajs/framework/types"
import { Container, Heading, Badge } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { sdk } from "../lib/sdk"

const ProductBrandWidget = ({ data: product }: DetailWidgetProps<AdminProduct>) => {
  // Fetch linked data through the API
  const { data, isLoading } = useQuery({
    queryFn: async () => {
      const response = await sdk.client.fetch(`/admin/products/${product.id}?fields=+brand.*`)
      return response
    },
    queryKey: ["product-brand", product.id],
  })

  if (isLoading) {
    return (
      <Container>
        <Heading level="h2">Brand</Heading>
        <p>Loading...</p>
      </Container>
    )
  }

  const brand = data?.product?.brand

  return (
    <Container>
      <Heading level="h2">Brand</Heading>
      {brand ? (
        <div className="flex items-center gap-2">
          <span>{brand.name}</span>
          <Badge color="green">Linked</Badge>
        </div>
      ) : (
        <p className="text-gray-500">No brand associated</p>
      )}
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.before",
})

export default ProductBrandWidget
```

---

## Limitations

### What You CAN'T Customize

1. **Sidebar Structure**
   - Cannot reorder existing menu items
   - Cannot create nested menu groups
   - Cannot hide core menu items

2. **Core Page Layouts**
   - Cannot modify existing page layouts
   - Cannot remove core form fields
   - Cannot change the routing structure of core pages

3. **Widget Limitations**
   - Limited to predefined zones (see Widget Zones section)
   - Cannot create custom zones
   - Cannot control the order of multiple widgets in the same zone

4. **Styling Constraints**
   - Must use Medusa UI components (`@medusajs/ui`) for consistency
   - Cannot override core admin CSS globally
   - Custom styling limited to your components

5. **Authentication**
   - Cannot bypass Medusa's authentication
   - Cannot add custom login providers directly (use widgets for UI, middleware for validation)

### When to Build Separate Admin

Consider building a separate admin dashboard when:

| Scenario | Recommendation |
|----------|----------------|
| Complex multi-tenant dashboards | Separate admin |
| Real-time data visualization | Separate admin |
| Custom authentication requirements | Separate admin |
| Mobile-first admin experience | Separate admin |
| Heavy bulk operations (>1000 items) | Separate admin |
| Simple CRUD for custom entities | Admin UI routes |
| Displaying related data on core pages | Widgets |
| Status management workflows | Admin UI routes |

**This codebase's approach:** Uses Medusa Admin UI routes for business/consultation management, with a separate Next.js storefront for customer-facing features.

---

## Reference

### Admin Components

From `@medusajs/ui`:

| Component | Purpose |
|-----------|---------|
| `Container` | Content wrapper with consistent padding |
| `Heading` | Section headings (h1-h3) |
| `Button` | Actions (primary, secondary, danger variants) |
| `Table` | Data display with header/body/row/cell |
| `Input` | Text input fields |
| `Select` | Dropdown selection |
| `Badge` | Status indicators (colors: green, red, orange, blue, grey) |
| `Switch` | Toggle controls |
| `Drawer` | Slide-out panels |
| `Modal` | Dialog overlays |
| `Tabs` | Tabbed interfaces |
| `Toast/Toaster` | Notifications |
| `DatePicker` | Date selection |
| `Avatar` | User/entity avatars |
| `Copy` | Copy-to-clipboard helper |

### Hooks

| Hook | Purpose | Import |
|------|---------|--------|
| `useQuery` | Data fetching | `@tanstack/react-query` |
| `useMutation` | Data mutations | `@tanstack/react-query` |
| `useParams` | Route params | `react-router-dom` |
| `useNavigate` | Programmatic navigation | `react-router-dom` |
| `useSearchParams` | URL query params | `react-router-dom` |

### Common Patterns

**Fetching with filters:**
```tsx
const [filters, setFilters] = useState({ status: "", q: "" })
const [page, setPage] = useState(0)

const queryString = useMemo(() => {
  const params = new URLSearchParams()
  params.set("limit", "25")
  params.set("offset", String(page * 25))
  if (filters.status) params.set("status", filters.status)
  if (filters.q) params.set("q", filters.q)
  return params.toString()
}, [filters, page])

useEffect(() => {
  fetchData()
}, [queryString])
```

**Bulk selection:**
```tsx
const [selected, setSelected] = useState<Set<string>>(new Set())

const toggleAll = (checked: boolean, items: any[]) => {
  const next = new Set(selected)
  items.forEach(item => {
    if (checked) next.add(item.id)
    else next.delete(item.id)
  })
  setSelected(next)
}

const toggleOne = (id: string, checked: boolean) => {
  const next = new Set(selected)
  if (checked) next.add(id)
  else next.delete(id)
  setSelected(next)
}
```

**Form with JSON field:**
```tsx
const [jsonField, setJsonField] = useState({})

<textarea
  value={JSON.stringify(jsonField, null, 2)}
  onChange={(e) => {
    try {
      setJsonField(JSON.parse(e.target.value))
    } catch {
      // Invalid JSON - ignore or show error
    }
  }}
  className="w-full h-32 p-2 border rounded font-mono text-sm"
/>
```

**Status badge mapping:**
```tsx
const STATUS_COLORS: Record<string, "green" | "orange" | "blue" | "red" | "grey"> = {
  pending: "orange",
  approved: "blue",
  active: "green",
  suspended: "red",
}

<Badge color={STATUS_COLORS[status] || "grey"}>{status}</Badge>
```

---

## Real Examples from This Codebase

### Businesses List Page
**Location:** `src/admin/routes/businesses/page.tsx`

Features demonstrated:
- Data table with status badges
- Filter dropdown
- Action buttons per row (Approve, Provision, Suspend)
- Navigation to detail page

### Business Detail Page  
**Location:** `src/admin/routes/businesses/[id]/page.tsx`

Features demonstrated:
- Create/edit form handling
- Dynamic route with `id` parameter
- JSON field editing
- Related entity management (domains)
- Image display
- Delete confirmation

### Consultations Management
**Location:** `src/admin/routes/consultations/page.tsx`

Features demonstrated:
- Complex filtering (search, dates, multi-select)
- Bulk operations
- Drawer-based filters
- Pagination
- Export functionality
- Row selection

---

*For official Medusa Admin documentation, see: https://docs.medusajs.com/learn/fundamentals/admin*
