import { MedusaService } from "@medusajs/framework/utils"
import { Business } from "./models/business"
import { Location } from "./models/location"
import { ProductCategory } from "./models/product-category"
import { LocationProduct } from "./models/location-product"
import { ConsultSubmission } from "./models/consult-submission"
import { ConsultApproval } from "./models/consult-approval"
import { BusinessDomain } from "./models/business-domain"
import { BusinessUser } from "./models/business-user"
import { OrderStatusEvent } from "./models/order-status-event"
import { OutboxEvent } from "./models/outbox-event"
import { decryptFields, encryptFields } from "../../utils/encryption"

class BusinessModuleService extends MedusaService({
  Business,
  Location,
  ProductCategory,
  LocationProduct,
  ConsultSubmission,
  ConsultApproval,
  BusinessDomain,
  BusinessUser,
  OrderStatusEvent,
  OutboxEvent,
}) {
  private static readonly CONSULT_SUBMISSION_PHI_FIELDS = [
    "customer_email",
    "customer_first_name",
    "customer_last_name",
    "customer_phone",
    "customer_dob",
    "eligibility_answers",
    "chief_complaint",
    "medical_history",
    "notes",
  ] as const

  private static isPhiEncryptionEnabled(): boolean {
    return (process.env.PHI_ENCRYPTION_ENABLED || "").toLowerCase() === "true"
  }

  async getBusinessBySlug(slug: string) {
    const businesses = await this.listBusinesses({ slug }, { take: 1 })
    return businesses[0] ?? null
  }

  async getBusinessByDomain(domain: string) {
    const businesses = await this.listBusinesses({ domain }, { take: 1 })
    return businesses[0] ?? null
  }

  async getBusinessByDomainFromTable(domain: string) {
    const domains = await this.listBusinessDomains({ domain, is_verified: true }, { take: 1 })
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
    return await this.listConsultSubmissionsDecrypted(
      { business_id: businessId },
      { order: { created_at: "DESC" } }
    )
  }

  /**
   * Returns consult submissions for a business that match an email address.
   * When PHI encryption is enabled, this does an in-memory match after decryption.
   */
  async listConsultSubmissionsByEmail(businessId: string, email: string) {
    const needle = (email || "").trim().toLowerCase()
    if (!needle) {
      return []
    }

    if (!BusinessModuleService.isPhiEncryptionEnabled()) {
      return await this.listConsultSubmissionsDecrypted({
        business_id: businessId,
        customer_email: needle,
      })
    }

    const submissions = await this.listConsultSubmissionsDecrypted(
      { business_id: businessId },
      { take: 250, order: { created_at: "DESC" } }
    )

    return (submissions as any[]).filter((s) => (s?.customer_email || "").toLowerCase() === needle)
  }

  async approveConsultSubmission(submissionId: string, reviewedBy: string) {
    return await this.updateConsultSubmissions({
      id: submissionId,
      status: "approved",
      reviewed_by: reviewedBy,
      reviewed_at: new Date(),
    } as any)
  }

  async rejectConsultSubmission(submissionId: string, reviewedBy: string, notes?: string) {
    return await this.updateConsultSubmissions({
      id: submissionId,
      status: "rejected",
      reviewed_by: reviewedBy,
      reviewed_at: new Date(),
      notes,
    } as any)
  }

  // ==========================================
  // Consult submission PHI helpers
  // ==========================================

  async createConsultSubmission(input: Record<string, any>): Promise<any> {
    if (!BusinessModuleService.isPhiEncryptionEnabled()) {
      return await this.createConsultSubmissions(input)
    }

    const encrypted = encryptFields(
      input as any,
      BusinessModuleService.CONSULT_SUBMISSION_PHI_FIELDS as any
    )

    const created = await this.createConsultSubmissions(encrypted)

    return decryptFields(
      created as any,
      BusinessModuleService.CONSULT_SUBMISSION_PHI_FIELDS as any
    ) as any
  }

  async listConsultSubmissionsDecrypted(filters: any = {}, config: any = {}): Promise<any[]> {
    const list = (await this.listConsultSubmissions(filters, config)) as any[]

    if (!BusinessModuleService.isPhiEncryptionEnabled()) return list

    return list.map((s) =>
      decryptFields(s as any, BusinessModuleService.CONSULT_SUBMISSION_PHI_FIELDS as any)
    )
  }

  async retrieveConsultSubmissionDecrypted(id: string, config?: any): Promise<any> {
    const submission = await this.retrieveConsultSubmission(id, config)
    if (!BusinessModuleService.isPhiEncryptionEnabled()) return submission
    return decryptFields(
      submission as any,
      BusinessModuleService.CONSULT_SUBMISSION_PHI_FIELDS as any
    ) as any
  }

  // Order Status Event methods
  async recordOrderStatusEvent(
    orderId: string,
    businessId: string,
    fromStatus: string,
    toStatus: string,
    triggeredBy?: string,
    reason?: string,
    metadata?: Record<string, any>
  ) {
    return await this.createOrderStatusEvents({
      order_id: orderId,
      business_id: businessId,
      from_status: fromStatus,
      to_status: toStatus,
      triggered_by: triggeredBy ?? null,
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

  // =========================
  // Outbox (dispatch) methods
  // =========================

  async createOutboxEventOnce(input: {
    business_id: string
    type: string
    dedupe_key: string
    payload: Record<string, any>
    metadata?: Record<string, any>
    next_attempt_at?: Date | null
  }) {
    const existing = await this.listOutboxEvents(
      { dedupe_key: input.dedupe_key },
      { take: 1 }
    )
    if (existing?.[0]) {
      return existing[0]
    }

    try {
      return await this.createOutboxEvents({
        business_id: input.business_id,
        type: input.type,
        dedupe_key: input.dedupe_key,
        status: "pending",
        attempts: 0,
        next_attempt_at: input.next_attempt_at ?? null,
        delivered_at: null,
        last_error: null,
        payload: input.payload ?? {},
        metadata: input.metadata ?? {},
      } as any)
    } catch {
      const again = await this.listOutboxEvents(
        { dedupe_key: input.dedupe_key },
        { take: 1 }
      )
      return again?.[0] ?? null
    }
  }

  // Category hierarchy methods
  async listCategoriesByBusiness(businessId: string) {
    return await this.listProductCategories(
      { business_id: businessId },
      { order: { rank: "ASC" } }
    )
  }

  async getCategoryTree(businessId: string) {
    const categories = await this.listCategoriesByBusiness(businessId)
    const categoryMap = new Map(categories.map(c => [c.id, { ...c, children: [] as any[] }]))
    const tree: any[] = []

    for (const cat of categoryMap.values()) {
      if (cat.parent_id && categoryMap.has(cat.parent_id)) {
        categoryMap.get(cat.parent_id)!.children.push(cat)
      } else {
        tree.push(cat)
      }
    }

    return tree
  }

  async reorderCategories(categoryIds: string[], parentId: string | null = null) {
    const updates = categoryIds.map((id, index) => ({
      id,
      rank: index,
      parent_id: parentId,
    }))

    for (const update of updates) {
      await this.updateProductCategories(update)
    }
  }

  // LocationProduct methods - use inherited listLocationProducts from MedusaService
  async getLocationProductsByLocation(locationId: string) {
    return await this.listLocationProducts({ location_id: locationId })
  }

  async assignProductToLocation(
    locationId: string,
    productId: string,
    categoryId?: string,
    customPrice?: number
  ) {
    const existing = await this.listLocationProducts({ location_id: locationId, product_id: productId })

    if (existing.length > 0) {
      return await this.updateLocationProducts({
        id: existing[0].id,
        is_active: true,
        category_id: categoryId ?? null,
        custom_price: customPrice ?? null,
      })
    }

    return await this.createLocationProducts({
      location_id: locationId,
      product_id: productId,
      category_id: categoryId ?? null,
      custom_price: customPrice ?? null,
      is_active: true,
      rank: 0,
    })
  }

  async removeProductFromLocation(locationId: string, productId: string) {
    const existing = await this.listLocationProducts({ location_id: locationId, product_id: productId })

    if (existing.length > 0) {
      await this.deleteLocationProducts(existing[0].id)
    }
  }

  async reorderLocationProducts(locationId: string, productIds: string[]) {
    for (let i = 0; i < productIds.length; i++) {
      const existing = await this.listLocationProducts({ location_id: locationId, product_id: productIds[i] })

      if (existing.length > 0) {
        await this.updateLocationProducts({ id: existing[0].id, rank: i })
      }
    }
  }
}

export default BusinessModuleService
