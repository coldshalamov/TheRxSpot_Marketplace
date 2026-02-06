import "react"

declare module "react" {
  interface HTMLAttributes<T> {
    colSpan?: number
    rowSpan?: number
  }
}
