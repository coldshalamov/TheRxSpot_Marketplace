import { Migration } from "@mikro-orm/migrations"

/**
 * Reliability hardening:
 * - Ensure a single Patient per (business_id, customer_id) to prevent duplicates under concurrency.
 * - Ensure a single Consultation per consult_submission to support idempotent reconciliation.
 */
export class Migration20260205073010 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_patient_business_customer_unique"
      ON "patient" ("business_id", "customer_id")
      WHERE "customer_id" IS NOT NULL AND "deleted_at" IS NULL
    `)

    this.addSql(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_consultation_originating_submission_unique"
      ON "consultation" ("originating_submission_id")
      WHERE "originating_submission_id" IS NOT NULL AND "deleted_at" IS NULL
    `)
  }

  async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "IDX_consultation_originating_submission_unique"`)
    this.addSql(`DROP INDEX IF EXISTS "IDX_patient_business_customer_unique"`)
  }
}

