import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Table, Button, Badge, Select } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

const STATUS_COLORS: Record<string, "green" | "orange" | "blue" | "red" | "grey"> = {
  pending: "orange",
  approved: "blue",
  active: "green",
  suspended: "red",
}

const BusinessesPage = () => {
  const navigate = useNavigate()
  const [businesses, setBusinesses] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("")

  useEffect(() => {
    fetchBusinesses()
  }, [statusFilter])

  const fetchBusinesses = async () => {
    try {
      const params = statusFilter ? `?status=${statusFilter}` : ""
      const response = await fetch(`/admin/businesses${params}`, {
        credentials: "include",
      })
      const data = await response.json()
      setBusinesses(data.businesses || [])
    } catch (error) {
      console.error("Failed to fetch businesses:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleProvision = async (id: string) => {
    try {
      const response = await fetch(`/admin/businesses/${id}/provision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      })
      if (response.ok) {
        fetchBusinesses()
      }
    } catch (error) {
      console.error("Failed to provision:", error)
    }
  }

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const response = await fetch(`/admin/businesses/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      })
      if (response.ok) {
        fetchBusinesses()
      }
    } catch (error) {
      console.error("Failed to update status:", error)
    }
  }

  if (loading) {
    return (
      <Container>
        <Heading level="h1">Businesses</Heading>
        <p>Loading...</p>
      </Container>
    )
  }

  return (
    <Container>
      <div className="flex items-center justify-between mb-6">
        <Heading level="h1">Businesses</Heading>
        <div className="flex gap-2 items-center">
          <Select
            value={statusFilter || "__all__"}
            onValueChange={(val) => setStatusFilter(val === "__all__" ? "" : val)}
          >
            <Select.Trigger>
              <Select.Value placeholder="All Statuses" />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="__all__">All</Select.Item>
              <Select.Item value="pending">Pending</Select.Item>
              <Select.Item value="approved">Approved</Select.Item>
              <Select.Item value="active">Active</Select.Item>
              <Select.Item value="suspended">Suspended</Select.Item>
            </Select.Content>
          </Select>
          <Button onClick={() => navigate("/businesses/new")}>
            Create Business
          </Button>
        </div>
      </div>

      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Name</Table.HeaderCell>
            <Table.HeaderCell>Slug</Table.HeaderCell>
            <Table.HeaderCell>Domain</Table.HeaderCell>
            <Table.HeaderCell>Status</Table.HeaderCell>
            <Table.HeaderCell>Sales Channel</Table.HeaderCell>
            <Table.HeaderCell>Actions</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {businesses.map((business: any) => (
            <Table.Row key={business.id}>
              <Table.Cell>{business.name}</Table.Cell>
              <Table.Cell>{business.slug}</Table.Cell>
              <Table.Cell>{business.domain || "-"}</Table.Cell>
              <Table.Cell>
                <Badge color={STATUS_COLORS[business.status] || "grey"}>
                  {business.status || (business.is_active ? "active" : "inactive")}
                </Badge>
              </Table.Cell>
              <Table.Cell>
                {business.sales_channel_id ? (
                  <Badge color="green">Provisioned</Badge>
                ) : (
                  <Badge color="grey">None</Badge>
                )}
              </Table.Cell>
              <Table.Cell>
                <div className="flex gap-1">
                  {business.status === "pending" && (
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => handleStatusChange(business.id, "approved")}
                    >
                      Approve
                    </Button>
                  )}
                  {business.status === "approved" && !business.sales_channel_id && (
                    <Button
                      variant="primary"
                      size="small"
                      onClick={() => handleProvision(business.id)}
                    >
                      Provision
                    </Button>
                  )}
                  {(business.status === "active" || business.status === "approved") && (
                    <Button
                      variant="danger"
                      size="small"
                      onClick={() => handleStatusChange(business.id, "suspended")}
                    >
                      Suspend
                    </Button>
                  )}
                  {business.status === "suspended" && (
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => handleStatusChange(business.id, "active")}
                    >
                      Reactivate
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => navigate(`/businesses/${business.id}`)}
                  >
                    Edit
                  </Button>
                </div>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Businesses",
})

export default BusinessesPage
