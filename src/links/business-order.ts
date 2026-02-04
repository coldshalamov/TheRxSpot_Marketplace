import { defineLink } from "@medusajs/framework/utils"
import BusinessModule from "../modules/business"
import OrderModule from "@medusajs/medusa/order"

export default defineLink(
  {
    linkable: BusinessModule.linkable.business,
    isList: false,
  },
  {
    linkable: OrderModule.linkable.order,
    isList: true,
  }
)
