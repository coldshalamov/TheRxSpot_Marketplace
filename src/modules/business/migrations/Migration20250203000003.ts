import { Migration } from '@mikro-orm/migrations';

export class Migration20250203000003 extends Migration {

  async up(): Promise<void> {
    // Create order_status_event table
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "order_status_event" (
        "id" TEXT PRIMARY KEY,
        "order_id" TEXT NOT NULL,
        "business_id" TEXT NOT NULL,
        "from_status" TEXT NOT NULL,
        "to_status" TEXT NOT NULL,
        "triggered_by" TEXT NULL,
        "reason" TEXT NULL,
        "metadata" JSONB NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_order_status_event_order_id" ON "order_status_event" ("order_id")`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_order_status_event_business_id" ON "order_status_event" ("business_id")`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_order_status_event_created_at" ON "order_status_event" ("created_at")`);
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "order_status_event"`);
  }

}
