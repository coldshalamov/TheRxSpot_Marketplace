import { defineLink } from "@medusajs/framework/utils"
import BusinessModule from "../modules/business"
import CartModule from "@medusajs/medusa/cart"

export default defineLink(
  {
    linkable: BusinessModule.linkable.business,
    isList: false,
  },
  {
    linkable: CartModule.linkable.cart,
    isList: true,
  }
)
