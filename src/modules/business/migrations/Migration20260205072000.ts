import { Migration } from "@mikro-orm/migrations"

/**
 * Add DNS verification bookkeeping fields for BusinessDomain.
 */
export class Migration20260205072000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      ALTER TABLE "business_domain"
      ADD COLUMN IF NOT EXISTS "last_checked_at" TIMESTAMPTZ NULL,
      ADD COLUMN IF NOT EXISTS "dns_error" TEXT NULL
    `)
  }

  async down(): Promise<void> {
    this.addSql(`
      ALTER TABLE "business_domain"
      DROP COLUMN IF EXISTS "dns_error",
      DROP COLUMN IF EXISTS "last_checked_at"
    `)
  }
}

