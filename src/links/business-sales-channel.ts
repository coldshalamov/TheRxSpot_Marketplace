import { defineLink } from "@medusajs/framework/utils"
import BusinessModule from "../modules/business"
import SalesChannelModule from "@medusajs/medusa/sales-channel"

export default defineLink(
  {
    linkable: BusinessModule.linkable.business,
    isList: false,
  },
  {
    linkable: SalesChannelModule.linkable.salesChannel,
    isList: false,
  }
)
