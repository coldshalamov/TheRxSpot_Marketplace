import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Container,
  Heading,
  Table,
  Button,
  Input,
  Badge,
  Toaster,
  toast,
} from "@medusajs/ui"
import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"

const DomainsPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [domains, setDomains] = useState<any[]>([])
  const [businessName, setBusinessName] = useState("")
  const [newDomain, setNewDomain] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [id])

  const fetchData = async () => {
    try {
      const [bizRes, domRes] = await Promise.all([
        fetch(`/admin/businesses/${id}`, { credentials: "include" }),
        fetch(`/admin/businesses/${id}/domains`, { credentials: "include" }),
      ])
      const bizData = await bizRes.json()
      const domData = await domRes.json()
      setBusinessName(bizData.business?.name || "")
      setDomains(domData.domains || [])
    } catch {
      toast.error("Failed to load data")
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async () => {
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
        fetchData()
      } else {
        toast.error("Failed to add domain")
      }
    } catch {
      toast.error("Failed to add domain")
    }
  }

  const handleDelete = async (domainId: string) => {
    try {
      await fetch(`/admin/businesses/${id}/domains/${domainId}`, {
        method: "DELETE",
        credentials: "include",
      })
      toast.success("Domain removed")
      fetchData()
    } catch {
      toast.error("Failed to remove domain")
    }
  }

  if (loading) {
    return (
      <Container>
        <p>Loading...</p>
      </Container>
    )
  }

  return (
    <Container>
      <Toaster />

      <div className="flex items-center justify-between mb-6">
        <div>
          <Heading level="h1">Domains - {businessName}</Heading>
          <Button
            variant="transparent"
            size="small"
            onClick={() => navigate(`/businesses/${id}`)}
          >
            Back to Business
          </Button>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        <Input
          value={newDomain}
          onChange={(e) => setNewDomain(e.target.value)}
          placeholder="custom.domain.com"
        />
        <Button onClick={handleAdd}>Add Domain</Button>
      </div>

      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Domain</Table.HeaderCell>
            <Table.HeaderCell>Primary</Table.HeaderCell>
            <Table.HeaderCell>Verified</Table.HeaderCell>
            <Table.HeaderCell>Actions</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {domains.map((d: any) => (
            <Table.Row key={d.id}>
              <Table.Cell>{d.domain}</Table.Cell>
              <Table.Cell>
                {d.is_primary ? (
                  <Badge color="blue">Yes</Badge>
                ) : (
                  <Badge color="grey">No</Badge>
                )}
              </Table.Cell>
              <Table.Cell>
                {d.is_verified ? (
                  <Badge color="green">Verified</Badge>
                ) : (
                  <Badge color="orange">Pending</Badge>
                )}
              </Table.Cell>
              <Table.Cell>
                <Button
                  variant="danger"
                  size="small"
                  onClick={() => handleDelete(d.id)}
                >
                  Remove
                </Button>
              </Table.Cell>
            </Table.Row>
          ))}
          {domains.length === 0 && (
            <Table.Row>
              <Table.Cell colSpan={4}>
                <p className="text-center text-gray-500">
                  No domains configured
                </p>
              </Table.Cell>
            </Table.Row>
          )}
        </Table.Body>
      </Table>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Domain Management",
})

export default DomainsPage
