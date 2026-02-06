import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Avatar,
  Badge,
  Button,
  Container,
  Copy,
  Drawer,
  Heading,
  Input,
  Select,
  Table,
  Toaster,
  toast,
  DatePicker,
} from "@medusajs/ui"
import { format, formatDistanceToNowStrict } from "date-fns"
import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"

type UserRole = "customer" | "admin" | "clinician"
type UserStatus = "active" | "inactive"

type UserRow = {
  id: string
  entity_id: string
  role: UserRole
  status: UserStatus
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  date_of_birth: string | null
  created_at: string
  avatar_url?: string | null
  deactivation_reason?: string | null
}

type UsersListResponse = {
  users: UserRow[]
  count: number
  limit: number
  offset: number
}

const LIMIT = 25

function isValidDate(value: Date | null | undefined): value is Date {
  return !!value && !Number.isNaN(value.getTime())
}

function initials(firstName?: string | null, lastName?: string | null, email?: string | null): string {
  const f = (firstName || "").trim()
  const l = (lastName || "").trim()
  if (f || l) {
    return `${f.slice(0, 1)}${l.slice(0, 1)}`.toUpperCase()
  }
  const e = (email || "").trim()
  if (!e) return "U"
  return e.slice(0, 2).toUpperCase()
}

function formatPhone(value?: string | null): string {
  if (!value) return "-"
  const digits = value.replace(/[^\d]/g, "")
  const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits
  if (ten.length === 10) {
    return `+1-${ten.slice(0, 3)}-${ten.slice(3, 6)}-${ten.slice(6)}`
  }
  return value
}

function formatDobAndAge(dob?: string | null): { label: string; ageLabel: string } {
  if (!dob) return { label: "-", ageLabel: "" }
  const date = new Date(dob)
  if (Number.isNaN(date.getTime())) {
    return { label: dob, ageLabel: "" }
  }
  const now = new Date()
  let age = now.getFullYear() - date.getFullYear()
  const m = now.getMonth() - date.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < date.getDate())) {
    age -= 1
  }
  const label = format(date, "MM/dd/yyyy")
  const ageLabel = age >= 0 && age <= 125 ? `${age}` : ""
  return { label, ageLabel }
}

function safeRelativeDate(value?: string | null): string {
  if (!value) return "-"
  const date = new Date(value)
  if (!isValidDate(date)) return "-"
  try {
    return formatDistanceToNowStrict(date, { addSuffix: true })
  } catch {
    return "-"
  }
}

function safeDate(value?: string | null, pattern = "MMM d, yyyy"): string {
  if (!value) return "-"
  const date = new Date(value)
  if (!isValidDate(date)) return "-"
  try {
    return format(date, pattern)
  } catch {
    return "-"
  }
}

function roleBadge(role: UserRole): { color: "grey" | "blue" | "green" | "orange"; label: string } {
  if (role === "admin") return { color: "blue", label: "Admin" }
  if (role === "clinician") return { color: "orange", label: "Clinician" }
  return { color: "green", label: "Customer" }
}

function statusBadge(status: UserStatus): { color: "green" | "red"; label: string } {
  return status === "active" ? { color: "green", label: "Active" } : { color: "red", label: "Inactive" }
}

const UsersPage = () => {
  const navigate = useNavigate()

  const [rows, setRows] = useState<UserRow[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const [q, setQ] = useState("")
  const [status, setStatus] = useState<UserStatus | "">("")
  const [role, setRole] = useState<UserRole | "">("")
  const [dateFrom, setDateFrom] = useState<Date | null>(null)
  const [dateTo, setDateTo] = useState<Date | null>(null)

  const [page, setPage] = useState(0)
  const [sortBy, setSortBy] = useState<"name" | "joined">("joined")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")

  const [selected, setSelected] = useState<Set<string>>(new Set())

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [activeUser, setActiveUser] = useState<UserRow | null>(null)
  const [activityLogs, setActivityLogs] = useState<any[]>([])
  const [activityLoading, setActivityLoading] = useState(false)

  const [bulkDeactivateOpen, setBulkDeactivateOpen] = useState(false)
  const [bulkReason, setBulkReason] = useState("")

  const [editFirstName, setEditFirstName] = useState("")
  const [editLastName, setEditLastName] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editPhone, setEditPhone] = useState("")
  const [editDob, setEditDob] = useState<Date | null>(null)

  const fetchAbort = useRef<AbortController | null>(null)

  const offset = page * LIMIT
  const totalPages = Math.max(1, Math.ceil(count / LIMIT))

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    params.set("limit", String(LIMIT))
    params.set("offset", String(offset))
    if (q.trim()) params.set("q", q.trim())
    if (status) params.set("status", status)
    if (role) params.set("role", role)
    if (dateFrom) params.set("date_from", dateFrom.toISOString())
    if (dateTo) params.set("date_to", dateTo.toISOString())
    params.set("sort_by", sortBy)
    params.set("sort_order", sortOrder)
    return params.toString()
  }, [dateFrom, dateTo, offset, q, role, sortBy, sortOrder, status])

  const fetchUsers = async () => {
    fetchAbort.current?.abort()
    const controller = new AbortController()
    fetchAbort.current = controller

    setLoading(true)
    try {
      const res = await fetch(`/admin/custom/users?${queryString}`, {
        credentials: "include",
        signal: controller.signal,
      })
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(text || `HTTP ${res.status}`)
      }
      const json = (await res.json()) as UsersListResponse
      setRows(json.users || [])
      setCount(json.count || 0)
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return
      toast.error("Failed to load users", {
        description: e instanceof Error ? e.message : "Unknown error",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString])

  useEffect(() => {
    setPage(0)
    setSelected(new Set())
  }, [q, status, role, dateFrom, dateTo, sortBy, sortOrder])

  const allOnPageSelected = rows.length > 0 && rows.every((r) => selected.has(r.id))

  const toggleSelectAllOnPage = () => {
    const next = new Set(selected)
    if (allOnPageSelected) {
      for (const r of rows) next.delete(r.id)
    } else {
      for (const r of rows) next.add(r.id)
    }
    setSelected(next)
  }

  const toggleRow = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const openUser = async (user: UserRow) => {
    setActiveUser(user)
    setDrawerOpen(true)
    setActivityLogs([])

    setEditFirstName(user.first_name || "")
    setEditLastName(user.last_name || "")
    setEditEmail(user.email || "")
    setEditPhone(user.phone || "")
    setEditDob(user.date_of_birth ? new Date(user.date_of_birth) : null)

    setActivityLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("limit", "50")
      params.set("offset", "0")
      params.set("actor_id", user.entity_id)
      const res = await fetch(`/admin/audit-logs?${params.toString()}`, {
        credentials: "include",
      })
      if (!res.ok) {
        setActivityLogs([])
        return
      }
      const json = await res.json()
      setActivityLogs(json.logs || [])
    } finally {
      setActivityLoading(false)
    }
  }

  const exportCsv = () => {
    const params = new URLSearchParams()
    if (q.trim()) params.set("q", q.trim())
    if (status) params.set("status", status)
    if (role) params.set("role", role)
    if (dateFrom) params.set("date_from", dateFrom.toISOString())
    if (dateTo) params.set("date_to", dateTo.toISOString())
    window.location.href = `/admin/custom/users/export?${params.toString()}`
  }

  const updateUser = async () => {
    if (!activeUser) return
    try {
      const res = await fetch(`/admin/custom/users/${encodeURIComponent(activeUser.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          first_name: editFirstName,
          last_name: editLastName,
          email: editEmail,
          phone: editPhone,
          date_of_birth: editDob ? editDob.toISOString().slice(0, 10) : "",
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(json?.message || json?.error || `HTTP ${res.status}`)
      }
      toast.success("User updated")
      setActiveUser(json.user)
      await fetchUsers()
    } catch (e) {
      toast.error("Failed to update user", {
        description: e instanceof Error ? e.message : "Unknown error",
      })
    }
  }

  const setUserStatus = async (user: UserRow, next: UserStatus, reason?: string) => {
    try {
      const res = await fetch(`/admin/custom/users/${encodeURIComponent(user.id)}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: next, reason }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(json?.message || json?.error || `HTTP ${res.status}`)
      }
      toast.success(next === "inactive" ? "User deactivated" : "User reactivated")
      await fetchUsers()
      if (activeUser?.id === user.id) {
        // re-fetch updated row via list refresh already; optimistic update for modal
        setActiveUser({ ...activeUser, status: next, deactivation_reason: reason || null })
      }
    } catch (e) {
      toast.error("Failed to update status", {
        description: e instanceof Error ? e.message : "Unknown error",
      })
    }
  }

  const runBulkDeactivate = async () => {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    try {
      const res = await fetch(`/admin/custom/users/bulk/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ids, status: "inactive", reason: bulkReason }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(json?.message || json?.error || `HTTP ${res.status}`)
      }
      toast.success("Bulk deactivate complete", {
        description: `${json.updated || 0} updated`,
      })
      setSelected(new Set())
      setBulkReason("")
      setBulkDeactivateOpen(false)
      await fetchUsers()
    } catch (e) {
      toast.error("Bulk deactivate failed", {
        description: e instanceof Error ? e.message : "Unknown error",
      })
    }
  }

  const toggleSort = (next: "name" | "joined") => {
    if (sortBy !== next) {
      setSortBy(next)
      setSortOrder(next === "name" ? "asc" : "desc")
      return
    }
    setSortOrder((o) => (o === "asc" ? "desc" : "asc"))
  }

  return (
    <Container>
      <Toaster />

      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <Heading level="h1">Users</Heading>
          <div className="mt-1 text-xs text-ui-fg-subtle">
            Server-side pagination · 25 per page
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={exportCsv}>
            Export CSV
          </Button>
          <Button variant="secondary" onClick={() => fetchUsers()}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          <div className="xl:col-span-2">
            <div className="text-xs font-medium mb-1">Search</div>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name, email, or phone"
            />
          </div>
          <div>
            <div className="text-xs font-medium mb-1">Status</div>
            <Select value={status} onValueChange={(v) => setStatus(v as any)}>
              <Select.Trigger>
                <Select.Value placeholder="All" />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="">All</Select.Item>
                <Select.Item value="active">Active</Select.Item>
                <Select.Item value="inactive">Inactive</Select.Item>
              </Select.Content>
            </Select>
          </div>
          <div>
            <div className="text-xs font-medium mb-1">Role</div>
            <Select value={role} onValueChange={(v) => setRole(v as any)}>
              <Select.Trigger>
                <Select.Value placeholder="All" />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="">All</Select.Item>
                <Select.Item value="customer">Customer</Select.Item>
                <Select.Item value="admin">Admin</Select.Item>
                <Select.Item value="clinician">Clinician</Select.Item>
              </Select.Content>
            </Select>
          </div>
          <div>
            <div className="text-xs font-medium mb-1">Joined (from)</div>
            <DatePicker value={dateFrom} onChange={setDateFrom} />
          </div>
          <div>
            <div className="text-xs font-medium mb-1">Joined (to)</div>
            <DatePicker value={dateTo} onChange={setDateTo} />
          </div>
        </div>

        {selected.size > 0 ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-ui-fg-subtle">
              Selected: <span className="font-medium">{selected.size}</span>
            </div>
            <div className="flex gap-2">
              <Button variant="danger" onClick={() => setBulkDeactivateOpen(true)}>
                Bulk deactivate
              </Button>
              <Button variant="secondary" onClick={exportCsv}>
                Bulk export CSV
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Table */}
      <div className="mt-4 rounded-xl border bg-white p-4 shadow-sm">
        {loading ? (
          <div className="text-sm text-ui-fg-subtle">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-ui-fg-subtle">No users found.</div>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={toggleSelectAllOnPage}
                    aria-label="Select all on page"
                  />
                </Table.HeaderCell>
                <Table.HeaderCell>Avatar</Table.HeaderCell>
                <Table.HeaderCell>
                  <button type="button" className="text-left" onClick={() => toggleSort("name")}>
                    Name
                    <span className="ml-1 text-ui-fg-subtle">
                      {sortBy === "name" ? (sortOrder === "asc" ? "↑" : "↓") : ""}
                    </span>
                  </button>
                </Table.HeaderCell>
                <Table.HeaderCell>Email</Table.HeaderCell>
                <Table.HeaderCell>Phone</Table.HeaderCell>
                <Table.HeaderCell>Date of Birth</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell>Role</Table.HeaderCell>
                <Table.HeaderCell>
                  <button type="button" className="text-left" onClick={() => toggleSort("joined")}>
                    Joined
                    <span className="ml-1 text-ui-fg-subtle">
                      {sortBy === "joined" ? (sortOrder === "asc" ? "↑" : "↓") : ""}
                    </span>
                  </button>
                </Table.HeaderCell>
                <Table.HeaderCell>Actions</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {rows.map((u) => {
                const name = `${u.first_name || ""} ${u.last_name || ""}`.trim() || (u.email || "-")
                const { label: dobLabel, ageLabel } = formatDobAndAge(u.date_of_birth)
                const statusInfo = statusBadge(u.status)
                const roleInfo = roleBadge(u.role)
                const joined = safeRelativeDate(u.created_at)

                return (
                  <Table.Row key={u.id}>
                    <Table.Cell>
                      <input
                        type="checkbox"
                        checked={selected.has(u.id)}
                        onChange={() => toggleRow(u.id)}
                        aria-label={`Select ${name}`}
                      />
                    </Table.Cell>
                    <Table.Cell>
                      <Avatar fallback={initials(u.first_name, u.last_name, u.email)} />
                    </Table.Cell>
                    <Table.Cell className="min-w-[200px]">
                      <div className="font-medium">{name}</div>
                    </Table.Cell>
                    <Table.Cell className="min-w-[240px]">
                      <div className="flex items-center gap-2">
                        <span className="truncate">{u.email || "-"}</span>
                        {u.email ? <Copy content={u.email} variant="mini" /> : null}
                      </div>
                    </Table.Cell>
                    <Table.Cell className="min-w-[180px]">
                      <div className="flex items-center gap-2">
                        <span>{formatPhone(u.phone)}</span>
                        {u.phone ? <Copy content={u.phone} variant="mini" /> : null}
                      </div>
                    </Table.Cell>
                    <Table.Cell className="min-w-[160px]">
                      <div className="flex items-center gap-2">
                        <span>{dobLabel}</span>
                        {ageLabel ? <span className="text-ui-fg-subtle">({ageLabel})</span> : null}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge color={statusInfo.color}>{statusInfo.label}</Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge color={roleInfo.color}>{roleInfo.label}</Badge>
                    </Table.Cell>
                    <Table.Cell className="min-w-[150px]">{joined}</Table.Cell>
                    <Table.Cell className="min-w-[240px]">
                      <div className="flex gap-2">
                        <Button
                          size="small"
                          variant="secondary"
                          onClick={() => openUser(u)}
                        >
                          View
                        </Button>
                        <Button
                          size="small"
                          variant="secondary"
                          onClick={() => openUser(u)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="small"
                          variant={u.status === "active" ? "danger" : "secondary"}
                          onClick={() => {
                            if (u.status === "active") {
                              const r = window.prompt("Deactivation reason (optional):") || ""
                              setUserStatus(u, "inactive", r.trim() || undefined)
                            } else {
                              setUserStatus(u, "active")
                            }
                          }}
                        >
                          {u.status === "active" ? "Deactivate" : "Reactivate"}
                        </Button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                )
              })}
            </Table.Body>
          </Table>
        )}

        {/* Pagination */}
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="text-xs text-ui-fg-subtle">
            Showing {rows.length ? offset + 1 : 0}–{offset + rows.length} of {count}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="small"
              variant="secondary"
              disabled={page <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Previous
            </Button>
            <div className="text-xs text-ui-fg-subtle">
              Page <span className="font-medium">{page + 1}</span> of {totalPages}
            </div>
            <Button
              size="small"
              variant="secondary"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      {/* Bulk deactivate drawer */}
      <Drawer open={bulkDeactivateOpen} onOpenChange={setBulkDeactivateOpen}>
        <Drawer.Content className="w-full max-w-xl">
          <Drawer.Header>
            <Drawer.Title>Bulk deactivate</Drawer.Title>
            <Drawer.Description>
              Deactivates the selected users. You can optionally provide a reason.
            </Drawer.Description>
          </Drawer.Header>
          <Drawer.Body>
            <div className="text-xs font-medium mb-1">Reason</div>
            <Input
              value={bulkReason}
              onChange={(e) => setBulkReason(e.target.value)}
              placeholder="Optional deactivation reason"
            />
          </Drawer.Body>
          <Drawer.Footer className="flex items-center justify-end gap-2">
            <Drawer.Close asChild>
              <Button variant="secondary">Cancel</Button>
            </Drawer.Close>
            <Button variant="danger" onClick={runBulkDeactivate}>
              Deactivate {selected.size}
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>

      {/* User detail drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <Drawer.Content className="w-full max-w-2xl">
          <Drawer.Header>
            <Drawer.Title>User details</Drawer.Title>
            <Drawer.Description>
              View and edit personal info. Activity log shows last 50 actions.
            </Drawer.Description>
          </Drawer.Header>
          <Drawer.Body>
            {!activeUser ? (
              <div className="text-sm text-ui-fg-subtle">No user selected</div>
            ) : (
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar fallback={initials(activeUser.first_name, activeUser.last_name, activeUser.email)} />
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {`${activeUser.first_name || ""} ${activeUser.last_name || ""}`.trim() ||
                          activeUser.email ||
                          activeUser.id}
                      </div>
                      <div className="text-xs text-ui-fg-subtle truncate">
                        {activeUser.email || activeUser.id}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge color={statusBadge(activeUser.status).color}>
                      {statusBadge(activeUser.status).label}
                    </Badge>
                    <Badge color={roleBadge(activeUser.role).color}>
                      {roleBadge(activeUser.role).label}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs font-medium mb-1">First name</div>
                    <Input value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} />
                  </div>
                  <div>
                    <div className="text-xs font-medium mb-1">Last name</div>
                    <Input value={editLastName} onChange={(e) => setEditLastName(e.target.value)} />
                  </div>
                  <div>
                    <div className="text-xs font-medium mb-1">Email</div>
                    <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                  </div>
                  <div>
                    <div className="text-xs font-medium mb-1">Phone</div>
                    <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
                  </div>
                  <div>
                    <div className="text-xs font-medium mb-1">Date of birth</div>
                    <DatePicker value={editDob} onChange={setEditDob} />
                  </div>
                  <div>
                    <div className="text-xs font-medium mb-1">Joined</div>
                    <div className="text-sm">
                      {safeDate(activeUser.created_at, "MMM d, yyyy")}
                    </div>
                  </div>
                </div>

                {activeUser.status === "inactive" && activeUser.deactivation_reason ? (
                  <div className="rounded-lg border bg-gray-50 p-3">
                    <div className="text-xs font-medium">Deactivation reason</div>
                    <div className="mt-1 text-sm text-ui-fg-subtle">
                      {activeUser.deactivation_reason}
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <Button onClick={updateUser}>Save</Button>
                  <Button
                    variant={activeUser.status === "active" ? "danger" : "secondary"}
                    onClick={() => {
                      if (!activeUser) return
                      if (activeUser.status === "active") {
                        const r = window.prompt("Deactivation reason (optional):") || ""
                        setUserStatus(activeUser, "inactive", r.trim() || undefined)
                      } else {
                        setUserStatus(activeUser, "active")
                      }
                    }}
                  >
                    {activeUser.status === "active" ? "Deactivate" : "Reactivate"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const email = (activeUser.email || "").trim()
                      if (!email) {
                        toast.error("No email available for linking")
                        return
                      }
                      navigate(`/orders?q=${encodeURIComponent(email)}`)
                    }}
                  >
                    View order history
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const email = (activeUser.email || "").trim()
                      navigate(`/consultations${email ? `?q=${encodeURIComponent(email)}` : ""}`)
                    }}
                  >
                    View consultation history
                  </Button>
                </div>

                <div className="rounded-xl border bg-white p-4">
                  <div className="text-sm font-medium">Activity log</div>
                  <div className="text-xs text-ui-fg-subtle">
                    Last 50 actions (by actor_id = {activeUser.entity_id})
                  </div>
                  <div className="mt-3 space-y-2">
                    {activityLoading ? (
                      <div className="text-xs text-ui-fg-subtle">Loading…</div>
                    ) : activityLogs.length === 0 ? (
                      <div className="text-xs text-ui-fg-subtle">No activity found.</div>
                    ) : (
                      activityLogs.map((log: any) => {
                        const ts = log.created_at ? new Date(log.created_at) : null
                        const tsLabel = isValidDate(ts) ? safeDate(log.created_at, "MMM d, h:mm a") : "—"
                        return (
                          <div key={log.id} className="rounded-lg border px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <Badge
                                  color={
                                    log.action === "create"
                                      ? "green"
                                      : log.action === "update"
                                        ? "blue"
                                        : log.action === "delete"
                                          ? "red"
                                          : "grey"
                                  }
                                >
                                  {log.action}
                                </Badge>
                                <div className="text-xs text-ui-fg-subtle">
                                  {log.entity_type} · {log.entity_id}
                                </div>
                              </div>
                              <div className="text-[11px] text-ui-fg-subtle">
                                {tsLabel}
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}
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
  label: "Users",
})

export default UsersPage
