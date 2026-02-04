"use server"

import { checkConsultApproval as checkConsultApprovalImpl } from "./consultations"

export async function checkConsultApproval(productId: string) {
  return checkConsultApprovalImpl(productId)
}
