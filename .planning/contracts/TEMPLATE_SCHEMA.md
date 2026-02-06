# Template Schema Contract (Workstream B)
> Phase 0 specification - for review before implementation

## Current State
- `/admin/tenant/branding` exists with simple key-value branding config
- No template model, no versioning, no section/block structure
- Storefront renders using branding variables only

## Target Template Model

```typescript
// Template configuration stored per-business
interface TemplateConfig {
  id: string
  business_id: string
  template_key: string          // e.g., "pharmacy-standard", "wellness-modern"
  template_version: string      // semver: "1.0.0"
  status: "draft" | "published" | "archived"

  theme: {
    branding: {
      primary_color: string
      secondary_color: string
      accent_color: string
      logo_url: string | null
      favicon_url: string | null
      font_family: string
      border_radius: string     // "rounded" | "sharp" | "pill"
    }
    content: {
      business_name: string
      tagline: string | null
      footer_text: string | null
      contact_email: string | null
      contact_phone: string | null
    }
    assets: {
      hero_image_url: string | null
      og_image_url: string | null
    }
  }

  sections: TemplateSection[]

  domain_overrides?: Record<string, Partial<TemplateConfig["theme"]>>

  created_at: Date
  updated_at: Date
  published_at: Date | null
}

interface TemplateSection {
  id: string
  section_key: string           // e.g., "hero", "featured-products", "about", "testimonials"
  visible: boolean
  order: number
  blocks: TemplateBlock[]
}

interface TemplateBlock {
  id: string
  block_type: string            // "text", "image", "cta", "product-grid", "consult-cta"
  content: Record<string, any>  // Type-specific content
  visible: boolean
  order: number
}
```

## API Contract

### Admin Template Endpoints
```
GET    /admin/businesses/:id/theme          -> Current template config
PUT    /admin/businesses/:id/theme          -> Update draft template
POST   /admin/businesses/:id/theme/publish  -> Publish current draft (creates version snapshot)
GET    /admin/businesses/:id/theme/versions -> List published versions
POST   /admin/businesses/:id/theme/preview-token -> Generate preview token
POST   /admin/businesses/:id/theme/rollback -> Rollback to previous version
```

### Store Template Endpoint (expanded)
```
GET    /store/tenant-config                 -> Returns full TemplateConfig for resolved tenant
```

Response contract:
```json
{
  "template_key": "pharmacy-standard",
  "template_version": "1.2.0",
  "theme": { ... },
  "sections": [ ... ],
  "domain_context": {
    "domain": "rxstore.example.com",
    "overrides_applied": true
  },
  // Legacy backwards-compat fields (migration window)
  "business_name": "...",
  "primary_color": "...",
  "logo_url": "..."
}
```

## Migration Strategy
1. Existing branding_config fields map into `theme.branding` and `theme.content`
2. Legacy fields maintained in tenant-config response during migration window
3. New template model stored as JSONB column on Business or new TemplateConfig entity
4. Default template auto-created on business provision

## Template Registry (Storefront)
- Maps `template_key` -> React component tree
- Each section renders based on `section_key` lookup
- Unknown section keys render nothing (graceful degradation)
- Invalid/missing template falls back to "default" template key

## Validation Rules
- `template_key` must be a registered template in the registry
- `sections[].section_key` must be a recognized section type
- `blocks[].block_type` must be a recognized block type
- `theme.branding.primary_color` must be valid hex
- Logo/image URLs must be valid URLs or null
- Max 20 sections per template
- Max 10 blocks per section
