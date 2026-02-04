import { defineLink } from "@medusajs/framework/utils"
import { BUSINESS_MODULE } from "../business"
import OrderModule from "@medusajs/medusa/order"

export default defineLink(
  {
    linkable: BUSINESS_MODULE + ".Business",
    isList: false,
  },
  {
    linkable: OrderModule.linkable.order,
    isList: true,
  },
  {
    readOnly: true,
  }
)
