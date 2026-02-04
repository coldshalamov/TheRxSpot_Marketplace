import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { FINANCIALS_MODULE } from "../../../modules/financials"

interface PayoutsQueryParams {
  business_id?: string
  status?: string
  limit?: string
  offset?: string
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const financialsService = req.scope.resolve(FINANCIALS_MODULE)
    const query = req.query as PayoutsQueryParams

    // Parse pagination
    const limit = parseInt(query.limit ?? "20", 10)
    const offset = parseInt(query.offset ?? "0", 10)

    // Build filters
    const filters: any = {}
    if (query.business_id) {
      filters.business_id = query.business_id
    }
    if (query.status) {
      filters.status = query.status
    }

    // Get payouts with pagination
    const [payouts, count] = await financialsService.listAndCountPayouts(filters, {
      take: limit,
      skip: offset,
      order: { created_at: "DESC" },
    })

    res.json({
      payouts,
      count,
      pagination: {
        limit,
        offset,
        has_more: offset + payouts.length < count,
      },
    })
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch payouts",
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const financialsService = req.scope.resolve(FINANCIALS_MODULE) as any
    const complianceService = req.scope.resolve("complianceModuleService") as any
    const authContext = (req as any).auth_context as
      | { actor_id?: string; actor_type?: string; actor_email?: string; business_id?: string; metadata?: any; app_metadata?: any }
      | undefined

    const actorId = authContext?.actor_id || "unknown"
    const actorType = ((authContext?.actor_type || "business_user") === "user"
      ? "business_user"
      : authContext?.actor_type || "business_user") as any

    const body = (req.body ?? {}) as Record<string, any>

    const businessIdRaw =
      (typeof body.business_id === "string" ? body.business_id.trim() : "") ||
      (authContext?.business_id || authContext?.metadata?.business_id || authContext?.app_metadata?.business_id || (req as any)?.tenant_context?.business_id || "")

    const businessId = `${businessIdRaw}`.trim()
    if (!businessId) {
      return res.status(400).json({ code: "INVALID_INPUT", message: "business_id is required" })
    }

    // Basic idempotency via header or body + unique index (`payout.idempotency_key`)
    const headerKey = (req.headers["idempotency-key"] as string | undefined)?.trim()
    const idempotencyKey = (typeof body.idempotency_key === "string" ? body.idempotency_key.trim() : "") || headerKey || ""

    if (idempotencyKey) {
      const [existing] = await financialsService.listAndCountPayouts(
        { business_id: businessId, idempotency_key: idempotencyKey },
        { take: 1 }
      )
      if (existing?.[0]) {
        return res.status(200).json({ payout: existing[0], idempotent: true })
      }
    }

    const methodRaw =
      (typeof body.method === "string" ? body.method.trim() : "") ||
      (typeof body.payout_method === "string" ? body.payout_method.trim() : "") ||
      "stripe_connect"

    const method = methodRaw as "stripe_connect" | "ach" | "wire"
    if (!["stripe_connect", "ach", "wire"].includes(method)) {
      return res.status(400).json({
        code: "INVALID_INPUT",
        message: "method must be one of: stripe_connect, ach, wire",
      })
    }

    const destinationAccount =
      typeof body.destination_account === "string" ? body.destination_account.trim() : null

    if ((method === "ach" || method === "wire") && !destinationAccount) {
      return res.status(400).json({
        code: "INVALID_INPUT",
        message: "destination_account is required for ach and wire payouts",
      })
    }

    const amount = typeof body.amount === "number" ? Math.trunc(body.amount) : undefined
    if (amount != null && (!Number.isFinite(amount) || amount <= 0)) {
      return res.status(400).json({
        code: "INVALID_INPUT",
        message: "amount must be a positive integer (cents)",
      })
    }

    const earningEntryIds = Array.isArray(body.earning_entry_ids) ? body.earning_entry_ids : null

    const asCents = (value: any): number => {
      if (value == null) return 0
      if (typeof value === "number") return Math.trunc(value)
      if (typeof value === "string") return parseInt(value, 10) || 0
      if (typeof value === "object" && typeof value.value === "string") return parseInt(value.value, 10) || 0
      return Number(value) || 0
    }

    const createId = (prefix: string) =>
      `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`

    const splitEarningForAmount = async (earning: any, takeNet: number): Promise<any> => {
      const originalNet = asCents(earning.net_amount)
      if (takeNet <= 0 || takeNet >= originalNet) {
        throw new Error("Invalid split amount")
      }

      const originalGross = asCents(earning.gross_amount)
      const originalPlatform = asCents(earning.platform_fee)
      const originalProcessing = asCents(earning.payment_processing_fee)
      const originalClinician = earning.clinician_fee != null ? asCents(earning.clinician_fee) : null

      const partGross = Math.floor((originalGross * takeNet) / originalNet)
      const partPlatform = Math.floor((originalPlatform * takeNet) / originalNet)
      const partProcessing = partGross - partPlatform - takeNet

      if (partProcessing < 0 || partProcessing > originalProcessing) {
        throw new Error("Unable to split earning amounts safely")
      }

      const partClinician =
        originalClinician != null ? Math.floor((originalClinician * takeNet) / originalNet) : null

      const remainderGross = originalGross - partGross
      const remainderPlatform = originalPlatform - partPlatform
      const remainderProcessing = originalProcessing - partProcessing
      const remainderNet = originalNet - takeNet
      const remainderClinician = originalClinician != null ? originalClinician - partClinician! : null

      // Update original earning to the remainder (stays available)
      await financialsService.updateEarningEntries({
        id: earning.id,
        gross_amount: remainderGross,
        platform_fee: remainderPlatform,
        payment_processing_fee: remainderProcessing,
        net_amount: remainderNet,
        clinician_fee: remainderClinician,
        metadata: {
          ...(earning.metadata || {}),
          split: { created_at: new Date().toISOString(), original_id: earning.id },
        },
      })

      // Create a new earning entry for the payout portion (available now)
      const split = await financialsService.createEarningEntries({
        id: createId("earn_split"),
        business_id: earning.business_id,
        order_id: earning.order_id ?? null,
        line_item_id: earning.line_item_id ?? null,
        consultation_id: earning.consultation_id ?? null,
        type: earning.type,
        description: `${earning.description || "Earning"} (partial payout)`,
        gross_amount: partGross,
        platform_fee: partPlatform,
        payment_processing_fee: partProcessing,
        net_amount: takeNet,
        clinician_fee: partClinician,
        status: "available",
        available_at: earning.available_at ?? new Date(),
        paid_at: null,
        payout_id: null,
        metadata: {
          ...(earning.metadata || {}),
          split_from: earning.id,
          split_reason: "payout_amount_allocation",
        },
      })

      return split
    }

    // Resolve and validate eligible earnings
    let availableEarnings: any[] = []

    if (earningEntryIds && earningEntryIds.length) {
      // Explicit selection path (backwards compatible)
      const items = (await Promise.all(
        earningEntryIds.map((id: string) => financialsService.retrieveEarningEntry(id))
      )) as any[]

      for (const earning of items) {
        if (!earning) {
          return res.status(400).json({ code: "INVALID_INPUT", message: "Invalid earning entry id" })
        }
        if (earning.business_id !== businessId) {
          return res.status(403).json({ code: "FORBIDDEN", message: "Earning does not belong to business" })
        }
        if (earning.status !== "available" || earning.payout_id) {
          return res.status(400).json({ code: "INVALID_INPUT", message: "All earnings must be available and not already linked to a payout" })
        }
      }

      availableEarnings = items
    } else {
      // Amount-based allocation path (PLAN)
      const [earnings] = await financialsService.listAndCountEarningEntries(
        { business_id: businessId, status: "available", payout_id: null },
        { order: { created_at: "ASC" }, take: 1000 }
      )
      availableEarnings = earnings || []
    }

    const availableTotal = availableEarnings.reduce((sum, e) => sum + asCents(e.net_amount), 0)

    const requestedAmount = amount != null ? amount : availableTotal
    if (requestedAmount <= 0) {
      return res.status(400).json({
        code: "NO_AVAILABLE_BALANCE",
        message: "No available balance to request payout",
      })
    }

    if (requestedAmount > availableTotal) {
      return res.status(400).json({
        code: "AMOUNT_EXCEEDS_AVAILABLE",
        message: `Requested amount exceeds available balance (${availableTotal})`,
      })
    }

    // If explicit IDs were provided, enforce exact sum (no splitting)
    let selected: any[] = []
    if (earningEntryIds && earningEntryIds.length) {
      selected = availableEarnings
      const selectedTotal = selected.reduce((sum, e) => sum + asCents(e.net_amount), 0)
      if (requestedAmount !== selectedTotal) {
        return res.status(400).json({
          code: "AMOUNT_MISMATCH",
          message: `amount (${requestedAmount}) must equal sum of selected earnings (${selectedTotal}) when earning_entry_ids is provided`,
        })
      }
    } else {
      // Allocate by amount, splitting the final earning entry if needed
      let remaining = requestedAmount
      for (const earning of availableEarnings) {
        if (remaining <= 0) break
        const net = asCents(earning.net_amount)
        if (net <= remaining) {
          selected.push(earning)
          remaining -= net
        } else {
          const split = await splitEarningForAmount(earning, remaining)
          selected.push(split)
          remaining = 0
        }
      }

      if (remaining !== 0) {
        return res.status(400).json({
          code: "ALLOCATION_FAILED",
          message: "Unable to allocate earnings for requested payout amount",
        })
      }
    }

    const totalAmount = selected.reduce((sum, e) => sum + asCents(e.gross_amount), 0)
    const feeAmount =
      selected.reduce((sum, e) => sum + asCents(e.platform_fee), 0) +
      selected.reduce((sum, e) => sum + asCents(e.payment_processing_fee), 0)
    const netAmount = selected.reduce((sum, e) => sum + asCents(e.net_amount), 0)

    // Create payout record
    const payout = await financialsService.createPayouts({
      id: createId("payout"),
      business_id: businessId,
      idempotency_key: idempotencyKey || null,
      total_amount: totalAmount,
      fee_amount: feeAmount,
      net_amount: netAmount,
      status: "pending",
      method,
      destination_account: destinationAccount,
      requested_at: new Date(),
      processed_at: null,
      completed_at: null,
      transaction_id: null,
      failure_reason: null,
      earning_entries: selected.map((e) => e.id),
      metadata: {
        requested_by: actorId,
        requested_amount: requestedAmount,
      },
    })

    // Mark earnings as "paid out" in PLAN terms: lock them to this payout and remove from available balance.
    for (const earning of selected) {
      await financialsService.updateEarningEntries({
        id: earning.id,
        payout_id: payout.id,
        status: "paid_out",
        metadata: {
          ...(earning.metadata || {}),
          paid_out_at: new Date().toISOString(),
          paid_out_by: actorId,
          payout_method: method,
        },
      })
    }

    // Audit log (payout create)
    await complianceService?.logAuditEvent?.({
      actor_type: actorType,
      actor_id: actorId,
      actor_email: authContext?.actor_email ?? null,
      action: "create",
      entity_type: "payout",
      entity_id: payout.id,
      business_id: businessId,
      changes: { before: null, after: { id: payout.id, net_amount: netAmount, method } },
      metadata: {
        earning_entry_ids: selected.map((e) => e.id),
        idempotency_key: idempotencyKey || null,
      },
      risk_level: "medium",
    })

    // Notification stub: event emission (email infra later)
    try {
      const eventBus = (req.scope as any).resolve?.("event_bus") ?? null
      await eventBus?.emit?.("payout.requested", {
        payout_id: payout.id,
        business_id: businessId,
        amount: netAmount,
        method,
      })
    } catch {
      // best-effort
    }

    res.status(201).json({ payout })
  } catch (error) {
    res.status(500).json({
      message: "Failed to create payout",
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
