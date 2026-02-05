import { BUSINESS_MODULE } from "../modules/business"
import { Modules } from "@medusajs/framework/utils"

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null
}

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v
      .filter((x) => typeof x === "string")
      .map((x) => x.trim())
      .filter(Boolean)
  }

  // Metadata sometimes arrives as a JSON-stringified array depending on how the
  // order was created/serialized. Be liberal in what we accept so the guard
  // can't be bypassed due to type drift.
  if (typeof v === "string") {
    const raw = v.trim()
    if (!raw) return []

    if (raw.startsWith("[")) {
      try {
        const parsed = JSON.parse(raw) as unknown
        return asStringArray(parsed)
      } catch {
        // fall through to comma-split
      }
    }

    if (raw.includes(",")) {
      return raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    }

    return [raw]
  }

  if (v && typeof v === "object") {
    // Handle cases like { "0": "prod_...", "1": "prod_..." }
    const values = Object.values(v)
    if (values.every((x) => typeof x === "string")) {
      return (values as string[]).map((s) => s.trim()).filter(Boolean)
    }
  }

  return []
}

function asEntityList<T = any>(value: unknown): T[] {
  if (!value) return []
  if (Array.isArray(value)) {
    // Some Medusa APIs use listAndCount and return [entities, count].
    if (value.length === 2 && Array.isArray(value[0]) && typeof value[1] === "number") {
      return value[0] as T[]
    }
    return value as T[]
  }
  return []
}

export function orderRequiresConsultation(order: any): boolean {
  const meta = (order?.metadata ?? {}) as Record<string, unknown>
  // If the order explicitly lists consult-required products, treat that as the source of truth.
  if (asStringArray(meta.consult_required_product_ids).length > 0) {
    return true
  }
  return (
    meta.requires_consultation === true ||
    meta.requires_consult === true ||
    String(meta.requires_consultation ?? "").toLowerCase() === "true" ||
    String(meta.requires_consult ?? "").toLowerCase() === "true"
  )
}

export function getConsultRequiredProductIds(order: any): string[] {
  const explicit = asStringArray(order?.metadata?.consult_required_product_ids)
  if (explicit.length) return explicit

  const items = Array.isArray(order?.items) ? (order.items as any[]) : []
  return items
    .map((it) => {
      return (
        asString(it?.product_id) ||
        asString(it?.variant?.product_id) ||
        asString(it?.variant?.product?.id) ||
        asString(it?.product?.id)
      )
    })
    .filter((x): x is string => !!x)
}

async function resolveConsultRequiredProducts(container: any, order: any): Promise<string[]> {
  // Prefer explicit list written during order initialization if present.
  const explicit = asStringArray(order?.metadata?.consult_required_product_ids)
  if (explicit.length) return explicit

  // If the order was retrieved with `items.variant.product`, we can infer consult-required
  // products without extra DB calls.
  const items = Array.isArray(order?.items) ? (order.items as any[]) : []
  const inferredFromLoadedProducts = items
    .map((it) => it?.variant?.product ?? it?.product ?? null)
    .filter(Boolean)
    .filter((p: any) => {
      const meta = (p?.metadata ?? {}) as Record<string, unknown>
      const rc = meta.requires_consult
      const rct = meta.requires_consultation
      return (
        rc === true ||
        rct === true ||
        String(rc ?? "").toLowerCase() === "true" ||
        String(rct ?? "").toLowerCase() === "true"
      )
    })
    .map((p: any) => asString(p?.id))
    .filter((x): x is string => !!x)

  if (inferredFromLoadedProducts.length) {
    return Array.from(new Set(inferredFromLoadedProducts))
  }

  const productIds = getConsultRequiredProductIds(order)
  if (!productIds.length) return []

  const productService = container.resolve(Modules.PRODUCT) as any
  const products = await Promise.all(
    productIds.map((id) => productService.retrieveProduct(id).catch(() => null))
  )

  const consultRequired = products
    .filter(Boolean)
    .filter((p: any) => {
      const meta = (p?.metadata ?? {}) as Record<string, unknown>
      const rc = meta.requires_consult
      const rct = meta.requires_consultation
      return (
        rc === true ||
        rct === true ||
        String(rc ?? "").toLowerCase() === "true" ||
        String(rct ?? "").toLowerCase() === "true"
      )
    })

  return consultRequired
    .map((p: any) => asString(p?.id))
    .filter((x): x is string => !!x)
}

export async function assertConsultApprovedForFulfillment(container: any, order: any) {
  // Compute consult requirement from product metadata when possible.
  // This avoids relying on mutable order metadata flags.
  const consultProductIds = await resolveConsultRequiredProducts(container, order)

  if (consultProductIds.length === 0) {
    // Fail-closed: if the order indicates consultation is required but we can't identify
    // which products require it, do not allow fulfillment transitions.
    if (!orderRequiresConsultation(order)) return

    const fallback = getConsultRequiredProductIds(order)
    if (!fallback.length) {
      throw new Error("CONSULT_APPROVAL_REQUIRED_FOR_FULFILLMENT: missing consult_required_product_ids")
    }

    consultProductIds.push(...fallback)
  }

  const businessId = asString(order?.metadata?.business_id)
  const customerId = asString(order?.customer_id) || asString(order?.customer?.id)
  if (!businessId || !customerId) {
    throw new Error("CONSULT_APPROVAL_REQUIRED_FOR_FULFILLMENT: missing business_id or customer_id")
  }

  if (!consultProductIds.length) {
    throw new Error("CONSULT_APPROVAL_REQUIRED_FOR_FULFILLMENT: missing consult_required_product_ids")
  }

  const businessService = container.resolve(BUSINESS_MODULE) as any
  const now = Date.now()

  for (const productId of consultProductIds) {
    const approvalsRaw = await businessService.listConsultApprovals(
      { business_id: businessId, customer_id: customerId, product_id: productId, status: "approved" },
      { take: 1, order: { approved_at: "DESC" } }
    )

    const approvals = asEntityList<any>(approvalsRaw)
    const approval = approvals?.[0] ?? null
    if (!approval || approval.status !== "approved") {
      throw new Error(`CONSULT_APPROVAL_REQUIRED_FOR_FULFILLMENT: missing approval for product ${productId}`)
    }

    const expiresAt = approval.expires_at ? new Date(approval.expires_at).getTime() : null
    if (expiresAt && expiresAt <= now) {
      throw new Error(`CONSULT_APPROVAL_REQUIRED_FOR_FULFILLMENT: expired approval for product ${productId}`)
    }
  }
}
