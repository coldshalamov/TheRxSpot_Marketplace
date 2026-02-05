import { FINANCIALS_MODULE } from "../modules/financials"
import { BUSINESS_MODULE } from "../modules/business"
import { getLogger } from "../utils/logger"

/**
 * Hold period configuration for healthcare transactions (in hours)
 * 
 * CRITICAL FIX (BIZ-002): Extended hold periods for healthcare compliance.
 * Chargebacks can occur up to 180 days, so 24 hours is insufficient.
 * 
 * Default hold periods:
 * - Standard healthcare businesses: 14 days (336 hours)
 * - New businesses (< 90 days): 30 days (720 hours)
 * - Businesses with chargeback history: 30+ days (configurable)
 */
const HOLD_PERIODS = {
  DEFAULT: 336, // 14 days in hours - for established healthcare businesses
  NEW_BUSINESS: 720, // 30 days in hours - for businesses < 90 days old
  HIGH_RISK: 720, // 30 days in hours - for businesses with chargeback history
  MINIMUM: 168, // 7 days in hours - absolute minimum for any healthcare transaction
} as const

/**
 * Get the appropriate hold period for a business based on risk factors
 */
async function getBusinessHoldPeriod(
  businessId: string,
  container: any
): Promise<number> {
  const businessService = container.resolve(BUSINESS_MODULE)
  
  try {
    const business = await businessService.retrieveBusiness(businessId)
    
    // Check for custom hold period in business settings
    const settings = (business.settings as Record<string, any>) || {}
    const customHoldDays = settings.payout_hold_days
    
    if (customHoldDays && typeof customHoldDays === 'number') {
      // Custom hold period configured (ensure minimum of 7 days for healthcare)
      return Math.max(customHoldDays * 24, HOLD_PERIODS.MINIMUM)
    }
    
    // Check if business has chargeback history flag
    if (settings.has_chargeback_history === true) {
      return HOLD_PERIODS.HIGH_RISK
    }
    
    // Check if business is new (< 90 days)
    const createdAt = business.created_at ? new Date(business.created_at) : null
    if (createdAt) {
      const daysSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
      if (daysSinceCreation < 90) {
        return HOLD_PERIODS.NEW_BUSINESS
      }
    }
    
    // Default to standard hold period for established businesses
    return HOLD_PERIODS.DEFAULT
  } catch (error) {
    const logger = getLogger()
    logger.warn(
      {
        business_id: businessId,
        error: error instanceof Error ? error.message : String(error),
      },
      "process-payouts: could not determine business hold period, using default"
    )
    return HOLD_PERIODS.DEFAULT
  }
}

/**
 * Scheduled job to process pending payouts
 * Runs daily to:
 * 1. Find payouts with status='pending' and requested_at older than hold period
 * 2. Apply risk-based hold periods (14-30 days for healthcare)
 * 3. Process them through Stripe Connect or other payment provider
 * 4. Update payout status and linked earnings
 */
export default async function processPayoutsJob(container: any) {
  const financialsService = container.resolve(FINANCIALS_MODULE)
  const logger = getLogger()

  logger.info("process-payouts: starting payout processing job")

  try {
    // Find all pending payouts
    const pendingPayouts = await financialsService.listPayouts(
      {
        status: "pending",
      },
      {
        order: { requested_at: "ASC" },
      }
    )

    logger.info(
      { pending_payouts: pendingPayouts.length },
      "process-payouts: found pending payouts"
    )

    let processedCount = 0
    let failedCount = 0
    let skippedCount = 0

    for (const payout of pendingPayouts) {
      try {
        // CRITICAL FIX (BIZ-002): Use risk-based hold period instead of fixed 24 hours
        const holdPeriodHours = await getBusinessHoldPeriod(
          payout.business_id,
          container
        )

        // Check if payout is old enough to process
        const requestTime = new Date(payout.requested_at).getTime()
        const now = Date.now()
        const hoursSinceRequest = (now - requestTime) / (1000 * 60 * 60)

        if (hoursSinceRequest < holdPeriodHours) {
          const daysRemaining = Math.ceil((holdPeriodHours - hoursSinceRequest) / 24)
          logger.info(
            {
              payout_id: payout.id,
              business_id: payout.business_id,
              hours_since_request: Number(hoursSinceRequest.toFixed(1)),
              hold_period_hours: holdPeriodHours,
              days_remaining: daysRemaining,
            },
            "process-payouts: payout within hold period, skipping"
          )
          skippedCount++
          continue
        }

        logger.info(
          {
            payout_id: payout.id,
            business_id: payout.business_id,
            net_amount: payout.net_amount,
            hours_since_request: Number(hoursSinceRequest.toFixed(1)),
          },
          "process-payouts: processing payout"
        )

        // Process the payout
        // In production, this would integrate with Stripe Connect or similar
        // For now, we simulate successful processing
        const processedPayout = await processPayoutWithProvider(
          payout,
          financialsService
        )

        if (processedPayout.status === "completed") {
          processedCount++
          logger.info(
            { payout_id: payout.id, business_id: payout.business_id },
            "process-payouts: payout completed successfully"
          )
        } else if (processedPayout.status === "failed") {
          failedCount++
          logger.error(
            {
              payout_id: payout.id,
              business_id: payout.business_id,
              failure_reason: processedPayout.failure_reason,
            },
            "process-payouts: payout failed"
          )
        }
      } catch (error) {
        failedCount++
        logger.error(
          {
            payout_id: payout.id,
            business_id: payout.business_id,
            error: error instanceof Error ? error.message : String(error),
          },
          "process-payouts: error processing payout"
        )

        // Update payout with failure info
        const failureReason =
          error instanceof Error ? error.message : "Unknown error"
        
        // Get current retry count from metadata or default to 0
        const currentMetadata = (payout.metadata as Record<string, any>) || {}
        const retryCount = (currentMetadata.retry_count || 0) + 1
        
        await financialsService.updatePayouts(payout.id, {
          status: retryCount >= 3 ? "failed" : "pending",
          failure_reason: failureReason,
          metadata: {
            ...currentMetadata,
            retry_count: retryCount,
          },
        })
      }
    }

    logger.info(
      {
        processed: processedCount,
        failed: failedCount,
        skipped: skippedCount,
      },
      "process-payouts: job completed"
    )
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "process-payouts: fatal error in payout processing job"
    )
  }
}

/**
 * Process a payout with the payment provider (Stripe Connect)
 * In production, this would make actual API calls to Stripe
 */
async function processPayoutWithProvider(
  payout: any,
  financialsService: any
): Promise<any> {
  // Stripe Connect integration is not enabled in this MVP.
  // This job uses a deterministic simulation unless explicitly configured for chaos testing.
  // 1. Get the business's Stripe Connect account ID
  // 2. Create a transfer to their connected account
  // 3. Handle any errors from Stripe

  // For now, simulate processing
  const simulateStripeCall = async () => {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 100))

    const failureRate = parseFloat(process.env.PAYOUT_SIM_FAILURE_RATE || "0")
    if (Number.isFinite(failureRate) && failureRate > 0) {
      // Optional chaos knob for pre-launch hardening.
      if (Math.random() < Math.min(failureRate, 1)) {
        throw new Error("Simulated payout provider API error")
      }
    }

    return {
      id: `stripe_transfer_${Date.now()}`,
      status: "paid",
    }
  }

  try {
    // Update to processing
    await financialsService.updatePayouts(payout.id, {
      status: "processing",
      processed_at: new Date(),
    })

    // Call Stripe Connect
    const stripeTransfer = await simulateStripeCall()

    // Get linked earnings
    const earnings = await financialsService.listEarningEntries({
      payout_id: payout.id,
    })

    // Complete the payout
    const completedPayout = await financialsService.updatePayouts(payout.id, {
      status: "completed",
      completed_at: new Date(),
      transaction_id: stripeTransfer.id,
    })

    // Update all linked earnings to paid
    for (const earning of earnings) {
      await financialsService.updateEarningEntries(earning.id, {
        status: "paid",
        paid_at: new Date(),
      })
    }

    return completedPayout
  } catch (error) {
    // Update payout with failure
    const failureReason =
      error instanceof Error ? error.message : "Payment provider error"

    await financialsService.updatePayouts(payout.id, {
      status: "failed",
      failure_reason: failureReason,
    })

    // Return failed payout
    return {
      ...payout,
      status: "failed",
      failure_reason: failureReason,
    }
  }
}

/**
 * Job configuration
 * Runs daily at 2 AM UTC
 */
export const config = {
  name: "process-payouts",
  schedule: "0 2 * * *", // Daily at 2:00 AM UTC
}
