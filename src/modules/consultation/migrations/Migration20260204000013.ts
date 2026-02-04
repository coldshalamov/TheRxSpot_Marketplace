import { Migration } from "@mikro-orm/migrations"

/**
 * Users Management Page (PLAN Week 3-4)
 * - Add optional demographic/status fields needed by admin user directory UI.
 */
export class Migration20260204000013 extends Migration {
  async up(): Promise<void> {
    this.addSql(`ALTER TABLE "clinician" ADD COLUMN IF NOT EXISTS "date_of_birth" text NULL`)
    this.addSql(`ALTER TABLE "clinician" ADD COLUMN IF NOT EXISTS "deactivation_reason" text NULL`)
  }

  async down(): Promise<void> {
    this.addSql(`ALTER TABLE "clinician" DROP COLUMN IF EXISTS "deactivation_reason"`)
    this.addSql(`ALTER TABLE "clinician" DROP COLUMN IF EXISTS "date_of_birth"`)
  }
}

