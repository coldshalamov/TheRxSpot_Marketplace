import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { FINANCIALS_MODULE } from "../../../../modules/financials"

type EarningsType =
  | "product_sale"
  | "consultation_fee"
  | "shipping_fee"
  | "platform_fee"
  | "clinician_fee"

interface SummaryQueryParams {
  business_id?: string
  business_ids?: string
  date_from?: string
  date_to?: string
}

function parseCommaList(value?: string): string[] {
  if (!value) return []
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
}

function parseIsoDate(value?: string): Date | undefined {
  if (!value) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return undefined
  }
  return date
}

function asIntegerCents(value: any): number {
  if (value == null) return 0
  if (typeof value === "number") return Math.trunc(value)
  if (typeof value === "string") return parseInt(value, 10) || 0
  // Medusa BigNumber sometimes serializes as `{ value, precision }`
  if (typeof value === "object" && typeof value.value === "string") {
    return parseInt(value.value, 10) || 0
  }
  return Number(value) || 0
}

function getOptionalTenantBusinessId(req: MedusaRequest): string | undefined {
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

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const financialsService = req.scope.resolve(FINANCIALS_MODULE) as any
    const query = req.query as SummaryQueryParams

    const tenantBusinessId = getOptionalTenantBusinessId(req)

    const requestedBusinessIds = parseCommaList(query.business_ids || query.business_id)
    if (tenantBusinessId && requestedBusinessIds.length && !requestedBusinessIds.includes(tenantBusinessId)) {
      return res.status(403).json({
        code: "FORBIDDEN",
        message: "business_id is restricted by tenant context",
      })
    }

    const businessIds = tenantBusinessId ? [tenantBusinessId] : requestedBusinessIds

    const dateFrom = parseIsoDate(query.date_from)
    const dateTo = parseIsoDate(query.date_to)
    if (query.date_from && !dateFrom) {
      return res.status(400).json({
        code: "INVALID_INPUT",
        message: "date_from must be a valid ISO date string",
      })
    }
    if (query.date_to && !dateTo) {
      return res.status(400).json({
        code: "INVALID_INPUT",
        message: "date_to must be a valid ISO date string",
      })
    }

    const filters: any = {}
    if (businessIds.length === 1) {
      filters.business_id = businessIds[0]
    } else if (businessIds.length > 1) {
      filters.business_id = businessIds
    }
    if (dateFrom || dateTo) {
      filters.created_at = {}
      if (dateFrom) filters.created_at.$gte = dateFrom
      if (dateTo) filters.created_at.$lte = dateTo
    }

    const earnings = (await financialsService.listEarningEntries(filters, {
      order: { created_at: "DESC" },
    })) as any[]

    const breakdown = {
      commission: 0,
      consultation_fee: 0,
      service_fee: 0,
    }

    let totalEarnings = 0
    let commissionBalance = 0
    let pendingPayout = 0
    let platformCommissionBalance = 0
    let commissionPending = 0

    for (const earning of earnings) {
      if (!earning || earning.status === "reversed") continue

      const net = asIntegerCents(earning.net_amount)
      totalEarnings += net

      const platformFee = asIntegerCents(earning.platform_fee)
      if (earning.status === "pending") {
        commissionPending += platformFee
      } else {
        platformCommissionBalance += platformFee
      }

      const isAvailable = earning.status === "available" && !earning.payout_id
      if (isAvailable) {
        commissionBalance += net
      }

      const isPendingPayout = !!earning.payout_id && earning.status === "paid_out"
      if (isPendingPayout) {
        pendingPayout += net
      }

      const type = earning.type as EarningsType
      if (type === "consultation_fee") {
        breakdown.consultation_fee += net
      } else if (type === "product_sale" || type === "platform_fee") {
        breakdown.commission += net
      } else {
        breakdown.service_fee += net
      }
    }

    return res.json({
      business_id: businessIds.length === 1 ? businessIds[0] : null,
      business_ids: businessIds.length ? businessIds : null,
      date_from: dateFrom ? dateFrom.toISOString() : null,
      date_to: dateTo ? dateTo.toISOString() : null,
      pending_payout: pendingPayout,
      total_earnings: totalEarnings,
      commission_balance: commissionBalance,
      available_payout: commissionBalance,
      platform_commission_balance: platformCommissionBalance,
      commission_pending: commissionPending,
      breakdown,
    })
  } catch (error) {
    return res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "Failed to fetch earnings summary",
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
