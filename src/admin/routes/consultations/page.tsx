import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Avatar,
  Badge,
  Button,
  Container,
  Copy,
  DatePicker,
  Drawer,
  Heading,
  Input,
  Select,
  Table,
  Toaster,
  toast,
} from "@medusajs/ui"
import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"

type PlanStatus = "pending" | "scheduled" | "completed" | "approved" | "rejected"
type PlanMode = "video" | "audio" | "form"
type PlanType = "initial" | "follow-up"

type ConsultationRow = {
  id: string
  business_id: string
  order_id: string | null
  scheduled_at: string | null
  updated_at: string | null
  plan_status: PlanStatus
  mode: PlanMode
  type: PlanType
  state: string | null
  patient: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string | null
    phone: string | null
  } | null
  clinician: {
    id: string
    first_name: string | null
    last_name: string | null
    status?: string | null
  } | null
  business: {
    id: string
    name: string
    logo_url?: string | null
  } | null
  product: {
    id: string
    title: string
    handle?: string | null
  } | null
}

type ConsultationsListResponse = {
  consultations: ConsultationRow[]
  count: number
  limit: number
  offset: number
}

const LIMIT = 25

function stableDisplayNumber(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  }
  const num = hash % 1000000
  return String(num).padStart(6, "0")
}

function consultationDisplayId(id: string): string {
  return `CO-${stableDisplayNumber(id)}`
}

function statusBadge(status: PlanStatus): { color: "grey" | "blue" | "green" | "orange" | "red"; label: string } {
  if (status === "pending") return { color: "orange", label: "Pending" }
  if (status === "scheduled") return { color: "blue", label: "Scheduled" }
  if (status === "completed") return { color: "grey", label: "Completed" }
  if (status === "approved") return { color: "green", label: "Approved" }
  return { color: "red", label: "Rejected" }
}

function modeBadge(mode: PlanMode): { color: "grey" | "blue" | "orange"; label: string } {
  if (mode === "video") return { color: "blue", label: "Video" }
  if (mode === "audio") return { color: "orange", label: "Audio" }
  return { color: "grey", label: "Form" }
}

function ModeIcon({ mode }: { mode: PlanMode }) {
  const cls = "h-3.5 w-3.5 shrink-0"

  if (mode === "video") {
    return (
      <svg className={cls} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h6A2.5 2.5 0 0 1 14 6.5v7A2.5 2.5 0 0 1 11.5 16h-6A2.5 2.5 0 0 1 3 13.5v-7Z" />
        <path d="M14.5 8.1 18 6.3v7.4l-3.5-1.8V8.1Z" />
      </svg>
    )
  }

  if (mode === "audio") {
    return (
      <svg className={cls} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M10 2.5a3.5 3.5 0 0 0-3.5 3.5v4a3.5 3.5 0 1 0 7 0V6A3.5 3.5 0 0 0 10 2.5Z" />
        <path d="M4.5 9.5a.75.75 0 0 1 .75.75 4.75 4.75 0 1 0 9.5 0 .75.75 0 0 1 1.5 0 6.25 6.25 0 0 1-5.5 6.2v1.05h2a.75.75 0 0 1 0 1.5h-5.5a.75.75 0 0 1 0-1.5h2V16.45a6.25 6.25 0 0 1-5.5-6.2.75.75 0 0 1 .75-.75Z" />
      </svg>
    )
  }

  return (
    <svg className={cls} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M6 2.5A1.5 1.5 0 0 0 4.5 4v12A1.5 1.5 0 0 0 6 17.5h8A1.5 1.5 0 0 0 15.5 16V4A1.5 1.5 0 0 0 14 2.5H6Zm1.5 4.25a.75.75 0 0 1 .75-.75h3.5a.75.75 0 0 1 0 1.5h-3.5a.75.75 0 0 1-.75-.75Zm0 3a.75.75 0 0 1 .75-.75h5.5a.75.75 0 0 1 0 1.5h-5.5a.75.75 0 0 1-.75-.75Zm0 3a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1-.75-.75Z" />
    </svg>
  )
}

function formatDateTime(value?: string | null): string {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, { timeZoneName: "short" })
}

const ConsultationsPage = () => {
  const navigate = useNavigate()

  const [rows, setRows] = useState<ConsultationRow[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const [q, setQ] = useState("")
  const [status, setStatus] = useState<PlanStatus[]>([])
  const [mode, setMode] = useState<PlanMode[]>([])
  const [type, setType] = useState<PlanType | "">("")
  const [businessId, setBusinessId] = useState("")
  const [stateFilter, setStateFilter] = useState("")
  const [dateFrom, setDateFrom] = useState<Date | null>(null)
  const [dateTo, setDateTo] = useState<Date | null>(null)

  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const [filterOpen, setFilterOpen] = useState(false)

  const [assignOpen, setAssignOpen] = useState(false)
  const [assignClinicianId, setAssignClinicianId] = useState("")
  const [clinicians, setClinicians] = useState<any[]>([])
  const [cliniciansLoading, setCliniciansLoading] = useState(false)

  const [businesses, setBusinesses] = useState<any[]>([])

  const fetchAbort = useRef<AbortController | null>(null)

  const offset = page * LIMIT
  const totalPages = Math.max(1, Math.ceil(count / LIMIT))

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    params.set("limit", String(LIMIT))
    params.set("offset", String(offset))
    if (q.trim()) params.set("q", q.trim())
    if (status.length) params.set("status", status.join(","))
    if (mode.length) params.set("mode", mode.join(","))
    if (type) params.set("type", type)
    if (businessId) params.set("business_id", businessId)
    if (stateFilter.trim()) params.set("state", stateFilter.trim().toUpperCase())
    if (dateFrom) params.set("date_from", dateFrom.toISOString())
    if (dateTo) params.set("date_to", dateTo.toISOString())
    return params.toString()
  }, [businessId, dateFrom, dateTo, mode, offset, q, stateFilter, status, type])

  const fetchBusinesses = async () => {
    try {
      const res = await fetch(`/admin/businesses`, { credentials: "include" })
      if (!res.ok) return
      const json = await res.json()
      setBusinesses(json.businesses || [])
    } catch {
      // best-effort
    }
  }

  const fetchConsultations = async () => {
    fetchAbort.current?.abort()
    const controller = new AbortController()
    fetchAbort.current = controller

    setLoading(true)
    try {
      const res = await fetch(`/admin/custom/consultations?${queryString}`, {
        credentials: "include",
        signal: controller.signal,
      })
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(text || `HTTP ${res.status}`)
      }
      const json = (await res.json()) as ConsultationsListResponse
      setRows(json.consultations || [])
      setCount(json.count || 0)
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return
      toast.error("Failed to load consultations", {
        description: e instanceof Error ? e.message : "Unknown error",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBusinesses()
  }, [])

  useEffect(() => {
    fetchConsultations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString])

  useEffect(() => {
    setPage(0)
    setSelected(new Set())
  }, [q, status, mode, type, businessId, stateFilter, dateFrom, dateTo])

  const allOnPageSelected = rows.length > 0 && rows.every((r) => selected.has(r.id))

  const toggleAllOnPage = (checked: boolean) => {
    const next = new Set(selected)
    for (const r of rows) {
      if (checked) next.add(r.id)
      else next.delete(r.id)
    }
    setSelected(next)
  }

  const toggleOne = (id: string, checked: boolean) => {
    const next = new Set(selected)
    if (checked) next.add(id)
    else next.delete(id)
    setSelected(next)
  }

  const loadClinicians = async (effectiveBusinessId: string | null) => {
    setCliniciansLoading(true)
    try {
      const params = new URLSearchParams()
      if (effectiveBusinessId) params.set("business_id", effectiveBusinessId)
      params.set("status", "active")
      params.set("limit", "100")
      params.set("offset", "0")

      const res = await fetch(`/admin/clinicians?${params.toString()}`, {
        credentials: "include",
      })
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(text || `HTTP ${res.status}`)
      }
      const json = await res.json()
      setClinicians(json.clinicians || [])
    } catch (e) {
      toast.error("Failed to load clinicians", {
        description: e instanceof Error ? e.message : "Unknown error",
      })
      setClinicians([])
    } finally {
      setCliniciansLoading(false)
    }
  }

  const selectedRows = rows.filter((r) => selected.has(r.id))
  const selectedBusinessIds = Array.from(new Set(selectedRows.map((r) => r.business_id)))
  const canBulkAssign = selected.size > 0 && selectedBusinessIds.length <= 1
  const bulkAssignBusinessId = selectedBusinessIds.length === 1 ? selectedBusinessIds[0] : null

  const openAssign = async () => {
    if (!canBulkAssign) {
      toast.error("Bulk assign requires selections from one business", {
        description: "Select consultations belonging to a single business.",
      })
      return
    }
    setAssignClinicianId("")
    setAssignOpen(true)
    await loadClinicians(bulkAssignBusinessId)
  }

  const assignSelected = async () => {
    const ids = Array.from(selected)
    if (!ids.length) return
    const clinicianId = assignClinicianId.trim()
    if (!clinicianId) {
      toast.error("Choose a clinician to assign")
      return
    }

    try {
      let ok = 0
      for (const id of ids) {
        const res = await fetch(`/admin/consultations/${encodeURIComponent(id)}/assign`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ clinician_id: clinicianId }),
        })
        if (res.ok) ok += 1
        else {
          const text = await res.text().catch(() => "")
          throw new Error(text || `Assign failed for ${id}`)
        }
      }
      toast.success("Assigned clinician", { description: `${ok} consultation(s) updated.` })
      setAssignOpen(false)
      setSelected(new Set())
      await fetchConsultations()
    } catch (e) {
      toast.error("Failed to assign clinician", {
        description: e instanceof Error ? e.message : "Unknown error",
      })
    }
  }

  const exportPdf = () => {
    const params = new URLSearchParams()
    if (selected.size > 0) {
      params.set("ids", Array.from(selected).join(","))
    } else {
      if (q.trim()) params.set("q", q.trim())
      if (status.length) params.set("status", status.join(","))
      if (mode.length) params.set("mode", mode.join(","))
      if (type) params.set("type", type)
      if (businessId) params.set("business_id", businessId)
      if (stateFilter.trim()) params.set("state", stateFilter.trim().toUpperCase())
      if (dateFrom) params.set("date_from", dateFrom.toISOString())
      if (dateTo) params.set("date_to", dateTo.toISOString())
    }

    const url = `/admin/custom/consultations/export?${params.toString()}`
    window.open(url, "_blank", "noopener,noreferrer")
  }

  const updateStatus = async (id: string, next: PlanStatus, reason?: string) => {
    try {
      const res = await fetch(`/admin/consultations/${encodeURIComponent(id)}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: next, reason }),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(text || `HTTP ${res.status}`)
      }
      toast.success("Status updated")
      await fetchConsultations()
    } catch (e) {
      toast.error("Failed to update status", {
        description: e instanceof Error ? e.message : "Unknown error",
      })
    }
  }

  const clearFilters = () => {
    setQ("")
    setStatus([])
    setMode([])
    setType("")
    setBusinessId("")
    setStateFilter("")
    setDateFrom(null)
    setDateTo(null)
  }

  const toggleSetValue = <T,>(values: T[], value: T): T[] => {
    const set = new Set(values as any)
    if (set.has(value as any)) set.delete(value as any)
    else set.add(value as any)
    return Array.from(set) as any
  }

  return (
    <Container>
      <Toaster />
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <Heading level="h1">Consultations</Heading>
          <div className="text-xs text-ui-fg-subtle">
            {count} result{count === 1 ? "" : "s"}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => setFilterOpen(true)}>
            Filters
          </Button>
          <Button variant="secondary" onClick={exportPdf}>
            Export PDF
          </Button>
          <Button variant="secondary" disabled={!canBulkAssign} onClick={openAssign}>
            Bulk assign
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2 mb-4">
        <div className="w-[320px]">
          <div className="text-xs font-medium mb-1">Search</div>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Client name, clinician name, order ID…"
          />
        </div>
        <div className="w-[240px]">
          <div className="text-xs font-medium mb-1">Business</div>
          <Select value={businessId} onValueChange={setBusinessId}>
            <Select.Trigger>
              <Select.Value placeholder="All businesses" />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="">All businesses</Select.Item>
              {businesses.map((b: any) => (
                <Select.Item key={b.id} value={b.id}>
                  {b.name}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>
        <div className="w-[170px]">
          <div className="text-xs font-medium mb-1">State</div>
          <Input value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} placeholder="e.g. FL" />
        </div>
        <div className="w-[200px]">
          <div className="text-xs font-medium mb-1">Scheduled from</div>
          <DatePicker value={dateFrom} onChange={setDateFrom} />
        </div>
        <div className="w-[200px]">
          <div className="text-xs font-medium mb-1">Scheduled to</div>
          <DatePicker value={dateTo} onChange={setDateTo} />
        </div>
        <Button variant="secondary" onClick={clearFilters}>
          Clear
        </Button>
      </div>

      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>
              <input
                type="checkbox"
                checked={allOnPageSelected}
                onChange={(e) => toggleAllOnPage(e.target.checked)}
                aria-label="Select all on page"
              />
            </Table.HeaderCell>
            <Table.HeaderCell>ID</Table.HeaderCell>
            <Table.HeaderCell>Client</Table.HeaderCell>
            <Table.HeaderCell>Provider</Table.HeaderCell>
            <Table.HeaderCell>Business</Table.HeaderCell>
            <Table.HeaderCell>Scheduled</Table.HeaderCell>
            <Table.HeaderCell>State</Table.HeaderCell>
            <Table.HeaderCell>Status</Table.HeaderCell>
            <Table.HeaderCell>Mode</Table.HeaderCell>
            <Table.HeaderCell>Product</Table.HeaderCell>
            <Table.HeaderCell>Type</Table.HeaderCell>
            <Table.HeaderCell>Actions</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {loading ? (
            <Table.Row>
              <Table.Cell colSpan={12}>
                <div className="text-sm text-ui-fg-subtle">Loading…</div>
              </Table.Cell>
            </Table.Row>
          ) : rows.length === 0 ? (
            <Table.Row>
              <Table.Cell colSpan={12}>
                <div className="text-sm text-ui-fg-subtle">No consultations found.</div>
              </Table.Cell>
            </Table.Row>
          ) : (
            rows.map((r) => {
              const patientName =
                [r.patient?.first_name, r.patient?.last_name].filter(Boolean).join(" ") || "-"
              const clinicianName =
                [r.clinician?.first_name, r.clinician?.last_name].filter(Boolean).join(" ") ||
                "Unassigned"
              const businessName = r.business?.name || r.business_id
              const st = statusBadge(r.plan_status)
              const md = modeBadge(r.mode)
              const canApprove = r.plan_status === "completed"
              const canReject = r.plan_status === "completed"

              return (
                <Table.Row key={r.id}>
                  <Table.Cell>
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={(e) => toggleOne(r.id, e.target.checked)}
                      aria-label={`Select ${r.id}`}
                    />
                  </Table.Cell>
                  <Table.Cell>
                    <button
                      className="text-ui-fg-interactive hover:underline inline-flex items-center gap-1"
                      onClick={() => navigate(`/consultations/${r.id}`)}
                    >
                      {consultationDisplayId(r.id)}
                      <Copy content={r.id} />
                    </button>
                  </Table.Cell>
                  <Table.Cell>
                    <button
                      className="text-ui-fg-interactive hover:underline"
                      onClick={() => {
                        const email = (r.patient?.email || "").trim()
                        navigate(`/users${email ? `?q=${encodeURIComponent(email)}` : ""}`)
                      }}
                    >
                      {patientName}
                    </button>
                    <div className="text-xs text-ui-fg-subtle">{r.patient?.email || ""}</div>
                  </Table.Cell>
                  <Table.Cell>{clinicianName}</Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center gap-2">
                      {r.business?.logo_url ? (
                        <Avatar src={r.business.logo_url} fallback={businessName?.slice(0, 2) || "B"} />
                      ) : (
                        <Avatar fallback={businessName?.slice(0, 2) || "B"} />
                      )}
                      <div className="text-sm">{businessName}</div>
                    </div>
                  </Table.Cell>
                  <Table.Cell>{formatDateTime(r.scheduled_at)}</Table.Cell>
                  <Table.Cell>{r.state || "—"}</Table.Cell>
                  <Table.Cell>
                    <Badge color={st.color}>{st.label}</Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge color={md.color}>
                      <span className="inline-flex items-center gap-1">
                        <ModeIcon mode={r.mode} />
                        {md.label}
                      </span>
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    {r.product?.id ? (
                      <button
                        className="text-ui-fg-interactive hover:underline"
                        onClick={() => navigate(`/products/${r.product!.id}`)}
                      >
                        {r.product?.title || r.product.id}
                      </button>
                    ) : (
                      <span className="text-ui-fg-subtle">—</span>
                    )}
                  </Table.Cell>
                  <Table.Cell>{r.type === "initial" ? "Initial" : "Follow-up"}</Table.Cell>
                  <Table.Cell>
                    <div className="flex flex-wrap gap-1">
                      <Button size="small" variant="secondary" onClick={() => navigate(`/consultations/${r.id}`)}>
                        View
                      </Button>
                      <Button
                        size="small"
                        variant="secondary"
                        onClick={async () => {
                          setSelected(new Set([r.id]))
                          setAssignOpen(true)
                          setAssignClinicianId("")
                          await loadClinicians(r.business_id)
                        }}
                      >
                        Assign
                      </Button>
                      <Button
                        size="small"
                        variant="secondary"
                        disabled={!canApprove}
                        onClick={() => updateStatus(r.id, "approved")}
                      >
                        Approve
                      </Button>
                      <Button
                        size="small"
                        variant="danger"
                        disabled={!canReject}
                        onClick={() => {
                          const reason = window.prompt("Rejection reason (required):") || ""
                          if (!reason.trim()) {
                            toast.error("Rejection reason is required")
                            return
                          }
                          updateStatus(r.id, "rejected", reason.trim())
                        }}
                      >
                        Reject
                      </Button>
                    </div>
                  </Table.Cell>
                </Table.Row>
              )
            })
          )}
        </Table.Body>
      </Table>

      <div className="flex items-center justify-between mt-4">
        <div className="text-xs text-ui-fg-subtle">
          Page {page + 1} / {totalPages}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            Previous
          </Button>
          <Button
            variant="secondary"
            disabled={page + 1 >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          >
            Next
          </Button>
        </div>
      </div>

      <Drawer open={filterOpen} onOpenChange={setFilterOpen}>
        <Drawer.Content className="max-w-[520px]">
          <Drawer.Header>
            <Drawer.Title>Filters</Drawer.Title>
            <Drawer.Description>Multi-select filters from PLAN.</Drawer.Description>
          </Drawer.Header>
          <Drawer.Body>
            <div className="space-y-6">
              <div>
                <div className="text-xs font-medium mb-2">Status</div>
                <div className="flex flex-wrap gap-2">
                  {(["pending", "scheduled", "completed", "approved", "rejected"] as PlanStatus[]).map((s) => {
                    const active = status.includes(s)
                    const b = statusBadge(s)
                    return (
                      <button
                        key={s}
                        className={`rounded-full border px-3 py-1 text-xs ${active ? "bg-ui-bg-subtle" : "bg-white"}`}
                        onClick={() => setStatus((prev) => toggleSetValue(prev, s))}
                        type="button"
                      >
                        <span className="inline-flex items-center gap-2">
                          <Badge color={b.color}>{b.label}</Badge>
                          {active ? "Included" : "Excluded"}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <div className="text-xs font-medium mb-2">Mode</div>
                <div className="flex flex-wrap gap-2">
                  {(["video", "audio", "form"] as PlanMode[]).map((m) => {
                    const active = mode.includes(m)
                    const b = modeBadge(m)
                    return (
                      <button
                        key={m}
                        className={`rounded-full border px-3 py-1 text-xs ${active ? "bg-ui-bg-subtle" : "bg-white"}`}
                        onClick={() => setMode((prev) => toggleSetValue(prev, m))}
                        type="button"
                      >
                        <span className="inline-flex items-center gap-2">
                          <Badge color={b.color}>{b.label}</Badge>
                          <span className="text-ui-fg-subtle">
                            <ModeIcon mode={m} />
                          </span>
                          {active ? "Included" : "Excluded"}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <div className="text-xs font-medium mb-2">Type</div>
                <Select value={type} onValueChange={(v) => setType(v as any)}>
                  <Select.Trigger>
                    <Select.Value placeholder="All" />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="">All</Select.Item>
                    <Select.Item value="initial">Initial</Select.Item>
                    <Select.Item value="follow-up">Follow-up</Select.Item>
                  </Select.Content>
                </Select>
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

      <Drawer open={assignOpen} onOpenChange={setAssignOpen}>
        <Drawer.Content className="max-w-[520px]">
          <Drawer.Header>
            <Drawer.Title>Assign clinician</Drawer.Title>
            <Drawer.Description>
              {selected.size} selected. {canBulkAssign ? "" : "Selections must be within one business."}
            </Drawer.Description>
          </Drawer.Header>
          <Drawer.Body>
            <div className="space-y-3">
              <div>
                <div className="text-xs font-medium mb-2">Clinician</div>
                {cliniciansLoading ? (
                  <div className="text-xs text-ui-fg-subtle">Loading clinicians…</div>
                ) : (
                  <Select value={assignClinicianId} onValueChange={setAssignClinicianId}>
                    <Select.Trigger>
                      <Select.Value placeholder="Select clinician" />
                    </Select.Trigger>
                    <Select.Content>
                      {clinicians.map((c: any) => (
                        <Select.Item key={c.id} value={c.id}>
                          {`${c.first_name || ""} ${c.last_name || ""}`.trim() || c.id}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                )}
              </div>
              <div className="text-xs text-ui-fg-subtle">
                Note: assigning moves a pending consultation into Scheduled (minimal viable behavior).
              </div>
            </div>
          </Drawer.Body>
          <Drawer.Footer className="flex items-center justify-end gap-2">
            <Drawer.Close asChild>
              <Button variant="secondary">Cancel</Button>
            </Drawer.Close>
            <Button disabled={!assignClinicianId.trim() || selected.size === 0} onClick={assignSelected}>
              Assign
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Consultations",
})

export default ConsultationsPage
