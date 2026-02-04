import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Container,
  Heading,
  Label,
  Input,
  Switch,
  Button,
  Badge,
  Toaster,
  toast,
} from "@medusajs/ui"
import { useState, useEffect, type HTMLAttributes } from "react"
import { useParams, useNavigate } from "react-router-dom"

const Section = (props: HTMLAttributes<HTMLDivElement>) => <div {...props} />

const BusinessDetailPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = id === "new"

  const [business, setBusiness] = useState<any>({
    name: "",
    slug: "",
    domain: "",
    logo_url: "",
    primary_color: "",
    secondary_color: "",
    custom_html_head: "",
    custom_html_body: "",
    is_active: true,
    status: "pending",
    branding_config: {},
    catalog_config: {},
    settings: {},
    sales_channel_id: null,
    publishable_api_key_id: null,
  })
  const [domains, setDomains] = useState<any[]>([])
  const [newDomain, setNewDomain] = useState("")
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isNew) {
      fetchBusiness()
      fetchDomains()
    }
  }, [id])

  const fetchBusiness = async () => {
    try {
      const response = await fetch(`/admin/businesses/${id}`, {
        credentials: "include",
      })
      const data = await response.json()
      setBusiness(data.business)
    } catch (error) {
      console.error("Failed to fetch business:", error)
      toast.error("Failed to load business")
    } finally {
      setLoading(false)
    }
  }

  const fetchDomains = async () => {
    try {
      const response = await fetch(`/admin/businesses/${id}/domains`, {
        credentials: "include",
      })
      const data = await response.json()
      setDomains(data.domains || [])
    } catch {
      // non-critical
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const url = isNew ? "/admin/businesses" : `/admin/businesses/${id}`
      const method = isNew ? "POST" : "PUT"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(business),
      })

      if (response.ok) {
        toast.success(isNew ? "Business created" : "Business updated")
        if (isNew) {
          navigate("/businesses")
        }
      } else {
        throw new Error("Save failed")
      }
    } catch (error) {
      toast.error("Failed to save business")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this business?")) return

    try {
      const response = await fetch(`/admin/businesses/${id}`, {
        method: "DELETE",
        credentials: "include",
      })

      if (response.ok) {
        toast.success("Business deleted")
        navigate("/businesses")
      }
    } catch (error) {
      toast.error("Failed to delete business")
    }
  }

  const handleAddDomain = async () => {
    if (!newDomain.trim()) return
    try {
      const response = await fetch(`/admin/businesses/${id}/domains`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ domain: newDomain.trim() }),
      })
      if (response.ok) {
        toast.success("Domain added")
        setNewDomain("")
        fetchDomains()
      }
    } catch {
      toast.error("Failed to add domain")
    }
  }

  const handleDeleteDomain = async (domainId: string) => {
    try {
      await fetch(`/admin/businesses/${id}/domains/${domainId}`, {
        method: "DELETE",
        credentials: "include",
      })
      toast.success("Domain removed")
      fetchDomains()
    } catch {
      toast.error("Failed to remove domain")
    }
  }

  const handleRegenerateQR = async () => {
    try {
      const response = await fetch(`/admin/businesses/${id}/qr-code`, {
        method: "POST",
        credentials: "include",
      })
      if (response.ok) {
        const data = await response.json()
        setBusiness((prev: any) => ({
          ...prev,
          settings: {
            ...prev.settings,
            qr_code_data_url: data.qr_code_data_url,
          },
        }))
        toast.success("QR code regenerated")
      }
    } catch {
      toast.error("Failed to regenerate QR code")
    }
  }

  if (loading) {
    return (
      <Container>
        <Heading level="h1">
          {isNew ? "New Business" : "Edit Business"}
        </Heading>
        <p>Loading...</p>
      </Container>
    )
  }

  return (
    <Container>
      <Toaster />

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Heading level="h1">
            {isNew ? "New Business" : business.name}
          </Heading>
          {!isNew && business.status && (
            <Badge
              color={
                {
                  pending: "orange" as const,
                  approved: "blue" as const,
                  active: "green" as const,
                  suspended: "red" as const,
                }[business.status] || ("grey" as const)
              }
            >
              {business.status}
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          {!isNew && (
            <Button variant="danger" onClick={handleDelete}>
              Delete
            </Button>
          )}
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <Section className="mb-6">
        <Heading level="h2" className="mb-4">
          Basic Information
        </Heading>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={business.name}
              onChange={(e) =>
                setBusiness({ ...business, name: e.target.value })
              }
              placeholder="Business Name"
            />
          </div>

          <div>
            <Label htmlFor="slug">Slug *</Label>
            <Input
              id="slug"
              value={business.slug}
              onChange={(e) =>
                setBusiness({ ...business, slug: e.target.value })
              }
              placeholder="business-slug"
            />
          </div>

          <div>
            <Label htmlFor="domain">Domain (legacy)</Label>
            <Input
              id="domain"
              value={business.domain || ""}
              onChange={(e) =>
                setBusiness({ ...business, domain: e.target.value })
              }
              placeholder="example.com"
            />
          </div>

          <div>
            <Label htmlFor="logo_url">Logo URL</Label>
            <Input
              id="logo_url"
              value={business.logo_url || ""}
              onChange={(e) =>
                setBusiness({ ...business, logo_url: e.target.value })
              }
              placeholder="https://..."
            />
          </div>
        </div>
      </Section>

      <Section className="mb-6">
        <Heading level="h2" className="mb-4">
          Branding
        </Heading>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="primary_color">Primary Color</Label>
            <Input
              id="primary_color"
              value={business.primary_color || ""}
              onChange={(e) =>
                setBusiness({ ...business, primary_color: e.target.value })
              }
              placeholder="#000000"
            />
          </div>

          <div>
            <Label htmlFor="secondary_color">Secondary Color</Label>
            <Input
              id="secondary_color"
              value={business.secondary_color || ""}
              onChange={(e) =>
                setBusiness({ ...business, secondary_color: e.target.value })
              }
              placeholder="#FFFFFF"
            />
          </div>
        </div>
      </Section>

      <Section className="mb-6">
        <Heading level="h2" className="mb-4">
          Branding Config (JSON)
        </Heading>
        <textarea
          value={JSON.stringify(business.branding_config || {}, null, 2)}
          onChange={(e) => {
            try {
              setBusiness({
                ...business,
                branding_config: JSON.parse(e.target.value),
              })
            } catch {
              // invalid JSON, ignore
            }
          }}
          className="w-full h-32 p-2 border rounded font-mono text-sm"
        />
      </Section>

      <Section className="mb-6">
        <Heading level="h2" className="mb-4">
          Catalog Config (JSON)
        </Heading>
        <textarea
          value={JSON.stringify(business.catalog_config || {}, null, 2)}
          onChange={(e) => {
            try {
              setBusiness({
                ...business,
                catalog_config: JSON.parse(e.target.value),
              })
            } catch {
              // invalid JSON, ignore
            }
          }}
          className="w-full h-32 p-2 border rounded font-mono text-sm"
        />
      </Section>

      <Section className="mb-6">
        <Heading level="h2" className="mb-4">
          Custom HTML
        </Heading>

        <div className="space-y-4">
          <div>
            <Label htmlFor="custom_html_head">
              Head HTML (injected in &lt;head&gt;)
            </Label>
            <textarea
              id="custom_html_head"
              value={business.custom_html_head || ""}
              onChange={(e) =>
                setBusiness({ ...business, custom_html_head: e.target.value })
              }
              className="w-full h-24 p-2 border rounded"
            />
          </div>

          <div>
            <Label htmlFor="custom_html_body">
              Body HTML (injected before &lt;/body&gt;)
            </Label>
            <textarea
              id="custom_html_body"
              value={business.custom_html_body || ""}
              onChange={(e) =>
                setBusiness({ ...business, custom_html_body: e.target.value })
              }
              className="w-full h-24 p-2 border rounded"
            />
          </div>
        </div>
      </Section>

      {!isNew && (
        <Section className="mb-6">
          <Heading level="h2" className="mb-4">
            Domain Management
          </Heading>

          <div className="flex gap-2 mb-4">
            <Input
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="custom.domain.com"
            />
            <Button variant="secondary" onClick={handleAddDomain}>
              Add Domain
            </Button>
          </div>

          {domains.length > 0 ? (
            <div className="space-y-2">
              {domains.map((d: any) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between p-2 border rounded"
                >
                  <div className="flex items-center gap-2">
                    <span>{d.domain}</span>
                    {d.is_primary && (
                      <Badge color="blue">Primary</Badge>
                    )}
                    {d.is_verified ? (
                      <Badge color="green">Verified</Badge>
                    ) : (
                      <Badge color="orange">Unverified</Badge>
                    )}
                  </div>
                  <Button
                    variant="danger"
                    size="small"
                    onClick={() => handleDeleteDomain(d.id)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No custom domains configured</p>
          )}
        </Section>
      )}

      {!isNew && (
        <Section className="mb-6">
          <Heading level="h2" className="mb-4">
            Provisioning Info
          </Heading>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Sales Channel ID</Label>
              <Input
                value={business.sales_channel_id || "Not provisioned"}
                readOnly
              />
            </div>
            <div>
              <Label>Publishable API Key ID</Label>
              <Input
                value={
                  business.publishable_api_key_id
                    ? `${business.publishable_api_key_id.substring(0, 8)}...`
                    : "Not provisioned"
                }
                readOnly
              />
            </div>
            <div>
              <Label>Storefront URL</Label>
              <Input
                value={business.settings?.storefront_url || "Not set"}
                readOnly
              />
            </div>
          </div>

          {business.settings?.qr_code_data_url && (
            <div className="mt-4">
              <Label>QR Code</Label>
              <div className="flex items-start gap-4">
                <img
                  src={business.settings.qr_code_data_url}
                  alt="QR Code"
                  className="w-32 h-32 border rounded"
                />
                <Button
                  variant="secondary"
                  size="small"
                  onClick={handleRegenerateQR}
                >
                  Regenerate
                </Button>
              </div>
            </div>
          )}

          {business.settings?.dns_instructions && (
            <div className="mt-4">
              <Label>DNS Instructions</Label>
              <ul className="list-disc pl-5 text-sm text-gray-600">
                {(business.settings.dns_instructions as string[]).map(
                  (instruction: string, i: number) => (
                    <li key={i}>{instruction}</li>
                  )
                )}
              </ul>
            </div>
          )}
        </Section>
      )}

      <Section>
        <div className="flex items-center gap-2">
          <Switch
            id="is_active"
            checked={business.is_active}
            onCheckedChange={(checked) =>
              setBusiness({ ...business, is_active: checked })
            }
          />
          <Label htmlFor="is_active">Active</Label>
        </div>
      </Section>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Business Detail",
})

export default BusinessDetailPage
