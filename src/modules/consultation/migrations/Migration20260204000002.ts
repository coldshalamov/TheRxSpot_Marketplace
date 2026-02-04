import { Migration } from "@mikro-orm/migrations"

/**
 * Baseline tables for the Consultation module.
 *
 * Without these tables, clean databases created by Medusa's integration test runner
 * (and other clean environments) will fail when custom services attempt to write to
 * `consultation`, `patient`, `clinician`, and `consultation_status_event`.
 */
export class Migration20260204000002 extends Migration {
  async up(): Promise<void> {
    // `clinician`
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "clinician" (
        "id" TEXT PRIMARY KEY,
        "business_id" TEXT NULL,
        "user_id" TEXT NULL,
        "first_name" TEXT NOT NULL,
        "last_name" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "phone" TEXT NULL,
        "npi_number" TEXT NULL,
        "license_number" TEXT NOT NULL,
        "license_state" TEXT NOT NULL,
        "license_expiry" TIMESTAMPTZ NOT NULL,
        "credentials" TEXT[] NOT NULL DEFAULT '{}'::text[],
        "specializations" TEXT[] NOT NULL DEFAULT '{}'::text[],
        "status" TEXT NOT NULL,
        "is_platform_clinician" BOOLEAN NOT NULL DEFAULT FALSE,
        "timezone" TEXT NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" TIMESTAMPTZ NULL
      )
    `)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_clinician_business_id" ON "clinician" ("business_id")`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_clinician_email" ON "clinician" ("email")`)

    // `patient`
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "patient" (
        "id" TEXT PRIMARY KEY,
        "business_id" TEXT NOT NULL,
        "customer_id" TEXT NULL,
        "first_name" TEXT NOT NULL,
        "last_name" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "phone" TEXT NULL,
        "date_of_birth" TEXT NULL,
        "gender" TEXT NULL,
        "medical_history" TEXT NULL,
        "allergies" TEXT NULL,
        "medications" TEXT NULL,
        "emergency_contact_name" TEXT NULL,
        "emergency_contact_phone" TEXT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" TIMESTAMPTZ NULL
      )
    `)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_patient_business_id" ON "patient" ("business_id")`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_patient_customer_id" ON "patient" ("customer_id")`)

    // `consultation`
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "consultation" (
        "id" TEXT PRIMARY KEY,
        "business_id" TEXT NOT NULL,
        "patient_id" TEXT NOT NULL,
        "clinician_id" TEXT NULL,
        "mode" TEXT NOT NULL,
        "status" TEXT NOT NULL,
        "scheduled_at" TIMESTAMPTZ NULL,
        "started_at" TIMESTAMPTZ NULL,
        "ended_at" TIMESTAMPTZ NULL,
        "duration_minutes" INTEGER NULL,
        "chief_complaint" TEXT NULL,
        "medical_history" JSONB NULL,
        "assessment" TEXT NULL,
        "plan" TEXT NULL,
        "notes" TEXT NULL,
        "outcome" TEXT NULL,
        "rejection_reason" TEXT NULL,
        "approved_medications" TEXT[] NULL,
        "originating_submission_id" TEXT NULL,
        "order_id" TEXT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" TIMESTAMPTZ NULL
      )
    `)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_consultation_business_id" ON "consultation" ("business_id")`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_consultation_patient_id" ON "consultation" ("patient_id")`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_consultation_clinician_id" ON "consultation" ("clinician_id")`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_consultation_status" ON "consultation" ("status")`)

    // `consultation_status_event`
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "consultation_status_event" (
        "id" TEXT PRIMARY KEY,
        "consultation_id" TEXT NOT NULL,
        "from_status" TEXT NULL,
        "to_status" TEXT NOT NULL,
        "changed_by" TEXT NULL,
        "reason" TEXT NULL,
        "metadata" JSONB NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" TIMESTAMPTZ NULL
      )
    `)
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_consultation_status_event_consultation_id" ON "consultation_status_event" ("consultation_id")`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_consultation_status_event_created_at" ON "consultation_status_event" ("created_at")`
    )
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "consultation_status_event" CASCADE`)
    this.addSql(`DROP TABLE IF EXISTS "consultation" CASCADE`)
    this.addSql(`DROP TABLE IF EXISTS "patient" CASCADE`)
    this.addSql(`DROP TABLE IF EXISTS "clinician" CASCADE`)
  }
}
