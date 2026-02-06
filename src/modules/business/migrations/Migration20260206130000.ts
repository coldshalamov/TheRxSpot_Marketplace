import { Migration } from "@mikro-orm/migrations"

/**
 * Add tenant-editable card override fields to location_product.
 * These power per-business catalog ordering + product card customization.
 */
export class Migration20260206130000 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      `ALTER TABLE "location_product" ADD COLUMN IF NOT EXISTS "display_title" TEXT NULL`
    )
    this.addSql(
      `ALTER TABLE "location_product" ADD COLUMN IF NOT EXISTS "display_description" TEXT NULL`
    )
    this.addSql(
      `ALTER TABLE "location_product" ADD COLUMN IF NOT EXISTS "display_image_url" TEXT NULL`
    )
    this.addSql(
      `ALTER TABLE "location_product" ADD COLUMN IF NOT EXISTS "details_blocks" JSONB NULL`
    )
  }

  async down(): Promise<void> {
    this.addSql(`ALTER TABLE "location_product" DROP COLUMN IF EXISTS "details_blocks"`)
    this.addSql(`ALTER TABLE "location_product" DROP COLUMN IF EXISTS "display_image_url"`)
    this.addSql(`ALTER TABLE "location_product" DROP COLUMN IF EXISTS "display_description"`)
    this.addSql(`ALTER TABLE "location_product" DROP COLUMN IF EXISTS "display_title"`)
  }
}
