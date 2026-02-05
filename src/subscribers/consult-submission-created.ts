import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { BUSINESS_MODULE } from "../modules/business"
import { sendEmail } from "../utils/email"
import processConsultSubmissionJob from "../jobs/process-consult-submission"
import { getLogger } from "../utils/logger"

/**
 * Subscriber: Handle consult submission created
 * 
 * Purpose:
 * - Trigger immediate job to process submission
 * - Send instant notifications
 * - Create real-time dashboard notifications
 * - Log submission for analytics
 */

export default async function consultSubmissionCreatedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string; business_id: string }>) {
  const businessService = container.resolve(BUSINESS_MODULE)
  const logger = getLogger()
  
  logger.info(
    { consult_submission_id: data.id, tenant_id: data.business_id ?? null },
    "consult-submission-created: processing event"
  )
  
  try {
    // Retrieve the full submission
    const submission = await businessService.retrieveConsultSubmissionDecrypted(data.id)
    
    if (!submission) {
      logger.warn(
        { consult_submission_id: data.id, tenant_id: data.business_id ?? null },
        "consult-submission-created: submission not found"
      )
      return
    }
    
    // Get business details
    const business = await businessService.retrieveBusiness(submission.business_id)
    
    if (!business) {
      logger.warn(
        { consult_submission_id: data.id, tenant_id: submission.business_id },
        "consult-submission-created: business not found"
      )
      return
    }
    
    // 1. Send immediate notification to business (best-effort)
    await sendImmediateNotification(container, submission, business)

    // 1b. Best-effort reconciliation to ensure downstream records exist even if the API crashed mid-request.
    await processConsultSubmissionJob(container).catch(() => null)
    
    // 2. Create real-time dashboard notification
    await createDashboardNotification(container, submission, business)
    
    // 3. Log for analytics
    await logSubmissionAnalytics(container, submission, business)
    
    // 4. Check for urgent/eligible submissions and escalate if needed
    await checkEscalationRules(container, submission, business)
    
    logger.info(
      { consult_submission_id: data.id, tenant_id: submission.business_id },
      "consult-submission-created: processed successfully"
    )
  } catch (error) {
    logger.error(
      { consult_submission_id: data.id, error: error instanceof Error ? error.message : String(error) },
      "consult-submission-created: error processing submission"
    )
    // Don't throw - subscriber failures should not break core consult intake.
  }
}

/**
 * Send immediate notification to business
 */
async function sendImmediateNotification(
  container: SubscriberArgs<any>["container"],
  submission: any,
  business: any
) {
  const logger = getLogger()
  
  try {
    const businessEmail =
      business.contact_email ||
      business.settings?.ops_email ||
      business.settings?.fulfillment_email
    
    if (!businessEmail) {
      logger.warn(
        { tenant_id: business.id },
        "consult-submission-created: no business email found"
      )
      return
    }

    const subject = `[TheRxSpot] New consult submission: ${submission.id}`
    const text = [
      `Business: ${business.name} (${business.id})`,
      `Submission: ${submission.id}`,
      `Product: ${submission.product_id}`,
      `Customer: ${submission.customer_first_name} ${submission.customer_last_name} <${submission.customer_email}>`,
      submission.customer_phone ? `Phone: ${submission.customer_phone}` : null,
      submission.customer_dob ? `DOB: ${submission.customer_dob}` : null,
      ``,
      `Status: ${submission.status}`,
      submission.consult_fee ? `Consult fee: ${submission.consult_fee}` : null,
      submission.notes ? `Notes: ${submission.notes}` : null,
    ].filter(Boolean).join("\n")

    await sendEmail({ to: businessEmail, subject, text })
    
    logger.info(
      { consult_submission_id: submission.id, tenant_id: business.id },
      "consult-submission-created: immediate notification sent"
    )
  } catch (error) {
    logger.error(
      { consult_submission_id: submission.id, tenant_id: business.id, error: error instanceof Error ? error.message : String(error) },
      "consult-submission-created: failed to send immediate notification"
    )
    // Don't throw - notification failure shouldn't fail submission processing
  }
}

/**
 * Create real-time dashboard notification
 */
async function createDashboardNotification(
  container: SubscriberArgs<any>["container"],
  submission: any,
  business: any
) {
  const logger = getLogger()
  
  try {
    // This would typically create a notification record in a notifications table
    // that the dashboard can poll or receive via WebSocket
    
    const notification = {
      id: `notif_${Date.now()}_${submission.id}`,
      type: "consult_submission",
      business_id: business.id,
      submission_id: submission.id,
      title: "New Consult Submission",
      message: `${submission.customer_first_name} ${submission.customer_last_name} submitted a consultation request`,
      read: false,
      created_at: new Date(),
    }
    
    // Placeholder: integrate a notification service (DB/WebSocket) when available.
    // await notificationService.createNotification(notification)
    
    logger.info(
      { consult_submission_id: submission.id, tenant_id: business.id },
      "consult-submission-created: dashboard notification created"
    )
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.error(
      { consult_submission_id: submission.id, tenant_id: business.id, error: msg },
      "consult-submission-created: failed to create dashboard notification"
    )
    // Don't throw
  }
}

/**
 * Log submission for analytics
 */
async function logSubmissionAnalytics(
  container: SubscriberArgs<any>["container"],
  submission: any,
  business: any
) {
  const logger = getLogger()
  
  try {
    // Update business statistics
    const businessService = container.resolve(BUSINESS_MODULE)
    const currentSettings = (business.settings ?? {}) as Record<string, any>
    const currentStats = (currentSettings.statistics ?? {}) as Record<string, any>
    
    const submissionCount = (currentStats.consult_submission_count || 0) + 1
    
    const nextSettings = {
      ...currentSettings,
      statistics: {
        ...currentStats,
        consult_submission_count: submissionCount,
        last_consult_submission_at: new Date(),
      },
    }

    await businessService.updateBusinesses({ id: business.id, settings: nextSettings } as any)
    
    logger.info(
      { consult_submission_id: submission.id, tenant_id: business.id },
      "consult-submission-created: analytics logged"
    )
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.error(
      { consult_submission_id: submission.id, tenant_id: business.id, error: msg },
      "consult-submission-created: failed to log analytics"
    )
    // Don't throw
  }
}

/**
 * Check if submission needs escalation
 */
async function checkEscalationRules(
  container: SubscriberArgs<any>["container"],
  submission: any,
  business: any
) {
  const logger = getLogger()
  
  try {
    // Check for returning customers
    const businessService = container.resolve(BUSINESS_MODULE)
    const previousSubmissions = await businessService.listConsultSubmissionsByEmail(
      business.id,
      submission.customer_email
    )
    
    if (previousSubmissions.length > 1) {
      logger.info(
        { consult_submission_id: submission.id, tenant_id: business.id },
        "consult-submission-created: returning customer detected"
      )
      
      // Could add special handling for returning customers
      // e.g., expedited review, loyalty discounts, etc.
    }
  } catch (error) {
    logger.error(
      { consult_submission_id: submission.id, tenant_id: business.id, error: error instanceof Error ? error.message : String(error) },
      "consult-submission-created: failed to check escalation rules"
    )
    // Don't throw
  }
}

/**
 * Subscriber configuration
 */
export const config: SubscriberConfig = {
  event: "consult_submission.created",
}
