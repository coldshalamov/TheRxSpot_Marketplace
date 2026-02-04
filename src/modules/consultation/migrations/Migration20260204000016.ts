import { Migration } from "@mikro-orm/migrations"

/**
 * Add internal admin notes support for consultations (PLAN - Consultations detail view).
 */
export class Migration20260204000016 extends Migration {
  async up(): Promise<void> {
    this.addSql(`ALTER TABLE "consultation" ADD COLUMN IF NOT EXISTS "admin_notes" TEXT NULL`)
  }

  async down(): Promise<void> {
    // Keep column for safety; no-op rollback.
  }
}

