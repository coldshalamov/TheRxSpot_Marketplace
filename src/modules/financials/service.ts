import { MedusaService } from "@medusajs/framework/utils"
import { EarningEntry } from "./models/earning-entry"
import { Payout } from "./models/payout"

// Configuration constants
const PLATFORM_FEE_PERCENT = 0.10 // 10%
const STRIPE_PERCENTAGE_FEE = 0.029 // 2.9%
const STRIPE_FIXED_FEE_CENTS = 30 // $0.30 in cents

function unwrapListResult<T>(result: any): T[] {
  if (Array.isArray(result?.[0])) {
    return result[0] as T[]
  }
  return (result || []) as T[]
}

// Types
export interface EarningsSummary {
  available: number
  pending: number
  lifetime: number
  ytd_payouts: number
  next_payout_date: Date | null
}

export interface EarningFilters {
  business_id?: string
  status?: string
  type?: string
  date_from?: Date
  date_to?: Date
}

export interface OrderItemInput {
  id: string
  unit_price: number
  quantity: number
  total: number
  currency_code?: string
  title?: string
}

export interface OrderInput {
  id: string
  business_id: string
  items: OrderItemInput[]
  shipping_total?: number
  currency_code?: string
}

export interface ConsultationInput {
  id: string
  business_id: string
  clinician_id?: string
  fee: number
  currency_code?: string
}

const FinancialsBaseService = MedusaService({
  EarningEntry,
  Payout,
}) as any

class FinancialsService extends FinancialsBaseService {
  private normalizeListArgs(filters: Record<string, any> = {}, config: any = {}) {
    const includeDeleted = !!(filters as any)?.include_deleted || !!(config as any)?.withDeleted
    const normalizedFilters = { ...(filters || {}) } as Record<string, any>
    delete (normalizedFilters as any).include_deleted

    if (!includeDeleted && normalizedFilters.deleted_at === undefined) {
      normalizedFilters.deleted_at = null
    }

    const normalizedConfig = { ...(config || {}) } as any
    if (includeDeleted) {
      normalizedConfig.withDeleted = true
    }

    return { filters: normalizedFilters, config: normalizedConfig }
  }

  // Ensure soft-deleted records are filtered out by default.
  async listEarningEntries(filters: Record<string, any> = {}, config: any = {}) {
    const { filters: f, config: c } = this.normalizeListArgs(filters, config)
    return await super.listEarningEntries(f, c)
  }
  async listAndCountEarningEntries(filters: Record<string, any> = {}, config: any = {}) {
    const { filters: f, config: c } = this.normalizeListArgs(filters, config)
    return await super.listAndCountEarningEntries(f, c)
  }
  async listPayouts(filters: Record<string, any> = {}, config: any = {}) {
    const { filters: f, config: c } = this.normalizeListArgs(filters, config)
    return await super.listPayouts(f, c)
  }
  async listAndCountPayouts(filters: Record<string, any> = {}, config: any = {}) {
    const { filters: f, config: c } = this.normalizeListArgs(filters, config)
    return await super.listAndCountPayouts(f, c)
  }

  // Soft delete (restore sets deleted_at back to null).
  async deleteEarningEntries(ids: string | string[]) {
    const list = Array.isArray(ids) ? ids : [ids]
    for (const id of list) {
      await (this as any).softDeleteEarningEntries(id)
    }
  }
  async deletePayouts(ids: string | string[]) {
    const list = Array.isArray(ids) ? ids : [ids]
    for (const id of list) {
      await (this as any).softDeletePayouts(id)
    }
  }

  /**
   * Calculate earnings for an order
   * Creates earning entries for each line item and shipping
   * 
   * CRITICAL FIX (BIZ-001): Stripe fee is calculated at ORDER level, not per line item.
   * The $0.30 fixed fee is applied once per transaction, then distributed proportionally.
   * 
   * Example:
   * - Order with 2 items: $100 + $50 = $150 total
   * - Stripe fee: $150 × 2.9% + $0.30 = $4.65 (not $4.95 if calculated per item)
   * - Fixed fee is distributed proportionally: item 1 gets $0.20, item 2 gets $0.10
   */
  async calculateEarningsOnOrder(order: OrderInput): Promise<typeof EarningEntry[]> {
    const earnings: typeof EarningEntry[] = []

    // Calculate order-level totals for Stripe fee calculation
    const orderSubtotal = order.items.reduce((sum, item) => sum + item.total, 0)
    const shippingTotal = order.shipping_total || 0
    const orderTotal = orderSubtotal + shippingTotal
    const orderTotalCents = Math.round(orderTotal * 100)

    // Calculate Stripe fee at ORDER level (not per item)
    // This ensures the $0.30 fixed fee is only charged once per transaction
    const orderStripePercentageFee = Math.round(orderTotalCents * STRIPE_PERCENTAGE_FEE)
    const orderStripeFixedFee = STRIPE_FIXED_FEE_CENTS // $0.30 applied once
    const totalStripeFee = orderStripePercentageFee + orderStripeFixedFee

    // Calculate total platform fee for proportion calculations
    const totalPlatformFee = Math.round(orderTotalCents * PLATFORM_FEE_PERCENT)

    // Calculate proportional fees for each line item
    for (const item of order.items) {
      const grossAmount = Math.round(item.total * 100) // Convert to cents
      const itemRatio = orderTotalCents > 0 ? grossAmount / orderTotalCents : 0

      // Platform fee (calculated per item)
      const platformFee = Math.round(grossAmount * PLATFORM_FEE_PERCENT)

      // Distribute Stripe fee proportionally based on item value
      // Percentage portion is proportional to item's share
      const itemStripePercentageFee = Math.round(orderStripePercentageFee * itemRatio)
      // Fixed portion is distributed proportionally
      const itemStripeFixedFee = Math.round(orderStripeFixedFee * itemRatio)
      const processingFee = itemStripePercentageFee + itemStripeFixedFee

      const netAmount = grossAmount - platformFee - processingFee

      const earning = await this.createEarningEntries({
        business_id: order.business_id,
        order_id: order.id,
        line_item_id: item.id,
        type: "product_sale",
        description: item.title || `Product sale for order ${order.id}`,
        gross_amount: grossAmount,
        platform_fee: platformFee,
        payment_processing_fee: processingFee,
        net_amount: netAmount,
        status: "pending",
        available_at: null,
        metadata: {
          currency_code: order.currency_code || "usd",
          quantity: item.quantity,
          unit_price: item.unit_price,
          // Track fee distribution for auditing
          stripe_fee_breakdown: {
            percentage_portion: itemStripePercentageFee,
            fixed_portion: itemStripeFixedFee,
            item_ratio: itemRatio,
          },
        },
      })

      earnings.push(earning)
    }

    // Calculate earnings for shipping if applicable
    if (order.shipping_total && order.shipping_total > 0) {
      const grossAmount = Math.round(order.shipping_total * 100)
      const shippingRatio = orderTotalCents > 0 ? grossAmount / orderTotalCents : 0

      // Platform fee (calculated per shipping)
      const platformFee = Math.round(grossAmount * PLATFORM_FEE_PERCENT)

      // Distribute Stripe fee proportionally
      const shippingStripePercentageFee = Math.round(orderStripePercentageFee * shippingRatio)
      const shippingStripeFixedFee = Math.round(orderStripeFixedFee * shippingRatio)
      const processingFee = shippingStripePercentageFee + shippingStripeFixedFee

      const netAmount = grossAmount - platformFee - processingFee

      const earning = await this.createEarningEntries({
        business_id: order.business_id,
        order_id: order.id,
        line_item_id: null,
        type: "shipping_fee",
        description: `Shipping for order ${order.id}`,
        gross_amount: grossAmount,
        platform_fee: platformFee,
        payment_processing_fee: processingFee,
        net_amount: netAmount,
        status: "pending",
        available_at: null,
        metadata: {
          currency_code: order.currency_code || "usd",
          stripe_fee_breakdown: {
            percentage_portion: shippingStripePercentageFee,
            fixed_portion: shippingStripeFixedFee,
            shipping_ratio: shippingRatio,
          },
        },
      })

      earnings.push(earning)
    }

    return earnings
  }

  /**
   * Calculate earnings for a consultation
   * Splits consultation fee between business and clinician
   */
  async calculateConsultationEarnings(consultation: ConsultationInput): Promise<typeof EarningEntry[]> {
    const earnings: typeof EarningEntry[] = []
    const totalFee = Math.round(consultation.fee * 100)

    // Platform fee on consultation
    const platformFee = Math.round(totalFee * PLATFORM_FEE_PERCENT)
    const remainingAfterPlatform = totalFee - platformFee

    // Split remaining between clinician (70%) and business (30%)
    const clinicianFee = Math.round(remainingAfterPlatform * 0.70)
    const businessFee = remainingAfterPlatform - clinicianFee

    // Create earning entry for clinician
    if (consultation.clinician_id) {
      const clinicianEarning = await this.createEarningEntries({
        business_id: consultation.clinician_id, // Clinician gets paid directly
        order_id: null,
        consultation_id: consultation.id,
        type: "clinician_fee",
        description: `Consultation fee for consultation ${consultation.id}`,
        gross_amount: clinicianFee,
        platform_fee: 0, // Platform fee already deducted
        payment_processing_fee: 0, // Will be handled separately
        net_amount: clinicianFee,
        clinician_fee: null,
        status: "pending",
        available_at: null,
        metadata: {
          recipient_type: "clinician",
          original_consultation_fee: totalFee,
          clinician_share_percent: 70,
        },
      })
      earnings.push(clinicianEarning)
    }

    // Create earning entry for business
    const businessEarning = await this.createEarningEntries({
      business_id: consultation.business_id,
      order_id: null,
      consultation_id: consultation.id,
      type: "consultation_fee",
      description: `Consultation fee for consultation ${consultation.id}`,
      gross_amount: businessFee,
      platform_fee: platformFee,
      payment_processing_fee: 0, // Will be calculated at payout
      net_amount: businessFee,
      clinician_fee: consultation.clinician_id ? clinicianFee : null,
      status: "pending",
      available_at: null,
      metadata: {
        recipient_type: "business",
        original_consultation_fee: totalFee,
        business_share_percent: 30,
      },
    })
    earnings.push(businessEarning)

    return earnings
  }

  /**
   * Get earnings summary for a business
   */
  async getEarningsSummary(businessId: string): Promise<EarningsSummary> {
    // Get available earnings (status = 'available')
    const availableEarningsRes = await this.listEarningEntries({
      business_id: businessId,
      status: "available",
    })
    const availableEarnings = unwrapListResult<any>(availableEarningsRes)
    const available = availableEarnings.reduce((sum, e) => sum + Number(e.net_amount), 0)

    // Get pending earnings (status = 'pending')
    const pendingEarningsRes = await this.listEarningEntries({
      business_id: businessId,
      status: "pending",
    })
    const pendingEarnings = unwrapListResult<any>(pendingEarningsRes)
    const pending = pendingEarnings.reduce((sum, e) => sum + Number(e.net_amount), 0)

    // Get all historical earnings (excluding cancelled/reversed)
    const allEarningsRes = await this.listEarningEntries({
      business_id: businessId,
    })
    const allEarnings = unwrapListResult<any>(allEarningsRes)
    const lifetime = allEarnings
      .filter((e) => e.status !== "reversed")
      .reduce((sum, e) => sum + Number(e.net_amount), 0)

    // Get YTD payouts
    const currentYear = new Date().getFullYear()
    const yearStart = new Date(currentYear, 0, 1)
    const ytdPayoutsRes = await this.listPayouts({
      business_id: businessId,
      status: "completed",
    })
    const ytdPayouts = unwrapListResult<any>(ytdPayoutsRes)
    const ytdPayoutsTotal = ytdPayouts
      .filter((p) => p.completed_at && new Date(p.completed_at) >= yearStart)
      .reduce((sum, p) => sum + Number(p.net_amount), 0)

    // Calculate next payout date (typically 7 days from now if earnings available)
    const nextPayoutDate = available > 0 ? this.calculateNextPayoutDate() : null

    return {
      available,
      pending,
      lifetime,
      ytd_payouts: ytdPayoutsTotal,
      next_payout_date: nextPayoutDate,
    }
  }

  /**
   * Get earnings with filters
   */
  async getEarnings(filters: EarningFilters): Promise<typeof EarningEntry[]> {
    const queryFilters: Record<string, any> = {}

    if (filters.business_id) {
      queryFilters.business_id = filters.business_id
    }
    if (filters.status) {
      queryFilters.status = filters.status
    }
    if (filters.type) {
      queryFilters.type = filters.type
    }
    if (filters.date_from || filters.date_to) {
      queryFilters.created_at = {}
      if (filters.date_from) {
        queryFilters.created_at.$gte = filters.date_from
      }
      if (filters.date_to) {
        queryFilters.created_at.$lte = filters.date_to
      }
    }

    return await this.listEarningEntries(queryFilters, {
      order: { created_at: "DESC" },
    })
  }

  /**
   * Create a payout from selected earnings
   * 
   * CRITICAL FIX (BIZ-003): Enhanced validation to prevent:
   * 1. Double-paying earnings (checking payout_id and status)
   * 2. Cross-business payout requests (strict business isolation)
   * 3. Payouts of non-available earnings (status validation)
   * 4. Duplicate earnings in the same payout request
   */
  async createPayout(
    businessId: string,
    earningsIds: string[],
    requestedBy?: string
  ): Promise<any> {
    // Validate input
    if (!businessId) {
      throw new Error("Business ID is required")
    }
    if (!earningsIds || earningsIds.length === 0) {
      throw new Error("At least one earning ID is required")
    }

    // Check for duplicate earnings in the request
    const uniqueIds = new Set(earningsIds)
    if (uniqueIds.size !== earningsIds.length) {
      const duplicates = earningsIds.filter((id, index) => earningsIds.indexOf(id) !== index)
      throw new Error(`Duplicate earning IDs in request: ${[...new Set(duplicates)].join(', ')}`)
    }

    // Fetch all specified earnings
    let earnings: any[]
    try {
      earnings = (await Promise.all(
        earningsIds.map((id) => this.retrieveEarningEntry(id))
      )) as any[]
    } catch (error) {
      throw new Error(`Failed to retrieve earnings: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    // Validate all earnings - comprehensive checks
    const validationErrors: string[] = []
    
    for (const earning of earnings) {
      // 1. Business isolation: Ensure earning belongs to the requesting business
      if (earning.business_id !== businessId) {
        validationErrors.push(
          `Earning ${earning.id} does not belong to business ${businessId} ` +
          `(belongs to: ${earning.business_id})`
        )
        continue
      }

      // 2. Status validation: Only 'available' earnings can be paid out
      if (earning.status !== "available") {
        validationErrors.push(
          `Earning ${earning.id} is not available for payout (current status: ${earning.status})`
        )
        continue
      }

      // 3. Double-payout prevention: Check if already linked to a payout
      if (earning.payout_id) {
        validationErrors.push(
          `Earning ${earning.id} is already linked to payout ${earning.payout_id}`
        )
        continue
      }

      // 4. Additional safety: Check if already paid
      if (earning.status === "paid") {
        validationErrors.push(
          `Earning ${earning.id} has already been paid out`
        )
        continue
      }

      // 5. Validate earning has positive amount
      if (Number(earning.net_amount) <= 0) {
        validationErrors.push(
          `Earning ${earning.id} has invalid net amount: ${earning.net_amount}`
        )
        continue
      }
    }

    // Throw comprehensive error if any validations failed
    if (validationErrors.length > 0) {
      throw new Error(
        `Payout validation failed for ${validationErrors.length} earning(s):\n` +
        validationErrors.map(e => `  - ${e}`).join('\n')
      )
    }

    // Calculate totals
    const totalAmount = earnings.reduce((sum, e) => sum + Number(e.gross_amount), 0)
    const platformFeeTotal = earnings.reduce((sum, e) => sum + Number(e.platform_fee), 0)
    const processingFeeTotal = earnings.reduce((sum, e) => sum + Number(e.payment_processing_fee), 0)
    const feeAmount = platformFeeTotal + processingFeeTotal
    const netAmount = earnings.reduce((sum, e) => sum + Number(e.net_amount), 0)

    // Create payout
    const payout = await this.createPayouts({
      business_id: businessId,
      total_amount: totalAmount,
      fee_amount: feeAmount,
      net_amount: netAmount,
      status: "pending",
      requested_at: new Date(),
      earning_entries: earningsIds,
      metadata: {
        requested_by: requestedBy ?? null,
      },
    })

    // Link earnings to payout
    for (const earning of earnings) {
      await this.updateEarningEntries({
        id: earning.id,
        payout_id: payout.id,
        status: "paid_out", // PLAN: locked to payout request
      })
    }

    return payout
  }

  /**
   * Process a payout
   */
  async processPayout(payoutId: string, processedBy?: string): Promise<typeof Payout> {
    const payout = await this.retrievePayout(payoutId)

    if (payout.status !== "pending") {
      throw new Error(`Payout ${payoutId} cannot be processed (current status: ${payout.status})`)
    }

    // Update payout to processing
    await this.updatePayouts(payoutId, {
      status: "processing",
      processed_at: new Date(),
    })

    // Here you would integrate with Stripe Connect or other payment provider
    // For now, we'll simulate successful processing

    // Get linked earnings
    const earningsRes = await this.listEarningEntries({
      payout_id: payoutId,
    })
    const earnings = unwrapListResult<any>(earningsRes)

    // Complete the payout
    const completedPayout = await this.updatePayouts(payoutId, {
      status: "completed",
      completed_at: new Date(),
    })

    // Update all linked earnings to paid
    for (const earning of earnings) {
      await this.updateEarningEntries({
        id: earning.id,
        status: "paid",
        paid_at: new Date(),
      })
    }

    return completedPayout
  }

  /**
   * Cancel a pending payout
   */
  async cancelPayout(payoutId: string, reason?: string): Promise<typeof Payout> {
    const payout = await this.retrievePayout(payoutId)

    if (payout.status !== "pending") {
      throw new Error(`Payout ${payoutId} cannot be cancelled (current status: ${payout.status})`)
    }

    // Get linked earnings and revert them to available
    const earningsRes = await this.listEarningEntries({
      payout_id: payoutId,
    })
    const earnings = unwrapListResult<any>(earningsRes)

    for (const earning of earnings) {
      await this.updateEarningEntries({
        id: earning.id,
        status: "available",
        payout_id: null,
      })
    }

    // Cancel the payout
    return await this.updatePayouts(payoutId, {
      status: "failed",
      failure_reason: reason ?? "Cancelled by user",
    })
  }

  /**
   * Mark earnings as available (when order is delivered)
   */
  async makeEarningsAvailable(orderId: string): Promise<void> {
    const earningsRes = await this.listEarningEntries({
      order_id: orderId,
      status: "pending",
    })
    const earnings = unwrapListResult<any>(earningsRes)

    const now = new Date()

    for (const earning of earnings) {
      await this.updateEarningEntries({
        id: earning.id,
        status: "available",
        available_at: now,
      })
    }
  }

  /**
   * Cancel earnings for an order (when order is cancelled/refunded)
   */
  async cancelEarnings(orderId: string): Promise<void> {
    const earningsRes = await this.listEarningEntries({
      order_id: orderId,
    })
    const earnings = unwrapListResult<any>(earningsRes)

    for (const earning of earnings) {
      // Only cancel if not already paid
      if (earning.status !== "paid") {
        await this.updateEarningEntries({
          id: earning.id,
          status: "reversed",
        })
      }
    }
  }

  /**
   * Get platform-wide earnings summary
   */
  async getPlatformEarningsSummary(): Promise<{
    total_gross: number
    total_platform_fees: number
    total_paid_out: number
    pending_payouts: number
  }> {
    const allEarnings = unwrapListResult<any>(await this.listEarningEntries())
    const allPayouts = unwrapListResult<any>(await this.listPayouts())

    const totalGross = allEarnings
      .filter((e) => e.status !== "reversed")
      .reduce((sum, e) => sum + Number(e.gross_amount), 0)

    const totalPlatformFees = allEarnings
      .filter((e) => e.status !== "reversed")
      .reduce((sum, e) => sum + Number(e.platform_fee), 0)

    const totalPaidOut = allPayouts
      .filter((p) => p.status === "completed")
      .reduce((sum, p) => sum + Number(p.net_amount), 0)

    const pendingPayouts = allPayouts
      .filter((p) => p.status === "pending" || p.status === "processing")
      .reduce((sum, p) => sum + Number(p.net_amount), 0)

    return {
      total_gross: totalGross,
      total_platform_fees: totalPlatformFees,
      total_paid_out: totalPaidOut,
      pending_payouts: pendingPayouts,
    }
  }

  /**
   * Get earnings by period for analytics
   */
  async getEarningsByPeriod(
    period: "day" | "week" | "month" | "year",
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<Array<{ period: string; gross: number; net: number }>> {
    const filters: any = {}
    if (dateFrom || dateTo) {
      filters.created_at = {}
      if (dateFrom) filters.created_at.$gte = dateFrom
      if (dateTo) filters.created_at.$lte = dateTo
    }

    const earnings = unwrapListResult<any>(await this.listEarningEntries(filters))
    const validEarnings = earnings.filter((e) => e.status !== "reversed")

    // Group by period
    const grouped = new Map<string, { gross: number; net: number }>()

    for (const earning of validEarnings) {
      const date = new Date(earning.created_at)
      let key: string

      switch (period) {
        case "day":
          key = date.toISOString().split("T")[0]
          break
        case "week":
          const weekStart = new Date(date)
          weekStart.setDate(date.getDate() - date.getDay())
          key = weekStart.toISOString().split("T")[0]
          break
        case "month":
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
          break
        case "year":
          key = String(date.getFullYear())
          break
      }

      if (!grouped.has(key)) {
        grouped.set(key, { gross: 0, net: 0 })
      }

      const current = grouped.get(key)!
      current.gross += Number(earning.gross_amount)
      current.net += Number(earning.net_amount)
    }

    // Convert to array and sort
    return Array.from(grouped.entries())
      .map(([period, data]) => ({
        period,
        gross: data.gross,
        net: data.net,
      }))
      .sort((a, b) => a.period.localeCompare(b.period))
  }

  /**
   * Helper: Calculate next payout date (7 days from now)
   */
  private calculateNextPayoutDate(): Date {
    const date = new Date()
    date.setDate(date.getDate() + 7)
    return date
  }

  /**
   * Validate earnings before payout (public method for external validation)
   * 
   * CRITICAL FIX (BIZ-003): Provides comprehensive validation for earnings:
   * - Prevents double-paying earnings
   * - Validates business ownership
   * - Checks earnings are in 'available' status
   * 
   * @param businessId - The business requesting payout
   * @param earningsIds - Array of earning IDs to validate
   * @returns Validation result with any errors found
   */
  async validateEarningsForPayout(
    businessId: string,
    earningsIds: string[]
  ): Promise<{
    valid: boolean
    errors: string[]
    validEarnings: typeof EarningEntry[]
    totalAmount: number
  }> {
    const errors: string[] = []
    const validEarnings: typeof EarningEntry[] = []
    let totalAmount = 0

    if (!businessId) {
      errors.push("Business ID is required")
      return { valid: false, errors, validEarnings, totalAmount }
    }

    if (!earningsIds || earningsIds.length === 0) {
      errors.push("At least one earning ID is required")
      return { valid: false, errors, validEarnings, totalAmount }
    }

    // Check for duplicates
    const uniqueIds = new Set(earningsIds)
    if (uniqueIds.size !== earningsIds.length) {
      const duplicates = earningsIds.filter((id, index) => earningsIds.indexOf(id) !== index)
      errors.push(`Duplicate earning IDs: ${[...new Set(duplicates)].join(', ')}`)
    }

    // Fetch and validate each earning
    for (const id of earningsIds) {
      try {
        const earning = await this.retrieveEarningEntry(id)

        // Business isolation check
        if (earning.business_id !== businessId) {
          errors.push(`Earning ${id} belongs to different business`)
          continue
        }

        // Status check
        if (earning.status !== "available") {
          errors.push(`Earning ${id} status is '${earning.status}', expected 'available'`)
          continue
        }

        // Double-payout check
        if (earning.payout_id) {
          errors.push(`Earning ${id} already linked to payout ${earning.payout_id}`)
          continue
        }

        // Already paid check
        if (earning.status === "paid") {
          errors.push(`Earning ${id} has already been paid`)
          continue
        }

        // Amount check
        if (Number(earning.net_amount) <= 0) {
          errors.push(`Earning ${id} has invalid amount`)
          continue
        }

        validEarnings.push(earning)
        totalAmount += Number(earning.net_amount)
      } catch (error) {
        errors.push(`Earning ${id} not found or error retrieving: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    return {
      valid: errors.length === 0 && validEarnings.length > 0,
      errors,
      validEarnings,
      totalAmount,
    }
  }
}

export default FinancialsService
