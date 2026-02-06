import { HttpTypes } from "@medusajs/types"
import { Heading, Text, Badge } from "@medusajs/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

type ProductInfoProps = {
  product: HttpTypes.StoreProduct
}

const ProductInfo = ({ product }: ProductInfoProps) => {
  const requiresConsult = product.metadata?.requires_consult === true
  const consultFeeRaw = product.metadata?.consult_fee
  const consultFee =
    typeof consultFeeRaw === "number" || typeof consultFeeRaw === "string"
      ? Number(consultFeeRaw)
      : null

  return (
    <div id="product-info">
      <div className="flex flex-col gap-y-4 lg:max-w-[500px] mx-auto">
        {product.collection && (
          <LocalizedClientLink
            href={`/collections/${product.collection.handle}`}
            className="text-medium text-ui-fg-muted hover:text-ui-fg-subtle"
          >
            {product.collection.title}
          </LocalizedClientLink>
        )}
        <div className="flex flex-col gap-y-2">
          <Heading
            level="h2"
            className="text-3xl leading-10 text-ui-fg-base"
            data-testid="product-title"
          >
            {product.title}
          </Heading>
          {requiresConsult && (
            <div className="flex items-center gap-2">
              <Badge size="small" color="orange">
                Consultation Required
              </Badge>
              {consultFee !== null && Number.isFinite(consultFee) && (
                <Text className="text-small text-ui-fg-muted">
                  Consultation Fee: ${consultFee / 100}
                </Text>
              )}
            </div>
          )}
        </div>

        <Text
          className="text-medium text-ui-fg-subtle whitespace-pre-line"
          data-testid="product-description"
        >
          {product.description}
        </Text>
      </div>
    </div>
  )
}

export default ProductInfo
