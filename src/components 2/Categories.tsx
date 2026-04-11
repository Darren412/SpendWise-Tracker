'use client'

import Link from 'next/link'

const categories = [
  { id: 1, name: 'Fresh Vegetables', emoji: '🥬', color: 'from-sage-200 to-sage-100' },
  { id: 2, name: 'Fruits', emoji: '🍎', color: 'from-red-200 to-red-100' },
  { id: 3, name: 'Dairy Products', emoji: '🥛', color: 'from-yellow-200 to-yellow-100' },
  { id: 4, name: 'Grains & Pulses', emoji: '🌾', color: 'from-amber-200 to-amber-100' },
  { id: 5, name: 'Spices', emoji: '🌶️', color: 'from-orange-200 to-orange-100' },
  { id: 6, name: 'Beverages', emoji: '☕', color: 'from-amber-100 to-yellow-50' },
]

export default function Categories() {
  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="section-heading">Shop by Category</h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Explore our wide range of organic and fresh products
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          {categories.map((category) => (
            <Link key={category.id} href={`/products?category=${category.name.toLowerCase().replace(/\s+/g, '-')}`}>
              <div className={`h-48 rounded-2xl bg-gradient-to-br ${category.color} p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:shadow-lg transform hover:scale-105 transition-all duration-300 group`}>
                <span className="text-6xl mb-4 group-hover:scale-125 transition-transform">
                  {category.emoji}
                </span>
                <h3 className="font-bold text-gray-900 text-lg">
                  {category.name}
                </h3>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}