// components/footer.tsx
"use client"

import { Business } from "@/lib/business"

interface FooterProps {
  business: Business
}

export function Footer({ business }: FooterProps) {
  return (
    <footer className="border-t bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="font-semibold mb-2">{business.name}</h3>
            <p className="text-sm text-gray-600">
              Licensed telehealth provider
            </p>
          </div>
          
          <div>
            <h3 className="font-semibold mb-2">Quick Links</h3>
            <ul className="text-sm space-y-1">
              <li><a href="#" className="text-gray-600 hover:text-primary">About</a></li>
              <li><a href="#" className="text-gray-600 hover:text-primary">FAQ</a></li>
              <li><a href="#" className="text-gray-600 hover:text-primary">Contact</a></li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold mb-2">Legal</h3>
            <ul className="text-sm space-y-1">
              <li><a href="#" className="text-gray-600 hover:text-primary">Privacy Policy</a></li>
              <li><a href="#" className="text-gray-600 hover:text-primary">Terms of Service</a></li>
            </ul>
          </div>
        </div>
        
        <div className="mt-8 pt-8 border-t text-center text-sm text-gray-500">
          © {new Date().getFullYear()} {business.name}. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
