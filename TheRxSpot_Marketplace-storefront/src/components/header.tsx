// components/header.tsx
"use client"

import Link from "next/link"
import Image from "next/image"
import { Business } from "@/lib/business"
import { ShoppingCart } from "lucide-react"

interface HeaderProps {
  business: Business
}

export function Header({ business }: HeaderProps) {
  return (
    <header className="border-b">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href={`/${business.slug}`} className="flex items-center gap-2">
          {business.logo_url ? (
            <Image
              src={business.logo_url}
              alt={business.name}
              width={120}
              height={40}
              className="h-8 w-auto"
            />
          ) : (
            <span className="text-xl font-bold">{business.name}</span>
          )}
        </Link>
        
        <nav className="flex items-center gap-6">
          <Link href={`/${business.slug}`} className="hover:text-primary">
            Home
          </Link>
          <Link href={`/${business.slug}/products`} className="hover:text-primary">
            Products
          </Link>
          <Link href={`/${business.slug}/cart`} className="hover:text-primary">
            <ShoppingCart className="w-5 h-5" />
          </Link>
        </nav>
      </div>
    </header>
  )
}
