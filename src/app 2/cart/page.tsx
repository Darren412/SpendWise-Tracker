'use client'

import Link from 'next/link'
import { Trash2, Plus, Minus, ShoppingCart } from 'lucide-react'
import { useCartStore } from '@/store/cartStore'

export default function CartPage() {
  const { items, removeItem, updateQuantity, getTotalPrice, clearCart } = useCartStore()
  const total = getTotalPrice()

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-beige-50 flex items-center justify-center">
        <div className="text-center">
          <ShoppingCart size={64} className="mx-auto text-sage-600 mb-4 opacity-50" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Your Cart is Empty</h1>
          <p className="text-gray-600 mb-8">Add some fresh products to get started!</p>
          <Link href="/products" className="btn-primary inline-block">
            Continue Shopping
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-beige-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-12">Shopping Cart</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className={`p-6 flex items-center gap-6 ${
                    index !== items.length - 1 ? 'border-b border-beige-200' : ''
                  }`}
                >
                  <div className="text-5xl">{item.image}</div>

                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-gray-900">{item.name}</h3>
                    <p className="text-gray-600 text-sm capitalize">{item.category}</p>
                    <p className="text-sage-600 font-bold text-lg mt-2">₹{item.price}</p>
                  </div>

                  <div className="flex items-center gap-3 bg-beige-100 px-4 py-2 rounded-lg">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="text-gray-700 hover:text-sage-600 transition-colors"
                    >
                      <Minus size={18} />
                    </button>
                    <span className="font-bold text-gray-900 w-8 text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="text-gray-700 hover:text-sage-600 transition-colors"
                    >
                      <Plus size={18} />
                    </button>
                  </div>

                  <div className="text-right">
                    <p className="font-bold text-gray-900">
                      ₹{(item.price * item.quantity).toFixed(2)}
                    </p>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-red-500 hover:text-red-700 transition-colors mt-2 flex items-center gap-1 text-sm"
                    >
                      <Trash2 size={16} />
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <Link href="/products" className="text-sage-600 hover:text-sage-700 mt-6 inline-flex items-center gap-2">
              ← Continue Shopping
            </Link>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-6 h-fit sticky top-24">
              <h2 className="font-bold text-2xl text-gray-900 mb-6">Order Summary</h2>

              <div className="space-y-4 mb-6 pb-6 border-b border-beige-200">
                <div className="flex justify-between text-gray-700">
                  <span>Subtotal</span>
                  <span>₹{total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span>Delivery Fee</span>
                  <span className="text-green-600 font-medium">FREE</span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span>Tax (5%)</span>
                  <span>₹{(total * 0.05).toFixed(2)}</span>
                </div>
              </div>

              <div className="flex justify-between items-center mb-6">
                <span className="font-bold text-lg text-gray-900">Total</span>
                <span className="font-bold text-2xl text-sage-600">
                  ₹{(total * 1.05).toFixed(2)}
                </span>
              </div>

              <button className="w-full btn-primary block text-center mb-3">
                Proceed to Checkout
              </button>

              <button
                onClick={() => clearCart()}
                className="w-full text-red-600 hover:text-red-700 py-2 font-medium transition-colors"
              >
                Clear Cart
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}