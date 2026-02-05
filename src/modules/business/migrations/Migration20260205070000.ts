import { Migration } from "@mikro-orm/migrations"

/**
 * Add business contact email for notifications and ops workflows.
 */
export class Migration20260205070000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      ALTER TABLE "business"
      ADD COLUMN IF NOT EXISTS "contact_email" TEXT NULL
    `)
  }

  async down(): Promise<void> {
    this.addSql(`
      ALTER TABLE "business"
      DROP COLUMN IF EXISTS "contact_email"
    `)
  }
}

