import { Module } from "@medusajs/framework/utils"
import ConsultationModuleService from "./service"

export const CONSULTATION_MODULE = "consultationModuleService"

export default Module(CONSULTATION_MODULE, {
  service: ConsultationModuleService,
})
