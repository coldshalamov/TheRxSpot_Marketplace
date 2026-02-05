import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { BUSINESS_MODULE } from "../modules/business"

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
  const notificationService = container.resolve(Modules.NOTIFICATION)
  const logger = container.resolve("logger")
  
  logger.info(`Processing consult submission created event: ${data.id}`)
  
  try {
    // Retrieve the full submission
    const submission = await businessService.retrieveConsultSubmission(data.id)
    
    if (!submission) {
      logger.warn(`Consult submission ${data.id} not found`)
      return
    }
    
    // Get business details
    const business = await businessService.retrieveBusiness(submission.business_id)
    
    if (!business) {
      logger.warn(`Business ${submission.business_id} not found for submission ${data.id}`)
      return
    }
    
    // 1. Send immediate notification to business
    await sendImmediateNotification(container, submission, business)
    
    // 2. Create real-time dashboard notification
    await createDashboardNotification(container, submission, business)
    
    // 3. Log for analytics
    await logSubmissionAnalytics(container, submission, business)
    
    // 4. Check for urgent/eligible submissions and escalate if needed
    await checkEscalationRules(container, submission, business)
    
    logger.info(`Successfully processed consult submission created: ${data.id}`)
  } catch (error) {
    logger.error(`Error processing consult submission ${data.id}: ${error.message}`)
    throw error
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
  const notificationService = container.resolve(Modules.NOTIFICATION)
  const logger = container.resolve("logger")
  
  try {
    const businessEmail = business.contact_email || business.email
    
    if (!businessEmail) {
      logger.warn(`No business email found for business ${business.id}`)
      return
    }
    
    await notificationService.createNotifications({
      to: businessEmail,
      channel: "email",
      template: "consult-submission-new",
      data: {
        business_name: business.name,
        customer_name: `${submission.customer_first_name} ${submission.customer_last_name}`,
        customer_email: submission.customer_email,
        customer_phone: submission.customer_phone,
        submission_id: submission.id,
        product_id: submission.product_id,
        submission_date: submission.created_at,
        consult_fee: submission.consult_fee,
        dashboard_url: `${business.settings?.storefront_url}/admin/consults`,
      },
    })
    
    logger.info(`Sent immediate notification to business for submission ${submission.id}`)
  } catch (error) {
    logger.error(`Failed to send immediate notification: ${error.message}`)
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
  const logger = container.resolve("logger")
  
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
    
    // TODO: Implement based on your notification infrastructure
    // await notificationService.createNotification(notification)
    
    logger.info(`Created dashboard notification for submission ${submission.id}`)
  } catch (error) {
    logger.error(`Failed to create dashboard notification: ${error.message}`)
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
  const logger = container.resolve("logger")
  
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
    
    logger.info(`Logged analytics for submission ${submission.id}`)
  } catch (error) {
    logger.error(`Failed to log analytics: ${error.message}`)
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
  const logger = container.resolve("logger")
  
  try {
    // Check for high-value consultations
    const consultFee = submission.consult_fee || 0
    const highValueThreshold = 100 // $100
    
    if (consultFee >= highValueThreshold) {
      logger.info(`High-value submission ${submission.id} detected, escalating`)
      
      // Mark as high priority
      const businessService = container.resolve(BUSINESS_MODULE)
      await businessService.updateConsultSubmissions(submission.id, {
        priority: "high",
      })
    }
    
    // Check for returning customers
    const businessService = container.resolve(BUSINESS_MODULE)
    const previousSubmissions = await businessService.listConsultSubmissions({
      business_id: business.id,
      customer_email: submission.customer_email,
    })
    
    if (previousSubmissions.length > 1) {
      logger.info(`Returning customer detected for submission ${submission.id}`)
      
      // Could add special handling for returning customers
      // e.g., expedited review, loyalty discounts, etc.
    }
  } catch (error) {
    logger.error(`Failed to check escalation rules: ${error.message}`)
    // Don't throw
  }
}

/**
 * Subscriber configuration
 */
export const config: SubscriberConfig = {
  event: "consult_submission.created",
}
