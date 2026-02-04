import { defineLink } from "@medusajs/framework/utils"
import BusinessModule from "../modules/business"
import ProductModule from "@medusajs/medusa/product"

export default defineLink(
  {
    linkable: BusinessModule.linkable.business,
    isList: false,
  },
  {
    linkable: ProductModule.linkable.product,
    isList: true,
  }
)
