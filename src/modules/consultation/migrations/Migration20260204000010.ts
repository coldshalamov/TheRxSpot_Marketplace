import { Migration } from "@mikro-orm/migrations"

/**
 * Data hardening:
 * - Add missing `deleted_at` to consultation schedule tables
 * - Add PLAN performance indexes (consultation.scheduled_at)
 * - Add `deleted_at` indexes to speed default filtering
 */
export class Migration20260204000010 extends Migration {
  async up(): Promise<void> {
    // Ensure soft-delete support for schedule tables created in Migration20250203000004
    this.addSql(
      `ALTER TABLE "clinician_schedule" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ NULL`
    )
    this.addSql(
      `ALTER TABLE "clinician_availability_exception" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ NULL`
    )

    // PLAN: consultations.scheduled_at index
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_consultation_scheduled_at" ON "consultation" ("scheduled_at")`
    )

    // Add deleted_at indexes for fast default filtering
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_consultation_deleted_at" ON "consultation" ("deleted_at")`
    )
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_patient_deleted_at" ON "patient" ("deleted_at")`)
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_clinician_deleted_at" ON "clinician" ("deleted_at")`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_consultation_status_event_deleted_at" ON "consultation_status_event" ("deleted_at")`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_clinician_schedule_deleted_at" ON "clinician_schedule" ("deleted_at")`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_clinician_availability_exception_deleted_at" ON "clinician_availability_exception" ("deleted_at")`
    )
  }

  async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "IDX_consultation_scheduled_at"`)
    this.addSql(`DROP INDEX IF EXISTS "IDX_consultation_deleted_at"`)
    this.addSql(`DROP INDEX IF EXISTS "IDX_patient_deleted_at"`)
    this.addSql(`DROP INDEX IF EXISTS "IDX_clinician_deleted_at"`)
    this.addSql(`DROP INDEX IF EXISTS "IDX_consultation_status_event_deleted_at"`)
    this.addSql(`DROP INDEX IF EXISTS "IDX_clinician_schedule_deleted_at"`)
    this.addSql(`DROP INDEX IF EXISTS "IDX_clinician_availability_exception_deleted_at"`)

    this.addSql(`ALTER TABLE "clinician_schedule" DROP COLUMN IF EXISTS "deleted_at"`)
    this.addSql(`ALTER TABLE "clinician_availability_exception" DROP COLUMN IF EXISTS "deleted_at"`)
  }
}

