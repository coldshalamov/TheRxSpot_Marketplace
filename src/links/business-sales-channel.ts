import { defineLink } from "@medusajs/framework/utils"
import { BUSINESS_MODULE } from "../modules/business"
import SalesChannelModule from "@medusajs/medusa/sales-channel"

export default defineLink(
  {
    linkable: BUSINESS_MODULE + ".Business",
    isList: false,
  },
  {
    linkable: SalesChannelModule.linkable.salesChannel,
    isList: false,
  }
)
