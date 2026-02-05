import { Migration } from "@mikro-orm/migrations"

/**
 * Data hardening:
 * - Add `deleted_at` indexes to speed default filtering of soft-deleted records
 */
export class Migration20260204000012 extends Migration {
  async up(): Promise<void> {
    // this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_document_deleted_at" ON "document" ("deleted_at")`)
    // this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_audit_log_deleted_at" ON "audit_log" ("deleted_at")`)
  }

  async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "IDX_document_deleted_at"`)
    this.addSql(`DROP INDEX IF EXISTS "IDX_audit_log_deleted_at"`)
  }
}

