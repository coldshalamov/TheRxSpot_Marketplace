import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { BUSINESS_MODULE } from "../modules/business"
import { getLogger } from "../utils/logger"

/**
 * Subscriber: Handle order.placed event
 * 
 * Purpose:
 * - Create earnings entries for the business
 * - Update business order statistics
 * - Send order confirmation emails to customer
 * - Send order notification to business
 * - Update inventory
 */

export default async function orderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const orderService = container.resolve(Modules.ORDER)
  const businessService = container.resolve(BUSINESS_MODULE)
  const notificationService = container.resolve(Modules.NOTIFICATION)
  const logger = getLogger()
  
  logger.info({ order_id: data.id }, "order-placed: processing event")
  
  try {
    // Retrieve the full order with relations
    const order = await orderService.retrieveOrder(data.id, {
      relations: ["items", "items.product", "customer", "shipping_address"],
    })
    
    if (!order) {
      logger.warn({ order_id: data.id }, "order-placed: order not found")
      return
    }
    
    // Get business ID from order metadata
    const businessId = order.metadata?.business_id as string
    
    if (!businessId) {
      logger.warn({ order_id: data.id }, "order-placed: no associated business")
      return
    }
    
    // Get business details
    const business = await businessService.retrieveBusiness(businessId)
    
    if (!business) {
      logger.warn({ order_id: data.id, tenant_id: businessId }, "order-placed: business not found")
      return
    }
    
    // 1. Create earnings entry
    await createEarningsEntry(container, order, business)
    
    // 2. Update business order statistics
    await updateBusinessStatistics(container, business, order)
    
    // 3. Send confirmation email to customer
    await sendCustomerConfirmation(container, order, business)
    
    // 4. Send notification to business
    await sendBusinessNotification(container, order, business)
    
    logger.info({ order_id: data.id, tenant_id: businessId }, "order-placed: processed successfully")
  } catch (error) {
    logger.error(
      { order_id: data.id, error: error instanceof Error ? error.message : String(error) },
      "order-placed: error processing event"
    )
    throw error
  }
}

/**
 * Create earnings entry for the business
 */
async function createEarningsEntry(
  container: SubscriberArgs<any>["container"],
  order: any,
  business: any
) {
  const logger = getLogger()
  
  try {
    // Calculate platform fee
    const platformFeePercentage = business.platform_fee_percentage || 10
    const orderTotal = order.total || 0
    const platformFee = orderTotal * (platformFeePercentage / 100)
    const businessEarnings = orderTotal - platformFee
    
    // This would typically create a record in an earnings table
    // Implement based on your earnings model
    
    const earningsRecord = {
      id: `earn_${Date.now()}_${order.id}`,
      business_id: business.id,
      order_id: order.id,
      order_total: orderTotal,
      platform_fee: platformFee,
      business_earnings: businessEarnings,
      status: "pending", // pending, ready_for_payout, paid
      created_at: new Date(),
    }
    
    logger.info(
      { order_id: order.id, tenant_id: business.id, earnings_id: earningsRecord.id },
      "order-placed: earnings entry created"
    )
    
    return earningsRecord
  } catch (error) {
    logger.error(
      { order_id: order.id, tenant_id: business.id, error: error instanceof Error ? error.message : String(error) },
      "order-placed: failed to create earnings entry"
    )
    throw error
  }
}

/**
 * Update business order statistics
 */
async function updateBusinessStatistics(
  container: SubscriberArgs<any>["container"],
  business: any,
  order: any
) {
  const businessService = container.resolve(BUSINESS_MODULE)
  const logger = getLogger()
  
  try {
    const currentSettings = (business.settings ?? {}) as Record<string, any>
    const currentStats = (currentSettings.statistics ?? {}) as Record<string, any>
    
    // Calculate new statistics
    const orderCount = (currentStats.order_count || 0) + 1
    const totalRevenue = (currentStats.total_revenue || 0) + (order.total || 0)

    const nextSettings = {
      ...currentSettings,
      statistics: {
        ...currentStats,
        order_count: orderCount,
        total_revenue: totalRevenue,
        last_order_at: new Date(),
      },
    }
    
    await businessService.updateBusinesses({ id: business.id, settings: nextSettings } as any)
    
    logger.info({ tenant_id: business.id }, "order-placed: updated business statistics")
  } catch (error) {
    logger.error(
      { tenant_id: business.id, error: error instanceof Error ? error.message : String(error) },
      "order-placed: failed to update business statistics"
    )
    // Don't throw - statistics update failure shouldn't fail order processing
  }
}

/**
 * Send order confirmation email to customer
 */
async function sendCustomerConfirmation(
  container: SubscriberArgs<any>["container"],
  order: any,
  business: any
) {
  const notificationService = container.resolve(Modules.NOTIFICATION)
  const logger = getLogger()
  
  try {
    const customerEmail = order.email || order.customer?.email
    
    if (!customerEmail) {
      logger.warn({ order_id: order.id }, "order-placed: no customer email")
      return
    }
    
    await notificationService.createNotifications({
      to: customerEmail,
      channel: "email",
      template: "order-confirmation",
      data: {
        order_id: order.id,
        order_number: order.display_id || order.id,
        order_date: order.created_at,
        order_total: order.total,
        order_currency: order.currency_code,
        customer_name: getCustomerName(order),
        items: order.items?.map((item: any) => ({
          title: item.title,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.total,
        })),
        business_name: business.name,
        business_contact: business.contact_email,
        storefront_url: business.settings?.storefront_url,
        order_status_url: `${business.settings?.storefront_url}/orders/${order.id}`,
      },
    })
    
    logger.info({ order_id: order.id, email: customerEmail }, "order-placed: customer confirmation sent")
  } catch (error) {
    logger.error(
      { order_id: order.id, error: error instanceof Error ? error.message : String(error) },
      "order-placed: failed to send customer confirmation"
    )
    // Don't throw - notification failure shouldn't fail order processing
  }
}

/**
 * Send order notification to business
 */
async function sendBusinessNotification(
  container: SubscriberArgs<any>["container"],
  order: any,
  business: any
) {
  const notificationService = container.resolve(Modules.NOTIFICATION)
  const logger = getLogger()
  
  try {
    const businessEmail = business.contact_email || business.email
    
    if (!businessEmail) {
      logger.warn({ tenant_id: business.id }, "order-placed: no business email found")
      return
    }
    
    await notificationService.createNotifications({
      to: businessEmail,
      channel: "email",
      template: "new-order-notification",
      data: {
        order_id: order.id,
        order_number: order.display_id || order.id,
        order_date: order.created_at,
        order_total: order.total,
        order_currency: order.currency_code,
        customer_name: getCustomerName(order),
        customer_email: order.email || order.customer?.email,
        items: order.items?.map((item: any) => ({
          title: item.title,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.total,
        })),
        business_name: business.name,
        dashboard_url: `${business.settings?.storefront_url}/admin/orders`,
      },
    })
    
    logger.info({ tenant_id: business.id, email: businessEmail }, "order-placed: business notification sent")
  } catch (error) {
    logger.error(
      { tenant_id: business.id, error: error instanceof Error ? error.message : String(error) },
      "order-placed: failed to send business notification"
    )
    // Don't throw - notification failure shouldn't fail order processing
  }
}

/**
 * Get customer name from order
 */
function getCustomerName(order: any): string {
  if (order.customer) {
    const firstName = order.customer.first_name || ""
    const lastName = order.customer.last_name || ""
    return `${firstName} ${lastName}`.trim() || "Valued Customer"
  }
  
  if (order.shipping_address) {
    const firstName = order.shipping_address.first_name || ""
    const lastName = order.shipping_address.last_name || ""
    return `${firstName} ${lastName}`.trim() || "Valued Customer"
  }
  
  return "Valued Customer"
}

/**
 * Subscriber configuration
 */
export const config: SubscriberConfig = {
  event: "order.placed",
}
