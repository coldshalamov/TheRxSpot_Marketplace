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
  Textarea,
  Toaster,
  toast,
} from "@medusajs/ui"
import { format, formatDistanceToNowStrict } from "date-fns"
import { DragEvent, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"

type PlanStatus = "pending" | "scheduled" | "completed" | "approved" | "rejected"

type ConsultationDetail = {
  id: string
  business_id: string
  plan_status: PlanStatus
  scheduled_at: string | null
  updated_at: string | null
  chief_complaint: string | null
  medical_history: any | null
  rejection_reason: string | null
  notes: string | null
  admin_notes: string | null
  clinician_id: string | null
  state: string | null
  patient: any | null
  clinician: any | null
  submission: any | null
  product: any | null
  mode: string
  type: string
}

type DocumentRow = {
  id: string
  type: string
  title: string
  file_name: string
  file_size: number
  mime_type: string
  created_at: string
  access_level: string
  uploaded_by?: string | null
}

function ModeIcon({ mode }: { mode: "video" | "audio" | "form" }) {
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

function formatDateTime(value?: string | null): string {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, { timeZoneName: "short" })
}

function isValidDate(value: Date | null | undefined): value is Date {
  return !!value && !Number.isNaN(value.getTime())
}

function safeRelativeDate(value?: string | null, withSuffix = false): string {
  if (!value) return "—"
  const date = new Date(value)
  if (!isValidDate(date)) return "—"
  try {
    return formatDistanceToNowStrict(date, withSuffix ? { addSuffix: true } : undefined)
  } catch {
    return "—"
  }
}

function safeFormatDate(value?: string | null, pattern = "PPpp"): string {
  if (!value) return "—"
  const date = new Date(value)
  if (!isValidDate(date)) return "—"
  try {
    return format(date, pattern)
  } catch {
    return "—"
  }
}

function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "-"
  const units = ["B", "KB", "MB", "GB"]
  let i = 0
  let v = bytes
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function computeAge(dob?: string | null): string {
  if (!dob) return ""
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return ""
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1
  if (age < 0 || age > 125) return ""
  return `${age}`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function isProbablyHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value)
}

function normalizeClinicianNotes(value: string): string {
  const trimmed = value ?? ""
  if (!trimmed) return ""
  if (isProbablyHtml(trimmed)) return trimmed
  return `<p>${escapeHtml(trimmed).replace(/\r?\n/g, "<br/>")}</p>`
}

function sanitizeRichTextHtml(html: string): string {
  if (!html) return ""
  if (typeof window === "undefined") return html

  const parser = new DOMParser()
  const doc = parser.parseFromString(html, "text/html")

  const blocked = ["script", "style", "iframe", "object", "embed", "link", "meta"]
  for (const tag of blocked) {
    doc.querySelectorAll(tag).forEach((n) => n.remove())
  }

  const allowed = new Set([
    "b",
    "strong",
    "i",
    "em",
    "u",
    "p",
    "br",
    "ul",
    "ol",
    "li",
    "div",
    "span",
  ])

  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT)
  const toRemove: Element[] = []

  while (walker.nextNode()) {
    const el = walker.currentNode as Element
    const name = el.tagName.toLowerCase()

    // Strip non-allowed tags but keep their text content.
    if (!allowed.has(name)) {
      toRemove.push(el)
      continue
    }

    // Remove potentially dangerous attributes.
    for (const attr of Array.from(el.attributes)) {
      const key = attr.name.toLowerCase()
      if (key.startsWith("on") || key === "style") {
        el.removeAttribute(attr.name)
      }
      if (key === "href" || key === "src") {
        el.removeAttribute(attr.name)
      }
    }
  }

  for (const el of toRemove) {
    const parent = el.parentNode
    if (!parent) continue
    parent.replaceChild(doc.createTextNode(el.textContent || ""), el)
  }

  return (doc.body.innerHTML || "").trim()
}

function RichTextEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (next: string) => void
  placeholder: string
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const lastApplied = useRef<string>("")

  useEffect(() => {
    if (!ref.current) return
    if (value === lastApplied.current) return
    ref.current.innerHTML = value || ""
    lastApplied.current = value
  }, [value])

  const emit = () => {
    const html = ref.current?.innerHTML ?? ""
    lastApplied.current = html
    onChange(html)
  }

  const command = (cmd: string, arg?: string) => {
    ref.current?.focus()
    try {
      // eslint-disable-next-line deprecation/deprecation
      document.execCommand(cmd, false, arg)
    } catch {
      // Best-effort formatting only.
    }
    emit()
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="small" type="button" onClick={() => command("bold")}>
          Bold
        </Button>
        <Button variant="secondary" size="small" type="button" onClick={() => command("italic")}>
          Italic
        </Button>
        <Button variant="secondary" size="small" type="button" onClick={() => command("underline")}>
          Underline
        </Button>
        <Button
          variant="secondary"
          size="small"
          type="button"
          onClick={() => command("insertUnorderedList")}
        >
          Bullets
        </Button>
        <Button variant="secondary" size="small" type="button" onClick={() => command("removeFormat")}>
          Clear
        </Button>
      </div>

      <div className="relative">
        {!value ? (
          <div className="pointer-events-none absolute top-3 left-3 text-ui-fg-subtle text-sm">
            {placeholder}
          </div>
        ) : null}
        <div
          ref={ref}
          className="min-h-[120px] rounded-md border bg-ui-bg-base px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ui-border-interactive"
          contentEditable
          suppressContentEditableWarning
          onInput={emit}
          onPaste={(e) => {
            e.preventDefault()
            const text = e.clipboardData?.getData("text/plain") ?? ""
            command("insertText", text)
          }}
        />
      </div>
    </div>
  )
}

const ConsultationDetailPage = () => {
  const navigate = useNavigate()
  const params = useParams()
  const id = params.id as string

  const [consultation, setConsultation] = useState<ConsultationDetail | null>(null)
  const [loading, setLoading] = useState(true)

  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [docsLoading, setDocsLoading] = useState(true)
  const [activeDoc, setActiveDoc] = useState<DocumentRow | null>(null)

  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [auditLoading, setAuditLoading] = useState(true)

  const [assignOpen, setAssignOpen] = useState(false)
  const [assignClinicianId, setAssignClinicianId] = useState("")
  const [clinicians, setClinicians] = useState<any[]>([])
  const [cliniciansLoading, setCliniciansLoading] = useState(false)

  const [availability, setAvailability] = useState<"available" | "busy" | "unknown">("unknown")
  const [availabilityLoading, setAvailabilityLoading] = useState(false)
  const availabilityAbort = useRef<AbortController | null>(null)

  const [notes, setNotes] = useState("")
  const [adminNotes, setAdminNotes] = useState("")
  const [saveState, setSaveState] = useState<"idle" | "dirty" | "saving" | "saved" | "error">("idle")
  const lastSaved = useRef<{ notes: string; admin_notes: string }>({ notes: "", admin_notes: "" })
  const saveTimer = useRef<number | null>(null)
  const saveAbort = useRef<AbortController | null>(null)

  const [statusUpdating, setStatusUpdating] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState("")

  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadType, setUploadType] = useState("medical_record")
  const [uploadTitle, setUploadTitle] = useState("")
  const [uploadDescription, setUploadDescription] = useState("")
  const [uploadAccessLevel, setUploadAccessLevel] = useState("clinician")
  const [dragActive, setDragActive] = useState(false)
  const [medicalExpanded, setMedicalExpanded] = useState(false)

  const exportUrl = useMemo(() => `/admin/custom/consultations/${encodeURIComponent(id)}/export`, [id])

  const fetchConsultation = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/admin/custom/consultations/${encodeURIComponent(id)}`, {
        credentials: "include",
      })
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(text || `HTTP ${res.status}`)
      }
      const json = await res.json()
      setConsultation(json.consultation as ConsultationDetail)
    } catch (e) {
      toast.error("Failed to load consultation", {
        description: e instanceof Error ? e.message : "Unknown error",
      })
      setConsultation(null)
    } finally {
      setLoading(false)
    }
  }

  const fetchDocuments = async () => {
    setDocsLoading(true)
    try {
      const url = `/admin/documents?consultation_id=${encodeURIComponent(id)}&limit=100&offset=0`
      const res = await fetch(url, { credentials: "include" })
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(text || `HTTP ${res.status}`)
      }
      const json = await res.json()
      setDocuments((json.documents || []) as DocumentRow[])
    } catch (e) {
      toast.error("Failed to load documents", {
        description: e instanceof Error ? e.message : "Unknown error",
      })
      setDocuments([])
    } finally {
      setDocsLoading(false)
    }
  }

  const fetchAuditLogs = async () => {
    setAuditLoading(true)
    try {
      const qs = new URLSearchParams()
      qs.set("consultation_id", id)
      qs.set("limit", "20")
      qs.set("offset", "0")
      const res = await fetch(`/admin/audit-logs?${qs.toString()}`, {
        credentials: "include",
      })
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(text || `HTTP ${res.status}`)
      }
      const json = await res.json()
      setAuditLogs(json.logs || [])
    } catch (e) {
      toast.error("Failed to load history", {
        description: e instanceof Error ? e.message : "Unknown error",
      })
      setAuditLogs([])
    } finally {
      setAuditLoading(false)
    }
  }

  const fetchAvailability = async () => {
    const clinicianId = consultation?.clinician?.id ? String(consultation.clinician.id) : ""

    if (!clinicianId) {
      availabilityAbort.current?.abort()
      setAvailability("unknown")
      setAvailabilityLoading(false)
      return
    }

    availabilityAbort.current?.abort()
    const controller = new AbortController()
    availabilityAbort.current = controller

    setAvailabilityLoading(true)
    try {
      const clinicianStatus = `${consultation?.clinician?.status || ""}`.trim().toLowerCase()
      if (clinicianStatus && clinicianStatus !== "active") {
        setAvailability("busy")
        return
      }

      const now = new Date()
      const inTwoHours = new Date(Date.now() + 2 * 60 * 60 * 1000)

      const qs = new URLSearchParams()
      qs.set("clinician_id", clinicianId)
      qs.set("status", "scheduled")
      qs.set("date_from", now.toISOString())
      qs.set("date_to", inTwoHours.toISOString())
      qs.set("limit", "25")
      qs.set("offset", "0")

      const res = await fetch(`/admin/custom/consultations?${qs.toString()}`, {
        credentials: "include",
        signal: controller.signal,
      })
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(text || `HTTP ${res.status}`)
      }

      const json = (await res.json()) as { consultations?: any[] }
      const scheduled = Array.isArray(json.consultations) ? json.consultations : []

      const hasOtherScheduled = scheduled.some((c) => c?.id && c.id !== consultation?.id)
      setAvailability(hasOtherScheduled ? "busy" : "available")
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return
      setAvailability("unknown")
    } finally {
      setAvailabilityLoading(false)
    }
  }

  const loadClinicians = async (businessId: string | null) => {
    setCliniciansLoading(true)
    try {
      const params = new URLSearchParams()
      if (businessId) params.set("business_id", businessId)
      params.set("status", "active")
      params.set("limit", "100")
      params.set("offset", "0")

      const res = await fetch(`/admin/clinicians?${params.toString()}`, { credentials: "include" })
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

  const openAssignDrawer = async () => {
    if (!consultation) return
    setAssignClinicianId(consultation.clinician_id || "")
    setAssignOpen(true)
    await loadClinicians(consultation.business_id || null)
  }

  const assignClinician = async () => {
    if (!consultation) return
    const clinicianId = assignClinicianId.trim()
    if (!clinicianId) {
      toast.error("Choose a clinician to assign")
      return
    }

    try {
      const res = await fetch(`/admin/consultations/${encodeURIComponent(id)}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ clinician_id: clinicianId }),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(text || `HTTP ${res.status}`)
      }

      toast.success("Clinician assigned")
      setAssignOpen(false)
      await fetchConsultation()
      await fetchAuditLogs()
    } catch (e) {
      toast.error("Failed to assign clinician", {
        description: e instanceof Error ? e.message : "Unknown error",
      })
    }
  }

  const updateStatus = async (next: PlanStatus, reason?: string) => {
    setStatusUpdating(true)
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
      setRejectOpen(false)
      await fetchConsultation()
      await fetchAuditLogs()
    } catch (e) {
      toast.error("Failed to update status", {
        description: e instanceof Error ? e.message : "Unknown error",
      })
    } finally {
      setStatusUpdating(false)
    }
  }

  const openUploadDrawer = (file?: File | null) => {
    const f = file ?? null
    setUploadFile(f)
    setUploadType("medical_record")
    setUploadAccessLevel("clinician")
    setUploadTitle(f?.name || "")
    setUploadDescription("")
    setUploadOpen(true)
  }

  const uploadDocument = async () => {
    if (!uploadFile) {
      toast.error("Choose a file to upload")
      return
    }

    if (!uploadTitle.trim()) {
      toast.error("Title is required")
      return
    }

    setUploading(true)
    try {
      const form = new FormData()
      form.append("document", uploadFile)
      form.append("type", uploadType)
      form.append("title", uploadTitle.trim())
      form.append("access_level", uploadAccessLevel)
      if (uploadDescription.trim()) form.append("description", uploadDescription.trim())

      const res = await fetch(`/admin/consultations/${encodeURIComponent(id)}/documents`, {
        method: "POST",
        credentials: "include",
        body: form,
      })

      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(text || `HTTP ${res.status}`)
      }

      const json = await res.json().catch(() => ({} as any))
      toast.success("Document uploaded")
      setUploadOpen(false)
      setUploadFile(null)
      await fetchDocuments()
      await fetchAuditLogs()

      const created = json.document as any
      if (created?.id) {
        setActiveDoc(created as DocumentRow)
      }
    } catch (e) {
      toast.error("Failed to upload document", {
        description: e instanceof Error ? e.message : "Unknown error",
      })
    } finally {
      setUploading(false)
    }
  }

  const saveNotesNow = async () => {
    const sanitizedNotes = sanitizeRichTextHtml(notes)
    const next = { notes: sanitizedNotes, admin_notes: adminNotes }
    if (next.notes === lastSaved.current.notes && next.admin_notes === lastSaved.current.admin_notes) {
      setSaveState("idle")
      return
    }

    saveAbort.current?.abort()
    const controller = new AbortController()
    saveAbort.current = controller

    setSaveState("saving")
    try {
      const res = await fetch(`/admin/custom/consultations/${encodeURIComponent(id)}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: controller.signal,
        body: JSON.stringify(next),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(text || `HTTP ${res.status}`)
      }

      lastSaved.current = next
      if (sanitizedNotes !== notes) {
        setNotes(sanitizedNotes)
      }
      setSaveState("saved")
      await fetchAuditLogs()
      window.setTimeout(() => setSaveState("idle"), 1000)
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return
      setSaveState("error")
      toast.error("Failed to save notes", {
        description: e instanceof Error ? e.message : "Unknown error",
      })
    }
  }

  useEffect(() => {
    if (!id) return
    fetchConsultation()
    fetchDocuments()
    fetchAuditLogs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    if (!activeDoc && documents.length) {
      setActiveDoc(documents[0]!)
    }
  }, [activeDoc, documents])

  useEffect(() => {
    if (!consultation) return
    const serverNotes = normalizeClinicianNotes(consultation.notes ?? "")
    const serverAdminNotes = consultation.admin_notes ?? ""

    const unchanged =
      notes === lastSaved.current.notes && adminNotes === lastSaved.current.admin_notes

    if (unchanged) {
      setNotes(serverNotes)
      setAdminNotes(serverAdminNotes)
      lastSaved.current = { notes: serverNotes, admin_notes: serverAdminNotes }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultation?.id, consultation?.updated_at])

  useEffect(() => {
    if (!consultation) return
    void fetchAvailability()
    return () => {
      availabilityAbort.current?.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultation?.id, consultation?.clinician?.id, consultation?.updated_at])

  useEffect(() => {
    if (!consultation) return

    if (notes === lastSaved.current.notes && adminNotes === lastSaved.current.admin_notes) {
      if (saveState === "dirty") setSaveState("idle")
      return
    }

    setSaveState("dirty")
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      void saveNotesNow()
    }, 5000)

    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, adminNotes])

  useEffect(() => {
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
      saveAbort.current?.abort()
    }
  }, [])

  if (loading) {
    return (
      <Container>
        <Toaster />
        <Heading level="h1">Consultation</Heading>
        <div className="text-sm text-ui-fg-subtle">Loading…</div>
      </Container>
    )
  }

  if (!consultation) {
    return (
      <Container>
        <Toaster />
        <Heading level="h1">Consultation</Heading>
        <div className="text-sm text-ui-fg-subtle">Not found.</div>
        <Button variant="secondary" className="mt-4" onClick={() => navigate("/consultations")}>
          Back
        </Button>
      </Container>
    )
  }

  const planStatus = consultation.plan_status
  const status = statusBadge(planStatus)
  const patient = consultation.patient || null
  const patientName = [patient?.first_name, patient?.last_name].filter(Boolean).join(" ") || "—"
  const age = computeAge(patient?.date_of_birth || null)

  const answers =
    consultation.submission?.eligibility_answers && typeof consultation.submission.eligibility_answers === "object"
      ? consultation.submission.eligibility_answers
      : null
  const address = answers
    ? [answers.address, answers.city, answers.state, answers.zip]
        .filter((v: any) => typeof v === "string" && v.trim())
        .map((v: string) => v.trim())
        .join(", ")
    : ""
  const mapLink = address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : null

  const scheduledAt = consultation.scheduled_at ? new Date(consultation.scheduled_at) : null
  const scheduledLabel = consultation.scheduled_at ? formatDateTime(consultation.scheduled_at) : "—"
  const scheduledCountdown =
    scheduledAt && isValidDate(scheduledAt) && scheduledAt.getTime() > Date.now()
      ? safeRelativeDate(consultation.scheduled_at, true)
      : null

  const clinician = consultation.clinician || null
  const clinicianName = clinician
    ? [clinician.first_name, clinician.last_name].filter(Boolean).join(" ") || clinician.email || clinician.id
    : "Unassigned"

  const modeLabel =
    consultation.mode === "video" ? "Video" : consultation.mode === "audio" ? "Audio" : "Form"
  const typeLabel = consultation.type === "follow-up" ? "Follow-up" : "Initial"

  const canSchedule = planStatus === "pending"
  const canComplete = planStatus === "scheduled"
  const canApprove = planStatus === "completed"
  const canReject = planStatus === "completed"

  const previewUrl = activeDoc ? `/admin/documents/${encodeURIComponent(activeDoc.id)}/download` : null
  const previewIsPdf = !!activeDoc && activeDoc.mime_type === "application/pdf"
  const previewIsImage = !!activeDoc && (activeDoc.mime_type || "").startsWith("image/")

  const medicalHistoryObj =
    consultation.medical_history && typeof consultation.medical_history === "object"
      ? consultation.medical_history
      : null

  const allergies = Array.isArray((medicalHistoryObj as any)?.allergies)
    ? ((medicalHistoryObj as any).allergies as any[]).map((a) => String(a)).filter(Boolean)
    : []

  const currentMeds = Array.isArray((medicalHistoryObj as any)?.current_medications)
    ? ((medicalHistoryObj as any).current_medications as any[]).map((m) => String(m)).filter(Boolean)
    : Array.isArray((medicalHistoryObj as any)?.medications)
      ? ((medicalHistoryObj as any).medications as any[]).map((m) => String(m)).filter(Boolean)
      : []

  const medicalJson = medicalHistoryObj ? JSON.stringify(medicalHistoryObj, null, 2) : ""

  const product = consultation.product || null
  const productTitle = product?.title || "—"
  const productImage = product?.thumbnail || product?.images?.[0]?.url || null

  return (
    <Container>
      <Toaster />
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <Heading level="h1" className="flex items-center gap-2">
            <span>{consultationDisplayId(consultation.id)}</span>
            <Copy content={consultation.id} />
          </Heading>
          <div className="text-xs text-ui-fg-subtle mt-1">ID: {consultation.id}</div>
          <div className="mt-2 flex items-center gap-2">
            <Badge color={status.color}>{status.label}</Badge>
            <div className="text-xs text-ui-fg-subtle">
              Updated{" "}
              {safeRelativeDate(consultation.updated_at, true)}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => window.print()}>
            Print
          </Button>
          <Button variant="secondary" onClick={() => window.open(exportUrl, "_blank", "noopener,noreferrer")}>
            Export PDF
          </Button>
          <Button variant="secondary" onClick={() => navigate("/consultations")}>
            Back
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="text-sm font-medium">Patient information</div>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div className="text-xs font-medium mb-1">Full name</div>
            <div className="text-sm">{patientName}</div>
          </div>
          <div>
            <div className="text-xs font-medium mb-1">DOB / Age</div>
            <div className="text-sm">
              {patient?.date_of_birth || "—"}
              {age ? ` (${age})` : ""}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium mb-1">Phone</div>
            <div className="text-sm">
              {patient?.phone ? (
                <a className="text-ui-fg-interactive hover:underline" href={`tel:${patient.phone}`}>
                  {patient.phone}
                </a>
              ) : (
                "—"
              )}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium mb-1">Email</div>
            <div className="text-sm">
              {patient?.email ? (
                <a className="text-ui-fg-interactive hover:underline" href={`mailto:${patient.email}`}>
                  {patient.email}
                </a>
              ) : (
                "—"
              )}
            </div>
          </div>
          <div className="sm:col-span-2">
            <div className="text-xs font-medium mb-1">Address</div>
            <div className="text-sm">
              {address ? (
                mapLink ? (
                  <a className="text-ui-fg-interactive hover:underline" href={mapLink} target="_blank" rel="noreferrer">
                    {address}
                  </a>
                ) : (
                  address
                )
              ) : (
                <span className="text-ui-fg-subtle">—</span>
              )}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium mb-1">State</div>
            <div className="text-sm font-medium">{consultation.state || "—"}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="text-sm font-medium">Consultation details</div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge color="grey">
                  <span className="inline-flex items-center gap-1">
                    <ModeIcon
                      mode={
                        consultation.mode === "video"
                          ? "video"
                          : consultation.mode === "audio"
                            ? "audio"
                            : "form"
                      }
                    />
                    {modeLabel}
                  </span>
                </Badge>
                <Badge color="grey">{typeLabel}</Badge>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar
                  src={productImage ?? undefined}
                  fallback={(productTitle || "P").slice(0, 2).toUpperCase()}
                />
                <div className="min-w-0">
                  <div className="text-xs font-medium mb-1">Product</div>
                  <div className="text-sm">
                    {product?.id ? (
                      <button
                        className="text-ui-fg-interactive hover:underline truncate"
                        onClick={() => navigate(`/products/${product.id}`)}
                      >
                        {productTitle}
                      </button>
                    ) : (
                      <span className="truncate">{productTitle}</span>
                    )}
                  </div>
                  {product?.id ? <div className="text-xs text-ui-fg-subtle">{product.id}</div> : null}
                </div>
              </div>

              <div>
                <div className="text-xs font-medium mb-1">Scheduled</div>
                <div className="text-sm">{scheduledLabel}</div>
                {scheduledCountdown ? (
                  <div className="text-xs text-ui-fg-subtle">{scheduledCountdown}</div>
                ) : null}
              </div>

              <div className="md:col-span-2">
                <div className="text-xs font-medium mb-1">Chief complaint</div>
                <div className="text-sm whitespace-pre-wrap">{consultation.chief_complaint || "—"}</div>
              </div>

              <div>
                <div className="text-xs font-medium mb-1">Current medications</div>
                {currentMeds.length ? (
                  <ul className="text-sm list-disc pl-5 space-y-1">
                    {currentMeds.slice(0, 10).map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-ui-fg-subtle">—</div>
                )}
              </div>

              <div>
                <div className="text-xs font-medium mb-1">Allergies</div>
                {allergies.length ? (
                  <ul className="text-sm list-disc pl-5 space-y-1 text-red-700">
                    {allergies.slice(0, 10).map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-ui-fg-subtle">None reported</div>
                )}
              </div>

              <div className="md:col-span-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-medium">Medical history</div>
                  <Button variant="secondary" size="small" onClick={() => setMedicalExpanded((v) => !v)}>
                    {medicalExpanded ? "Hide" : "View"}
                  </Button>
                </div>
                {medicalExpanded ? (
                  <Textarea readOnly value={medicalJson || "—"} className="mt-2 font-mono text-xs min-h-[180px]" />
                ) : (
                  <div className="mt-2 text-sm text-ui-fg-subtle">
                    {medicalHistoryObj ? "Stored health history available." : "—"}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium">Documents</div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="small" onClick={() => fetchDocuments()} disabled={docsLoading}>
                  Refresh
                </Button>
                <Button variant="secondary" size="small" onClick={() => openUploadDrawer(null)}>
                  Upload new document
                </Button>
              </div>
            </div>

            <div
              className={[
                "mt-3 rounded-lg border border-dashed p-3 text-sm",
                dragActive ? "bg-ui-bg-highlight" : "bg-ui-bg-base",
              ].join(" ")}
              onDragOver={(e: DragEvent<HTMLDivElement>) => {
                e.preventDefault()
                setDragActive(true)
              }}
              onDragLeave={(e: DragEvent<HTMLDivElement>) => {
                e.preventDefault()
                setDragActive(false)
              }}
              onDrop={(e: DragEvent<HTMLDivElement>) => {
                e.preventDefault()
                setDragActive(false)
                const file = e.dataTransfer?.files?.[0] || null
                if (file) openUploadDrawer(file)
              }}
            >
              Drag & drop a PDF/JPG/PNG here to upload.
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
              <div className="lg:col-span-1">
                <Table>
                  <Table.Header>
                    <Table.Row>
                      <Table.HeaderCell>File</Table.HeaderCell>
                      <Table.HeaderCell>Type</Table.HeaderCell>
                      <Table.HeaderCell>Uploaded by</Table.HeaderCell>
                      <Table.HeaderCell>Size</Table.HeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {docsLoading ? (
                      <Table.Row>
                        <Table.Cell colSpan={4}>
                          <div className="text-sm text-ui-fg-subtle">Loading…</div>
                        </Table.Cell>
                      </Table.Row>
                    ) : documents.length === 0 ? (
                      <Table.Row>
                        <Table.Cell colSpan={4}>
                          <div className="text-sm text-ui-fg-subtle">No documents uploaded.</div>
                        </Table.Cell>
                      </Table.Row>
                    ) : (
                      documents.map((d) => (
                        <Table.Row
                          key={d.id}
                          className={activeDoc?.id === d.id ? "bg-ui-bg-highlight" : undefined}
                        >
                          <Table.Cell>
                            <button
                              className="text-ui-fg-interactive hover:underline text-left"
                              onClick={() => setActiveDoc(d)}
                            >
                              {d.file_name || d.title}
                            </button>
                            <div className="text-[11px] text-ui-fg-subtle truncate">{safeFormatDate(d.created_at, "PPpp")}</div>
                          </Table.Cell>
                          <Table.Cell>
                            <div className="text-sm">{d.type}</div>
                            <div className="text-[11px] text-ui-fg-subtle truncate">{d.access_level}</div>
                          </Table.Cell>
                          <Table.Cell>
                            <div className="text-sm">{d.uploaded_by ? String(d.uploaded_by) : "—"}</div>
                          </Table.Cell>
                          <Table.Cell>
                            <div className="text-sm">{formatBytes(d.file_size)}</div>
                          </Table.Cell>
                        </Table.Row>
                      ))
                    )}
                  </Table.Body>
                </Table>
              </div>

              <div className="lg:col-span-2">
                {!activeDoc ? (
                  <div className="text-sm text-ui-fg-subtle">Select a document to preview.</div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{activeDoc.title}</div>
                        <div className="text-xs text-ui-fg-subtle truncate">
                          {activeDoc.file_name} • {activeDoc.mime_type} • {formatBytes(activeDoc.file_size)}
                        </div>
                      </div>
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={() => window.open(`/admin/documents/${encodeURIComponent(activeDoc.id)}/download`, "_blank")}
                      >
                        Download
                      </Button>
                    </div>

                    {previewUrl ? (
                      previewIsPdf ? (
                        <iframe title="Document preview" src={previewUrl} className="w-full h-[520px] rounded-md border" />
                      ) : previewIsImage ? (
                        <img src={previewUrl} alt={activeDoc.title} className="max-h-[520px] w-full object-contain rounded-md border bg-white" />
                      ) : (
                        <div className="text-sm text-ui-fg-subtle">Preview not available for this file type.</div>
                      )
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium">Status history</div>
              <Button variant="secondary" size="small" onClick={() => fetchAuditLogs()} disabled={auditLoading}>
                Refresh
              </Button>
            </div>

            {auditLoading ? (
              <div className="mt-3 text-sm text-ui-fg-subtle">Loading…</div>
            ) : auditLogs.length === 0 ? (
              <div className="mt-3 text-sm text-ui-fg-subtle">No history yet.</div>
            ) : (
              <div className="mt-3 space-y-3">
                {auditLogs.map((l: any) => {
                  const when = l.created_at ? new Date(l.created_at) : null
                  const whenLabel = when && !Number.isNaN(when.getTime()) ? format(when, "PPpp") : "—"
                  const actor = [l.actor_type, l.actor_email || l.actor_id].filter(Boolean).join(": ")
                  const title = `${l.action || "event"} • ${l.entity_type || "entity"}`
                  const detail =
                    l.metadata?.event ||
                    l.metadata?.message ||
                    (l.changes?.after?.plan_status ? `Status → ${l.changes.after.plan_status}` : null) ||
                    null
                  return (
                    <div key={l.id || `${l.action}-${l.entity_id}-${l.created_at}`} className="flex gap-3">
                      <div className="w-2 mt-2">
                        <div className="h-2 w-2 rounded-full bg-ui-fg-muted" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{title}</div>
                        <div className="text-xs text-ui-fg-subtle truncate">
                          {whenLabel} • {actor || "—"}
                        </div>
                        {detail ? <div className="text-sm text-ui-fg-subtle mt-1">{String(detail)}</div> : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium">Clinician assignment</div>
              <Button variant="secondary" size="small" onClick={openAssignDrawer}>
                Reassign
              </Button>
            </div>
            <div className="mt-4 flex items-center gap-3 min-w-0">
              <Avatar fallback={(clinicianName || "C").slice(0, 2).toUpperCase()} />
              <div className="min-w-0">
                <div className="font-medium truncate">{clinicianName}</div>
                <div className="text-xs text-ui-fg-subtle truncate">
                  {clinician?.status ? `Status: ${clinician.status}` : "Status: —"}
                </div>
                <div className="text-xs text-ui-fg-subtle truncate">
                  Availability:{" "}
                  {availabilityLoading ? (
                    "Checking…"
                  ) : availability === "available" ? (
                    <span className="text-green-700">Available</span>
                  ) : availability === "busy" ? (
                    <span className="text-orange-700">Busy</span>
                  ) : (
                    "—"
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-4">
            <div className="text-sm font-medium">Status management</div>
            <div className="mt-3 space-y-2">
              {(() => {
                const order: PlanStatus[] = ["pending", "scheduled", "completed", "approved"]
                const currentIndex = planStatus === "rejected" ? 3 : order.indexOf(planStatus)
                const lastLabel = planStatus === "rejected" ? "Rejected" : "Approved"
                const labels = ["Pending", "Scheduled", "Completed", lastLabel]
                return labels.map((label, idx) => {
                  const isActive = idx === currentIndex
                  const isDone = idx < currentIndex
                  return (
                    <div key={label} className="flex items-center gap-2">
                      <div
                        className={[
                          "h-6 w-6 rounded-full border flex items-center justify-center text-xs",
                          isDone ? "bg-ui-bg-interactive text-white border-ui-bg-interactive" : isActive ? "border-ui-fg-interactive" : "border-ui-border-base",
                        ].join(" ")}
                      >
                        {isDone ? "✓" : idx + 1}
                      </div>
                      <div className={["text-sm", isActive ? "font-medium" : "text-ui-fg-subtle"].join(" ")}>
                        {label}
                      </div>
                    </div>
                  )
                })
              })()}
            </div>

            {planStatus === "rejected" && consultation.rejection_reason ? (
              <div className="mt-3 text-sm">
                <div className="text-xs font-medium mb-1">Rejection reason</div>
                <div className="text-sm text-ui-fg-subtle whitespace-pre-wrap">{consultation.rejection_reason}</div>
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="small"
                disabled={!canSchedule || statusUpdating}
                onClick={() => updateStatus("scheduled")}
              >
                Schedule
              </Button>
              <Button
                variant="secondary"
                size="small"
                disabled={!canComplete || statusUpdating}
                onClick={() => updateStatus("completed")}
              >
                Mark complete
              </Button>
              <Button
                variant="secondary"
                size="small"
                disabled={!canApprove || statusUpdating}
                onClick={() => updateStatus("approved")}
              >
                Approve
              </Button>
              <Button
                variant="secondary"
                size="small"
                disabled={!canReject || statusUpdating}
                onClick={() => {
                  setRejectReason("")
                  setRejectOpen(true)
                }}
              >
                Reject
              </Button>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium">Notes</div>
              <div className="text-xs text-ui-fg-subtle">
                {saveState === "saving"
                  ? "Saving…"
                  : saveState === "dirty"
                    ? "Unsaved"
                    : saveState === "saved"
                      ? "Saved"
                      : saveState === "error"
                        ? "Save failed"
                        : "Saved"}
              </div>
            </div>
            <div className="mt-3 space-y-4">
              <div>
                <div className="text-xs font-medium mb-1">Clinician notes</div>
                <RichTextEditor value={notes} onChange={setNotes} placeholder="Clinician notes…" />
              </div>
              <div>
                <div className="text-xs font-medium mb-1">Admin notes (internal)</div>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Internal notes…"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <Drawer open={assignOpen} onOpenChange={setAssignOpen}>
        <Drawer.Content className="w-full max-w-xl">
          <Drawer.Header>
            <Drawer.Title>Assign clinician</Drawer.Title>
            <Drawer.Description>Select a clinician to assign to this consultation.</Drawer.Description>
          </Drawer.Header>
          <Drawer.Body>
            {cliniciansLoading ? (
              <div className="text-sm text-ui-fg-subtle">Loading clinicians…</div>
            ) : (
              <div className="space-y-3">
                <div>
                  <div className="text-xs font-medium mb-1">Clinician</div>
                  <Select value={assignClinicianId} onValueChange={setAssignClinicianId}>
                    <Select.Trigger>
                      <Select.Value placeholder="Select clinician" />
                    </Select.Trigger>
                    <Select.Content>
                      {clinicians.map((c: any) => {
                        const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || c.id
                        return (
                          <Select.Item key={c.id} value={c.id}>
                            {name}
                          </Select.Item>
                        )
                      })}
                    </Select.Content>
                  </Select>
                </div>
              </div>
            )}
          </Drawer.Body>
          <Drawer.Footer className="flex items-center justify-end gap-2">
            <Drawer.Close asChild>
              <Button variant="secondary">Cancel</Button>
            </Drawer.Close>
            <Button onClick={assignClinician} disabled={cliniciansLoading}>
              Assign
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>

      <Drawer open={rejectOpen} onOpenChange={setRejectOpen}>
        <Drawer.Content className="w-full max-w-xl">
          <Drawer.Header>
            <Drawer.Title>Reject consultation</Drawer.Title>
            <Drawer.Description>Rejection requires a reason.</Drawer.Description>
          </Drawer.Header>
          <Drawer.Body>
            <div className="space-y-2">
              <div className="text-xs font-medium">Reason</div>
              <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
            </div>
          </Drawer.Body>
          <Drawer.Footer className="flex items-center justify-end gap-2">
            <Drawer.Close asChild>
              <Button variant="secondary">Cancel</Button>
            </Drawer.Close>
            <Button
              variant="danger"
              disabled={!rejectReason.trim() || statusUpdating}
              onClick={() => updateStatus("rejected", rejectReason.trim())}
            >
              Reject
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>

      <Drawer open={uploadOpen} onOpenChange={setUploadOpen}>
        <Drawer.Content className="w-full max-w-2xl">
          <Drawer.Header>
            <Drawer.Title>Upload document</Drawer.Title>
            <Drawer.Description>PDF/JPG/PNG up to 10MB.</Drawer.Description>
          </Drawer.Header>
          <Drawer.Body>
            <div className="space-y-4">
              <div>
                <div className="text-xs font-medium mb-1">File</div>
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null
                    setUploadFile(f)
                    if (f && !uploadTitle.trim()) setUploadTitle(f.name)
                  }}
                />
                {uploadFile ? (
                  <div className="text-xs text-ui-fg-subtle mt-1">
                    {uploadFile.name} • {formatBytes(uploadFile.size)} • {uploadFile.type || "unknown"}
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs font-medium mb-1">Type</div>
                  <Select value={uploadType} onValueChange={setUploadType}>
                    <Select.Trigger>
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value="prescription">Prescription</Select.Item>
                      <Select.Item value="lab_result">Lab result</Select.Item>
                      <Select.Item value="medical_record">Medical record</Select.Item>
                      <Select.Item value="consent_form">Consent form</Select.Item>
                      <Select.Item value="id_verification">ID verification</Select.Item>
                      <Select.Item value="insurance_card">Insurance card</Select.Item>
                      <Select.Item value="other">Other</Select.Item>
                    </Select.Content>
                  </Select>
                </div>
                <div>
                  <div className="text-xs font-medium mb-1">Access level</div>
                  <Select value={uploadAccessLevel} onValueChange={setUploadAccessLevel}>
                    <Select.Trigger>
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value="patient_only">Patient only</Select.Item>
                      <Select.Item value="clinician">Clinician</Select.Item>
                      <Select.Item value="business_staff">Business staff</Select.Item>
                      <Select.Item value="platform_admin">Platform admin</Select.Item>
                    </Select.Content>
                  </Select>
                </div>
              </div>

              <div>
                <div className="text-xs font-medium mb-1">Title</div>
                <Input value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} />
              </div>

              <div>
                <div className="text-xs font-medium mb-1">Description (optional)</div>
                <Textarea value={uploadDescription} onChange={(e) => setUploadDescription(e.target.value)} />
              </div>
            </div>
          </Drawer.Body>
          <Drawer.Footer className="flex items-center justify-end gap-2">
            <Drawer.Close asChild>
              <Button variant="secondary" disabled={uploading}>
                Cancel
              </Button>
            </Drawer.Close>
            <Button onClick={uploadDocument} disabled={uploading}>
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Consultation detail",
})

export default ConsultationDetailPage
