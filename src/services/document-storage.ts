/**
 * Document Storage Abstraction (thin wrapper)
 *
 * The compliance module already provides a storage provider interface and
 * implementations (local filesystem for dev, S3 for prod). This file exposes
 * a small, stable surface area under `src/services/**` so API routes and other
 * services can depend on a single import path, and we can swap implementations
 * later without touching call sites.
 */

export type {
  StorageProvider as DocumentStorageProvider,
  StorageConfig as DocumentStorageConfig,
  StorageProviderType as DocumentStorageProviderType,
} from "../modules/compliance/services/storage"

export {
  createStorageProvider as createDocumentStorageProvider,
  getStorageConfig as getDocumentStorageConfig,
  generateStorageKey as generateDocumentStorageKey,
  validateFileSize as validateDocumentFileSize,
  validateFileType as validateDocumentFileType,
  getExtensionFromMimeType as getDocumentExtensionFromMimeType,
} from "../modules/compliance/services/storage"

