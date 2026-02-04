import { MedusaService } from "@medusajs/framework/utils"
import { Business } from "./models/business"
import { Location } from "./models/location"
import { ProductCategory } from "./models/product-category"
import { ConsultSubmission } from "./models/consult-submission"
import { ConsultApproval } from "./models/consult-approval"
import { BusinessDomain } from "./models/business-domain"
import { BusinessUser } from "./models/business-user"
import { OrderStatusEvent } from "./models/order-status-event"

class BusinessModuleService extends MedusaService({
  Business,
  Location,
  ProductCategory,
  ConsultSubmission,
  ConsultApproval,
  BusinessDomain,
  BusinessUser,
  OrderStatusEvent,
}) {
  async getBusinessBySlug(slug: string) {
    const businesses = await this.listBusinesses({ slug }, { take: 1 })
    return businesses[0] ?? null
  }

  async getBusinessByDomain(domain: string) {
    const businesses = await this.listBusinesses({ domain }, { take: 1 })
    return businesses[0] ?? null
  }

  async getBusinessByDomainFromTable(domain: string) {
    const domains = await this.listBusinessDomains({ domain }, { take: 1 })
    if (!domains.length) return null
    const businesses = await this.listBusinesses(
      { id: domains[0].business_id },
      { take: 1 }
    )
    return businesses[0] ?? null
  }

  async listActiveBusinesses() {
    return await this.listBusinesses(
      { is_active: true },
      { order: { name: "ASC" } }
    )
  }

  async getBusinessByStatus(status: string) {
    return await this.listBusinesses(
      { status },
      { order: { name: "ASC" } }
    )
  }

  async listBusinessDomainsByBusiness(businessId: string) {
    return await this.listBusinessDomains({ business_id: businessId })
  }

  async listConsultSubmissionsByBusiness(businessId: string) {
    return await this.listConsultSubmissions(
      { business_id: businessId },
      { order: { created_at: "DESC" } }
    )
  }

  async approveConsultSubmission(submissionId: string, reviewedBy: string) {
    return await this.updateConsultSubmissions(submissionId, {
      status: "approved",
      reviewed_by: reviewedBy,
      reviewed_at: new Date(),
    })
  }

  async rejectConsultSubmission(submissionId: string, reviewedBy: string, notes?: string) {
    return await this.updateConsultSubmissions(submissionId, {
      status: "rejected",
      reviewed_by: reviewedBy,
      reviewed_at: new Date(),
      notes,
    })
  }

  // Order Status Event methods
  async recordOrderStatusEvent(
    orderId: string,
    fromStatus: string,
    toStatus: string,
    changedBy?: string,
    reason?: string,
    metadata?: Record<string, any>
  ) {
    return await this.createOrderStatusEvents({
      order_id: orderId,
      from_status: fromStatus,
      to_status: toStatus,
      changed_by: changedBy ?? null,
      reason: reason ?? null,
      metadata: metadata ?? null,
    })
  }

  async listOrderStatusEventsByOrder(orderId: string) {
    return await this.listOrderStatusEvents(
      { order_id: orderId },
      { order: { created_at: "ASC" } }
    )
  }

  async getLatestOrderStatusEvent(orderId: string) {
    const events = await this.listOrderStatusEvents(
      { order_id: orderId },
      { order: { created_at: "DESC" }, take: 1 }
    )
    return events[0] ?? null
  }
}

export default BusinessModuleService
