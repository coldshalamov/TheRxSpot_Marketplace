/**
 * AWS S3 Storage Provider
 * 
 * Production-ready storage provider using AWS S3.
 * Supports:
 * - Server-side encryption
 * - Presigned URLs for secure downloads
 * - Object metadata
 * - Multi-region support
 * - Custom endpoints (for MinIO compatibility)
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ServerSideEncryption,
} from "@aws-sdk/client-s3"
import { getSignedUrl as getS3SignedUrl } from "@aws-sdk/s3-request-presigner"
import { StorageProvider, StorageConfig } from "./index"

export class S3StorageProvider implements StorageProvider {
  private client: S3Client
  private bucket: string
  private encryptionKeyId?: string

  constructor(config: StorageConfig) {
    this.bucket = config.bucket || "therxspot-documents"
    this.encryptionKeyId = config.encryptionKeyId

    const clientConfig: any = {
      region: config.region || "us-east-1",
      credentials:
        config.accessKey && config.secretKey
          ? {
              accessKeyId: config.accessKey,
              secretAccessKey: config.secretKey,
            }
          : undefined,
    }

    // Support custom endpoints (e.g., MinIO, LocalStack)
    if (config.endpoint) {
      clientConfig.endpoint = config.endpoint
      clientConfig.forcePathStyle = true // Required for MinIO
    }

    this.client = new S3Client(clientConfig)
  }

  /**
   * Upload a file to S3
   * Supports server-side encryption if encryptionKeyId is configured
   */
  async upload(
    key: string,
    buffer: Buffer,
    metadata: Record<string, any>
  ): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: metadata.contentType || "application/octet-stream",
      ContentLength: buffer.length,
      Metadata: this.sanitizeMetadata(metadata),
      // Server-side encryption
      ...(this.encryptionKeyId
        ? {
            ServerSideEncryption: "aws:kms" as ServerSideEncryption,
            SSEKMSKeyId: this.encryptionKeyId,
          }
        : {
            ServerSideEncryption: "AES256" as ServerSideEncryption,
          }),
    })

    await this.client.send(command)
  }

  /**
   * Download a file from S3
   */
  async download(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    })

    const response = await this.client.send(command)
    
    if (!response.Body) {
      throw new Error(`File not found: ${key}`)
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = []
    const stream = response.Body as any
    
    for await (const chunk of stream) {
      chunks.push(chunk)
    }
    
    return Buffer.concat(chunks)
  }

  /**
   * Generate a presigned URL for temporary access
   * URL expires after the specified duration
   */
  async getSignedUrl(key: string, expiresInSeconds: number): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    })

    return await getS3SignedUrl(this.client, command, {
      expiresIn: expiresInSeconds,
    })
  }

  /**
   * Delete a file from S3
   */
  async delete(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    })

    await this.client.send(command)
  }

  /**
   * Check if a file exists in S3
   */
  async exists(key: string): Promise<boolean> {
    const command = new HeadObjectCommand({
      Bucket: this.bucket,
      Key: key,
    })

    try {
      await this.client.send(command)
      return true
    } catch (error: any) {
      if (error.name === "NotFound" || error.name === "NoSuchKey") {
        return false
      }
      throw error
    }
  }

  /**
   * Sanitize metadata for S3
   * S3 metadata keys must be alphanumeric plus hyphens
   * Values must be ASCII and under 2KB
   */
  private sanitizeMetadata(
    metadata: Record<string, any>
  ): Record<string, string> {
    const sanitized: Record<string, string> = {}

    for (const [key, value] of Object.entries(metadata)) {
      // Skip non-string values or convert to string
      if (value === null || value === undefined) continue

      // Sanitize key: only alphanumeric and hyphens
      const sanitizedKey = key
        .replace(/[^a-zA-Z0-9-]/g, "-")
        .toLowerCase()
        .substring(0, 50)

      // Convert value to string and truncate if needed
      let stringValue = String(value)
      if (stringValue.length > 2000) {
        stringValue = stringValue.substring(0, 2000)
      }

      sanitized[sanitizedKey] = stringValue
    }

    return sanitized
  }

  /**
   * Get object metadata from S3
   */
  async getObjectMetadata(
    key: string
  ): Promise<Record<string, string> | null> {
    const command = new HeadObjectCommand({
      Bucket: this.bucket,
      Key: key,
    })

    try {
      const response = await this.client.send(command)
      return response.Metadata || null
    } catch (error: any) {
      if (error.name === "NotFound" || error.name === "NoSuchKey") {
        return null
      }
      throw error
    }
  }

  /**
   * Copy an object within S3
   */
  async copyObject(sourceKey: string, destinationKey: string): Promise<void> {
    const { CopyObjectCommand } = await import("@aws-sdk/client-s3")
    
    const command = new CopyObjectCommand({
      Bucket: this.bucket,
      CopySource: `${this.bucket}/${sourceKey}`,
      Key: destinationKey,
    })

    await this.client.send(command)
  }

  /**
   * Generate a presigned URL for uploading (for direct browser uploads)
   */
  async getPresignedUploadUrl(
    key: string,
    contentType: string,
    expiresInSeconds: number
  ): Promise<string> {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3")
    
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    })

    return await getS3SignedUrl(this.client, command, {
      expiresIn: expiresInSeconds,
    })
  }
}
