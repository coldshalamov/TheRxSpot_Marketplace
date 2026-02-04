"use client"

import { convertToLocale } from "@lib/util/money"
import { Button, Heading } from "@medusajs/ui"

import CartTotals from "@modules/common/components/cart-totals"
import Divider from "@modules/common/components/divider"
import DiscountCode from "@modules/checkout/components/discount-code"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { HttpTypes } from "@medusajs/types"

type SummaryProps = {
  cart: HttpTypes.StoreCart & {
    promotions: HttpTypes.StorePromotion[]
  }
}

function getCheckoutStep(cart: HttpTypes.StoreCart) {
  if (!cart?.shipping_address?.address_1 || !cart.email) {
    return "address"
  } else if (cart?.shipping_methods?.length === 0) {
    return "delivery"
  } else {
    return "payment"
  }
}

const Summary = ({ cart }: SummaryProps) => {
  const step = getCheckoutStep(cart)

  const consultFeeItems = (cart.items || []).filter((it: any) => it?.metadata?.type === "consultation_fee")
  const consultFeeTotal = consultFeeItems.reduce((sum: number, it: any) => {
    const total = typeof it?.total === "number" ? it.total : 0
    if (Number.isFinite(total) && total > 0) return sum + total
    const unit = typeof it?.unit_price === "number" ? it.unit_price : 0
    const qty = typeof it?.quantity === "number" ? it.quantity : 1
    return sum + unit * qty
  }, 0)

  const consultFeeExpiresAt = consultFeeItems
    .map((it: any) => it?.metadata?.expires_at)
    .find((v: any) => typeof v === "string" && v.trim())

  return (
    <div className="flex flex-col gap-y-4">
      <Heading level="h2" className="text-[2rem] leading-[2.75rem]">
        Summary
      </Heading>
      <DiscountCode cart={cart} />
      <Divider />
      {consultFeeItems.length ? (
        <div className="flex flex-col gap-y-1 text-ui-fg-subtle txt-medium">
          <div className="flex items-center justify-between">
            <span>Consultation fees</span>
            <span>
              {convertToLocale({
                amount: consultFeeTotal || 0,
                currency_code: cart.currency_code,
              })}
            </span>
          </div>
          {consultFeeExpiresAt ? (
            <div className="text-xs text-ui-fg-subtle">
              Approval expires {new Date(consultFeeExpiresAt).toLocaleString()}
            </div>
          ) : null}
          <Divider />
        </div>
      ) : null}
      <CartTotals totals={cart} />
      <LocalizedClientLink
        href={"/checkout?step=" + step}
        data-testid="checkout-button"
      >
        <Button className="w-full h-10">Go to checkout</Button>
      </LocalizedClientLink>
    </div>
  )
}

export default Summary
