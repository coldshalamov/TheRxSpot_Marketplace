import { defineLink } from "@medusajs/framework/utils"
import { BUSINESS_MODULE } from "../business"
import CartModule from "@medusajs/medusa/cart"

export default defineLink(
  {
    linkable: BUSINESS_MODULE + ".Business",
    isList: false,
  },
  {
    linkable: CartModule.linkable.cart,
    isList: true,
  }
)
