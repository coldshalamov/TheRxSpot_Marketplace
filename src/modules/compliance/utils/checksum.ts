/**
 * Checksum Utility for Document Integrity
 * 
 * Provides SHA-256 checksums for file integrity verification.
 * Used for:
 * - Verifying files haven't been tampered with
 * - Detecting corruption during transfer
 * - Compliance with HIPAA integrity requirements
 */

import { createHash } from "crypto"

/**
 * Generate SHA-256 checksum for a file buffer
 * @param buffer - File data as buffer
 * @returns Hex-encoded SHA-256 hash
 */
export function generateChecksum(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex")
}

/**
 * Verify file integrity by comparing checksums
 * @param buffer - File data as buffer
 * @param expectedChecksum - Expected SHA-256 hash
 * @returns True if checksums match
 */
export function verifyChecksum(buffer: Buffer, expectedChecksum: string): boolean {
  const actualChecksum = generateChecksum(buffer)
  return timingSafeEqual(actualChecksum, expectedChecksum)
}

/**
 * Generate checksum for a string
 * @param data - String data
 * @returns Hex-encoded SHA-256 hash
 */
export function generateChecksumForString(data: string): string {
  return createHash("sha256").update(data, "utf-8").digest("hex")
}

/**
 * Generate checksum for a file stream
 * Useful for large files that shouldn't be fully loaded into memory
 * @param stream - Readable stream
 * @returns Promise resolving to hex-encoded SHA-256 hash
 */
export async function generateChecksumForStream(
  stream: NodeJS.ReadableStream
): Promise<string> {
  const hash = createHash("sha256")
  
  return new Promise((resolve, reject) => {
    stream.on("data", (chunk: Buffer) => {
      hash.update(chunk)
    })
    
    stream.on("end", () => {
      resolve(hash.digest("hex"))
    })
    
    stream.on("error", (error) => {
      reject(error)
    })
  })
}

/**
 * Timing-safe string comparison to prevent timing attacks
 * @param a - First string
 * @param b - Second string
 * @returns True if strings are equal
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }
  
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  
  return result === 0
}

/**
 * Calculate checksum and return with file info
 * @param buffer - File data
 * @param originalName - Original filename
 */
export function calculateFileIntegrity(
  buffer: Buffer,
  originalName: string
): {
  checksum: string
  size: number
  mimeType: string
} {
  return {
    checksum: generateChecksum(buffer),
    size: buffer.length,
    mimeType: inferMimeType(originalName),
  }
}

/**
 * Infer MIME type from filename
 */
function inferMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase()
  
  const mimeTypes: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    tiff: "image/tiff",
    tif: "image/tiff",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    txt: "text/plain",
  }
  
  return mimeTypes[ext || ""] || "application/octet-stream"
}

/**
 * Checksum verification result
 */
export interface ChecksumVerificationResult {
  isValid: boolean
  expectedChecksum: string
  actualChecksum: string
  timestamp: Date
}

/**
 * Verify checksum and return detailed result
 */
export function verifyChecksumDetailed(
  buffer: Buffer,
  expectedChecksum: string
): ChecksumVerificationResult {
  const actualChecksum = generateChecksum(buffer)
  
  return {
    isValid: timingSafeEqual(actualChecksum, expectedChecksum),
    expectedChecksum,
    actualChecksum,
    timestamp: new Date(),
  }
}
