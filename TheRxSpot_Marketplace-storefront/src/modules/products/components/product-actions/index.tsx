"use client"

import { addToCart } from "@lib/data/cart"
import { useIntersection } from "@lib/hooks/use-in-view"
import { HttpTypes } from "@medusajs/types"
import { Button, toast } from "@medusajs/ui"
import Divider from "@modules/common/components/divider"
import OptionSelect from "@modules/products/components/product-actions/option-select"
import { isEqual } from "lodash"
import { useParams, usePathname, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import ProductPrice from "../product-price"
import MobileActions from "./mobile-actions"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ConsultForm } from "@/components/consult-form"
import { checkConsultApproval } from "@/lib/data/consultations"

type ProductActionsProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  disabled?: boolean
}

const optionsAsKeymap = (
  variantOptions: HttpTypes.StoreProductVariant["options"]
) => {
  return variantOptions?.reduce((acc: Record<string, string>, varopt: any) => {
    acc[varopt.option_id] = varopt.value
    return acc
  }, {})
}

export default function ProductActions({
  product,
  disabled,
}: ProductActionsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [options, setOptions] = useState<Record<string, string | undefined>>({})
  const [isAdding, setIsAdding] = useState(false)
  const [consultOpen, setConsultOpen] = useState(false)
  const [consultSubmitted, setConsultSubmitted] = useState(false)
  const [approvalLoading, setApprovalLoading] = useState(false)
  const [approval, setApproval] = useState<{
    has_valid_approval: boolean
    consultation_id: string | null
    expires_at: string | null
  } | null>(null)
  const [approvalState, setApprovalState] = useState<
    "idle" | "unauthenticated" | "needs_consult" | "pending" | "approved" | "error"
  >("idle")
  const countryCode = useParams().countryCode as string

  const requiresConsult = useMemo(() => {
    const v = (product as any)?.metadata?.requires_consult
    return v === true || v === "true"
  }, [product])

  // If there is only 1 variant, preselect the options
  useEffect(() => {
    if (product.variants?.length === 1) {
      const variantOptions = optionsAsKeymap(product.variants[0].options)
      setOptions(variantOptions ?? {})
    }
  }, [product.variants])

  const selectedVariant = useMemo(() => {
    if (!product.variants || product.variants.length === 0) {
      return
    }

    return product.variants.find((v) => {
      const variantOptions = optionsAsKeymap(v.options)
      return isEqual(variantOptions, options)
    })
  }, [product.variants, options])

  // update the options when a variant is selected
  const setOptionValue = (optionId: string, value: string) => {
    setOptions((prev) => ({
      ...prev,
      [optionId]: value,
    }))
  }

  //check if the selected options produce a valid variant
  const isValidVariant = useMemo(() => {
    return product.variants?.some((v) => {
      const variantOptions = optionsAsKeymap(v.options)
      return isEqual(variantOptions, options)
    })
  }, [product.variants, options])

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    const value = isValidVariant ? selectedVariant?.id : null

    if (params.get("v_id") === value) {
      return
    }

    if (value) {
      params.set("v_id", value)
    } else {
      params.delete("v_id")
    }

    router.replace(pathname + "?" + params.toString())
  }, [selectedVariant, isValidVariant])

  // check if the selected variant is in stock
  const inStock = useMemo(() => {
    // If we don't manage inventory, we can always add to cart
    if (selectedVariant && !selectedVariant.manage_inventory) {
      return true
    }

    // If we allow back orders on the variant, we can add to cart
    if (selectedVariant?.allow_backorder) {
      return true
    }

    // If there is inventory available, we can add to cart
    if (
      selectedVariant?.manage_inventory &&
      (selectedVariant?.inventory_quantity || 0) > 0
    ) {
      return true
    }

    // Otherwise, we can't add to cart
    return false
  }, [selectedVariant])

  const actionsRef = useRef<HTMLDivElement>(null)

  const inView = useIntersection(actionsRef, "0px")

  const refreshApproval = useCallback(async () => {
    if (!requiresConsult) return

    setApprovalLoading(true)
    try {
      const res = await checkConsultApproval(product.id)

      if (!res.ok) {
        setApproval(null)
        if (res.code === "UNAUTHORIZED") {
          setApprovalState("unauthenticated")
          return
        }
        setApprovalState("error")
        toast.error("Failed to check consultation approval", {
          description: res.message,
        })
        return
      }

      setApproval({
        has_valid_approval: res.has_valid_approval,
        consultation_id: res.consultation_id,
        expires_at: res.expires_at,
      })

      if (res.has_valid_approval) {
        setApprovalState("approved")
      } else if (consultSubmitted) {
        setApprovalState("pending")
      } else {
        setApprovalState("needs_consult")
      }
    } finally {
      setApprovalLoading(false)
    }
  }, [consultSubmitted, product.id, requiresConsult])

  useEffect(() => {
    if (!requiresConsult) return
    refreshApproval()
  }, [requiresConsult, refreshApproval])

  useEffect(() => {
    if (!requiresConsult) return
    if (!consultSubmitted) return
    if (approval?.has_valid_approval) return

    const interval = setInterval(() => {
      refreshApproval()
    }, 10_000)

    return () => clearInterval(interval)
  }, [approval?.has_valid_approval, consultSubmitted, refreshApproval, requiresConsult])

  // add the selected variant to the cart
  const handleAddToCart = async () => {
    if (!selectedVariant?.id) return null

    if (requiresConsult && !approval?.has_valid_approval) {
      setConsultOpen(true)
      return
    }

    setIsAdding(true)

    try {
      await addToCart({
        variantId: selectedVariant.id,
        quantity: 1,
        countryCode,
        consultationId:
          requiresConsult && approval?.consultation_id ? approval.consultation_id : undefined,
      })
    } catch (e: any) {
      toast.error("Failed to add to cart", {
        description: e?.message || "Unknown error",
      })
    }

    setIsAdding(false)
  }

  return (
    <>
      <div className="flex flex-col gap-y-2" ref={actionsRef}>
        <div>
          {(product.variants?.length ?? 0) > 1 && (
            <div className="flex flex-col gap-y-4">
              {(product.options || []).map((option) => {
                return (
                  <div key={option.id}>
                    <OptionSelect
                      option={option}
                      current={options[option.id]}
                      updateOption={setOptionValue}
                      title={option.title ?? ""}
                      data-testid="product-options"
                      disabled={!!disabled || isAdding}
                    />
                  </div>
                )
              })}
              <Divider />
            </div>
          )}
        </div>

        <ProductPrice product={product} variant={selectedVariant} />

        {requiresConsult ? (
          <div className="rounded-md border p-3 text-sm">
            {approvalState === "approved" ? (
              <div className="space-y-2">
                <div className="font-medium">Consultation approved</div>
                <div className="text-gray-600">
                  {approval?.expires_at ? (
                    <>Valid until {new Date(approval.expires_at).toLocaleString()}</>
                  ) : (
                    <>Valid approval found.</>
                  )}
                </div>
              </div>
            ) : approvalState === "unauthenticated" ? (
              <div className="space-y-2">
                <div className="font-medium">Consultation required</div>
                <div className="text-gray-600">Sign in to request a consultation for this product.</div>
                <Link
                  href={`/${countryCode}/account`}
                  className="inline-flex items-center justify-center rounded-md bg-teal-600 px-3 py-2 text-white"
                >
                  Sign in
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="font-medium">Consultation required</div>
                <div className="text-gray-600">
                  {approvalState === "pending"
                    ? "Your consultation is under review. We’ll refresh this page every 10 seconds."
                    : "You need an approved consultation before you can add this product to your cart."}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => setConsultOpen(true)}
                    disabled={approvalLoading}
                  >
                    {consultSubmitted ? "Update details" : "Request consultation"}
                  </Button>
                  <Button variant="transparent" size="small" onClick={refreshApproval} disabled={approvalLoading}>
                    {approvalLoading ? "Checking..." : "Check status"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : null}

        <Button
          onClick={handleAddToCart}
          disabled={
            !inStock ||
            !selectedVariant ||
            !!disabled ||
            isAdding ||
            !isValidVariant ||
            (requiresConsult && approvalState !== "approved")
          }
          variant="primary"
          className="w-full h-10"
          isLoading={isAdding}
          data-testid="add-product-button"
        >
          {!selectedVariant && !options
            ? "Select variant"
            : !inStock || !isValidVariant
            ? "Out of stock"
            : "Add to cart"}
        </Button>
        <MobileActions
          product={product}
          variant={selectedVariant}
          options={options}
          updateOptions={setOptionValue}
          inStock={inStock}
          handleAddToCart={handleAddToCart}
          isAdding={isAdding}
          show={!inView}
          optionsDisabled={!!disabled || isAdding}
        />
      </div>

      {consultOpen ? (
        <ConsultForm
          productId={product.id}
          onClose={() => setConsultOpen(false)}
          onSubmitted={() => {
            setConsultOpen(false)
            setConsultSubmitted(true)
            setApprovalState("pending")
            refreshApproval()
          }}
        />
      ) : null}
    </>
  )
}
