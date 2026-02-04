import { Migration } from "@mikro-orm/migrations"

/**
 * Financials schema alignment + idempotency support.
 *
 * - `earning_entry.order_id` must be nullable (consultation earnings can exist without an order).
 * - Older migration used `order_item_id`; model uses `line_item_id`.
 * - `payout.metadata` exists in the model but was missing from SQL.
 * - Add `payout.idempotency_key` + unique index for basic dedupe.
 */
export class Migration20260204000003 extends Migration {
  async up(): Promise<void> {
    // earning_entry: make order_id nullable
    this.addSql(`ALTER TABLE "earning_entry" ALTER COLUMN "order_id" DROP NOT NULL`)

    // earning_entry: rename order_item_id -> line_item_id if needed, otherwise ensure column exists
    this.addSql(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'earning_entry' AND column_name = 'order_item_id'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'earning_entry' AND column_name = 'line_item_id'
        ) THEN
          ALTER TABLE "earning_entry" RENAME COLUMN "order_item_id" TO "line_item_id";
        ELSIF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'earning_entry' AND column_name = 'line_item_id'
        ) THEN
          ALTER TABLE "earning_entry" ADD COLUMN "line_item_id" TEXT NULL;
        END IF;
      END $$;
    `)

    // payout: add metadata + idempotency_key
    this.addSql(`ALTER TABLE "payout" ADD COLUMN IF NOT EXISTS "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb`)
    this.addSql(`ALTER TABLE "payout" ADD COLUMN IF NOT EXISTS "idempotency_key" TEXT NULL`)
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_payout_business_idempotency_key_unique" ON "payout" ("business_id", "idempotency_key") WHERE "idempotency_key" IS NOT NULL`
    )
  }

  async down(): Promise<void> {
    // Best-effort rollback (avoid destructive operations on existing data)
    this.addSql(`DROP INDEX IF EXISTS "IDX_payout_business_idempotency_key_unique"`)
    this.addSql(`ALTER TABLE "payout" DROP COLUMN IF EXISTS "idempotency_key"`)
    // keep metadata column to avoid data loss

    // Do not attempt to re-add NOT NULL constraints or rename columns back.
  }
}

