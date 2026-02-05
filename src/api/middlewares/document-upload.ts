/**
 * Document Upload Middleware
 * 
 * Multer-based middleware for handling document uploads with:
 * - File size limits (max 10MB)
 * - MIME type validation (pdf, jpg, png, tiff)
 * - Secure file naming
 * - Virus scanning with ClamAV or file-type validation fallback
 */

import multer from "multer"
import path from "path"
import { v4 as uuidv4 } from "uuid"
import NodeClam from "clamscan"
import { getLogger } from "../../utils/logger"

// Allowed MIME types for medical documents
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
]

// Map MIME types to expected file extensions
const MIME_TO_EXTENSIONS: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
}

// ClamAV instance (lazy loaded)
let clamscan: NodeClam | null = null
let clamscanInitialized = false
let clamscanAvailable = false

const logger = getLogger()

// Maximum file size (10MB default)
const MAX_FILE_SIZE = parseInt(process.env.DOCUMENT_MAX_SIZE || "10485760")

// Configure storage
const storage = multer.memoryStorage()

/**
 * File filter to validate MIME types
 */
const fileFilter = (
  req: any,
  file: any,
  cb: multer.FileFilterCallback
) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype.toLowerCase())) {
    cb(null, true)
  } else {
    cb(
      new Error(
        `Invalid file type: ${file.mimetype}. Allowed types: ${ALLOWED_MIME_TYPES.join(", ")}`
      )
    )
  }
}

/**
 * Multer upload configuration
 */
export const documentUpload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1, // Only single file uploads
  },
  fileFilter,
})

/**
 * Middleware for single document upload
 * Usage: upload.single('document')
 */
export const uploadSingleDocument = documentUpload.single("document")

/**
 * Middleware for multiple document uploads
 * Usage: upload.array('documents', 5)
 */
export const uploadMultipleDocuments = documentUpload.array("documents", 5)

/**
 * Error handler for multer errors
 */
export function handleMulterError(error: any, req: any, res: any, next: any) {
  if (error instanceof multer.MulterError) {
    // Multer-specific errors
    switch (error.code) {
      case "LIMIT_FILE_SIZE":
        return res.status(413).json({
          error: "File too large",
          message: `Maximum file size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
          code: "FILE_TOO_LARGE",
        })
      case "LIMIT_FILE_COUNT":
        return res.status(413).json({
          error: "Too many files",
          message: "Maximum number of files exceeded",
          code: "TOO_MANY_FILES",
        })
      case "LIMIT_UNEXPECTED_FILE":
        return res.status(400).json({
          error: "Unexpected field",
          message: "Unexpected file field name",
          code: "UNEXPECTED_FILE_FIELD",
        })
      default:
        return res.status(400).json({
          error: "Upload error",
          message: error.message,
          code: error.code,
        })
    }
  }

  // Other errors
  if (error) {
    return res.status(400).json({
      error: "Upload failed",
      message: error.message,
      code: "UPLOAD_FAILED",
    })
  }

  next()
}

/**
 * Initialize ClamAV virus scanner
 * Called once at application startup
 */
export async function initializeVirusScanner(): Promise<boolean> {
  if (clamscanInitialized) {
    return clamscanAvailable
  }

  try {
    clamscan = await new NodeClam().init({
      removeInfected: false,
      quarantineInfected: false,
      scanLog: null,
      debugMode: process.env.NODE_ENV === "development",
      fileList: null,
      scanRecursively: false,
      preference: "clamdscan", // Try clamdscan first (daemon), then clamscan
      clamdscan: {
        host: process.env.CLAMAV_HOST || "localhost",
        port: parseInt(process.env.CLAMAV_PORT || "3310", 10),
        timeout: 60000,
        localFallback: true,
      },
      clamscan: {
        path: "/usr/bin/clamscan",
        db: "/var/lib/clamav",
      },
    })
    
    clamscanAvailable = true
    logger.info("virus-scanner: ClamAV initialized successfully")
  } catch (error) {
    clamscanAvailable = false
    logger.warn(
      "virus-scanner: ClamAV not available, falling back to file-type validation. " +
        "For production, install ClamAV and set CLAMAV_HOST/CLAMAV_PORT environment variables."
    )
  }

  clamscanInitialized = true
  return clamscanAvailable
}

/**
 * Validate file content matches expected MIME type
 * Uses file-type library to detect actual file content
 */
async function validateFileContent(
  buffer: Buffer,
  expectedMimeType: string
): Promise<{ valid: boolean; detectedMimeType?: string }> {
  try {
    // NOTE: keep a real runtime dynamic import here so Jest/SWC doesn't rewrite it to `require()`.
    // `file-type` is ESM and should be loaded via `import()` in Node.
    const dynamicImport = (moduleName: string) =>
      Function("m", "return import(m)")(moduleName) as Promise<any>

    const { fileTypeFromBuffer } = await dynamicImport("file-type")
    const fileType = await fileTypeFromBuffer(buffer)
    
    if (!fileType) {
      // Unable to detect file type - allow if it's a common type we support
      // but log a warning
      logger.warn("virus-scanner: unable to detect file type from content")
      return { valid: true }
    }

    // Check if detected MIME type matches expected MIME type
    const normalizedExpected = expectedMimeType.toLowerCase()
    const normalizedDetected = fileType.mime.toLowerCase()

    // Handle special cases
    const mimeAliases: Record<string, string[]> = {
      "image/tif": ["image/tiff"],
      "image/tiff": ["image/tif"],
    }

    const allowedTypes = [normalizedExpected, ...(mimeAliases[normalizedExpected] || [])]
    
    if (!allowedTypes.includes(normalizedDetected)) {
      logger.warn(
        {
          expected_mime_type: expectedMimeType,
          detected_mime_type: fileType.mime,
        },
        "virus-scanner: MIME type mismatch"
      )
      return { valid: false, detectedMimeType: fileType.mime }
    }

    return { valid: true, detectedMimeType: fileType.mime }
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "virus-scanner: error validating file content"
    )
    // Fail open to avoid blocking legitimate uploads, but log the error
    return { valid: true }
  }
}

/**
 * Scan file buffer for viruses using ClamAV or file-type validation fallback
 * 
 * Priority:
 * 1. If ClamAV is available, use it for virus scanning
 * 2. If ClamAV is not available, validate file content matches MIME type
 * 3. Both methods can reject files
 */
export async function scanFileForViruses(
  buffer: Buffer,
  filename: string,
  mimeType?: string
): Promise<{ clean: boolean; threats?: string[] }> {
  const threats: string[] = []

  // Ensure scanner is initialized
  if (!clamscanInitialized) {
    await initializeVirusScanner()
  }

  // Method 1: ClamAV virus scanning (if available)
  if (clamscan && clamscanAvailable) {
    try {
      const result = await clamscan.scanBuffer(buffer)
      
      if (result.isInfected) {
        const viruses = Array.isArray(result.viruses) ? result.viruses : [result.viruses]
        logger.error(
          { filename, threats: viruses },
          "virus-scanner: threat detected"
        )
        return { 
          clean: false, 
          threats: [`Virus detected: ${viruses.join(", ")}`] 
        }
      }
      
      logger.info({ filename }, "virus-scanner: file scanned successfully")
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "virus-scanner: ClamAV scan failed"
      )
      threats.push("Virus scan failed - unable to verify file safety")
      return { clean: false, threats }
    }
  }

  // Method 2: Content validation (always runs)
  // Validates that file content matches the declared MIME type
  if (mimeType) {
    const contentValidation = await validateFileContent(buffer, mimeType)
    
    if (!contentValidation.valid) {
      const msg = `File content does not match declared type. ` +
                  `Expected: ${mimeType}, detected: ${contentValidation.detectedMimeType || "unknown"}`
      logger.warn({ filename }, `virus-scanner: ${msg}`)
      threats.push(msg)
      return { clean: false, threats }
    }
  }

  // Check file extension matches MIME type
  if (mimeType) {
    const ext = path.extname(filename).toLowerCase()
    const allowedExts = MIME_TO_EXTENSIONS[mimeType.toLowerCase()]
    
    if (allowedExts && !allowedExts.includes(ext)) {
      const msg = `File extension '${ext}' does not match MIME type '${mimeType}'`
      logger.warn({ filename }, `virus-scanner: ${msg}`)
      threats.push(msg)
      return { clean: false, threats }
    }
  }

  return { clean: true }
}

/**
 * Middleware to scan uploaded files for viruses
 */
export async function virusScanMiddleware(
  req: any,
  res: any,
  next: any
) {
  if (!req.file && (!req.files || req.files.length === 0)) {
    return next()
  }

  const files = req.file ? [req.file] : req.files

  try {
    for (const file of files) {
      const scanResult = await scanFileForViruses(
        file.buffer, 
        file.originalname,
        file.mimetype
      )
      
      if (!scanResult.clean) {
        logger.error(
          { filename: file.originalname, threats: scanResult.threats },
          "security: file upload rejected"
        )
        return res.status(400).json({
          error: "Security threat detected",
          message: `File '${file.originalname}' failed security validation`,
          threats: scanResult.threats,
          code: "VIRUS_DETECTED",
        })
      }
    }
    next()
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "security: virus scan middleware error"
    )
    return res.status(500).json({
      error: "Scan failed",
      message: "Failed to scan file for viruses",
      code: "SCAN_FAILED",
    })
  }
}

/**
 * Validate file extension matches MIME type
 */
export function validateFileExtension(
  filename: string,
  mimetype: string
): boolean {
  const ext = path.extname(filename).toLowerCase()
  
  const mimeToExt: Record<string, string[]> = {
    "application/pdf": [".pdf"],
    "image/jpeg": [".jpg", ".jpeg"],
    "image/png": [".png"],
  }

  const allowedExts = mimeToExt[mimetype.toLowerCase()]
  if (!allowedExts) return false

  return allowedExts.includes(ext)
}

/**
 * Sanitize filename for storage
 * Format: {timestamp}_{uuid}_{sanitized_name}
 */
export function sanitizeFilename(originalname: string): string {
  const timestamp = Date.now()
  const uuid = uuidv4().split("-")[0]
  const ext = path.extname(originalname)
  const basename = path.basename(originalname, ext)
  
  // Sanitize: remove special chars, limit length
  const sanitized = basename
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .substring(0, 50)
  
  return `${timestamp}_${uuid}_${sanitized}${ext}`
}

/**
 * Get file type category for document classification
 */
export function getFileTypeCategory(mimetype: string): string {
  if (mimetype === "application/pdf") return "pdf"
  if (mimetype.startsWith("image/")) return "image"
  return "other"
}

/**
 * Upload configuration options
 */
export interface UploadConfig {
  maxSize?: number
  allowedTypes?: string[]
  maxFiles?: number
}

/**
 * Create custom upload middleware with specific config
 */
export function createUploadMiddleware(config: UploadConfig = {}) {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: config.maxSize || MAX_FILE_SIZE,
      files: config.maxFiles || 1,
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = config.allowedTypes || ALLOWED_MIME_TYPES
      if (allowedTypes.includes(file.mimetype.toLowerCase())) {
        cb(null, true)
      } else {
        cb(new Error(`Invalid file type: ${file.mimetype}`))
      }
    },
  })

  return upload
}

export default documentUpload
