'use client'

import { ShoppingCart, Star } from 'lucide-react'
import { useCartStore } from '@/store/cartStore'
import { useState } from 'react'

const featuredProducts = [
  { id: '1', name: 'Organic Tomatoes', price: 45, image: '🍅', category: 'vegetables', rating: 4.8, reviews: 124, badge: 'Fresh Daily' },
  { id: '2', name: 'Crisp Cucumbers', price: 35, image: '🥒', category: 'vegetables', rating: 4.6, reviews: 89, badge: 'Organic' },
  { id: '3', name: 'Sweet Mangoes', price: 120, image: '🥭', category: 'fruits', rating: 4.9, reviews: 256, badge: 'Best Seller' },
  { id: '4', name: 'Red Apples', price: 80, image: '🍎', category: 'fruits', rating: 4.7, reviews: 178, badge: 'Premium' },
  { id: '5', name: 'Fresh Broccoli', price: 60, image: '🥦', category: 'vegetables', rating: 4.5, reviews: 95, badge: 'New' },
  { id: '6', name: 'Organic Carrots', price: 40, image: '🥕', category: 'vegetables', rating: 4.4, reviews: 67, badge: 'Fresh Daily' },
]

export default function FeaturedProducts() {
  const addItem = useCartStore((state: any) => state.addItem)
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set())

  const handleAddToCart = (product: typeof featuredProducts[0]) => {
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      quantity: 1,
      image: product.image,
      category: product.category,
    })
    
    setAddedItems((prev) => new Set(prev).add(product.id))
    setTimeout(() => {
      setAddedItems((prev) => {
        const next = new Set(prev)
        next.delete(product.id)
        return next
      })
    }, 2000)
  }

  return (
    <section className="py-16 md:py-24 bg-beige-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="section-heading">Featured Products</h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Handpicked fresh products for your family
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {featuredProducts.map((product) => (
            <div key={product.id} className="card group relative">
              <div className="absolute top-4 right-4 bg-sage-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                {product.badge}
              </div>

              <div className="h-40 bg-gradient-to-br from-sage-100 to-beige-100 rounded-lg flex items-center justify-center text-7xl mb-4 group-hover:scale-105 transition-transform">
                {product.image}
              </div>

              <h3 className="font-bold text-lg text-gray-900 mb-2">
                {product.name}
              </h3>

              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      size={14}
                      className={i < Math.floor(product.rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
                    />
                  ))}
                </div>
                <span className="text-sm text-gray-600">
                  ({product.reviews})
                </span>
              </div>

              <div className="flex items-center justify-between mb-4">
                <span className="text-2xl font-bold text-sage-600">
                  ₹{product.price}
                </span>
                <span className="text-sm text-gray-500">Per kg</span>
              </div>

              <button
                onClick={() => handleAddToCart(product)}
                className={`w-full py-2 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                  addedItems.has(product.id)
                    ? 'bg-green-500 text-white'
                    : 'bg-sage-600 text-white hover:bg-sage-700'
                }`}
              >
                <ShoppingCart size={18} />
                {addedItems.has(product.id) ? 'Added!' : 'Add to Cart'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}