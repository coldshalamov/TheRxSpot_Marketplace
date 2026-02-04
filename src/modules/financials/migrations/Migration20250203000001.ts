import { Migration } from '@mikro-orm/migrations';

export class Migration20250203000001 extends Migration {

  async up(): Promise<void> {
    // Create earning_entry table
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "earning_entry" (
        "id" TEXT PRIMARY KEY,
        "business_id" TEXT NOT NULL,
        "order_id" TEXT NOT NULL,
        "order_item_id" TEXT NULL,
        "consultation_id" TEXT NULL,
        "type" TEXT NOT NULL CHECK ("type" IN ('product_sale', 'consultation_fee', 'shipping_fee', 'platform_fee', 'clinician_fee')),
        "gross_amount" NUMERIC NOT NULL,
        "platform_fee" NUMERIC NOT NULL,
        "payment_processing_fee" NUMERIC NOT NULL,
        "net_amount" NUMERIC NOT NULL,
        "clinician_fee" NUMERIC NULL,
        "status" TEXT NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'available', 'paid', 'reversed')),
        "available_at" TIMESTAMPTZ NULL,
        "paid_at" TIMESTAMPTZ NULL,
        "payout_id" TEXT NULL,
        "description" TEXT NOT NULL,
        "metadata" JSONB NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_earning_entry_business_id" ON "earning_entry" ("business_id")`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_earning_entry_order_id" ON "earning_entry" ("order_id")`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_earning_entry_consultation_id" ON "earning_entry" ("consultation_id")`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_earning_entry_status" ON "earning_entry" ("status")`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_earning_entry_payout_id" ON "earning_entry" ("payout_id")`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_earning_entry_created_at" ON "earning_entry" ("created_at")`);

    // Create payout table
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "payout" (
        "id" TEXT PRIMARY KEY,
        "business_id" TEXT NOT NULL,
        "total_amount" NUMERIC NOT NULL,
        "fee_amount" NUMERIC NOT NULL,
        "net_amount" NUMERIC NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'processing', 'completed', 'failed')),
        "method" TEXT NOT NULL CHECK ("method" IN ('ach', 'wire', 'check', 'stripe_connect')),
        "destination_account" TEXT NULL,
        "requested_at" TIMESTAMPTZ NOT NULL,
        "processed_at" TIMESTAMPTZ NULL,
        "completed_at" TIMESTAMPTZ NULL,
        "earning_entries" JSONB NOT NULL DEFAULT '[]',
        "transaction_id" TEXT NULL,
        "failure_reason" TEXT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_payout_business_id" ON "payout" ("business_id")`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_payout_status" ON "payout" ("status")`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_payout_requested_at" ON "payout" ("requested_at")`);
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "earning_entry"`);
    this.addSql(`DROP TABLE IF EXISTS "payout"`);
  }

}
