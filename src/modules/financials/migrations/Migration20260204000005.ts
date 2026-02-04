import { Migration } from "@mikro-orm/migrations"

/**
 * Add Medusa standard soft-delete columns for Financials tables.
 *
 * The Medusa DAL expects `deleted_at` for models and will implicitly filter
 * on it. Without it, queries fail with errors like:
 *   column e0.deleted_at does not exist
 */
export class Migration20260204000005 extends Migration {
  async up(): Promise<void> {
    this.addSql(`ALTER TABLE "earning_entry" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ NULL`)
    this.addSql(`ALTER TABLE "payout" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ NULL`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_earning_entry_deleted_at" ON "earning_entry" ("deleted_at")`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_payout_deleted_at" ON "payout" ("deleted_at")`)
  }

  async down(): Promise<void> {
    // Keep columns to avoid data loss
  }
}

