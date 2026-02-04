import { defineLink } from "@medusajs/framework/utils"
import { BUSINESS_MODULE } from "../business"
import ProductModule from "@medusajs/medusa/product"

export default defineLink(
  {
    linkable: BUSINESS_MODULE + ".Business",
    isList: false,
  },
  {
    linkable: ProductModule.linkable.product,
    isList: true,
  },
  {
    readOnly: true,
  }
)
