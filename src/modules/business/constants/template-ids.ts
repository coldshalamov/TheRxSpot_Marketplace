export const ALLOWED_TEMPLATE_IDS = [
  "therxspot-dimension",
  "therxspot-editorial",
  "therxspot-future-imperfect",
  "therxspot-landed",
  "therxspot-massively",
  "therxspot-paradigm-shift",
  "therxspot-photon",
  "therxspot-strongly-typed",
  "therxspot-verti",
] as const

export const DEFAULT_TEMPLATE_ID = ALLOWED_TEMPLATE_IDS[0]

export function isAllowedTemplateId(templateId: unknown): templateId is (typeof ALLOWED_TEMPLATE_IDS)[number] {
  return typeof templateId === "string" && ALLOWED_TEMPLATE_IDS.includes(templateId as any)
}
