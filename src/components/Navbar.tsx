'use client'

import Link from 'next/link'
import { ShoppingCart, Menu, X, User, Search } from 'lucide-react'
import { useState } from 'react'
import { useCartStore } from '@/store/cartStore'

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const cartCount = useCartStore((state: any) => state.items.length)

  return (
    <nav className="sticky top-0 z-50 bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-sage-600 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-lg">LC</span>
            </div>
            <span className="hidden sm:inline font-bold text-xl text-gray-900">Last Club</span>
          </Link>

          <div className="hidden md:flex items-center space-x-8">
            <Link href="/products" className="text-gray-700 hover:text-sage-600 transition-colors">
              Products
            </Link>
            <Link href="/about" className="text-gray-700 hover:text-sage-600 transition-colors">
              About
            </Link>
            <Link href="/contact" className="text-gray-700 hover:text-sage-600 transition-colors">
              Contact
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            <button className="p-2 hover:bg-beige-100 rounded-lg transition-colors">
              <Search size={20} className="text-gray-700" />
            </button>
            <button className="p-2 hover:bg-beige-100 rounded-lg transition-colors">
              <User size={20} className="text-gray-700" />
            </button>
            <Link href="/cart" className="relative p-2 hover:bg-beige-100 rounded-lg transition-colors">
              <ShoppingCart size={20} className="text-gray-700" />
              {cartCount > 0 && (
                <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </Link>

            <button
              onClick={() => setIsOpen(!isOpen)}
              className="md:hidden p-2 hover:bg-beige-100 rounded-lg transition-colors"
            >
              {isOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {isOpen && (
          <div className="md:hidden border-t border-beige-200">
            <div className="flex flex-col space-y-2 py-4">
              <Link href="/products" className="px-4 py-2 text-gray-700 hover:bg-beige-100 rounded transition-colors">
                Products
              </Link>
              <Link href="/about" className="px-4 py-2 text-gray-700 hover:bg-beige-100 rounded transition-colors">
                About
              </Link>
              <Link href="/contact" className="px-4 py-2 text-gray-700 hover:bg-beige-100 rounded transition-colors">
                Contact
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}