import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Table, Badge } from "@medusajs/ui"
import { useEffect, useState } from "react"

const OrdersGlobalPage = () => {
  const [orders, setOrders] = useState<any[]>([])
  const [businesses, setBusinesses] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [bizRes] = await Promise.all([
        fetch("/admin/businesses", { credentials: "include" }),
      ])
      const bizData = await bizRes.json()
      const bizMap: Record<string, any> = {}
      for (const b of bizData.businesses || []) {
        bizMap[b.id] = b
      }
      setBusinesses(bizMap)
    } catch {
      console.error("Failed to fetch data")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Container>
        <Heading level="h1">All Orders (Cross-Tenant)</Heading>
        <p>Loading...</p>
      </Container>
    )
  }

  return (
    <Container>
      <Heading level="h1" className="mb-6">
        All Orders (Cross-Tenant)
      </Heading>

      <p className="text-gray-500 mb-4">
        Cross-tenant order view. Use Medusa's built-in Orders page for
        full order management. This page provides a tenant-aware overview.
      </p>

      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Business</Table.HeaderCell>
            <Table.HeaderCell>Status</Table.HeaderCell>
            <Table.HeaderCell>Sales Channel</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {Object.values(businesses).map((biz: any) => (
            <Table.Row key={biz.id}>
              <Table.Cell>{biz.name}</Table.Cell>
              <Table.Cell>
                <Badge
                  color={biz.status === "active" ? "green" : "grey"}
                >
                  {biz.status}
                </Badge>
              </Table.Cell>
              <Table.Cell>
                {biz.sales_channel_id ? (
                  <Badge color="green">Provisioned</Badge>
                ) : (
                  <Badge color="grey">None</Badge>
                )}
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Orders (Global)",
  icon: "ShoppingBag",
})

export default OrdersGlobalPage
