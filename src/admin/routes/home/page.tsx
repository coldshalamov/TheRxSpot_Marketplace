import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Badge,
  Button,
  Container,
  Drawer,
  Heading,
  Toaster,
  toast,
  DatePicker,
} from "@medusajs/ui"
import { format, formatDistanceToNowStrict, isValid } from "date-fns"
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useNavigate } from "react-router-dom"

type DashboardHomeResponse = {
  generated_at: string
  metrics: {
    total_businesses: { value: number; change_pct: number | null }
    active_consultations: { value: number }
    pending_reviews: { value: number }
    revenue_this_month: {
      gross_cents: number
      platform_commission_cents: number
    }
    orders_in_progress: { value: number }
  }
  activity: {
    logs: Array<{
      id: string
      created_at?: string
      actor_email?: string | null
      actor_id: string
      action: string
      entity_type: string
      entity_id: string
      business_id?: string | null
    }>
  }
  charts: {
    revenue_trend_30d: {
      points: Array<{
        date: string
        gross_cents: number
        platform_commission_cents: number
      }>
    }
    consultations_by_status: {
      segments: Array<{ status: string; count: number }>
    }
    orders_by_business_top10: {
      bars: Array<{ business_id: string; business_name: string; count: number }>
    }
  }
}

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

const integer = new Intl.NumberFormat("en-US")

function formatCents(cents: number): string {
  return money.format((cents || 0) / 100)
}

function safeRelativeDate(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  if (!isValid(date)) return null
  try {
    return formatDistanceToNowStrict(date, { addSuffix: true })
  } catch {
    return null
  }
}

function safeTimestamp(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (!isValid(date)) return "—"
  try {
    return format(date, "MMM d, h:mm a")
  } catch {
    return "—"
  }
}

function actionColor(action: string): "green" | "blue" | "red" | "grey" {
  if (action === "create") return "green"
  if (action === "update") return "blue"
  if (action === "delete") return "red"
  return "grey"
}

function buildEntityHref(log: {
  entity_type: string
  entity_id: string
  business_id?: string | null
}): string | null {
  const id = log.entity_id
  switch (log.entity_type) {
    case "business":
      return `/businesses/${id}`
    case "order":
      return `/orders/${id}`
    case "consultation":
      return `/consultations/${id}`
    case "document":
      return `/documents/${id}`
    case "patient":
      return `/patients/${id}`
    case "earning":
      return `/earnings`
    case "payout":
      return `/payouts`
    default:
      return null
  }
}

function MetricCard(props: {
  title: string
  value: ReactNode
  hint?: ReactNode
  badge?: ReactNode
}) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="text-ui-fg-subtle text-xs font-medium">
          {props.title}
        </div>
        {props.badge}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">
        {props.value}
      </div>
      {props.hint ? (
        <div className="mt-1 text-xs text-ui-fg-subtle">{props.hint}</div>
      ) : null}
    </div>
  )
}

function SvgLineChart(props: {
  title: string
  points: Array<{ date: string; gross: number; platform: number }>
}) {
  const width = 640
  const height = 200
  const paddingX = 24
  const paddingY = 18

  const max = Math.max(
    1,
    ...props.points.map((p) => Math.max(p.gross, p.platform))
  )

  const toX = (i: number) => {
    const n = Math.max(2, props.points.length)
    return (
      paddingX + (i * (width - paddingX * 2)) / (n - 1)
    )
  }

  const toY = (value: number) => {
    const usable = height - paddingY * 2
    return height - paddingY - (value / max) * usable
  }

  const linePath = (key: "gross" | "platform") => {
    if (!props.points.length) return ""
    const d = props.points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(p[key])}`)
      .join(" ")
    return d
  }

  const last = props.points[props.points.length - 1]
  const first = props.points[0]
  const rangeLabel =
    first && last ? `${first.date} → ${last.date}` : "Last 30 days"

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <div className="text-sm font-medium">{props.title}</div>
          <div className="text-xs text-ui-fg-subtle">{rangeLabel}</div>
        </div>
        <div className="flex gap-2 text-xs text-ui-fg-subtle">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-violet-500" />
            Gross
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-teal-500" />
            Commission
          </span>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Revenue trend line chart"
        >
          <defs>
            <linearGradient id="gross" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
            </linearGradient>
          </defs>

          <line
            x1={paddingX}
            y1={height - paddingY}
            x2={width - paddingX}
            y2={height - paddingY}
            stroke="#e5e7eb"
          />

          <path
            d={`${linePath("gross")} L ${toX(props.points.length - 1)} ${height - paddingY} L ${toX(
              0
            )} ${height - paddingY} Z`}
            fill="url(#gross)"
          />

          <path
            d={linePath("gross")}
            fill="none"
            stroke="#8b5cf6"
            strokeWidth="2"
          />
          <path
            d={linePath("platform")}
            fill="none"
            stroke="#14b8a6"
            strokeWidth="2"
            strokeDasharray="6 4"
          />
        </svg>
      </div>
    </div>
  )
}

function SvgPieChart(props: {
  title: string
  segments: Array<{ label: string; value: number; color: string }>
}) {
  const size = 200
  const r = 78
  const cx = size / 2
  const cy = size / 2
  const total = props.segments.reduce((s, x) => s + x.value, 0)

  const arcs = useMemo(() => {
    if (!total) return []
    let a0 = -Math.PI / 2
    return props.segments
      .filter((s) => s.value > 0)
      .map((s) => {
        const slice = (s.value / total) * Math.PI * 2
        const a1 = a0 + slice

        const x0 = cx + r * Math.cos(a0)
        const y0 = cy + r * Math.sin(a0)
        const x1 = cx + r * Math.cos(a1)
        const y1 = cy + r * Math.sin(a1)
        const large = slice > Math.PI ? 1 : 0

        const d = [
          `M ${cx} ${cy}`,
          `L ${x0} ${y0}`,
          `A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`,
          "Z",
        ].join(" ")

        a0 = a1
        return { ...s, d }
      })
  }, [total, props.segments])

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="text-sm font-medium">{props.title}</div>
      <div className="mt-3 flex items-center gap-4">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label="Consultations by status pie chart"
        >
          {total === 0 ? (
            <>
              <circle cx={cx} cy={cy} r={r} fill="#f3f4f6" />
              <text
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#6b7280"
                fontSize="12"
              >
                No data
              </text>
            </>
          ) : (
            arcs.map((a) => (
              <path key={a.label} d={a.d} fill={a.color} />
            ))
          )}
        </svg>

        <div className="min-w-[180px] space-y-2">
          {props.segments.map((s) => (
            <div key={s.label} className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-ui-fg-subtle">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: s.color }}
                />
                <span className="capitalize">{s.label}</span>
              </div>
              <div className="font-medium">{integer.format(s.value)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SvgBarChart(props: {
  title: string
  bars: Array<{ label: string; value: number }>
}) {
  const max = Math.max(1, ...props.bars.map((b) => b.value))
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="text-sm font-medium">{props.title}</div>
      <div className="mt-3 space-y-2">
        {props.bars.length === 0 ? (
          <div className="text-xs text-ui-fg-subtle">No data</div>
        ) : (
          props.bars.map((b) => (
            <div key={b.label} className="grid grid-cols-[1fr_56px] gap-3 items-center">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate text-xs text-ui-fg-subtle">{b.label}</div>
                </div>
                <div className="mt-1 h-2 rounded-full bg-gray-100">
                  <div
                    className="h-2 rounded-full bg-indigo-500"
                    style={{ width: `${(b.value / max) * 100}%` }}
                  />
                </div>
              </div>
              <div className="text-right text-xs font-medium">{integer.format(b.value)}</div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

const HomePage = () => {
  const navigate = useNavigate()
  const [data, setData] = useState<DashboardHomeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportFrom, setReportFrom] = useState<Date | null>(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return d
  })
  const [reportTo, setReportTo] = useState<Date | null>(() => new Date())
  const inFlight = useRef(false)

  const fetchHome = async () => {
    if (inFlight.current) return
    inFlight.current = true
    try {
      const res = await fetch("/admin/dashboard/home", {
        credentials: "include",
      })
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(text || `HTTP ${res.status}`)
      }
      const json = (await res.json()) as DashboardHomeResponse
      setData(json)
    } catch (e) {
      toast.error("Failed to load dashboard", {
        description:
          e instanceof Error ? e.message : "Unknown error",
      })
    } finally {
      setLoading(false)
      inFlight.current = false
    }
  }

  useEffect(() => {
    fetchHome()
    const t = setInterval(fetchHome, 30_000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const lastUpdated = safeRelativeDate(data?.generated_at)

  const metrics = data?.metrics

  const revenuePoints = (data?.charts?.revenue_trend_30d?.points || []).map(
    (p) => ({
      date: p.date,
      gross: p.gross_cents,
      platform: p.platform_commission_cents,
    })
  )

  const consultSegmentsRaw = data?.charts?.consultations_by_status?.segments || []
  const consultSegments = [
    { label: "pending", value: consultSegmentsRaw.find((s) => s.status === "pending")?.count || 0, color: "#64748b" },
    { label: "scheduled", value: consultSegmentsRaw.find((s) => s.status === "scheduled")?.count || 0, color: "#0ea5e9" },
    { label: "completed", value: consultSegmentsRaw.find((s) => s.status === "completed")?.count || 0, color: "#f59e0b" },
    { label: "approved", value: consultSegmentsRaw.find((s) => s.status === "approved")?.count || 0, color: "#22c55e" },
    { label: "rejected", value: consultSegmentsRaw.find((s) => s.status === "rejected")?.count || 0, color: "#ef4444" },
  ]

  const orderBars = (data?.charts?.orders_by_business_top10?.bars || [])
    .slice()
    .sort((a, b) => b.count - a.count)
    .map((b) => ({
      label: b.business_name || b.business_id,
      value: b.count,
    }))

  const exportActivityCsv = async () => {
    if (!reportFrom || !reportTo) {
      toast.error("Select a date range first")
      return
    }
    const from = new Date(reportFrom)
    from.setHours(0, 0, 0, 0)
    const to = new Date(reportTo)
    to.setHours(23, 59, 59, 999)

    try {
      const url = `/admin/audit-logs?limit=200&date_from=${encodeURIComponent(
        from.toISOString()
      )}&date_to=${encodeURIComponent(to.toISOString())}`
      const res = await fetch(url, { credentials: "include" })
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(text || `HTTP ${res.status}`)
      }
      const json = await res.json()
      const rows = (json.logs || []) as any[]

      const header = [
        "timestamp",
        "actor_email",
        "actor_id",
        "action",
        "entity_type",
        "entity_id",
        "business_id",
      ]
      const lines = [header.join(",")]
      for (const r of rows) {
        const values = [
          r.created_at || "",
          r.actor_email || "",
          r.actor_id || "",
          r.action || "",
          r.entity_type || "",
          r.entity_id || "",
          r.business_id || "",
        ].map((v) => `"${String(v).replace(/\"/g, '""')}"`)
        lines.push(values.join(","))
      }

      const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" })
      const link = document.createElement("a")
      link.href = URL.createObjectURL(blob)
      link.download = `audit_logs_${from.toISOString().slice(0, 10)}_${to
        .toISOString()
        .slice(0, 10)}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()

      toast.success("Report generated", {
        description: "Downloaded audit logs CSV (up to 200 rows).",
      })
      setReportOpen(false)
    } catch (e) {
      toast.error("Failed to generate report", {
        description: e instanceof Error ? e.message : "Unknown error",
      })
    }
  }

  return (
    <Container>
      <Toaster />

      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <Heading level="h1">Home</Heading>
          <div className="mt-1 text-xs text-ui-fg-subtle">
            {lastUpdated ? `Updated ${lastUpdated}` : "Live metrics (polling every 30s)"}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => fetchHome()}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        <MetricCard
          title="Total Businesses"
          value={loading ? "—" : integer.format(metrics?.total_businesses.value || 0)}
          badge={
            !metrics || metrics.total_businesses.change_pct == null ? (
              <Badge color="grey">—</Badge>
            ) : (
              <Badge color={metrics.total_businesses.change_pct >= 0 ? "green" : "red"}>
                {metrics.total_businesses.change_pct >= 0 ? "+" : ""}
                {metrics.total_businesses.change_pct}%
              </Badge>
            )
          }
          hint="Change vs last month"
        />
        <MetricCard
          title="Active Consultations"
          value={loading ? "—" : integer.format(metrics?.active_consultations.value || 0)}
          hint="Scheduled today"
        />
        <MetricCard
          title="Pending Reviews"
          value={loading ? "—" : integer.format(metrics?.pending_reviews.value || 0)}
          hint="Awaiting approval"
        />
        <MetricCard
          title="Revenue This Month"
          value={
            loading
              ? "—"
              : formatCents(metrics?.revenue_this_month.gross_cents || 0)
          }
          hint={
            loading
              ? null
              : `Commission ${formatCents(
                  metrics?.revenue_this_month.platform_commission_cents || 0
                )}`
          }
        />
        <MetricCard
          title="Orders In Progress"
          value={loading ? "—" : integer.format(metrics?.orders_in_progress.value || 0)}
          hint="In production + shipped"
        />
      </div>

      {/* Quick Actions */}
      <div className="mt-6 rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Quick actions</div>
            <div className="text-xs text-ui-fg-subtle">
              Jump to common workflows
            </div>
          </div>
          <Drawer open={reportOpen} onOpenChange={setReportOpen}>
            <Drawer.Content className="w-full max-w-xl">
              <Drawer.Header>
                <Drawer.Title>Generate report</Drawer.Title>
                <Drawer.Description>
                  Exports audit logs to CSV for the selected range (max 200 rows).
                </Drawer.Description>
              </Drawer.Header>
              <Drawer.Body>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs font-medium mb-1">From</div>
                    <DatePicker value={reportFrom} onChange={setReportFrom} />
                  </div>
                  <div>
                    <div className="text-xs font-medium mb-1">To</div>
                    <DatePicker value={reportTo} onChange={setReportTo} />
                  </div>
                </div>
              </Drawer.Body>
              <Drawer.Footer className="flex items-center justify-end gap-2">
                <Drawer.Close asChild>
                  <Button variant="secondary">Cancel</Button>
                </Drawer.Close>
                <Button onClick={exportActivityCsv}>Generate CSV</Button>
              </Drawer.Footer>
            </Drawer.Content>
          </Drawer>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => navigate("/businesses/new")}>
            Create Business
          </Button>
          <Button variant="secondary" onClick={() => navigate("/consultations/new")}>
            Schedule Consultation
          </Button>
          <Button variant="secondary" onClick={() => navigate("/earnings")}>
            View Earnings
          </Button>
          <Button variant="secondary" onClick={() => setReportOpen(true)}>
            Generate Report
          </Button>
        </div>
      </div>

      {/* Charts + Activity */}
      <div className="mt-6 grid grid-cols-1 xl:grid-cols-3 gap-3">
        <div className="xl:col-span-2">
          <SvgLineChart title="Revenue trend" points={revenuePoints} />
        </div>
        <SvgPieChart title="Consultations by status" segments={consultSegments} />
      </div>

      <div className="mt-3 grid grid-cols-1 xl:grid-cols-3 gap-3">
        <div className="xl:col-span-2">
          <SvgBarChart title="Orders by business (top 10)" bars={orderBars} />
        </div>

        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <div className="text-sm font-medium">Recent activity</div>
              <div className="text-xs text-ui-fg-subtle">
                Last 20 events from audit logs
              </div>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {loading ? (
              <div className="text-xs text-ui-fg-subtle">Loading…</div>
            ) : (data?.activity.logs || []).length === 0 ? (
              <div className="text-xs text-ui-fg-subtle">No activity yet.</div>
            ) : (
              (data?.activity.logs || []).slice(0, 20).map((log) => {
                const who = (log.actor_email || "").trim() || log.actor_id
                const href = buildEntityHref(log)

                return (
                  <button
                    key={log.id}
                    type="button"
                    onClick={() => {
                      if (!href) return
                      navigate(href)
                    }}
                    className={`w-full text-left rounded-lg border px-3 py-2 transition ${
                      href ? "hover:bg-gray-50" : "opacity-80"
                    }`}
                    disabled={!href}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge color={actionColor(log.action)}>{log.action}</Badge>
                        <div className="truncate text-xs">
                          <span className="font-medium">{who}</span>
                          <span className="text-ui-fg-subtle">
                            {" "}
                            · {log.entity_type}
                          </span>
                        </div>
                      </div>
                      <div className="text-[11px] text-ui-fg-subtle whitespace-nowrap">
                        {safeTimestamp(log.created_at)}
                      </div>
                    </div>
                    <div className="mt-1 text-[11px] text-ui-fg-subtle">
                      {log.entity_id}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Home",
})

export default HomePage
