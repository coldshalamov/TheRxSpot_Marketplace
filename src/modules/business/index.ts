import { Module } from "@medusajs/framework/utils"
import BusinessModuleService from "./service"

export const BUSINESS_MODULE = "businessModuleService"

export default Module(BUSINESS_MODULE, {
  service: BusinessModuleService,
})
