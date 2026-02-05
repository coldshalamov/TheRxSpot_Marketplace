import { Migration } from "@mikro-orm/migrations"

/**
 * Create outbox_event table for durable partner dispatch.
 */
export class Migration20260205071000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "outbox_event" (
        "id" TEXT PRIMARY KEY,
        "business_id" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "dedupe_key" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'pending',
        "attempts" INTEGER NOT NULL DEFAULT 0,
        "next_attempt_at" TIMESTAMPTZ NULL,
        "delivered_at" TIMESTAMPTZ NULL,
        "last_error" TEXT NULL,
        "payload" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" TIMESTAMPTZ NULL
      )
    `)

    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_outbox_event_dedupe_key" ON "outbox_event" ("dedupe_key")`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "idx_outbox_event_status" ON "outbox_event" ("status")`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "idx_outbox_event_next_attempt" ON "outbox_event" ("next_attempt_at")`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "idx_outbox_event_business" ON "outbox_event" ("business_id")`)
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "outbox_event" CASCADE`)
  }
}

