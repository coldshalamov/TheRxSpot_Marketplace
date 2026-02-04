import { MedusaService } from "@medusajs/framework/utils"
import { Document } from "./models/document"
import { AuditLog } from "./models/audit-log"
import {
  createStorageProvider,
  StorageProvider,
  generateStorageKey,
  validateFileType,
  validateFileSize,
} from "./services/storage"
import { generateChecksum, verifyChecksum } from "./utils/checksum"
import {
  canAccessDocument,
  canDownloadDocument,
  canModifyDocument,
  canDeleteDocument,
  canChangeAccessLevel,
  checkDocumentAccess,
  DocumentAccessLevel,
} from "./utils/access-control"

// ============================================================================
// DTO Types
// ============================================================================

export interface UploadDocumentDTO {
  business_id: string
  patient_id: string
  consultation_id?: string | null
  order_id?: string | null
  type: "prescription" | "lab_result" | "medical_record" | "consent_form" | "id_verification" | "insurance_card" | "other"
  title: string
  description?: string | null
  access_level: DocumentAccessLevel
  expires_at?: Date | null
}

export interface ListDocumentsDTO {
  business_id?: string
  patient_id?: string
  consultation_id?: string
  order_id?: string
  type?: string
  access_level?: string
  date_from?: Date
  date_to?: Date
  skip?: number
  take?: number
}

export interface CreateAuditLogDTO {
  actor_type: "customer" | "business_user" | "clinician" | "system" | "api_key"
  actor_id: string
  actor_email?: string | null
  ip_address?: string | null
  user_agent?: string | null
  action: "create" | "read" | "update" | "delete" | "download" | "login" | "logout" | "export"
  entity_type: "consultation" | "order" | "document" | "patient" | "business" | "earning" | "payout"
  entity_id: string
  business_id?: string | null
  consultation_id?: string | null
  order_id?: string | null
  changes?: { before: Record<string, any> | null; after: Record<string, any> | null } | null
  metadata?: Record<string, any>
  risk_level?: "low" | "medium" | "high" | "critical"
  flagged?: boolean
}

export interface QueryAuditLogsDTO {
  actor_id?: string
  actor_type?: string
  entity_type?: string
  entity_id?: string
  business_id?: string
  consultation_id?: string
  order_id?: string
  action?: string
  risk_level?: string
  flagged?: boolean
  date_from?: Date
  date_to?: Date
  skip?: number
  take?: number
}

export interface AuditLogStatsDTO {
  business_id?: string
  date_from?: Date
  date_to?: Date
}

export interface AuditLogStats {
  total_events: number
  events_by_type: { action: string; count: number }[]
  events_by_risk_level: { risk_level: string; count: number }[]
  flagged_events: number
  recent_events: AuditLog[]
}

// ============================================================================
// Service Class
// ============================================================================

class ComplianceModuleService extends MedusaService({
  Document,
  AuditLog,
}) {
  private storageProvider: StorageProvider

  constructor(...args: any[]) {
    super(...args)
    this.storageProvider = createStorageProvider()
  }

  // ==========================================
  // STORAGE PROVIDER
  // ==========================================

  /**
   * Set a custom storage provider (useful for testing)
   */
  setStorageProvider(provider: StorageProvider): void {
    this.storageProvider = provider
  }

  // ==========================================
  // DOCUMENT METHODS - Core CRUD
  // ==========================================

  /**
   * Upload a new document with file storage
   */
  async uploadDocument(
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    metadata: UploadDocumentDTO,
    uploadedBy: string
  ): Promise<Document> {
    // Validate file type
    if (!validateFileType(file.mimetype)) {
      throw new Error(`File type '${file.mimetype}' is not allowed`)
    }

    // Validate file size (10MB default)
    if (!validateFileSize(file.size)) {
      throw new Error(`File size exceeds maximum allowed (10MB)`)
    }

    // Generate storage key
    const storageKey = generateStorageKey(
      metadata.business_id,
      metadata.patient_id,
      file.originalname
    )

    // Generate checksum for integrity
    const checksum = generateChecksum(file.buffer)

    // Get storage config
    const storageConfig = {
      provider: process.env.DOCUMENT_STORAGE_PROVIDER || "local",
      bucket: process.env.DOCUMENT_STORAGE_BUCKET || "therxspot-documents",
    }

    // Upload to storage provider
    await this.storageProvider.upload(storageKey, file.buffer, {
      contentType: file.mimetype,
      originalName: file.originalname,
      uploadedBy,
      businessId: metadata.business_id,
      patientId: metadata.patient_id,
      checksum,
    })

    // Create document record
    const documentData: Partial<Document> = {
      business_id: metadata.business_id,
      patient_id: metadata.patient_id,
      consultation_id: metadata.consultation_id ?? null,
      order_id: metadata.order_id ?? null,
      uploaded_by: uploadedBy,
      type: metadata.type,
      title: metadata.title,
      description: metadata.description ?? null,
      storage_provider: storageConfig.provider as any,
      storage_bucket: storageConfig.bucket,
      storage_key: storageKey,
      file_name: file.originalname,
      file_size: file.size,
      mime_type: file.mimetype,
      checksum,
      encryption_key_id: process.env.DOCUMENT_ENCRYPTION_KEY_ID ?? null,
      is_encrypted: !!process.env.DOCUMENT_ENCRYPTION_KEY_ID,
      access_level: metadata.access_level,
      expires_at: metadata.expires_at ?? null,
      download_count: 0,
      last_downloaded_at: null,
      last_downloaded_by: null,
    }

    const document = await this.createDocuments(documentData)

    // Log audit event
    await this.logAuditEvent({
      actor_type: "business_user",
      actor_id: uploadedBy,
      action: "create",
      entity_type: "document",
      entity_id: document.id,
      business_id: metadata.business_id,
      consultation_id: metadata.consultation_id ?? null,
      order_id: metadata.order_id ?? null,
      changes: { before: null, after: { id: document.id, title: document.title } },
      metadata: { fileName: file.originalname, fileSize: file.size },
      risk_level: "low",
    })

    return document
  }

  /**
   * Get a document with access control check
   */
  async getDocument(id: string, requestedBy: string, userType: Parameters<typeof canAccessDocument>[2]): Promise<Document> {
    const document = await this.getDocumentById(id)
    
    if (!document) {
      throw new Error(`Document not found: ${id}`)
    }

    // Check access permissions
    const accessCheck = checkDocumentAccess(document, requestedBy, userType, "read")
    if (!accessCheck.allowed) {
      throw new Error(`Access denied: ${accessCheck.reason}`)
    }

    return document
  }

  /**
   * Get a signed download URL for a document
   */
  async getSignedDownloadUrl(
    documentId: string,
    requestedBy: string,
    userType: Parameters<typeof canDownloadDocument>[2],
    expiresInSeconds: number = 3600
  ): Promise<{ url: string; expires_at: Date }> {
    const document = await this.getDocumentById(documentId)
    
    if (!document) {
      throw new Error(`Document not found: ${documentId}`)
    }

    // Check download permissions
    if (!canDownloadDocument(document, requestedBy, userType)) {
      throw new Error("Access denied: You do not have permission to download this document")
    }

    // Generate signed URL
    const url = await this.storageProvider.getSignedUrl(
      document.storage_key,
      expiresInSeconds
    )

    // Increment download count
    await this.incrementDownloadCount(documentId, requestedBy)

    // Log audit event
    await this.logAuditEvent({
      actor_type: userType === "patient" ? "customer" : "business_user",
      actor_id: requestedBy,
      action: "download",
      entity_type: "document",
      entity_id: documentId,
      business_id: document.business_id,
      consultation_id: document.consultation_id,
      order_id: document.order_id,
      metadata: { fileName: document.file_name },
      risk_level: "low",
    })

    return {
      url,
      expires_at: new Date(Date.now() + expiresInSeconds * 1000),
    }
  }

  /**
   * Delete a document with access control
   */
  async deleteDocument(id: string, deletedBy: string, userType: Parameters<typeof canDeleteDocument>[2]): Promise<void> {
    const document = await this.getDocumentById(id)
    
    if (!document) {
      throw new Error(`Document not found: ${id}`)
    }

    // Check delete permissions
    if (!canDeleteDocument(document, deletedBy, userType)) {
      throw new Error("Access denied: You do not have permission to delete this document")
    }

    // Delete from storage
    await this.storageProvider.delete(document.storage_key)

    // Delete from database
    await this.deleteDocuments(id)

    // Log audit event
    await this.logAuditEvent({
      actor_type: "business_user",
      actor_id: deletedBy,
      action: "delete",
      entity_type: "document",
      entity_id: id,
      business_id: document.business_id,
      consultation_id: document.consultation_id,
      order_id: document.order_id,
      changes: { before: { id: document.id, title: document.title }, after: null },
      metadata: { fileName: document.file_name },
      risk_level: "medium",
    })
  }

  /**
   * Update document metadata
   */
  async updateDocumentMetadata(
    id: string,
    data: Partial<Pick<Document, "title" | "description" | "access_level">>,
    updatedBy: string,
    userType: Parameters<typeof canModifyDocument>[2]
  ): Promise<Document> {
    const document = await this.getDocumentById(id)
    
    if (!document) {
      throw new Error(`Document not found: ${id}`)
    }

    // Check modify permissions
    if (!canModifyDocument(document, updatedBy, userType)) {
      throw new Error("Access denied: You do not have permission to modify this document")
    }

    // If changing access level, validate
    if (data.access_level && data.access_level !== document.access_level) {
      if (!canChangeAccessLevel(document, updatedBy, userType, data.access_level)) {
        throw new Error("Access denied: Cannot change to the requested access level")
      }
    }

    const beforeData = { title: document.title, description: document.description, access_level: document.access_level }
    
    const updated = await this.updateDocuments(id, data)

    // Log audit event
    await this.logAuditEvent({
      actor_type: "business_user",
      actor_id: updatedBy,
      action: "update",
      entity_type: "document",
      entity_id: id,
      business_id: document.business_id,
      consultation_id: document.consultation_id,
      order_id: document.order_id,
      changes: { before: beforeData, after: data },
      risk_level: "low",
    })

    return updated
  }

  /**
   * Update document access level
   */
  async updateDocumentAccessLevel(
    id: string,
    accessLevel: DocumentAccessLevel,
    updatedBy: string,
    userType: Parameters<typeof canChangeAccessLevel>[2]
  ): Promise<Document> {
    return this.updateDocumentMetadata(id, { access_level: accessLevel }, updatedBy, userType)
  }

  // ==========================================
  // DOCUMENT METHODS - Queries
  // ==========================================

  /**
   * List documents with filters and pagination
   */
  async listDocuments(filters: ListDocumentsDTO): Promise<{ documents: Document[]; count: number }> {
    const { skip = 0, take = 20, ...whereFilters } = filters

    // Build query filters
    const queryFilters: Record<string, any> = {}
    
    if (whereFilters.business_id) queryFilters.business_id = whereFilters.business_id
    if (whereFilters.patient_id) queryFilters.patient_id = whereFilters.patient_id
    if (whereFilters.consultation_id) queryFilters.consultation_id = whereFilters.consultation_id
    if (whereFilters.order_id) queryFilters.order_id = whereFilters.order_id
    if (whereFilters.type) queryFilters.type = whereFilters.type
    if (whereFilters.access_level) queryFilters.access_level = whereFilters.access_level

    // Date range filters
    if (whereFilters.date_from || whereFilters.date_to) {
      queryFilters.created_at = {}
      if (whereFilters.date_from) queryFilters.created_at.$gte = whereFilters.date_from
      if (whereFilters.date_to) queryFilters.created_at.$lte = whereFilters.date_to
    }

    const [documents, count] = await this.listDocumentsWithCount(queryFilters, {
      skip,
      take,
      order: { created_at: "DESC" },
    })

    return { documents, count }
  }

  /**
   * Get document by ID
   */
  async getDocumentById(documentId: string): Promise<Document | null> {
    const documents = await this.listDocuments({ id: documentId }, { take: 1 })
    return documents.documents[0] ?? null
  }

  /**
   * Get documents by consultation
   */
  async getDocumentsByConsultation(consultationId: string): Promise<Document[]> {
    const result = await this.listDocuments({ consultation_id: consultationId })
    return result.documents
  }

  /**
   * Get documents by patient
   */
  async getDocumentsByPatient(patientId: string): Promise<Document[]> {
    const result = await this.listDocuments({ patient_id: patientId })
    return result.documents
  }

  /**
   * Get documents by order
   */
  async getDocumentsByOrder(orderId: string): Promise<Document[]> {
    const result = await this.listDocuments({ order_id: orderId })
    return result.documents
  }

  /**
   * Verify document integrity using checksum
   */
  async verifyDocumentIntegrity(id: string): Promise<{ is_valid: boolean; checksum_match: boolean }> {
    const document = await this.getDocumentById(id)
    
    if (!document) {
      throw new Error(`Document not found: ${id}`)
    }

    try {
      // Download file from storage
      const buffer = await this.storageProvider.download(document.storage_key)
      
      // Verify checksum
      const isValid = verifyChecksum(buffer, document.checksum)
      
      return {
        is_valid: isValid,
        checksum_match: isValid,
      }
    } catch (error) {
      return {
        is_valid: false,
        checksum_match: false,
      }
    }
  }

  /**
   * Increment download count
   */
  async incrementDownloadCount(documentId: string, downloadedBy: string): Promise<void> {
    const document = await this.getDocumentById(documentId)
    if (!document) {
      throw new Error(`Document not found: ${documentId}`)
    }

    await this.updateDocuments(documentId, {
      download_count: (document.download_count || 0) + 1,
      last_downloaded_at: new Date(),
      last_downloaded_by: downloadedBy,
    })
  }

  // ==========================================
  // AUDIT LOG METHODS
  // ==========================================

  /**
   * Create an audit log entry
   */
  async logAuditEvent(event: CreateAuditLogDTO): Promise<AuditLog> {
    return await this.createAuditLogs({
      ...event,
      created_at: new Date(),
      metadata: event.metadata || {},
      risk_level: event.risk_level || "low",
      flagged: event.flagged || false,
    })
  }

  /**
   * Query audit logs with filters
   */
  async queryAuditLogs(filters: QueryAuditLogsDTO): Promise<{ logs: AuditLog[]; count: number; total: number }> {
    const { skip = 0, take = 50, ...whereFilters } = filters

    // Build query filters
    const queryFilters: Record<string, any> = {}
    
    if (whereFilters.actor_id) queryFilters.actor_id = whereFilters.actor_id
    if (whereFilters.actor_type) queryFilters.actor_type = whereFilters.actor_type
    if (whereFilters.entity_type) queryFilters.entity_type = whereFilters.entity_type
    if (whereFilters.entity_id) queryFilters.entity_id = whereFilters.entity_id
    if (whereFilters.business_id) queryFilters.business_id = whereFilters.business_id
    if (whereFilters.consultation_id) queryFilters.consultation_id = whereFilters.consultation_id
    if (whereFilters.order_id) queryFilters.order_id = whereFilters.order_id
    if (whereFilters.action) queryFilters.action = whereFilters.action
    if (whereFilters.risk_level) queryFilters.risk_level = whereFilters.risk_level
    if (whereFilters.flagged !== undefined) queryFilters.flagged = whereFilters.flagged

    // Date range filters
    if (whereFilters.date_from || whereFilters.date_to) {
      queryFilters.created_at = {}
      if (whereFilters.date_from) queryFilters.created_at.$gte = whereFilters.date_from
      if (whereFilters.date_to) queryFilters.created_at.$lte = whereFilters.date_to
    }

    const [logs, count] = await this.listAuditLogsWithCount(queryFilters, {
      skip,
      take,
      order: { created_at: "DESC" },
    })

    return { logs, count, total: count }
  }

  /**
   * Get audit log statistics
   */
  async getAuditLogStats(filters: AuditLogStatsDTO): Promise<AuditLogStats> {
    const queryFilters: Record<string, any> = {}
    
    if (filters.business_id) queryFilters.business_id = filters.business_id
    if (filters.date_from || filters.date_to) {
      queryFilters.created_at = {}
      if (filters.date_from) queryFilters.created_at.$gte = filters.date_from
      if (filters.date_to) queryFilters.created_at.$lte = filters.date_to
    }

    // Get total events
    const [allLogs, totalEvents] = await this.listAuditLogsWithCount(queryFilters)

    // Get events by type
    const eventsByType: { action: string; count: number }[] = []
    const actions = ["create", "read", "update", "delete", "download", "login", "logout", "export"]
    for (const action of actions) {
      const [, count] = await this.listAuditLogsWithCount({ ...queryFilters, action })
      if (count > 0) {
        eventsByType.push({ action, count })
      }
    }

    // Get events by risk level
    const eventsByRiskLevel: { risk_level: string; count: number }[] = []
    const riskLevels = ["low", "medium", "high", "critical"]
    for (const level of riskLevels) {
      const [, count] = await this.listAuditLogsWithCount({ ...queryFilters, risk_level: level })
      if (count > 0) {
        eventsByRiskLevel.push({ risk_level: level, count })
      }
    }

    // Get flagged events count
    const [, flaggedEvents] = await this.listAuditLogsWithCount({
      ...queryFilters,
      flagged: true,
    })

    // Get recent events (last 5)
    const recentResult = await this.queryAuditLogs({ ...filters, take: 5 })

    return {
      total_events: totalEvents,
      events_by_type: eventsByType.sort((a, b) => b.count - a.count),
      events_by_risk_level: eventsByRiskLevel.sort((a, b) => b.count - a.count),
      flagged_events: flaggedEvents,
      recent_events: recentResult.logs,
    }
  }

  /**
   * Flag or unflag an audit log entry
   */
  async flagAuditLog(id: string, reason: string, flagged: boolean = true): Promise<AuditLog> {
    const logs = await this.listAuditLogs({ id }, { take: 1 })
    if (!logs.logs.length) {
      throw new Error(`Audit log not found: ${id}`)
    }

    return await this.updateAuditLogs(id, {
      flagged,
      metadata: { ...logs.logs[0].metadata, flagReason: reason },
    })
  }

  /**
   * Auto-create audit log from request context
   */
  async createAutoLog(
    action: CreateAuditLogDTO["action"],
    entityType: CreateAuditLogDTO["entity_type"],
    entityId: string,
    actorType: CreateAuditLogDTO["actor_type"],
    actorId: string,
    req: {
      ip?: string
      headers: Record<string, string | string[] | undefined>
      body?: Record<string, any>
    },
    options?: {
      businessId?: string
      consultationId?: string
      orderId?: string
      changes?: { before: Record<string, any> | null; after: Record<string, any> | null }
      riskLevel?: CreateAuditLogDTO["risk_level"]
    }
  ): Promise<AuditLog> {
    const userAgent = Array.isArray(req.headers["user-agent"])
      ? req.headers["user-agent"][0]
      : req.headers["user-agent"]

    return this.logAuditEvent({
      actor_type: actorType,
      actor_id: actorId,
      ip_address: req.ip ?? null,
      user_agent: userAgent ?? null,
      action,
      entity_type: entityType,
      entity_id: entityId,
      business_id: options?.businessId ?? null,
      consultation_id: options?.consultationId ?? null,
      order_id: options?.orderId ?? null,
      changes: options?.changes ?? null,
      metadata: { body: req.body },
      risk_level: options?.riskLevel ?? "low",
    })
  }

  // ==========================================
  // EXISTING METHODS (Backward Compatibility)
  // ==========================================

  async listDocumentsByBusiness(businessId: string) {
    return await this.listDocuments({ business_id: businessId })
  }

  async listDocumentsByPatient(patientId: string) {
    return await this.listDocuments({ patient_id: patientId })
  }

  async listDocumentsByConsultation(consultationId: string) {
    return await this.listDocuments({ consultation_id: consultationId })
  }

  async listDocumentsByOrder(orderId: string) {
    return await this.listDocuments({ order_id: orderId })
  }

  async listDocumentsByType(type: string) {
    return await this.listDocuments({ type })
  }

  async listDocumentsByAccessLevel(accessLevel: string) {
    return await this.listDocuments({ access_level: accessLevel })
  }

  async listAuditLogsByBusiness(businessId: string) {
    return await this.queryAuditLogs({ business_id: businessId })
  }

  async listAuditLogsByActor(actorType: string, actorId: string) {
    return await this.queryAuditLogs({ actor_type: actorType, actor_id: actorId })
  }

  async listAuditLogsByEntity(entityType: string, entityId: string) {
    return await this.queryAuditLogs({ entity_type: entityType, entity_id: entityId })
  }

  async listAuditLogsByAction(action: string) {
    return await this.queryAuditLogs({ action })
  }

  async listAuditLogsByRiskLevel(riskLevel: string) {
    return await this.queryAuditLogs({ risk_level: riskLevel })
  }

  async listFlaggedAuditLogs() {
    return await this.queryAuditLogs({ flagged: true })
  }

  async listHighRiskAuditLogs() {
    const high = await this.queryAuditLogs({ risk_level: "high" })
    const critical = await this.queryAuditLogs({ risk_level: "critical" })
    return {
      logs: [...high.logs, ...critical.logs],
      count: high.count + critical.count,
      total: high.total + critical.total,
    }
  }

  // Legacy logging helpers
  async logEntityCreation(
    actorType: string,
    actorId: string,
    actorEmail: string | null,
    entityType: string,
    entityId: string,
    entityData: Record<string, any>,
    metadata?: {
      businessId?: string
      consultationId?: string
      orderId?: string
      ipAddress?: string
      userAgent?: string
    }
  ) {
    return await this.logAuditEvent({
      actor_type: actorType as any,
      actor_id: actorId,
      actor_email: actorEmail,
      action: "create",
      entity_type: entityType as any,
      entity_id: entityId,
      business_id: metadata?.businessId ?? null,
      consultation_id: metadata?.consultationId ?? null,
      order_id: metadata?.orderId ?? null,
      changes: { before: null, after: entityData },
      metadata: metadata || {},
      risk_level: "low",
      flagged: false,
    })
  }

  async logEntityUpdate(
    actorType: string,
    actorId: string,
    actorEmail: string | null,
    entityType: string,
    entityId: string,
    beforeData: Record<string, any>,
    afterData: Record<string, any>,
    metadata?: {
      businessId?: string
      consultationId?: string
      orderId?: string
      ipAddress?: string
      userAgent?: string
    }
  ) {
    return await this.logAuditEvent({
      actor_type: actorType as any,
      actor_id: actorId,
      actor_email: actorEmail,
      action: "update",
      entity_type: entityType as any,
      entity_id: entityId,
      business_id: metadata?.businessId ?? null,
      consultation_id: metadata?.consultationId ?? null,
      order_id: metadata?.orderId ?? null,
      changes: { before: beforeData, after: afterData },
      metadata: metadata || {},
      risk_level: "low",
      flagged: false,
    })
  }

  async logEntityDeletion(
    actorType: string,
    actorId: string,
    actorEmail: string | null,
    entityType: string,
    entityId: string,
    entityData: Record<string, any>,
    metadata?: {
      businessId?: string
      consultationId?: string
      orderId?: string
      ipAddress?: string
      userAgent?: string
    }
  ) {
    return await this.logAuditEvent({
      actor_type: actorType as any,
      actor_id: actorId,
      actor_email: actorEmail,
      action: "delete",
      entity_type: entityType as any,
      entity_id: entityId,
      business_id: metadata?.businessId ?? null,
      consultation_id: metadata?.consultationId ?? null,
      order_id: metadata?.orderId ?? null,
      changes: { before: entityData, after: null },
      metadata: metadata || {},
      risk_level: "medium",
      flagged: false,
    })
  }

  async logDocumentDownload(
    actorType: string,
    actorId: string,
    actorEmail: string | null,
    documentId: string,
    metadata?: {
      businessId?: string
      consultationId?: string
      orderId?: string
      ipAddress?: string
      userAgent?: string
    }
  ) {
    return await this.logAuditEvent({
      actor_type: actorType as any,
      actor_id: actorId,
      actor_email: actorEmail,
      action: "download",
      entity_type: "document",
      entity_id: documentId,
      business_id: metadata?.businessId ?? null,
      consultation_id: metadata?.consultationId ?? null,
      order_id: metadata?.orderId ?? null,
      changes: null,
      metadata: metadata || {},
      risk_level: "low",
      flagged: false,
    })
  }

  async logLogin(
    actorType: string,
    actorId: string,
    actorEmail: string | null,
    metadata?: {
      ipAddress?: string
      userAgent?: string
    }
  ) {
    return await this.logAuditEvent({
      actor_type: actorType as any,
      actor_id: actorId,
      actor_email: actorEmail,
      action: "login",
      entity_type: "business",
      entity_id: actorId,
      business_id: null,
      consultation_id: null,
      order_id: null,
      changes: null,
      metadata: metadata || {},
      risk_level: "low",
      flagged: false,
    })
  }

  async logLogout(
    actorType: string,
    actorId: string,
    actorEmail: string | null,
    metadata?: {
      ipAddress?: string
      userAgent?: string
    }
  ) {
    return await this.logAuditEvent({
      actor_type: actorType as any,
      actor_id: actorId,
      actor_email: actorEmail,
      action: "logout",
      entity_type: "business",
      entity_id: actorId,
      business_id: null,
      consultation_id: null,
      order_id: null,
      changes: null,
      metadata: metadata || {},
      risk_level: "low",
      flagged: false,
    })
  }
}

export default ComplianceModuleService
