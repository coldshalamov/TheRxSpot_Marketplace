/**
 * Access Control Utility for Documents
 * 
 * Implements HIPAA-compliant access controls for PHI documents.
 * Ensures users can only access documents based on their role
 * and the document's access level settings.
 */

type UserType = "patient" | "clinician" | "business_staff" | "platform_admin"

/**
 * Access levels for documents
 */
export type DocumentAccessLevel =
  | "patient_only"
  | "clinician"
  | "business_staff"
  | "platform_admin"

/**
 * Access control matrix defining which user types can access
 * documents at each access level
 */
const ACCESS_MATRIX: Record<DocumentAccessLevel, UserType[]> = {
  // Patient-only: Only the patient themselves
  patient_only: ["patient"],
  // Clinician: Patients and clinicians
  clinician: ["patient", "clinician"],
  // Business staff: Patients, clinicians, and business staff
  business_staff: ["patient", "clinician", "business_staff"],
  // Platform admin: All access levels
  platform_admin: ["patient", "clinician", "business_staff", "platform_admin"],
}

/**
 * Hierarchy of access levels (for permission inheritance)
 */
const ACCESS_HIERARCHY: DocumentAccessLevel[] = [
  "patient_only",
  "clinician",
  "business_staff",
  "platform_admin",
]

/**
 * Check if a user can access a document
 * 
 * @param document - The document to check access for
 * @param userId - The ID of the user requesting access
 * @param userType - The type/role of the user
 * @param isOwner - Optional: whether the user is the document owner (patient)
 * @returns True if access is allowed
 */
export function canAccessDocument(
  document: any,
  userId: string,
  userType: UserType,
  isOwner: boolean = false
): boolean {
  // Platform admins can access everything
  if (userType === "platform_admin") {
    return true
  }

  // Check if user type has permission for this access level
  const allowedTypes = ACCESS_MATRIX[document.access_level]
  if (!allowedTypes.includes(userType)) {
    return false
  }

  // Patients can only access their own documents
  if (userType === "patient") {
    return document.patient_id === userId
  }

  // Clinicians can access documents for patients they have
  // consultations with (checked at route level)
  if (userType === "clinician") {
    // Allow if clinician has access to the consultation
    return true // Additional checks done at route level
  }

  // Business staff can only access documents for their business
  if (userType === "business_staff") {
    // Additional business membership checks done at route level
    return true
  }

  return false
}

/**
 * Check if a user can download a document
 * Includes additional checks beyond basic access
 */
export function canDownloadDocument(
  document: any,
  userId: string,
  userType: UserType,
  isOwner: boolean = false
): boolean {
  // First check basic access
  if (!canAccessDocument(document, userId, userType, isOwner)) {
    return false
  }

  // Check if document has expired
  if (document.expires_at && new Date(document.expires_at) < new Date()) {
    return false
  }

  return true
}

/**
 * Check if a user can modify a document
 */
export function canModifyDocument(
  document: any,
  userId: string,
  userType: UserType
): boolean {
  // Only platform admins and the original uploader can modify
  if (userType === "platform_admin") {
    return true
  }

  // Uploader can modify their own documents
  if (document.uploaded_by === userId) {
    return true
  }

  // Business staff can modify documents for their business
  if (userType === "business_staff") {
    return true // Additional checks at route level
  }

  return false
}

/**
 * Check if a user can delete a document
 */
export function canDeleteDocument(
  document: any,
  userId: string,
  userType: UserType
): boolean {
  // Platform admins can delete anything
  if (userType === "platform_admin") {
    return true
  }

  // Original uploader can delete
  if (document.uploaded_by === userId) {
    return true
  }

  // Business staff can delete documents for their business
  if (userType === "business_staff") {
    return true // Additional checks at route level
  }

  return false
}

/**
 * Check if a user can change document access level
 */
export function canChangeAccessLevel(
  document: any,
  userId: string,
  userType: UserType,
  newAccessLevel: DocumentAccessLevel
): boolean {
  // Platform admins can change any access level
  if (userType === "platform_admin") {
    return true
  }

  // Cannot increase access level beyond user's own level
  const userMaxLevel = getUserMaxAccessLevel(userType)
  if (
    ACCESS_HIERARCHY.indexOf(newAccessLevel) >
    ACCESS_HIERARCHY.indexOf(userMaxLevel)
  ) {
    return false
  }

  // Uploader and business staff can change access level
  if (document.uploaded_by === userId || userType === "business_staff") {
    return true
  }

  return false
}

/**
 * Get the maximum access level a user type can assign
 */
function getUserMaxAccessLevel(userType: UserType): DocumentAccessLevel {
  switch (userType) {
    case "patient":
      return "patient_only"
    case "clinician":
      return "clinician"
    case "business_staff":
      return "business_staff"
    case "platform_admin":
      return "platform_admin"
    default:
      return "patient_only"
  }
}

/**
 * Get the minimum access level required to perform an action
 */
export function getRequiredAccessLevel(
  action: "read" | "write" | "delete" | "admin"
): DocumentAccessLevel {
  switch (action) {
    case "read":
      return "patient_only"
    case "write":
      return "clinician"
    case "delete":
      return "business_staff"
    case "admin":
      return "platform_admin"
    default:
      return "patient_only"
  }
}

/**
 * Validate access level string
 */
export function isValidAccessLevel(level: string): level is DocumentAccessLevel {
  return ["patient_only", "clinician", "business_staff", "platform_admin"].includes(
    level
  )
}

/**
 * Filter document fields based on access level
 * Removes sensitive fields for lower access levels
 */
export function filterDocumentFields(
  document: Record<string, any>,
  userType: UserType
): Record<string, any> {
  const baseFields: string[] = [
    "id",
    "business_id",
    "patient_id",
    "consultation_id",
    "order_id",
    "type",
    "title",
    "description",
    "file_name",
    "file_size",
    "mime_type",
    "access_level",
    "expires_at",
    "download_count",
    "last_downloaded_at",
    "created_at",
    "updated_at",
  ]

  // Admin fields - include storage details
  const adminFields: string[] = [
    ...baseFields,
    "storage_provider",
    "storage_bucket",
    "storage_key",
    "checksum",
    "encryption_key_id",
    "is_encrypted",
    "uploaded_by",
    "last_downloaded_by",
  ]

  if (userType === "platform_admin") {
    return pickFields(document, adminFields)
  }

  if (userType === "business_staff") {
    return pickFields(document, [...baseFields, "uploaded_by"])
  }

  // Patient and clinician - basic fields only
  return pickFields(document, baseFields)
}

/**
 * Pick specific fields from an object
 */
function pickFields(obj: Record<string, any>, keys: string[]): Record<string, any> {
  const result: Record<string, any> = {}
  for (const key of keys) {
    result[key] = obj[key]
  }
  return result
}

/**
 * Access check result with reason
 */
export interface AccessCheckResult {
  allowed: boolean
  reason?: string
}

/**
 * Detailed access check with reason
 */
export function checkDocumentAccess(
  document: any,
  userId: string,
  userType: UserType,
  action: "read" | "download" | "modify" | "delete" = "read"
): AccessCheckResult {
  // Check document expiry for downloads
  if (action === "download" && document.expires_at) {
    if (new Date(document.expires_at) < new Date()) {
      return { allowed: false, reason: "Document has expired" }
    }
  }

  // Check user type permission for access level
  const allowedTypes = ACCESS_MATRIX[document.access_level]
  if (!allowedTypes.includes(userType)) {
    return {
      allowed: false,
      reason: `User type '${userType}' does not have access to documents with access level '${document.access_level}'`,
    }
  }

  // Patient can only access own documents
  if (userType === "patient" && document.patient_id !== userId) {
    return {
      allowed: false,
      reason: "Patients can only access their own documents",
    }
  }

  // Check specific action permissions
  switch (action) {
    case "modify":
      if (!canModifyDocument(document, userId, userType)) {
        return {
          allowed: false,
          reason: "User does not have permission to modify this document",
        }
      }
      break
    case "delete":
      if (!canDeleteDocument(document, userId, userType)) {
        return {
          allowed: false,
          reason: "User does not have permission to delete this document",
        }
      }
      break
  }

  return { allowed: true }
}
