import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { BUSINESS_MODULE } from "../../../../modules/business"
import { CONSULTATION_MODULE } from "../../../../modules/consultation"
import { FINANCIALS_MODULE } from "../../../../modules/financials"

function isoDay(date: Date): string {
  return date.toISOString().split("T")[0]
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

function addUtcDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

function asIntegerCents(value: any): number {
  if (value == null) return 0
  if (typeof value === "number") return Math.trunc(value)
  if (typeof value === "string") return parseInt(value, 10) || 0
  if (typeof value === "object" && typeof value.value === "string") {
    return parseInt(value.value, 10) || 0
  }
  return Number(value) || 0
}

function getCustomOrderStatus(order: any): string {
  const fromMetadata = order?.metadata?.custom_status
  if (typeof fromMetadata === "string" && fromMetadata.trim()) {
    return fromMetadata.trim()
  }

  // Fallback: derive a coarse status from Medusa fields.
  if (order?.status === "pending") return "pending"
  if (order?.status === "completed") return "delivered"
  if (order?.status === "canceled") return "cancelled"
  return "pending"
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const now = new Date()

    const businessService = req.scope.resolve(BUSINESS_MODULE) as any
    const consultationService = req.scope.resolve(CONSULTATION_MODULE) as any
    const financialsService = req.scope.resolve(FINANCIALS_MODULE) as any
    const complianceService = req.scope.resolve("complianceModuleService") as any

    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as any

    // -----------------------------------------------------------------------
    // Date boundaries (UTC)
    // -----------------------------------------------------------------------
    const todayStart = startOfUtcDay(now)
    const tomorrowStart = addUtcDays(todayStart, 1)

    const monthStart = startOfUtcMonth(now)
    const nextMonthStart = startOfUtcMonth(addUtcDays(monthStart, 35))

    const trendStart = startOfUtcDay(addUtcDays(now, -29))
    const trendDays: string[] = []
    for (let i = 0; i < 30; i++) {
      trendDays.push(isoDay(addUtcDays(trendStart, i)))
    }

    // -----------------------------------------------------------------------
    // Businesses: total and % change vs last month
    // % change = (current_total - total_at_month_start) / total_at_month_start
    // -----------------------------------------------------------------------
    const [, totalBusinesses] = await businessService.listAndCountBusinesses({}, { take: 1 })
    const [, businessesBeforeMonth] = await businessService.listAndCountBusinesses(
      { created_at: { $lt: monthStart } },
      { take: 1 }
    )

    const changePct =
      businessesBeforeMonth > 0
        ? Math.round(((totalBusinesses - businessesBeforeMonth) / businessesBeforeMonth) * 1000) / 10
        : null

    // -----------------------------------------------------------------------
    // Consultations metrics
    // - Active consultations: scheduled today
    // - Pending reviews: completed but outcome is pending/null (awaiting approval)
    // -----------------------------------------------------------------------
    const [, activeConsultations] = await consultationService.listAndCountConsultations(
      {
        status: "scheduled",
        scheduled_at: { $gte: todayStart, $lt: tomorrowStart },
      },
      { take: 1 }
    )

    const [, pendingReviews] = await consultationService.listAndCountConsultations(
      { status: "completed", outcome: "pending" },
      { take: 1 }
    )

    // -----------------------------------------------------------------------
    // Revenue this month (gross + platform commission)
    // -----------------------------------------------------------------------
    const earningsThisMonth = (await financialsService.listEarningEntries(
      { created_at: { $gte: monthStart, $lt: nextMonthStart } },
      { order: { created_at: "DESC" } }
    )) as any[]

    let monthGross = 0
    let monthPlatformFees = 0
    for (const e of earningsThisMonth) {
      if (!e || e.status === "reversed") continue
      monthGross += asIntegerCents(e.gross_amount)
      monthPlatformFees += asIntegerCents(e.platform_fee)
    }

    // -----------------------------------------------------------------------
    // Activity feed (last 20 from audit_log)
    // -----------------------------------------------------------------------
    const activityResult = await complianceService.queryAuditLogs({ take: 20, skip: 0 })

    // -----------------------------------------------------------------------
    // Revenue trend (30 days)
    // -----------------------------------------------------------------------
    const earningsTrend = (await financialsService.listEarningEntries(
      { created_at: { $gte: trendStart } },
      { order: { created_at: "ASC" } }
    )) as any[]

    const trendMap = new Map<string, { gross: number; platform: number }>()
    for (const day of trendDays) {
      trendMap.set(day, { gross: 0, platform: 0 })
    }

    for (const e of earningsTrend) {
      if (!e || e.status === "reversed") continue
      const day = isoDay(new Date(e.created_at))
      const bucket = trendMap.get(day)
      if (!bucket) continue
      bucket.gross += asIntegerCents(e.gross_amount)
      bucket.platform += asIntegerCents(e.platform_fee)
    }

    const revenueTrendPoints = trendDays.map((day) => {
      const bucket = trendMap.get(day) || { gross: 0, platform: 0 }
      return {
        date: day,
        gross_cents: bucket.gross,
        platform_commission_cents: bucket.platform,
      }
    })

    // -----------------------------------------------------------------------
    // Consultations by status (pie)
    // PLAN states: pending → scheduled → completed → approved/rejected
    // We map model fields to "PLAN status" buckets:
    // - pending: status=draft
    // - scheduled: status=scheduled
    // - completed: status=completed & outcome=pending/null
    // - approved: status=completed & outcome=approved
    // - rejected: status=completed & outcome=rejected
    // -----------------------------------------------------------------------
    const [, pendingCount] = await consultationService.listAndCountConsultations(
      { status: "draft", created_at: { $gte: trendStart } },
      { take: 1 }
    )
    const [, scheduledCount] = await consultationService.listAndCountConsultations(
      { status: "scheduled", created_at: { $gte: trendStart } },
      { take: 1 }
    )
    const [, completedCount] = await consultationService.listAndCountConsultations(
      { status: "completed", outcome: "pending", created_at: { $gte: trendStart } },
      { take: 1 }
    )
    const [, approvedCount] = await consultationService.listAndCountConsultations(
      { status: "completed", outcome: "approved", created_at: { $gte: trendStart } },
      { take: 1 }
    )
    const [, rejectedCount] = await consultationService.listAndCountConsultations(
      { status: "completed", outcome: "rejected", created_at: { $gte: trendStart } },
      { take: 1 }
    )

    const consultationSegments = [
      { status: "pending", count: pendingCount },
      { status: "scheduled", count: scheduledCount },
      { status: "completed", count: completedCount },
      { status: "approved", count: approvedCount },
      { status: "rejected", count: rejectedCount },
    ]

    // -----------------------------------------------------------------------
    // Orders in progress + Orders by business (top 10)
    // We primarily use `metadata.business_id` (present in existing code/tests),
    // and `metadata.custom_status` for the PLAN-specific lifecycle status.
    // -----------------------------------------------------------------------
    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "created_at", "status", "metadata"],
    })

    const orderBusinessCounts = new Map<string, number>()
    let ordersInProgress = 0

    for (const o of orders as any[]) {
      const createdAt = new Date(o.created_at)
      if (createdAt < trendStart) continue

      const customStatus = getCustomOrderStatus(o)
      if (["in_production", "shipped", "processing", "fulfilled"].includes(customStatus)) {
        ordersInProgress += 1
      }

      const businessId =
        (typeof o?.metadata?.business_id === "string" && o.metadata.business_id) || ""

      if (!businessId) continue
      orderBusinessCounts.set(businessId, (orderBusinessCounts.get(businessId) || 0) + 1)
    }

    const topBusiness = Array.from(orderBusinessCounts.entries())
      .map(([business_id, count]) => ({ business_id, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    const businessLookups = await Promise.all(
      topBusiness.map(async (b) => {
        const list = (await businessService.listBusinesses({ id: b.business_id }, { take: 1 })) as any[]
        const business = list?.[0]
        return {
          ...b,
          business_name: business?.name || b.business_id,
        }
      })
    )

    return res.json({
      generated_at: now.toISOString(),
      metrics: {
        total_businesses: { value: totalBusinesses, change_pct: changePct },
        active_consultations: { value: activeConsultations },
        pending_reviews: { value: pendingReviews },
        revenue_this_month: {
          gross_cents: monthGross,
          platform_commission_cents: monthPlatformFees,
        },
        orders_in_progress: { value: ordersInProgress },
      },
      activity: {
        logs: activityResult?.logs || [],
        count: activityResult?.count || 0,
      },
      charts: {
        revenue_trend_30d: { points: revenueTrendPoints },
        consultations_by_status: { segments: consultationSegments },
        orders_by_business_top10: { bars: businessLookups },
      },
    })
  } catch (error) {
    return res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "Failed to generate dashboard home data",
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
