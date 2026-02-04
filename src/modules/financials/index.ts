import { Module } from "@medusajs/framework/utils"
import FinancialsModuleService from "./service"

export const FINANCIALS_MODULE = "financialsModuleService"

export default Module(FINANCIALS_MODULE, {
  service: FinancialsModuleService,
})
