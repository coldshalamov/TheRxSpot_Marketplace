import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Avatar,
  Badge,
  Button,
  Container,
  Drawer,
  Heading,
  Input,
  Select,
  Table,
  Textarea,
  Toaster,
  toast,
} from "@medusajs/ui"
import { useEffect, useMemo, useRef, useState } from "react"

type PlanOrderStatus = "pending" | "in_production" | "shipped" | "delivered" | "cancelled"

type OrderRow = {
  id: string
  display_id: number | null
  created_at: string | null
  total: number
  currency_code: string
  plan_status: PlanOrderStatus
  business_id: string | null
  business: any | null
  customer: any | null
  items: any[]
  metadata: Record<string, any>
}

type OrdersListResponse = {
  orders: OrderRow[]
  count: number
  limit: number
  offset: number
}

type OrderItemRow = {
  id: string
  order_id: string
  order_display_id: number | null
  business_id: string | null
  business: any | null
  created_at: string | null
  plan_status: PlanOrderStatus
  product_id: string | null
  product_title: string
  variant_title: string | null
  quantity: number
  unit_price: number
  total: number
  currency_code: string
}

type OrderItemsListResponse = {
  items: OrderItemRow[]
  count: number
  limit: number
  offset: number
}

const LIMIT = 25

function formatMoney(cents: number, currency = "USD"): string {
  const dollars = cents / 100
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(dollars)
  } catch {
    return `$${dollars.toFixed(2)}`
  }
}

function statusBadge(status: PlanOrderStatus): { label: string; color: "grey" | "blue" | "green" | "orange" | "red" } {
  if (status === "pending") return { label: "Pending", color: "orange" }
  if (status === "in_production") return { label: "In Production", color: "blue" }
  if (status === "shipped") return { label: "Shipped", color: "green" }
  if (status === "delivered") return { label: "Delivered", color: "grey" }
  return { label: "Cancelled", color: "red" }
}

function safeName(person: any): string {
  const name = `${person?.first_name || ""} ${person?.last_name || ""}`.trim()
  return name || person?.email || person?.id || "—"
}

const OrdersGlobalPage = () => {
  const [tab, setTab] = useState<"orders" | "items">("orders")

  const [businesses, setBusinesses] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])

  const [q, setQ] = useState("")
  const [statuses, setStatuses] = useState<PlanOrderStatus[]>([])
  const [businessId, setBusinessId] = useState("")
  const [productId, setProductId] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [minTotal, setMinTotal] = useState("")
  const [maxTotal, setMaxTotal] = useState("")

  const [page, setPage] = useState(0)
  const [rows, setRows] = useState<OrderRow[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const [selected, setSelected] = useState<Set<string>>(new Set())

  const [itemsPage, setItemsPage] = useState(0)
  const [itemRows, setItemRows] = useState<OrderItemRow[]>([])
  const [itemCount, setItemCount] = useState(0)
  const [itemsLoading, setItemsLoading] = useState(true)

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null)
  const [activeOrder, setActiveOrder] = useState<any | null>(null)

  const [statusUpdating, setStatusUpdating] = useState(false)
  const [shipOpen, setShipOpen] = useState(false)
  const [shipTracking, setShipTracking] = useState("")
  const [shipCarrier, setShipCarrier] = useState("")

  const [refundOpen, setRefundOpen] = useState(false)
  const [refundReason, setRefundReason] = useState("")
  const [refundLoading, setRefundLoading] = useState(false)

  const abortOrders = useRef<AbortController | null>(null)
  const abortItems = useRef<AbortController | null>(null)

  const offset = page * LIMIT
  const totalPages = Math.max(1, Math.ceil(count / LIMIT))
  const itemOffset = itemsPage * LIMIT
  const itemTotalPages = Math.max(1, Math.ceil(itemCount / LIMIT))

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    params.set("limit", String(LIMIT))
    params.set("offset", String(offset))
    if (q.trim()) params.set("q", q.trim())
    if (statuses.length) params.set("status", statuses.join(","))
    if (businessId) params.set("business_id", businessId)
    if (productId) params.set("product_id", productId)
    if (dateFrom) params.set("date_from", new Date(dateFrom).toISOString())
    if (dateTo) params.set("date_to", new Date(dateTo).toISOString())
    if (minTotal.trim()) params.set("min_total", String(Math.trunc(parseFloat(minTotal) * 100)))
    if (maxTotal.trim()) params.set("max_total", String(Math.trunc(parseFloat(maxTotal) * 100)))
    return params.toString()
  }, [businessId, dateFrom, dateTo, maxTotal, minTotal, offset, productId, q, statuses])

  const itemsQueryString = useMemo(() => {
    const params = new URLSearchParams()
    params.set("limit", String(LIMIT))
    params.set("offset", String(itemOffset))
    if (q.trim()) params.set("q", q.trim())
    if (statuses.length) params.set("status", statuses.join(","))
    if (businessId) params.set("business_id", businessId)
    if (productId) params.set("product_id", productId)
    if (dateFrom) params.set("date_from", new Date(dateFrom).toISOString())
    if (dateTo) params.set("date_to", new Date(dateTo).toISOString())
    if (minTotal.trim()) params.set("min_total", String(Math.trunc(parseFloat(minTotal) * 100)))
    if (maxTotal.trim()) params.set("max_total", String(Math.trunc(parseFloat(maxTotal) * 100)))
    return params.toString()
  }, [businessId, dateFrom, dateTo, itemOffset, maxTotal, minTotal, productId, q, statuses])

  const fetchBusinesses = async () => {
    try {
      const res = await fetch("/admin/businesses", { credentials: "include" })
      if (!res.ok) return
      const json = await res.json()
      setBusinesses(json.businesses || [])
    } catch {
      // best-effort
    }
  }

  const fetchProducts = async () => {
    try {
      const res = await fetch("/admin/products?limit=100&offset=0", { credentials: "include" })
      if (!res.ok) return
      const json = await res.json()
      setProducts(json.products || [])
    } catch {
      // best-effort
    }
  }

  const fetchOrders = async () => {
    abortOrders.current?.abort()
    const controller = new AbortController()
    abortOrders.current = controller

    setLoading(true)
    try {
      const res = await fetch(`/admin/custom/orders?${queryString}`, { credentials: "include", signal: controller.signal })
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(text || `HTTP ${res.status}`)
      }
      const json = (await res.json()) as OrdersListResponse
      setRows(json.orders || [])
      setCount(json.count || 0)
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return
      toast.error("Failed to load orders", { description: e instanceof Error ? e.message : "Unknown error" })
      setRows([])
      setCount(0)
    } finally {
      setLoading(false)
    }
  }

  const fetchOrderItems = async () => {
    abortItems.current?.abort()
    const controller = new AbortController()
    abortItems.current = controller

    setItemsLoading(true)
    try {
      const res = await fetch(`/admin/custom/orders/items?${itemsQueryString}`, {
        credentials: "include",
        signal: controller.signal,
      })
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(text || `HTTP ${res.status}`)
      }
      const json = (await res.json()) as OrderItemsListResponse
      setItemRows(json.items || [])
      setItemCount(json.count || 0)
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return
      toast.error("Failed to load order items", { description: e instanceof Error ? e.message : "Unknown error" })
      setItemRows([])
      setItemCount(0)
    } finally {
      setItemsLoading(false)
    }
  }

  useEffect(() => {
    void fetchBusinesses()
    void fetchProducts()
  }, [])

  useEffect(() => {
    void fetchOrders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString])

  useEffect(() => {
    if (tab !== "items") return
    void fetchOrderItems()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsQueryString, tab])

  const openOrderDetail = async (orderId: string) => {
    setDetailOpen(true)
    setActiveOrderId(orderId)
    setActiveOrder(null)
    setDetailLoading(true)
    try {
      const res = await fetch(`/admin/custom/orders/${encodeURIComponent(orderId)}`, { credentials: "include" })
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(text || `HTTP ${res.status}`)
      }
      const json = await res.json()
      setActiveOrder(json.order || null)
    } catch (e) {
      toast.error("Failed to load order detail", { description: e instanceof Error ? e.message : "Unknown error" })
      setActiveOrder(null)
    } finally {
      setDetailLoading(false)
    }
  }

  const clearFilters = () => {
    setQ("")
    setStatuses([])
    setBusinessId("")
    setProductId("")
    setDateFrom("")
    setDateTo("")
    setMinTotal("")
    setMaxTotal("")
    setPage(0)
    setItemsPage(0)
    setSelected(new Set())
  }

  const toggleStatus = (s: PlanOrderStatus) => {
    setStatuses((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
    setPage(0)
    setItemsPage(0)
  }

  const toggleSelected = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const selectAllOnPage = (checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) rows.forEach((r) => next.add(r.id))
      else rows.forEach((r) => next.delete(r.id))
      return next
    })
  }

  const exportCsv = () => {
    const ids = Array.from(selected)
    const params = new URLSearchParams(queryString)
    params.delete("limit")
    params.delete("offset")
    if (ids.length) params.set("ids", ids.join(","))
    window.open(`/admin/custom/orders/export?${params.toString()}`, "_blank", "noopener")
  }

  const printPackingSlips = () => {
    const ids = Array.from(selected)
    if (!ids.length) {
      toast.error("Select at least one order")
      return
    }
    const params = new URLSearchParams()
    params.set("ids", ids.join(","))
    window.open(`/admin/custom/orders/packing-slips/export?${params.toString()}`, "_blank", "noopener")
  }

  const bulkMarkInProduction = async () => {
    const ids = Array.from(selected)
    if (!ids.length) {
      toast.error("Select at least one order")
      return
    }

    try {
      const res = await fetch("/admin/custom/orders/bulk/fulfillment", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_ids: ids, status: "in_production" }),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(text || `HTTP ${res.status}`)
      }
      toast.success("Bulk updated", { description: `Marked ${ids.length} order(s) as In Production.` })
      setSelected(new Set())
      await Promise.all([fetchOrders(), fetchOrderItems()])
    } catch (e) {
      toast.error("Bulk update failed", { description: e instanceof Error ? e.message : "Unknown error" })
    }
  }

  const updateOrderStatus = async (
    next: PlanOrderStatus,
    options?: { tracking_number?: string; carrier?: string }
  ) => {
    if (!activeOrderId) return
    setStatusUpdating(true)
    try {
      const res = await fetch(`/admin/custom/orders/${encodeURIComponent(activeOrderId)}/fulfillment`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: next,
          tracking_number: options?.tracking_number,
          carrier: options?.carrier,
        }),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(text || `HTTP ${res.status}`)
      }
      toast.success("Order updated", { description: `Status → ${next}` })
      await Promise.all([fetchOrders(), fetchOrderItems()])
      await openOrderDetail(activeOrderId)
    } catch (e) {
      toast.error("Failed to update order", { description: e instanceof Error ? e.message : "Unknown error" })
    } finally {
      setStatusUpdating(false)
    }
  }

  const requestRefund = async () => {
    if (!activeOrderId) return
    setRefundLoading(true)
    try {
      const res = await fetch(`/admin/custom/orders/${encodeURIComponent(activeOrderId)}/refund`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: refundReason.trim() || null }),
      })

      if (res.status === 501) {
        const json = await res.json().catch(() => ({}))
        toast.error("Refund not implemented", { description: json?.message || "Payment provider integration is required." })
        return
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(text || `HTTP ${res.status}`)
      }

      toast.success("Refund requested")
      setRefundOpen(false)
      setRefundReason("")
    } catch (e) {
      toast.error("Refund failed", { description: e instanceof Error ? e.message : "Unknown error" })
    } finally {
      setRefundLoading(false)
    }
  }

  const currency = "USD"
  const allOnPageSelected = rows.length > 0 && rows.every((r) => selected.has(r.id))

  return (
    <Container>
      <Toaster />

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <Heading level="h1">Orders (Global)</Heading>
          <div className="text-sm text-ui-fg-subtle">Cross-tenant order search (PLAN).</div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={exportCsv}>
            Export CSV
          </Button>
          <Button variant="secondary" onClick={printPackingSlips} disabled={selected.size === 0}>
            Print Packing Slips
          </Button>
          <Button onClick={bulkMarkInProduction} disabled={selected.size === 0}>
            Bulk: In Production
          </Button>
          <Button variant="secondary" onClick={clearFilters}>
            Clear
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 mb-4">
        <div className="flex flex-col md:flex-row md:items-center gap-2">
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setPage(0)
            }}
            placeholder="Search order ID, product name, client, business…"
            className="w-full md:w-[420px]"
          />
          <Select
            value={businessId || "__all__"}
            onValueChange={(v) => {
              setBusinessId(v === "__all__" ? "" : v)
              setPage(0)
            }}
          >
            <Select.Trigger className="w-full md:w-[260px]">
              <Select.Value placeholder="All businesses" />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="__all__">All businesses</Select.Item>
              {(businesses || []).map((b: any) => (
                <Select.Item key={b.id} value={b.id}>
                  {b.name}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
          <Select
            value={productId || "__all__"}
            onValueChange={(v) => {
              setProductId(v === "__all__" ? "" : v)
              setPage(0)
            }}
          >
            <Select.Trigger className="w-full md:w-[260px]">
              <Select.Value placeholder="All products" />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="__all__">All products</Select.Item>
              {(products || []).map((p: any) => (
                <Select.Item key={p.id} value={p.id}>
                  {p.title}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-2">
          <div className="flex flex-wrap gap-2">
            {(["pending", "in_production", "shipped", "delivered", "cancelled"] as PlanOrderStatus[]).map((s) => {
              const active = statuses.includes(s)
              const b = statusBadge(s)
              return (
                <button
                  key={s}
                  type="button"
                  className={`rounded-full border px-3 py-1 text-xs ${active ? "bg-ui-bg-subtle" : "bg-white"}`}
                  onClick={() => toggleStatus(s)}
                >
                  <span className="inline-flex items-center gap-2">
                    <Badge color={b.color}>{b.label}</Badge>
                    {active ? "Included" : "Excluded"}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="flex flex-1 items-center gap-2">
            <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(0) }} />
            <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(0) }} />
            <Input value={minTotal} onChange={(e) => { setMinTotal(e.target.value); setPage(0) }} placeholder="Min total (USD)" className="w-[160px]" />
            <Input value={maxTotal} onChange={(e) => { setMaxTotal(e.target.value); setPage(0) }} placeholder="Max total (USD)" className="w-[160px]" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant={tab === "orders" ? "primary" : "secondary"} onClick={() => setTab("orders")}>
            Orders
          </Button>
          <Button variant={tab === "items" ? "primary" : "secondary"} onClick={() => setTab("items")}>
            Order Items
          </Button>
          <div className="text-xs text-ui-fg-subtle ml-2">Order Items tab requires `/admin/custom/orders/items`.</div>
        </div>
      </div>

      <div className={tab === "orders" ? "" : "hidden"}>
        <div className="rounded-lg border bg-white">
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  onChange={(e) => selectAllOnPage(e.target.checked)}
                  aria-label="Select all on page"
                />
              </Table.HeaderCell>
              <Table.HeaderCell>Order ID</Table.HeaderCell>
              <Table.HeaderCell>Customer</Table.HeaderCell>
              <Table.HeaderCell>Business</Table.HeaderCell>
              <Table.HeaderCell>Date</Table.HeaderCell>
              <Table.HeaderCell className="text-right">Total</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell>Actions</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {loading ? (
              <Table.Row>
                <Table.Cell colSpan={8}>
                  <div className="text-sm text-ui-fg-subtle p-3">Loading…</div>
                </Table.Cell>
              </Table.Row>
            ) : rows.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={8}>
                  <div className="text-sm text-ui-fg-subtle p-3">No orders found.</div>
                </Table.Cell>
              </Table.Row>
            ) : (
              rows.map((r) => {
                const b = statusBadge(r.plan_status)
                return (
                  <Table.Row key={r.id} onClick={() => void openOrderDetail(r.id)} className="cursor-pointer">
                    <Table.Cell onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={(e) => toggleSelected(r.id, e.target.checked)}
                        aria-label={`Select order ${r.id}`}
                      />
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex flex-col">
                        <span className="font-mono text-xs">{r.id}</span>
                        {r.display_id != null ? <span className="text-xs text-ui-fg-subtle">#{r.display_id}</span> : null}
                      </div>
                    </Table.Cell>
                    <Table.Cell>{safeName(r.customer)}</Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center gap-2">
                        <Avatar size="2xsmall" fallback={(r.business?.name || "B").slice(0, 1).toUpperCase()} src={r.business?.logo_url || undefined} />
                        <span>{r.business?.name || r.business_id || "—"}</span>
                      </div>
                    </Table.Cell>
                    <Table.Cell>{r.created_at ? new Date(r.created_at).toLocaleString() : "-"}</Table.Cell>
                    <Table.Cell className="text-right">{formatMoney(r.total || 0, currency)}</Table.Cell>
                    <Table.Cell>
                      <Badge color={b.color}>{b.label}</Badge>
                    </Table.Cell>
                    <Table.Cell onClick={(e) => e.stopPropagation()}>
                      <Button variant="secondary" size="small" onClick={() => void openOrderDetail(r.id)}>
                        View
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                )
              })
            )}
          </Table.Body>
        </Table>
        </div>

      <div className="flex items-center justify-between mt-3">
        <div className="text-xs text-ui-fg-subtle">
          Showing {rows.length ? offset + 1 : 0}–{Math.min(offset + rows.length, count)} of {count}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            Prev
          </Button>
          <div className="text-xs text-ui-fg-subtle">
            Page {page + 1} / {totalPages}
          </div>
          <Button variant="secondary" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}>
            Next
          </Button>
        </div>
      </div>
      </div>

      <div className={tab === "items" ? "" : "hidden"}>
        <div className="rounded-lg border bg-white">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Order ID</Table.HeaderCell>
                <Table.HeaderCell>Product</Table.HeaderCell>
                <Table.HeaderCell>Variant</Table.HeaderCell>
                <Table.HeaderCell className="text-right">Qty</Table.HeaderCell>
                <Table.HeaderCell className="text-right">Unit</Table.HeaderCell>
                <Table.HeaderCell className="text-right">Total</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {itemsLoading ? (
                <Table.Row>
                  <Table.Cell colSpan={7}>
                    <div className="text-sm text-ui-fg-subtle p-3">Loading…</div>
                  </Table.Cell>
                </Table.Row>
              ) : itemRows.length === 0 ? (
                <Table.Row>
                  <Table.Cell colSpan={7}>
                    <div className="text-sm text-ui-fg-subtle p-3">No order items found.</div>
                  </Table.Cell>
                </Table.Row>
              ) : (
                itemRows.map((it) => {
                  const b = statusBadge(it.plan_status)
                  return (
                    <Table.Row key={it.id} onClick={() => void openOrderDetail(it.order_id)} className="cursor-pointer">
                      <Table.Cell>
                        <div className="flex flex-col">
                          <span className="font-mono text-xs">{it.order_id}</span>
                          {it.order_display_id != null ? (
                            <span className="text-xs text-ui-fg-subtle">#{it.order_display_id}</span>
                          ) : null}
                        </div>
                      </Table.Cell>
                      <Table.Cell>{it.product_title}</Table.Cell>
                      <Table.Cell>{it.variant_title || "—"}</Table.Cell>
                      <Table.Cell className="text-right">{it.quantity}</Table.Cell>
                      <Table.Cell className="text-right">{formatMoney(it.unit_price || 0, currency)}</Table.Cell>
                      <Table.Cell className="text-right">{formatMoney(it.total || 0, currency)}</Table.Cell>
                      <Table.Cell>
                        <Badge color={b.color}>{b.label}</Badge>
                      </Table.Cell>
                    </Table.Row>
                  )
                })
              )}
            </Table.Body>
          </Table>
        </div>

        <div className="flex items-center justify-between mt-3">
          <div className="text-xs text-ui-fg-subtle">
            Showing {itemRows.length ? itemOffset + 1 : 0}–{Math.min(itemOffset + itemRows.length, itemCount)} of {itemCount}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" disabled={itemsPage <= 0} onClick={() => setItemsPage((p) => Math.max(0, p - 1))}>
              Prev
            </Button>
            <div className="text-xs text-ui-fg-subtle">
              Page {itemsPage + 1} / {itemTotalPages}
            </div>
            <Button
              variant="secondary"
              disabled={itemsPage + 1 >= itemTotalPages}
              onClick={() => setItemsPage((p) => Math.min(itemTotalPages - 1, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      <Drawer open={detailOpen} onOpenChange={setDetailOpen}>
        <Drawer.Content className="max-w-[920px]">
          <Drawer.Header>
            <Drawer.Title>Order detail</Drawer.Title>
            <Drawer.Description>{activeOrderId ? activeOrderId : ""}</Drawer.Description>
          </Drawer.Header>
          <Drawer.Body>
            {detailLoading ? (
              <div className="text-sm text-ui-fg-subtle">Loading...</div>
            ) : !activeOrder ? (
              <div className="text-sm text-ui-fg-subtle">No order loaded.</div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs text-ui-fg-subtle">Order</div>
                    <div className="font-mono text-sm">{activeOrder.id}</div>
                    {activeOrder.display_id != null ? (
                      <div className="text-xs text-ui-fg-subtle">#{activeOrder.display_id}</div>
                    ) : null}
                    <div className="text-xs text-ui-fg-subtle mt-1">
                      Placed: {activeOrder.created_at ? new Date(activeOrder.created_at).toLocaleString() : "-"}
                    </div>
                  </div>
                  <Badge color={statusBadge(activeOrder.plan_status).color}>
                    {statusBadge(activeOrder.plan_status).label}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    size="small"
                    disabled={statusUpdating || activeOrder.plan_status !== "pending"}
                    onClick={() => void updateOrderStatus("in_production")}
                  >
                    Mark In Production
                  </Button>
                  <Button
                    variant="secondary"
                    size="small"
                    disabled={statusUpdating || activeOrder.plan_status !== "in_production"}
                    onClick={() => setShipOpen(true)}
                  >
                    Mark as Shipped
                  </Button>
                  <Button
                    variant="secondary"
                    size="small"
                    disabled={statusUpdating || activeOrder.plan_status !== "shipped"}
                    onClick={() => void updateOrderStatus("delivered")}
                  >
                    Mark Delivered
                  </Button>
                  <Button
                    variant="secondary"
                    size="small"
                    disabled={statusUpdating || !["pending", "in_production", "shipped"].includes(activeOrder.plan_status)}
                    onClick={() => void updateOrderStatus("cancelled")}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    size="small"
                    disabled={refundLoading}
                    onClick={() => setRefundOpen(true)}
                  >
                    Refund Order
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded border p-3">
                    <div className="text-xs font-medium mb-2">Customer</div>
                    <div className="text-sm">{safeName(activeOrder.customer)}</div>
                    <div className="text-xs text-ui-fg-subtle">
                      {activeOrder.customer?.email || activeOrder.email || ""}
                    </div>
                    <div className="text-xs text-ui-fg-subtle mt-2">
                      Shipping:{" "}
                      {activeOrder.shipping_address
                        ? `${activeOrder.shipping_address.address_1 || ""} ${activeOrder.shipping_address.city || ""} ${activeOrder.shipping_address.province || ""} ${activeOrder.shipping_address.postal_code || ""}`
                        : "—"}
                    </div>
                  </div>
                  <div className="rounded border p-3">
                    <div className="text-xs font-medium mb-2">Business</div>
                    <div className="flex items-center gap-2">
                      <Avatar
                        size="2xsmall"
                        fallback={(activeOrder.business?.name || "B").slice(0, 1).toUpperCase()}
                        src={activeOrder.business?.logo_url || undefined}
                      />
                      <div className="text-sm">{activeOrder.business?.name || activeOrder.business_id || "—"}</div>
                    </div>
                    <div className="text-xs text-ui-fg-subtle mt-2">
                      Platform commission: {formatMoney(activeOrder.platform_commission_cents || 0, currency)}
                    </div>
                  </div>
                </div>

                <div className="rounded border p-3">
                  <div className="text-xs font-medium mb-2">Line items</div>
                  <div className="space-y-2">
                    {(activeOrder.items || []).map((it: any) => (
                      <div key={it.id} className="flex items-center justify-between gap-3 text-sm">
                        <div className="flex-1">
                          <div className="font-medium">{it.title}</div>
                          <div className="text-xs text-ui-fg-subtle">{it.variant_title || ""}</div>
                        </div>
                        <div className="text-xs text-ui-fg-subtle">x{it.quantity}</div>
                        <div className="font-mono text-xs">{formatMoney(it.total || 0, currency)}</div>
                      </div>
                    ))}
                    {(activeOrder.items || []).length === 0 ? (
                      <div className="text-sm text-ui-fg-subtle">No items.</div>
                    ) : null}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded border p-3">
                    <div className="text-xs font-medium mb-2">Pricing</div>
                    <div className="text-sm flex items-center justify-between">
                      <span>Subtotal</span>
                      <span className="font-mono text-xs">{formatMoney(activeOrder.subtotal || 0, currency)}</span>
                    </div>
                    <div className="text-sm flex items-center justify-between">
                      <span>Consultation Fee(s)</span>
                      <span className="font-mono text-xs">{formatMoney(activeOrder.consult_fee_total || 0, currency)}</span>
                    </div>
                    <div className="text-sm flex items-center justify-between">
                      <span>Tax</span>
                      <span className="font-mono text-xs">{formatMoney(activeOrder.tax_total || 0, currency)}</span>
                    </div>
                    <div className="text-sm flex items-center justify-between">
                      <span>Shipping</span>
                      <span className="font-mono text-xs">{formatMoney(activeOrder.shipping_total || 0, currency)}</span>
                    </div>
                    <div className="text-sm flex items-center justify-between mt-2">
                      <span className="font-medium">Total</span>
                      <span className="font-mono text-xs">{formatMoney(activeOrder.total || 0, currency)}</span>
                    </div>
                    <div className="text-xs text-ui-fg-subtle mt-2">
                      Platform commission: {formatMoney(activeOrder.platform_commission_cents || 0, currency)}
                    </div>
                    <div className="text-xs text-ui-fg-subtle">
                      Net earnings: {formatMoney(activeOrder.net_earnings_cents || 0, currency)}
                    </div>
                  </div>

                  <div className="rounded border p-3">
                    <div className="text-xs font-medium mb-2">Fulfillment</div>
                    <div className="text-sm">Carrier: {activeOrder.metadata?.carrier || "—"}</div>
                    <div className="text-sm">Tracking: {activeOrder.metadata?.tracking_number || "—"}</div>
                    <div className="text-xs text-ui-fg-subtle mt-2">Timeline</div>
                    <div className="mt-2 space-y-1">
                      {(activeOrder.status_history || []).slice(0, 12).map((ev: any) => (
                        <div key={ev.id || ev.created_at} className="text-xs text-ui-fg-subtle">
                          {ev.created_at ? new Date(ev.created_at).toLocaleString() : "-"} • {ev.from_status || "?"} → {ev.to_status || ev.status || "?"}
                        </div>
                      ))}
                      {(activeOrder.status_history || []).length === 0 ? (
                        <div className="text-xs text-ui-fg-subtle">No status events yet.</div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="rounded border p-3">
                  <div className="text-xs font-medium mb-2">Payment</div>
                  <div className="text-sm text-ui-fg-subtle">
                    Method: {activeOrder.metadata?.payment_method || activeOrder.metadata?.payment_provider || "—"}
                  </div>
                  <div className="text-sm text-ui-fg-subtle">
                    Transaction ID: {activeOrder.transactions?.[0]?.id || "—"}
                  </div>
                  <div className="text-sm text-ui-fg-subtle">
                    Status: {activeOrder.transactions?.[0]?.status || "—"}
                  </div>
                  {activeOrder.metadata?.consultation_id ? (
                    <div className="text-xs text-ui-fg-subtle mt-2">
                      Related consultation:{" "}
                      <a
                        href={`/consultations/${encodeURIComponent(String(activeOrder.metadata.consultation_id))}`}
                        className="font-mono text-xs underline underline-offset-2"
                      >
                        {String(activeOrder.metadata.consultation_id)}
                      </a>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </Drawer.Body>
          <Drawer.Footer className="flex items-center justify-end gap-2">
            <Drawer.Close asChild>
              <Button variant="secondary">Close</Button>
            </Drawer.Close>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>

      <Drawer
        open={shipOpen}
        onOpenChange={(open) => {
          setShipOpen(open)
          if (!open) {
            setShipTracking("")
            setShipCarrier("")
          }
        }}
      >
        <Drawer.Content className="max-w-[560px]">
          <Drawer.Header>
            <Drawer.Title>Mark as shipped</Drawer.Title>
            <Drawer.Description>Tracking number is required.</Drawer.Description>
          </Drawer.Header>
          <Drawer.Body>
            <div className="space-y-3">
              <div>
                <div className="text-xs font-medium mb-1">Carrier (optional)</div>
                <Input value={shipCarrier} onChange={(e) => setShipCarrier(e.target.value)} placeholder="UPS / USPS / FedEx…" />
              </div>
              <div>
                <div className="text-xs font-medium mb-1">Tracking number</div>
                <Input value={shipTracking} onChange={(e) => setShipTracking(e.target.value)} placeholder="Tracking #" />
              </div>
            </div>
          </Drawer.Body>
          <Drawer.Footer className="flex items-center justify-end gap-2">
            <Drawer.Close asChild>
              <Button variant="secondary" disabled={statusUpdating}>
                Cancel
              </Button>
            </Drawer.Close>
            <Button
              disabled={!shipTracking.trim() || statusUpdating}
              onClick={async () => {
                await updateOrderStatus("shipped", {
                  tracking_number: shipTracking.trim(),
                  carrier: shipCarrier.trim() || undefined,
                })
                setShipOpen(false)
              }}
            >
              {statusUpdating ? "Updating…" : "Mark shipped"}
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>

      <Drawer open={refundOpen} onOpenChange={setRefundOpen}>
        <Drawer.Content className="max-w-[560px]">
          <Drawer.Header>
            <Drawer.Title>Refund order</Drawer.Title>
            <Drawer.Description>Refunds are stubbed until payment integration is implemented.</Drawer.Description>
          </Drawer.Header>
          <Drawer.Body>
            <div className="space-y-2">
              <div className="text-xs font-medium">Reason (optional)</div>
              <Textarea value={refundReason} onChange={(e) => setRefundReason(e.target.value)} />
            </div>
          </Drawer.Body>
          <Drawer.Footer className="flex items-center justify-end gap-2">
            <Drawer.Close asChild>
              <Button variant="secondary" disabled={refundLoading}>
                Cancel
              </Button>
            </Drawer.Close>
            <Button variant="danger" disabled={refundLoading} onClick={() => void requestRefund()}>
              {refundLoading ? "Submitting…" : "Request refund"}
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Orders (Global)",
})

export default OrdersGlobalPage
