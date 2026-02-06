import { Migration } from "@mikro-orm/migrations"

/**
 * Backfill schema contracts for legacy databases that created audit_log/document
 * tables before `updated_at` / `deleted_at` were part of the table definition.
 *
 * Medusa's model.define() automatically adds deleted_at for soft-delete support.
 * Without this column every MikroORM query on these tables fails with:
 *   "column a0.deleted_at does not exist"
 */
export class Migration20260206210000 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      `ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`
    )
    this.addSql(
      `ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ DEFAULT NULL`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_audit_log_deleted_at" ON "audit_log" ("deleted_at") WHERE "deleted_at" IS NULL`
    )

    this.addSql(
      `ALTER TABLE "document" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`
    )
    this.addSql(
      `ALTER TABLE "document" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ DEFAULT NULL`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_document_deleted_at" ON "document" ("deleted_at") WHERE "deleted_at" IS NULL`
    )
  }

  async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "IDX_audit_log_deleted_at"`)
    this.addSql(`ALTER TABLE "audit_log" DROP COLUMN IF EXISTS "deleted_at"`)
    this.addSql(`ALTER TABLE "audit_log" DROP COLUMN IF EXISTS "updated_at"`)

    this.addSql(`DROP INDEX IF EXISTS "IDX_document_deleted_at"`)
    this.addSql(`ALTER TABLE "document" DROP COLUMN IF EXISTS "deleted_at"`)
    this.addSql(`ALTER TABLE "document" DROP COLUMN IF EXISTS "updated_at"`)
  }
}
