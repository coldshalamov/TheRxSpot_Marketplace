import { MedusaRequest } from "@medusajs/framework/http"

export type PlanOrderStatus = "pending" | "in_production" | "shipped" | "delivered" | "cancelled"

export function parseCommaList(value?: string): string[] {
  if (!value) return []
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
}

export function parseIsoDate(value?: string): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export function asInt(value: any, fallback: number): number {
  const n = typeof value === "string" ? parseInt(value, 10) : typeof value === "number" ? value : NaN
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

export function normalizeText(value: any): string {
  return `${value ?? ""}`.toLowerCase().trim()
}

export function getOptionalTenantBusinessId(req: MedusaRequest): string | undefined {
  const authContext = (req as any).auth_context as
    | { business_id?: string; metadata?: any; app_metadata?: any }
    | undefined

  return (
    authContext?.business_id ||
    authContext?.metadata?.business_id ||
    authContext?.app_metadata?.business_id ||
    (req as any)?.tenant_context?.business_id
  )
}

export function derivePlanStatusFromOrder(order: any): PlanOrderStatus {
  const meta = order?.metadata || {}
  const fs = typeof meta.fulfillment_status === "string" ? meta.fulfillment_status : ""

  if (fs === "pending") return "pending"
  if (fs === "in_production") return "in_production"
  if (fs === "shipped") return "shipped"
  if (fs === "delivered") return "delivered"
  if (fs === "cancelled") return "cancelled"

  // Backwards-compat fallback to existing custom_status machine.
  const custom = typeof meta.custom_status === "string" ? meta.custom_status : ""
  if (custom === "processing") return "in_production"
  if (custom === "fulfilled") return "shipped"
  if (custom === "delivered") return "delivered"
  if (custom === "cancelled" || custom === "refunded") return "cancelled"
  return "pending"
}

export function validateNextStatus(from: PlanOrderStatus, to: PlanOrderStatus): boolean {
  const allowed: Record<PlanOrderStatus, PlanOrderStatus[]> = {
    pending: ["in_production", "cancelled"],
    in_production: ["shipped", "cancelled"],
    shipped: ["delivered", "cancelled"],
    delivered: [],
    cancelled: [],
  }
  return (allowed[from] || []).includes(to)
}

