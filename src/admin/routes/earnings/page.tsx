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
  Toaster,
  toast,
} from "@medusajs/ui"
import { useEffect, useMemo, useRef, useState } from "react"

type PlanEarningStatus = "completed" | "pending" | "paid_out" | "refunded"
type PlanEarningType = "commission" | "consult_fee" | "service_fee"

type EarningsSummary = {
  pending_payout: number
  total_earnings: number
  commission_balance: number
  available_payout: number
  platform_commission_balance?: number
  commission_pending?: number
  breakdown?: {
    commission: number
    consultation_fee: number
    service_fee: number
  }
}

type EarningRow = {
  id: string
  business_id: string
  order_id: string | null
  created_at: string
  type: string
  status: string
  net_amount: any
  payout_id?: string | null
  metadata?: Record<string, any> | null
}

type EarningsListResponse = {
  earnings: EarningRow[]
  count: number
  limit: number
  offset: number
}

type PayoutRow = {
  id: string
  business_id: string
  method: string
  status: string
  amount: any
  created_at: string
  arrival_date?: string | null
}

type PayoutsListResponse = {
  payouts: PayoutRow[]
  count: number
  pagination?: { limit: number; offset: number; has_more: boolean }
}

const LIMIT = 25

function asCents(value: any): number {
  if (value == null) return 0
  if (typeof value === "number") return Math.trunc(value)
  if (typeof value === "string") return parseInt(value, 10) || 0
  if (typeof value === "object" && typeof value.value === "string") return parseInt(value.value, 10) || 0
  return Number(value) || 0
}

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

function typeLabel(internalType: string): { label: string; color: "grey" | "green" | "orange" | "blue" } {
  const t = (internalType || "").toLowerCase()
  if (t === "consultation_fee") return { label: "Consult Fee", color: "blue" }
  if (t === "shipping_fee" || t === "clinician_fee") return { label: "Service Fee", color: "grey" }
  return { label: "Commission", color: "green" }
}

function statusBadge(internalStatus: string): { label: string; color: "grey" | "green" | "orange" | "blue" | "red" } {
  const s = (internalStatus || "").toLowerCase()
  if (s === "pending") return { label: "Pending", color: "orange" }
  if (s === "paid_out") return { label: "Paid Out", color: "blue" }
  if (s === "reversed") return { label: "Refunded", color: "red" }
  return { label: "Completed", color: "green" }
}

function payoutMethodLabel(method: string): string {
  const m = (method || "").toLowerCase()
  if (m === "stripe_connect") return "Stripe"
  if (m === "ach") return "ACH"
  if (m === "wire") return "Wire"
  return method || "-"
}

function estimateArrival(method: string): string {
  const m = (method || "").toLowerCase()
  if (m === "stripe_connect") return "2 business days"
  if (m === "ach") return "3–5 business days"
  if (m === "wire") return "1 business day"
  return "-"
}

const EarningsPage = () => {
  const [businesses, setBusinesses] = useState<any[]>([])
  const businessById = useMemo(() => new Map((businesses || []).map((b: any) => [b.id, b])), [businesses])

  const [summary, setSummary] = useState<EarningsSummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(true)

  const [rows, setRows] = useState<EarningRow[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const [orderOpen, setOrderOpen] = useState(false)
  const [orderLoading, setOrderLoading] = useState(false)
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null)
  const [activeOrder, setActiveOrder] = useState<any | null>(null)

  const [payouts, setPayouts] = useState<PayoutRow[]>([])
  const [payoutsLoading, setPayoutsLoading] = useState(true)
  const [payoutCount, setPayoutCount] = useState(0)

  const [q, setQ] = useState("")
  const [status, setStatus] = useState<PlanEarningStatus[]>([])
  const [type, setType] = useState<PlanEarningType | "">("")
  const [selectedBusinessIds, setSelectedBusinessIds] = useState<string[]>([])
  const [datePreset, setDatePreset] = useState<"7" | "30" | "90" | "custom" | "">("30")
  const [dateFrom, setDateFrom] = useState<Date | null>(null)
  const [dateTo, setDateTo] = useState<Date | null>(null)

  const [page, setPage] = useState(0)

  const [filtersOpen, setFiltersOpen] = useState(false)
  const [payoutOpen, setPayoutOpen] = useState(false)
  const [payoutMethod, setPayoutMethod] = useState<"stripe_connect" | "ach" | "wire">("stripe_connect")
  const [payoutAmount, setPayoutAmount] = useState("")
  const [destinationAccount, setDestinationAccount] = useState("")
  const [confirmPayout, setConfirmPayout] = useState(false)
  const [creatingPayout, setCreatingPayout] = useState(false)

  const abortRef = useRef<AbortController | null>(null)

  const offset = page * LIMIT
  const totalPages = Math.max(1, Math.ceil(count / LIMIT))

  const effectiveDateRange = useMemo(() => {
    if (datePreset === "custom") return { from: dateFrom, to: dateTo }
    if (!datePreset) return { from: null as Date | null, to: null as Date | null }
    const days = parseInt(datePreset, 10)
    if (!Number.isFinite(days) || days <= 0) return { from: null, to: null }
    const to = new Date()
    const from = new Date()
    from.setDate(to.getDate() - days)
    return { from, to }
  }, [dateFrom, datePreset, dateTo])

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    params.set("limit", String(LIMIT))
    params.set("offset", String(offset))
    if (q.trim()) params.set("q", q.trim())
    if (status.length) params.set("status", status.join(","))
    if (type) params.set("type", type)
    if (selectedBusinessIds.length) params.set("business_ids", selectedBusinessIds.join(","))
    if (effectiveDateRange.from) params.set("date_from", effectiveDateRange.from.toISOString())
    if (effectiveDateRange.to) params.set("date_to", effectiveDateRange.to.toISOString())
    return params.toString()
  }, [effectiveDateRange.from, effectiveDateRange.to, offset, q, selectedBusinessIds, status, type])

  const summaryQueryString = useMemo(() => {
    const params = new URLSearchParams()
    if (selectedBusinessIds.length) params.set("business_ids", selectedBusinessIds.join(","))
    if (effectiveDateRange.from) params.set("date_from", effectiveDateRange.from.toISOString())
    if (effectiveDateRange.to) params.set("date_to", effectiveDateRange.to.toISOString())
    return params.toString()
  }, [effectiveDateRange.from, effectiveDateRange.to, selectedBusinessIds])

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

  const fetchSummary = async () => {
    setSummaryLoading(true)
    try {
      const res = await fetch(`/admin/earnings/summary?${summaryQueryString}`, { credentials: "include" })
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(text || `HTTP ${res.status}`)
      }
      const json = await res.json()
      setSummary(json as EarningsSummary)
    } catch (e) {
      toast.error("Failed to load earnings summary", {
        description: e instanceof Error ? e.message : "Unknown error",
      })
      setSummary(null)
    } finally {
      setSummaryLoading(false)
    }
  }

  const fetchEarnings = async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    try {
      const res = await fetch(`/admin/earnings?${queryString}`, { credentials: "include", signal: controller.signal })
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(text || `HTTP ${res.status}`)
      }
      const json = (await res.json()) as EarningsListResponse
      setRows(json.earnings || [])
      setCount(json.count || 0)
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return
      toast.error("Failed to load earnings", { description: e instanceof Error ? e.message : "Unknown error" })
      setRows([])
      setCount(0)
    } finally {
      setLoading(false)
    }
  }

  const openOrderDetail = async (orderId: string) => {
    setOrderOpen(true)
    setActiveOrderId(orderId)
    setActiveOrder(null)
    setOrderLoading(true)
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
      setOrderLoading(false)
    }
  }

  const fetchPayouts = async () => {
    setPayoutsLoading(true)
    try {
      const res = await fetch(`/admin/payouts?limit=25&offset=0`, { credentials: "include" })
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(text || `HTTP ${res.status}`)
      }
      const json = (await res.json()) as PayoutsListResponse
      setPayouts(json.payouts || [])
      setPayoutCount(json.count || 0)
    } catch (e) {
      toast.error("Failed to load payouts", { description: e instanceof Error ? e.message : "Unknown error" })
      setPayouts([])
      setPayoutCount(0)
    } finally {
      setPayoutsLoading(false)
    }
  }

  const clearFilters = () => {
    setQ("")
    setStatus([])
    setType("")
    setSelectedBusinessIds([])
    setDatePreset("30")
    setDateFrom(null)
    setDateTo(null)
    setPage(0)
  }

  const toggleStatus = (s: PlanEarningStatus) => {
    setStatus((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
    setPage(0)
  }

  const toggleBusiness = (id: string) => {
    setSelectedBusinessIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
    setPage(0)
  }

  const requestPayout = async () => {
    const businessId = selectedBusinessIds.length === 1 ? selectedBusinessIds[0] : ""
    if (!businessId) {
      toast.error("Select exactly one business", { description: "Payout requests must be created for a single business." })
      return
    }

    const max = summary ? asCents(summary.available_payout) : 0
    const amount = Math.trunc(parseFloat(payoutAmount || "0") * 100)
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Invalid payout amount", { description: "Enter a positive amount." })
      return
    }
    if (amount > max) {
      toast.error("Amount exceeds available payout", { description: `Max available is ${formatMoney(max)}.` })
      return
    }
    if ((payoutMethod === "ach" || payoutMethod === "wire") && !destinationAccount.trim()) {
      toast.error("Destination account required", { description: "Provide destination_account for ACH/Wire payouts." })
      return
    }
    if (!confirmPayout) {
      toast.error("Confirmation required", { description: "Confirm before requesting a payout." })
      return
    }

    setCreatingPayout(true)
    try {
      const res = await fetch("/admin/payouts", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_id: businessId,
          method: payoutMethod,
          amount,
          destination_account: destinationAccount.trim() || null,
          idempotency_key: `ui_${businessId}_${Date.now()}`,
        }),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(text || `HTTP ${res.status}`)
      }
      toast.success("Payout requested", { description: `${formatMoney(amount)} via ${payoutMethodLabel(payoutMethod)}.` })
      setPayoutOpen(false)
      setConfirmPayout(false)
      setPayoutAmount("")
      setDestinationAccount("")
      await Promise.all([fetchSummary(), fetchEarnings(), fetchPayouts()])
    } catch (e) {
      toast.error("Failed to request payout", { description: e instanceof Error ? e.message : "Unknown error" })
    } finally {
      setCreatingPayout(false)
    }
  }

  useEffect(() => {
    void fetchBusinesses()
  }, [])

  useEffect(() => {
    void fetchSummary()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summaryQueryString])

  useEffect(() => {
    void fetchEarnings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString])

  useEffect(() => {
    void fetchPayouts()
  }, [])

  const currency = "USD"
  const pendingPayout = summary ? asCents(summary.pending_payout) : 0
  const totalEarnings = summary ? asCents(summary.total_earnings) : 0
  const commissionBalance = summary ? asCents(summary.platform_commission_balance ?? summary.commission_balance) : 0
  const availablePayout = summary ? asCents(summary.available_payout) : 0
  const commissionPending = summary ? asCents(summary.commission_pending ?? 0) : 0

  return (
    <Container>
      <Toaster />

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <Heading level="h1">Earnings</Heading>
          <div className="text-sm text-ui-fg-subtle">Summary, earnings entries, payouts, and exports.</div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setFiltersOpen(true)}>
            Filters
          </Button>
          <Button onClick={() => setPayoutOpen(true)} disabled={selectedBusinessIds.length !== 1}>
            Request Payout
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-6">
        <div className="rounded-lg border bg-white p-3">
          <div className="text-xs text-ui-fg-subtle">Pending Payout</div>
          <div className="text-lg font-semibold">{summaryLoading ? "…" : formatMoney(pendingPayout, currency)}</div>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <div className="text-xs text-ui-fg-subtle">Total Earnings</div>
          <div className="text-lg font-semibold">{summaryLoading ? "…" : formatMoney(totalEarnings, currency)}</div>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <div className="text-xs text-ui-fg-subtle">Commission Balance</div>
          <div className="text-lg font-semibold">{summaryLoading ? "…" : formatMoney(commissionBalance, currency)}</div>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <div className="text-xs text-ui-fg-subtle">Available Payout</div>
          <div className="text-lg font-semibold">{summaryLoading ? "…" : formatMoney(availablePayout, currency)}</div>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <div className="text-xs text-ui-fg-subtle">Commission Pending</div>
          <div className="text-lg font-semibold">{summaryLoading ? "…" : formatMoney(commissionPending, currency)}</div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setPage(0)
            }}
            placeholder="Search by order ID…"
            className="w-full md:w-[320px]"
          />
          <Button variant="secondary" onClick={clearFilters}>
            Clear
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => window.open(`/admin/earnings/export?${queryString}`, "_blank", "noopener")}
          >
            Export CSV
          </Button>
          <Button variant="secondary" onClick={() => window.open(`/admin/payouts/export`, "_blank", "noopener")}>
            Export Payouts (PDF)
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-white">
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Order ID</Table.HeaderCell>
              <Table.HeaderCell>Business</Table.HeaderCell>
              <Table.HeaderCell>Date</Table.HeaderCell>
              <Table.HeaderCell>Type</Table.HeaderCell>
              <Table.HeaderCell className="text-right">Amount</Table.HeaderCell>
              <Table.HeaderCell>Payment Method</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {loading ? (
              <Table.Row>
                <Table.Cell colSpan={7}>
                  <div className="text-sm text-ui-fg-subtle p-3">Loading…</div>
                </Table.Cell>
              </Table.Row>
            ) : rows.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={7}>
                  <div className="text-sm text-ui-fg-subtle p-3">No earnings found.</div>
                </Table.Cell>
              </Table.Row>
            ) : (
              rows.map((e) => {
                const biz = businessById.get(e.business_id) || null
                const amount = asCents(e.net_amount)
                const amountClass = amount < 0 ? "text-red-600" : "text-green-600"
                const t = typeLabel(e.type)
                const s = statusBadge(e.status)
                const method = (e.metadata?.payment_method ||
                  e.metadata?.payment_provider ||
                  e.metadata?.provider_id ||
                  "-") as string
                return (
                  <Table.Row key={e.id}>
                    <Table.Cell>
                      {e.order_id ? (
                        <button
                          type="button"
                          className="font-mono text-xs underline underline-offset-2"
                          onClick={() => void openOrderDetail(e.order_id!)}
                        >
                          {e.order_id}
                        </button>
                      ) : (
                        <span className="text-ui-fg-subtle">-</span>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center gap-2">
                        <Avatar
                          size="2xsmall"
                          fallback={(biz?.name || "B").slice(0, 1).toUpperCase()}
                          src={biz?.logo_url || undefined}
                        />
                        <div className="text-sm">{biz?.name || e.business_id}</div>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-sm">{e.created_at ? new Date(e.created_at).toLocaleDateString() : "-"}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge color={t.color}>{t.label}</Badge>
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      <span className={`font-medium ${amountClass}`}>{formatMoney(amount, currency)}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-sm">{method || "-"}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge color={s.color}>{s.label}</Badge>
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

      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <Heading level="h2">Payout History</Heading>
          <div className="text-xs text-ui-fg-subtle">{payoutsLoading ? "Loading…" : `${payoutCount} total`}</div>
        </div>
        <div className="rounded-lg border bg-white">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>ID</Table.HeaderCell>
                <Table.HeaderCell>Date Requested</Table.HeaderCell>
                <Table.HeaderCell className="text-right">Amount</Table.HeaderCell>
                <Table.HeaderCell>Method</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell>Arrival</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {payoutsLoading ? (
                <Table.Row>
                  <Table.Cell colSpan={6}>
                    <div className="text-sm text-ui-fg-subtle p-3">Loading…</div>
                  </Table.Cell>
                </Table.Row>
              ) : payouts.length === 0 ? (
                <Table.Row>
                  <Table.Cell colSpan={6}>
                    <div className="text-sm text-ui-fg-subtle p-3">No payouts yet.</div>
                  </Table.Cell>
                </Table.Row>
              ) : (
                payouts.map((p) => (
                  <Table.Row key={p.id}>
                    <Table.Cell>
                      <span className="font-mono text-xs">{p.id}</span>
                    </Table.Cell>
                    <Table.Cell>{p.created_at ? new Date(p.created_at).toLocaleString() : "-"}</Table.Cell>
                    <Table.Cell className="text-right">{formatMoney(asCents(p.amount), currency)}</Table.Cell>
                    <Table.Cell>{payoutMethodLabel(p.method)}</Table.Cell>
                    <Table.Cell>
                      <Badge color={p.status === "completed" ? "green" : p.status === "failed" ? "red" : "blue"}>
                        {p.status}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>{p.arrival_date ? new Date(p.arrival_date).toLocaleDateString() : "-"}</Table.Cell>
                  </Table.Row>
                ))
              )}
            </Table.Body>
          </Table>
        </div>
      </div>

      <Drawer open={filtersOpen} onOpenChange={setFiltersOpen}>
        <Drawer.Content className="max-w-[560px]">
          <Drawer.Header>
            <Drawer.Title>Filters</Drawer.Title>
            <Drawer.Description>Search, business, type, status, and date range.</Drawer.Description>
          </Drawer.Header>
          <Drawer.Body>
            <div className="space-y-6">
              <div>
                <div className="text-xs font-medium mb-2">Business</div>
                <div className="max-h-[220px] overflow-auto rounded border">
                  {(businesses || []).map((b: any) => {
                    const active = selectedBusinessIds.includes(b.id)
                    return (
                      <button
                        key={b.id}
                        type="button"
                        className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${active ? "bg-ui-bg-subtle" : "bg-white"}`}
                        onClick={() => toggleBusiness(b.id)}
                      >
                        <Avatar size="2xsmall" fallback={(b.name || "B").slice(0, 1).toUpperCase()} src={b.logo_url || undefined} />
                        <span className="flex-1">{b.name}</span>
                        <span className="text-xs text-ui-fg-subtle">{active ? "Selected" : ""}</span>
                      </button>
                    )
                  })}
                  {businesses.length === 0 ? <div className="p-3 text-sm text-ui-fg-subtle">No businesses found.</div> : null}
                </div>
                <div className="text-xs text-ui-fg-subtle mt-1">Selected: {selectedBusinessIds.length ? selectedBusinessIds.length : "All"}</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs font-medium mb-2">Type</div>
                  <Select
                    value={type || "__all__"}
                    onValueChange={(v) => setType((v === "__all__" ? "" : v) as any)}
                  >
                    <Select.Trigger>
                      <Select.Value placeholder="All" />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value="__all__">All</Select.Item>
                      <Select.Item value="commission">Commission</Select.Item>
                      <Select.Item value="consult_fee">Consult Fee</Select.Item>
                      <Select.Item value="service_fee">Service Fee</Select.Item>
                    </Select.Content>
                  </Select>
                </div>
                <div>
                  <div className="text-xs font-medium mb-2">Date range</div>
                  <Select
                    value={datePreset || "__all__"}
                    onValueChange={(v) => setDatePreset((v === "__all__" ? "" : v) as any)}
                  >
                    <Select.Trigger>
                      <Select.Value placeholder="Last 30 days" />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value="7">Last 7 days</Select.Item>
                      <Select.Item value="30">Last 30 days</Select.Item>
                      <Select.Item value="90">Last 90 days</Select.Item>
                      <Select.Item value="custom">Custom (set below)</Select.Item>
                      <Select.Item value="__all__">All time</Select.Item>
                    </Select.Content>
                  </Select>
                  {datePreset === "custom" ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                      <Input
                        type="datetime-local"
                        value={dateFrom ? new Date(dateFrom).toISOString().slice(0, 16) : ""}
                        onChange={(e) => setDateFrom(e.target.value ? new Date(e.target.value) : null)}
                        placeholder="From"
                      />
                      <Input
                        type="datetime-local"
                        value={dateTo ? new Date(dateTo).toISOString().slice(0, 16) : ""}
                        onChange={(e) => setDateTo(e.target.value ? new Date(e.target.value) : null)}
                        placeholder="To"
                      />
                    </div>
                  ) : null}
                </div>
              </div>

              <div>
                <div className="text-xs font-medium mb-2">Status</div>
                <div className="flex flex-wrap gap-2">
                  {(["completed", "pending", "paid_out", "refunded"] as PlanEarningStatus[]).map((s) => {
                    const active = status.includes(s)
                    return (
                      <button
                        key={s}
                        type="button"
                        className={`rounded-full border px-3 py-1 text-xs ${active ? "bg-ui-bg-subtle" : "bg-white"}`}
                        onClick={() => toggleStatus(s)}
                      >
                        {active ? "✓ " : ""}{s}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </Drawer.Body>
          <Drawer.Footer className="flex items-center justify-between gap-2">
            <Button variant="secondary" onClick={clearFilters}>
              Clear all
            </Button>
            <Drawer.Close asChild>
              <Button>Done</Button>
            </Drawer.Close>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>

      <Drawer open={payoutOpen} onOpenChange={setPayoutOpen}>
        <Drawer.Content className="max-w-[560px]">
          <Drawer.Header>
            <Drawer.Title>Request payout</Drawer.Title>
            <Drawer.Description>Method: Stripe/ACH/Wire. Amount max = available payout for the selected business.</Drawer.Description>
          </Drawer.Header>
          <Drawer.Body>
            <div className="space-y-4">
              <div className="text-xs text-ui-fg-subtle">
                {selectedBusinessIds.length === 1
                  ? `Business: ${(businessById.get(selectedBusinessIds[0])?.name as string) || selectedBusinessIds[0]}`
                  : "Select exactly one business in Filters to request a payout."}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs font-medium mb-1">Method</div>
                  <Select value={payoutMethod} onValueChange={(v) => setPayoutMethod(v as any)}>
                    <Select.Trigger>
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value="stripe_connect">Stripe</Select.Item>
                      <Select.Item value="ach">ACH</Select.Item>
                      <Select.Item value="wire">Wire</Select.Item>
                    </Select.Content>
                  </Select>
                  <div className="text-xs text-ui-fg-subtle mt-1">Estimated arrival: {estimateArrival(payoutMethod)}</div>
                </div>
                <div>
                  <div className="text-xs font-medium mb-1">Amount (USD)</div>
                  <Input value={payoutAmount} onChange={(e) => setPayoutAmount(e.target.value)} placeholder="0.00" />
                  <div className="text-xs text-ui-fg-subtle mt-1">Max available: {formatMoney(availablePayout, currency)}</div>
                </div>
              </div>

              {payoutMethod === "ach" || payoutMethod === "wire" ? (
                <div>
                  <div className="text-xs font-medium mb-1">Destination account</div>
                  <Input value={destinationAccount} onChange={(e) => setDestinationAccount(e.target.value)} placeholder="Bank account / routing ref" />
                </div>
              ) : null}

              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={confirmPayout} onChange={(e) => setConfirmPayout(e.target.checked)} />
                <span>Are you sure you want to request this payout? This will lock eligible earnings as paid out.</span>
              </label>
            </div>
          </Drawer.Body>
          <Drawer.Footer className="flex items-center justify-end gap-2">
            <Drawer.Close asChild>
              <Button variant="secondary" disabled={creatingPayout}>
                Cancel
              </Button>
            </Drawer.Close>
            <Button disabled={creatingPayout || selectedBusinessIds.length !== 1} onClick={requestPayout}>
              {creatingPayout ? "Requesting…" : "Request payout"}
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>

      <Drawer open={orderOpen} onOpenChange={setOrderOpen}>
        <Drawer.Content className="max-w-[920px]">
          <Drawer.Header>
            <Drawer.Title>Order detail</Drawer.Title>
            <Drawer.Description>{activeOrderId ? activeOrderId : ""}</Drawer.Description>
          </Drawer.Header>
          <Drawer.Body>
            {orderLoading ? (
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
                  </div>
                  <Badge color={(activeOrder.plan_status === "delivered" && "grey") || "blue"}>
                    {activeOrder.plan_status || "—"}
                  </Badge>
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
                  </div>
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
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Earnings",
})

export default EarningsPage
