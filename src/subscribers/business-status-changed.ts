import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { BUSINESS_MODULE } from "../modules/business"

/**
 * Subscriber: Handle business status changes
 * 
 * Purpose:
 * - Activate/deactivate sales channel when business status changes
 * - Update API key status
 * - Send notification to business owners
 * - Update related services (domains, locations)
 * - Handle compliance-related status changes
 */

export default async function businessStatusChangedHandler({
  event: { data },
  container,
}: SubscriberArgs<{
  id: string
  previous_status: string
  new_status: string
  changed_by?: string
  reason?: string
}>) {
  const businessService = container.resolve(BUSINESS_MODULE)
  const logger = container.resolve("logger")
  
  logger.info(
    `Processing business status change: ${data.id} from ${data.previous_status} to ${data.new_status}`
  )
  
  try {
    // Retrieve the business
    const business = await businessService.retrieveBusiness(data.id)
    
    if (!business) {
      logger.warn(`Business ${data.id} not found`)
      return
    }
    
    // Handle different status transitions
    switch (data.new_status) {
      case "active":
        await handleActivation(container, business)
        break
        
      case "suspended":
        await handleSuspension(container, business, data.reason)
        break
        
      case "inactive":
        await handleDeactivation(container, business)
        break
        
      case "pending_review":
        await handlePendingReview(container, business)
        break
        
      default:
        logger.info(`No specific handler for status: ${data.new_status}`)
    }
    
    // Send notification about status change
    await sendStatusChangeNotification(container, business, data)
    
    logger.info(`Successfully processed business status change for ${data.id}`)
  } catch (error) {
    logger.error(`Error processing business status change: ${error.message}`)
    throw error
  }
}

/**
 * Handle business activation
 */
async function handleActivation(
  container: SubscriberArgs<any>["container"],
  business: any
) {
  const logger = container.resolve("logger")
  
  logger.info(`Activating business ${business.id}`)
  
  try {
    // 1. Activate sales channel if exists
    if (business.sales_channel_id) {
      await activateSalesChannel(container, business.sales_channel_id)
    }
    
    // 2. Activate API key if exists
    if (business.publishable_api_key_id) {
      await activateApiKey(container, business.publishable_api_key_id)
    }
    
    // 3. Activate custom domains
    await activateDomains(container, business.id)
    
    // 4. Clear any suspension-related flags
    await clearSuspensionFlags(container, business)
    
    logger.info(`Successfully activated business ${business.id}`)
  } catch (error) {
    logger.error(`Failed to activate business: ${error.message}`)
    throw error
  }
}

/**
 * Handle business suspension
 */
async function handleSuspension(
  container: SubscriberArgs<any>["container"],
  business: any,
  reason?: string
) {
  const logger = container.resolve("logger")
  
  logger.info(`Suspending business ${business.id}`)
  
  try {
    // 1. Deactivate sales channel
    if (business.sales_channel_id) {
      await deactivateSalesChannel(container, business.sales_channel_id)
    }
    
    // 2. Revoke API key
    if (business.publishable_api_key_id) {
      await revokeApiKey(container, business.publishable_api_key_id)
    }
    
    // 3. Suspend custom domains
    await suspendDomains(container, business.id)
    
    // 4. Record suspension details
    await recordSuspensionDetails(container, business, reason)
    
    logger.info(`Successfully suspended business ${business.id}`)
  } catch (error) {
    logger.error(`Failed to suspend business: ${error.message}`)
    throw error
  }
}

/**
 * Handle business deactivation
 */
async function handleDeactivation(
  container: SubscriberArgs<any>["container"],
  business: any
) {
  const logger = container.resolve("logger")
  
  logger.info(`Deactivating business ${business.id}`)
  
  try {
    // Similar to suspension but typically voluntary
    if (business.sales_channel_id) {
      await deactivateSalesChannel(container, business.sales_channel_id)
    }
    
    if (business.publishable_api_key_id) {
      await revokeApiKey(container, business.publishable_api_key_id)
    }
    
    await deactivateDomains(container, business.id)
    
    logger.info(`Successfully deactivated business ${business.id}`)
  } catch (error) {
    logger.error(`Failed to deactivate business: ${error.message}`)
    throw error
  }
}

/**
 * Handle pending review status
 */
async function handlePendingReview(
  container: SubscriberArgs<any>["container"],
  business: any
) {
  const logger = container.resolve("logger")
  
  logger.info(`Setting business ${business.id} to pending review`)
  
  try {
    // Typically keep services active but flag for review
    // Could send notifications to compliance team
    await sendPendingReviewNotification(container, business)
    
    logger.info(`Successfully set business ${business.id} to pending review`)
  } catch (error) {
    logger.error(`Failed to handle pending review: ${error.message}`)
  }
}

/**
 * Activate sales channel
 */
async function activateSalesChannel(
  container: SubscriberArgs<any>["container"],
  salesChannelId: string
) {
  const salesChannelService = container.resolve(Modules.SALES_CHANNEL)
  const logger = container.resolve("logger")
  
  try {
    await salesChannelService.updateSalesChannels(salesChannelId, {
      is_disabled: false,
    })
    logger.info(`Activated sales channel ${salesChannelId}`)
  } catch (error) {
    logger.error(`Failed to activate sales channel: ${error.message}`)
  }
}

/**
 * Deactivate sales channel
 */
async function deactivateSalesChannel(
  container: SubscriberArgs<any>["container"],
  salesChannelId: string
) {
  const salesChannelService = container.resolve(Modules.SALES_CHANNEL)
  const logger = container.resolve("logger")
  
  try {
    await salesChannelService.updateSalesChannels(salesChannelId, {
      is_disabled: true,
    })
    logger.info(`Deactivated sales channel ${salesChannelId}`)
  } catch (error) {
    logger.error(`Failed to deactivate sales channel: ${error.message}`)
  }
}

/**
 * Activate API key
 */
async function activateApiKey(
  container: SubscriberArgs<any>["container"],
  apiKeyId: string
) {
  const apiKeyService = container.resolve(Modules.API_KEY)
  const logger = container.resolve("logger")
  
  try {
    await apiKeyService.updateApiKeys(apiKeyId, {
      revoked_at: null,
      revoked_by: null,
    })
    logger.info(`Activated API key ${apiKeyId}`)
  } catch (error) {
    logger.error(`Failed to activate API key: ${error.message}`)
  }
}

/**
 * Revoke API key
 */
async function revokeApiKey(
  container: SubscriberArgs<any>["container"],
  apiKeyId: string
) {
  const apiKeyService = container.resolve(Modules.API_KEY)
  const logger = container.resolve("logger")
  
  try {
    await apiKeyService.revokeApiKeys({
      selector: { id: apiKeyId },
      revoke: {
        revoked_at: new Date(),
        // Note: revoked_by should be set by the system
      },
    })
    logger.info(`Revoked API key ${apiKeyId}`)
  } catch (error) {
    logger.error(`Failed to revoke API key: ${error.message}`)
  }
}

/**
 * Activate custom domains
 */
async function activateDomains(
  container: SubscriberArgs<any>["container"],
  businessId: string
) {
  const businessService = container.resolve(BUSINESS_MODULE)
  const logger = container.resolve("logger")
  
  try {
    const domains = await businessService.listBusinessDomainsByBusiness(businessId)
    
    for (const domain of domains) {
      if (domain.status === "suspended") {
        await businessService.updateBusinessDomains(domain.id, {
          status: "active",
        })
      }
    }
    
    logger.info(`Activated domains for business ${businessId}`)
  } catch (error) {
    logger.error(`Failed to activate domains: ${error.message}`)
  }
}

/**
 * Suspend custom domains
 */
async function suspendDomains(
  container: SubscriberArgs<any>["container"],
  businessId: string
) {
  const businessService = container.resolve(BUSINESS_MODULE)
  const logger = container.resolve("logger")
  
  try {
    const domains = await businessService.listBusinessDomainsByBusiness(businessId)
    
    for (const domain of domains) {
      if (domain.status === "active") {
        await businessService.updateBusinessDomains(domain.id, {
          status: "suspended",
        })
      }
    }
    
    logger.info(`Suspended domains for business ${businessId}`)
  } catch (error) {
    logger.error(`Failed to suspend domains: ${error.message}`)
  }
}

/**
 * Deactivate custom domains
 */
async function deactivateDomains(
  container: SubscriberArgs<any>["container"],
  businessId: string
) {
  const businessService = container.resolve(BUSINESS_MODULE)
  const logger = container.resolve("logger")
  
  try {
    const domains = await businessService.listBusinessDomainsByBusiness(businessId)
    
    for (const domain of domains) {
      await businessService.updateBusinessDomains(domain.id, {
        status: "inactive",
      })
    }
    
    logger.info(`Deactivated domains for business ${businessId}`)
  } catch (error) {
    logger.error(`Failed to deactivate domains: ${error.message}`)
  }
}

/**
 * Clear suspension flags
 */
async function clearSuspensionFlags(
  container: SubscriberArgs<any>["container"],
  business: any
) {
  const businessService = container.resolve(BUSINESS_MODULE)
  
  await businessService.updateBusinesses({
    selector: { id: business.id },
    data: {
      suspended_at: null,
      suspended_reason: null,
      suspended_by: null,
    },
  })
}

/**
 * Record suspension details
 */
async function recordSuspensionDetails(
  container: SubscriberArgs<any>["container"],
  business: any,
  reason?: string
) {
  const businessService = container.resolve(BUSINESS_MODULE)
  
  await businessService.updateBusinesses({
    selector: { id: business.id },
    data: {
      suspended_at: new Date(),
      suspended_reason: reason || "Compliance violation",
    },
  })
}

/**
 * Send status change notification
 */
async function sendStatusChangeNotification(
  container: SubscriberArgs<any>["container"],
  business: any,
  data: any
) {
  const notificationService = container.resolve(Modules.NOTIFICATION)
  const logger = container.resolve("logger")
  
  try {
    const businessEmail = business.contact_email || business.email
    
    if (!businessEmail) {
      return
    }
    
    let template = "business-status-changed"
    let subject = "Business Account Status Update"
    
    // Customize based on new status
    switch (data.new_status) {
      case "active":
        template = "business-activated"
        subject = "Your Business Account is Now Active"
        break
      case "suspended":
        template = "business-suspended"
        subject = "Important: Your Business Account Has Been Suspended"
        break
      case "inactive":
        template = "business-deactivated"
        subject = "Your Business Account Has Been Deactivated"
        break
    }
    
    await notificationService.createNotifications({
      to: businessEmail,
      channel: "email",
      template,
      data: {
        business_name: business.name,
        previous_status: data.previous_status,
        new_status: data.new_status,
        reason: data.reason,
        changed_at: new Date(),
        support_email: process.env.SUPPORT_EMAIL || "support@therxspot.app",
      },
    })
    
    logger.info(`Sent status change notification to ${businessEmail}`)
  } catch (error) {
    logger.error(`Failed to send status change notification: ${error.message}`)
  }
}

/**
 * Send pending review notification
 */
async function sendPendingReviewNotification(
  container: SubscriberArgs<any>["container"],
  business: any
) {
  const notificationService = container.resolve(Modules.NOTIFICATION)
  const logger = container.resolve("logger")
  
  try {
    const complianceEmail = process.env.COMPLIANCE_EMAIL || "compliance@therxspot.app"
    
    await notificationService.createNotifications({
      to: complianceEmail,
      channel: "email",
      template: "business-pending-review",
      data: {
        business_id: business.id,
        business_name: business.name,
        business_email: business.contact_email,
        submitted_at: business.created_at,
        dashboard_url: `${process.env.ADMIN_URL || ""}/businesses/${business.id}`,
      },
    })
    
    logger.info(`Sent pending review notification for business ${business.id}`)
  } catch (error) {
    logger.error(`Failed to send pending review notification: ${error.message}`)
  }
}

/**
 * Subscriber configuration
 */
export const config: SubscriberConfig = {
  event: "business.status_changed",
}
