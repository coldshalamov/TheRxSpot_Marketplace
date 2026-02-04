/**
 * Storage Provider Interface and Factory
 * 
 * Provides an abstraction layer for document storage supporting:
 * - Local filesystem (development)
 * - AWS S3 (production)
 * - Google Cloud Storage (future)
 * - Azure Blob Storage (future)
 */

import { S3StorageProvider } from "./s3-storage"
import { LocalStorageProvider } from "./local-storage"

/**
 * Storage provider interface
 * All storage implementations must conform to this interface
 */
export interface StorageProvider {
  /**
   * Upload a file to storage
   * @param key - Unique storage key/path
   * @param buffer - File data as buffer
   * @param metadata - Additional metadata to store with the file
   */
  upload(key: string, buffer: Buffer, metadata: Record<string, any>): Promise<void>

  /**
   * Download a file from storage
   * @param key - Unique storage key/path
   * @returns File data as buffer
   */
  download(key: string): Promise<Buffer>

  /**
   * Generate a presigned URL for temporary access
   * @param key - Unique storage key/path
   * @param expiresInSeconds - URL expiration time in seconds
   * @returns Presigned URL string
   */
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>

  /**
   * Delete a file from storage
   * @param key - Unique storage key/path
   */
  delete(key: string): Promise<void>

  /**
   * Check if a file exists in storage
   * @param key - Unique storage key/path
   * @returns True if file exists
   */
  exists(key: string): Promise<boolean>
}

/**
 * Storage provider types supported
 */
export type StorageProviderType = "s3" | "gcs" | "azure" | "local"

/**
 * Configuration options for storage providers
 */
export interface StorageConfig {
  provider: StorageProviderType
  bucket?: string
  region?: string
  endpoint?: string
  accessKey?: string
  secretKey?: string
  encryptionKeyId?: string
  localUploadDir?: string
  localBaseUrl?: string
}

/**
 * Get storage configuration from environment variables
 */
export function getStorageConfig(): StorageConfig {
  return {
    provider: (process.env.DOCUMENT_STORAGE_PROVIDER as StorageProviderType) || "local",
    bucket: process.env.DOCUMENT_STORAGE_BUCKET || "therxspot-documents",
    region: process.env.DOCUMENT_STORAGE_REGION || "us-east-1",
    endpoint: process.env.DOCUMENT_STORAGE_ENDPOINT,
    accessKey: process.env.DOCUMENT_STORAGE_ACCESS_KEY,
    secretKey: process.env.DOCUMENT_STORAGE_SECRET_KEY,
    encryptionKeyId: process.env.DOCUMENT_ENCRYPTION_KEY_ID,
    localUploadDir: process.env.LOCAL_UPLOAD_DIR || "uploads",
    localBaseUrl: process.env.LOCAL_BASE_URL || "http://localhost:9000",
  }
}

/**
 * Factory function to create the appropriate storage provider
 * based on environment configuration
 */
export function createStorageProvider(config?: StorageConfig): StorageProvider {
  const storageConfig = config || getStorageConfig()

  switch (storageConfig.provider) {
    case "s3":
      return new S3StorageProvider(storageConfig)
    
    case "local":
    default:
      return new LocalStorageProvider(storageConfig)
  }
}

/**
 * Generate a storage key for a document
 * Format: {business_id}/{patient_id}/{timestamp}_{filename}
 */
export function generateStorageKey(
  businessId: string,
  patientId: string,
  originalFilename: string
): string {
  const timestamp = Date.now()
  const sanitizedFilename = originalFilename
    .replace(/[^a-zA-Z0-9.-]/g, "_")
    .replace(/_{2,}/g, "_")
  
  return `${businessId}/${patientId}/${timestamp}_${sanitizedFilename}`
}

/**
 * Validate file type against allowed MIME types
 */
export function validateFileType(
  mimeType: string,
  allowedTypes?: string[]
): boolean {
  const types = allowedTypes || [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/tiff",
    "image/tif",
  ]
  
  return types.includes(mimeType.toLowerCase())
}

/**
 * Validate file size against maximum allowed
 */
export function validateFileSize(
  fileSize: number,
  maxSize?: number
): boolean {
  const max = maxSize || parseInt(process.env.DOCUMENT_MAX_SIZE || "10485760")
  return fileSize <= max
}

/**
 * Get file extension from MIME type
 */
export function getExtensionFromMimeType(mimeType: string): string {
  const mapping: Record<string, string> = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/tiff": ".tiff",
    "image/tif": ".tif",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  }
  
  return mapping[mimeType.toLowerCase()] || ""
}
