import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { FINANCIALS_MODULE } from "../../../modules/financials"

interface EarningsQueryParams {
  business_id?: string
  business_ids?: string
  q?: string
  status?: string
  type?: string
  date_from?: string
  date_to?: string
  limit?: string
  offset?: string
}

function parseCommaList(value?: string): string[] {
  if (!value) return []
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
}

function mapPlanStatusToInternal(status: string): string[] {
  const s = status.trim().toLowerCase()
  if (s === "completed") return ["available", "paid"]
  if (s === "pending") return ["pending"]
  if (s === "paid_out") return ["paid_out"]
  if (s === "refunded") return ["reversed"]
  return [status]
}

function mapPlanTypeToInternal(type: string): string[] {
  const t = type.trim().toLowerCase()
  if (t === "commission") return ["product_sale", "platform_fee"]
  if (t === "consult_fee" || t === "consultation_fee") return ["consultation_fee"]
  if (t === "service_fee") return ["shipping_fee", "clinician_fee"]
  return [type]
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const financialsService = req.scope.resolve(FINANCIALS_MODULE) as any
    const query = req.query as EarningsQueryParams

    // Parse pagination
    const limit = Math.min(Math.max(parseInt(query.limit ?? "25", 10) || 25, 1), 100)
    const offset = Math.max(parseInt(query.offset ?? "0", 10) || 0, 0)

    // Build filters
    const filters: any = {}

    const businessIds = parseCommaList(query.business_ids || query.business_id)
    if (businessIds.length === 1) filters.business_id = businessIds[0]
    else if (businessIds.length > 1) filters.business_id = businessIds

    const statuses = parseCommaList(query.status)
    if (statuses.length) {
      const mapped = Array.from(new Set(statuses.flatMap(mapPlanStatusToInternal)))
      filters.status = mapped.length === 1 ? mapped[0] : mapped
    }

    const types = parseCommaList(query.type)
    if (types.length) {
      const mapped = Array.from(new Set(types.flatMap(mapPlanTypeToInternal)))
      filters.type = mapped.length === 1 ? mapped[0] : mapped
    }
    if (query.date_from || query.date_to) {
      filters.created_at = {}
      if (query.date_from) {
        filters.created_at.$gte = new Date(query.date_from)
      }
      if (query.date_to) {
        filters.created_at.$lte = new Date(query.date_to)
      }
    }

    const q = (query.q || "").trim()

    // If q is provided, we scan a wider set and filter in-memory by order ID / earning ID.
    const scanTarget = q ? Math.min(Math.max(offset + limit, 500), 10000) : offset + limit

    const [earnings, countBeforeFilter] = await financialsService.listAndCountEarningEntries(
      filters,
      {
        take: scanTarget,
        skip: 0,
        order: { created_at: "DESC" },
      }
    )

    let filtered = earnings as any[]
    if (q) {
      const qq = q.toLowerCase()
      filtered = filtered.filter((e) => {
        const id = `${e?.id || ""}`.toLowerCase()
        const orderId = `${e?.order_id || ""}`.toLowerCase()
        return id.includes(qq) || orderId.includes(qq)
      })
    }

    const count = q ? filtered.length : (countBeforeFilter as number)
    const page = q ? filtered.slice(offset, offset + limit) : (earnings as any[]).slice(offset, offset + limit)

    res.json({
      earnings: page,
      count,
      limit,
      offset,
    })
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch earnings",
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
