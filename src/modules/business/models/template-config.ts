import { model } from "@medusajs/framework/utils"

export const TemplateConfig = model.define("template_config", {
  id: model.id().primaryKey(),
  business_id: model.text(),
  template_id: model.text().default("default"),
  version: model.number().default(1),
  is_published: model.boolean().default(false),
  sections: model.json().default({}),
  global_styles: model.json().default({}),
  metadata: model.json().default({}),
  published_at: model.dateTime().nullable(),
  published_by: model.text().nullable(),
})
