import {
  readFile,
  writeFile,
  mkdir,
  readdir,
  unlink,
  access,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import type { Document, Spec, StoreInterface } from "../types/index.js";

export class FileStore implements StoreInterface {
  private dataDir: string;
  private documentsDir: string;
  private specsDir: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.documentsDir = join(dataDir, "documents");
    this.specsDir = join(dataDir, "specs");
  }

  async init(): Promise<void> {
    await mkdir(this.documentsDir, { recursive: true });
    await mkdir(this.specsDir, { recursive: true });
  }

  /**
   * Encode a document path for safe filesystem storage.
   * Replaces / with __ and handles other special characters.
   */
  private encodePath(path: string): string {
    return path.replace(/\//g, "__");
  }

  /**
   * Decode a filesystem filename back to a document path.
   */
  private decodePath(encoded: string): string {
    return encoded.replace(/__/g, "/");
  }

  /**
   * Compute SHA-256 checksum of content.
   */
  private computeChecksum(content: string): string {
    return createHash("sha256").update(content).digest("hex");
  }

  /**
   * Get the full file path for a document.
   */
  private getDocumentFilePath(path: string): string {
    const encoded = this.encodePath(path);
    return join(this.documentsDir, encoded);
  }

  /**
   * Get the full file path for a spec.
   */
  private getSpecFilePath(id: string): string {
    return join(this.specsDir, `${id}.json`);
  }

  /**
   * Check if a file exists.
   */
  private async fileExists(path: string): Promise<boolean> {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }

  // ==================== Document Operations ====================

  async saveDocument(doc: Document): Promise<void> {
    const filePath = this.getDocumentFilePath(doc.path);

    // Ensure parent directory exists
    await mkdir(dirname(filePath), { recursive: true });

    // Update timestamps and checksum
    const now = new Date().toISOString();
    const existing = await this.getDocument(doc.path);

    const documentToSave: Document = {
      ...doc,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      checksum: this.computeChecksum(doc.content),
    };

    await writeFile(filePath, JSON.stringify(documentToSave, null, 2), "utf-8");
  }

  async getDocument(path: string): Promise<Document | null> {
    const filePath = this.getDocumentFilePath(path);

    try {
      const content = await readFile(filePath, "utf-8");
      return JSON.parse(content) as Document;
    } catch {
      return null;
    }
  }

  async deleteDocument(path: string): Promise<boolean> {
    const filePath = this.getDocumentFilePath(path);

    try {
      await unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async listDocuments(prefix?: string): Promise<Document[]> {
    try {
      const files = await readdir(this.documentsDir, { recursive: true });
      const documents: Document[] = [];

      for (const file of files) {
        // Skip directories
        if (!file.includes(".")) continue;

        const decodedPath = this.decodePath(file);

        // Filter by prefix if provided
        if (prefix && !decodedPath.startsWith(prefix)) {
          continue;
        }

        const doc = await this.getDocument(decodedPath);
        if (doc) {
          documents.push(doc);
        }
      }

      return documents;
    } catch {
      return [];
    }
  }

  async searchDocuments(query: string): Promise<Document[]> {
    const allDocs = await this.listDocuments();
    const lowerQuery = query.toLowerCase();

    return allDocs.filter(
      (doc) =>
        doc.content.toLowerCase().includes(lowerQuery) ||
        doc.path.toLowerCase().includes(lowerQuery)
    );
  }

  // ==================== Spec Operations ====================

  async saveSpec(spec: Spec): Promise<void> {
    const filePath = this.getSpecFilePath(spec.id);

    // Ensure specs directory exists
    await mkdir(this.specsDir, { recursive: true });

    const now = new Date().toISOString();
    const existing = await this.getSpec(spec.id);

    let specToSave: Spec;

    if (existing) {
      // Update existing spec - add to history
      const newVersion = existing.version + 1;
      const historyEntry = {
        version: existing.version,
        updatedAt: existing.updatedAt,
      };

      specToSave = {
        ...spec,
        createdAt: existing.createdAt,
        updatedAt: now,
        version: newVersion,
        history: [...existing.history, historyEntry],
      };
    } else {
      // New spec
      specToSave = {
        ...spec,
        createdAt: now,
        updatedAt: now,
        version: 1,
        history: [],
      };
    }

    await writeFile(filePath, JSON.stringify(specToSave, null, 2), "utf-8");
  }

  async getSpec(id: string): Promise<Spec | null> {
    const filePath = this.getSpecFilePath(id);

    try {
      const content = await readFile(filePath, "utf-8");
      return JSON.parse(content) as Spec;
    } catch {
      return null;
    }
  }

  async deleteSpec(id: string): Promise<boolean> {
    const filePath = this.getSpecFilePath(id);

    try {
      await unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async listSpecs(filter?: {
    status?: string;
    tag?: string;
    parent?: string;
  }): Promise<Spec[]> {
    try {
      const files = await readdir(this.specsDir);
      const specs: Spec[] = [];

      for (const file of files) {
        if (!file.endsWith(".json")) continue;

        const id = file.slice(0, -5); // Remove .json extension
        const spec = await this.getSpec(id);

        if (!spec) continue;

        // Apply filters
        if (filter?.status && spec.status !== filter.status) {
          continue;
        }

        if (filter?.tag && !spec.tags.includes(filter.tag)) {
          continue;
        }

        if (filter?.parent !== undefined) {
          if (filter.parent === null) {
            // Looking for specs without parent
            if (spec.parent !== undefined) continue;
          } else {
            if (spec.parent !== filter.parent) continue;
          }
        }

        specs.push(spec);
      }

      return specs;
    } catch {
      return [];
    }
  }
}
