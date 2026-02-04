/**
 * Local Filesystem Storage Provider
 * 
 * For development use only. Stores files in the local filesystem.
 * In production, use S3 or other cloud storage providers.
 */

import { promises as fs } from "fs"
import path from "path"
import { StorageProvider, StorageConfig } from "./index"

export class LocalStorageProvider implements StorageProvider {
  private uploadDir: string
  private baseUrl: string

  constructor(config: StorageConfig) {
    this.uploadDir = config.localUploadDir || "uploads"
    this.baseUrl = config.localBaseUrl || "http://localhost:9000"
  }

  /**
   * Ensure the upload directory exists
   */
  private async ensureDirectory(key: string): Promise<void> {
    const fullPath = path.join(this.uploadDir, path.dirname(key))
    await fs.mkdir(fullPath, { recursive: true })
  }

  /**
   * Get the full filesystem path for a key
   */
  private getFullPath(key: string): string {
    // Prevent directory traversal attacks
    const sanitizedKey = key.replace(/\.\./g, "").replace(/^\//, "")
    return path.join(this.uploadDir, sanitizedKey)
  }

  /**
   * Upload a file to local storage
   */
  async upload(
    key: string,
    buffer: Buffer,
    metadata: Record<string, any>
  ): Promise<void> {
    await this.ensureDirectory(key)
    const fullPath = this.getFullPath(key)
    
    await fs.writeFile(fullPath, buffer)
    
    // Store metadata in a sidecar file
    const metadataPath = `${fullPath}.meta.json`
    await fs.writeFile(
      metadataPath,
      JSON.stringify(
        {
          ...metadata,
          uploadedAt: new Date().toISOString(),
          key,
        },
        null,
        2
      )
    )
  }

  /**
   * Download a file from local storage
   */
  async download(key: string): Promise<Buffer> {
    const fullPath = this.getFullPath(key)
    
    try {
      return await fs.readFile(fullPath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(`File not found: ${key}`)
      }
      throw error
    }
  }

  /**
   * Generate a local URL for temporary access
   * Note: In local development, this returns a direct file URL
   * The actual file serving should be handled by a static file middleware
   */
  async getSignedUrl(key: string, expiresInSeconds: number): Promise<string> {
    // For local development, we generate a URL that can be served
    // In a real implementation, you might want to implement token-based access
    const sanitizedKey = key.replace(/\\/g, "/")
    return `${this.baseUrl}/uploads/${sanitizedKey}?expires=${Date.now() + expiresInSeconds * 1000}`
  }

  /**
   * Delete a file from local storage
   */
  async delete(key: string): Promise<void> {
    const fullPath = this.getFullPath(key)
    const metadataPath = `${fullPath}.meta.json`
    
    try {
      await fs.unlink(fullPath)
      // Also delete metadata if it exists
      try {
        await fs.unlink(metadataPath)
      } catch {
        // Metadata file might not exist, that's ok
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error
      }
    }
  }

  /**
   * Check if a file exists in local storage
   */
  async exists(key: string): Promise<boolean> {
    const fullPath = this.getFullPath(key)
    
    try {
      await fs.access(fullPath, fs.constants.F_OK)
      return true
    } catch {
      return false
    }
  }

  /**
   * Get file statistics
   */
  async getStats(key: string): Promise<{ size: number; modifiedAt: Date }> {
    const fullPath = this.getFullPath(key)
    const stats = await fs.stat(fullPath)
    
    return {
      size: stats.size,
      modifiedAt: stats.mtime,
    }
  }

  /**
   * List all files in a directory
   */
  async listFiles(prefix?: string): Promise<string[]> {
    const searchPath = prefix
      ? this.getFullPath(prefix)
      : this.uploadDir
    
    try {
      const entries = await fs.readdir(searchPath, { recursive: true })
      return entries.filter((entry) => !entry.endsWith(".meta.json"))
    } catch {
      return []
    }
  }
}
