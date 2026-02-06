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
import { TemplateConfig } from "./models/template-config"
import { Coupon } from "./models/coupon"
import { decryptFields, encryptFields } from "../../utils/encryption"
import { DEFAULT_TEMPLATE_ID } from "./constants/template-ids"

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
  TemplateConfig,
  Coupon,
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

  async getCatalogLocation(businessId: string, locationId?: string) {
    if (locationId) {
      const location = await this.retrieveLocation(locationId)
      if (!location || location.business_id !== businessId) {
        throw new Error("Location not found for business")
      }
      return location
    }

    const locations = await this.listLocations(
      { business_id: businessId, is_active: true },
      { order: { name: "ASC" }, take: 1 }
    )

    return locations[0] ?? null
  }

  async listCatalogProductsByBusiness(businessId: string, locationId?: string) {
    const location = await this.getCatalogLocation(businessId, locationId)
    if (!location) return { location: null, locationProducts: [] as any[] }

    const locationProducts = await this.listLocationProducts({ location_id: location.id })
    locationProducts.sort((a: any, b: any) => (a.rank ?? 0) - (b.rank ?? 0))

    return {
      location,
      locationProducts,
    }
  }

  // =========================
  // Template Config methods
  // =========================

  async getPublishedTemplate(businessId: string) {
    const configs = await this.listTemplateConfigs(
      { business_id: businessId, is_published: true },
      { take: 1, order: { version: "DESC" } }
    )
    return configs[0] ?? null
  }

  async getLatestTemplateDraft(businessId: string) {
    const configs = await this.listTemplateConfigs(
      { business_id: businessId },
      { take: 1, order: { version: "DESC" } }
    )
    return configs[0] ?? null
  }

  async createDefaultTemplate(businessId: string): Promise<any> {
    const existing = await this.getLatestTemplateDraft(businessId)
    if (existing) return existing

    return await this.createTemplateConfigs({
      business_id: businessId,
      template_id: DEFAULT_TEMPLATE_ID,
      version: 1,
      is_published: true,
      published_at: new Date(),
      published_by: "system",
      sections: [
        { id: "hero", type: "hero", visible: true, order: 0, settings: {} },
        { id: "featured-products", type: "product_grid", visible: true, order: 1, settings: { limit: 8 } },
        { id: "about", type: "rich_text", visible: true, order: 2, settings: {} },
        { id: "footer", type: "footer", visible: true, order: 3, settings: {} },
      ],
      global_styles: {},
      metadata: {},
    } as any)
  }

  async publishTemplate(templateId: string, publishedBy: string): Promise<any> {
    const template = await this.retrieveTemplateConfig(templateId)

    // Un-publish any currently published config for this business
    const published = await this.listTemplateConfigs(
      { business_id: template.business_id, is_published: true },
      {}
    )
    for (const p of published) {
      if (p.id !== templateId) {
        await this.updateTemplateConfigs({ id: p.id, is_published: false } as any)
      }
    }

    return await this.updateTemplateConfigs({
      id: templateId,
      is_published: true,
      published_at: new Date(),
      published_by: publishedBy,
    } as any)
  }

  // =========================
  // Coupon methods
  // =========================

  async listCouponsByBusiness(businessId: string) {
    return await this.listCoupons(
      { business_id: businessId },
      { order: { created_at: "DESC" } }
    )
  }

  async getCouponByCode(businessId: string, code: string) {
    const coupons = await this.listCoupons(
      { business_id: businessId, code: code.toUpperCase() },
      { take: 1 }
    )
    return coupons[0] ?? null
  }

  async validateCoupon(businessId: string, code: string, orderAmount?: number): Promise<{
    valid: boolean
    coupon: any | null
    reason?: string
  }> {
    const coupon = await this.getCouponByCode(businessId, code)
    if (!coupon) return { valid: false, coupon: null, reason: "Coupon not found" }
    if (!coupon.is_active) return { valid: false, coupon, reason: "Coupon is inactive" }

    const now = new Date()
    if (coupon.starts_at && new Date(coupon.starts_at) > now) {
      return { valid: false, coupon, reason: "Coupon is not yet active" }
    }
    if (coupon.ends_at && new Date(coupon.ends_at) < now) {
      return { valid: false, coupon, reason: "Coupon has expired" }
    }
    if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
      return { valid: false, coupon, reason: "Coupon usage limit reached" }
    }
    if (orderAmount && coupon.min_order_amount && orderAmount < Number(coupon.min_order_amount)) {
      return { valid: false, coupon, reason: `Minimum order amount is ${coupon.min_order_amount}` }
    }

    return { valid: true, coupon }
  }

  async incrementCouponUsage(couponId: string): Promise<any> {
    const coupon = await this.retrieveCoupon(couponId)
    return await this.updateCoupons({
      id: couponId,
      usage_count: (coupon.usage_count || 0) + 1,
    } as any)
  }
}

export default BusinessModuleService
