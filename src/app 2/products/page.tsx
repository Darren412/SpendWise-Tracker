'use client'

import { ShoppingCart, Star, Filter } from 'lucide-react'
import { useCartStore } from '@/store/cartStore'
import { useState, useMemo } from 'react'

const allProducts = [
  { id: '1', name: 'Organic Tomatoes', price: 45, image: '🍅', category: 'vegetables', rating: 4.8, reviews: 124, description: 'Fresh red tomatoes, ripe and juicy' },
  { id: '2', name: 'Crisp Cucumbers', price: 35, image: '🥒', category: 'vegetables', rating: 4.6, reviews: 89, description: 'Cool and refreshing cucumbers' },
  { id: '3', name: 'Sweet Mangoes', price: 120, image: '🥭', category: 'fruits', rating: 4.9, reviews: 256, description: 'Sweet and succulent mangoes' },
  { id: '4', name: 'Red Apples', price: 80, image: '🍎', category: 'fruits', rating: 4.7, reviews: 178, description: 'Crisp and sweet red apples' },
  { id: '5', name: 'Fresh Broccoli', price: 60, image: '🥦', category: 'vegetables', rating: 4.5, reviews: 95, description: 'Nutritious green broccoli' },
  { id: '6', name: 'Organic Carrots', price: 40, image: '🥕', category: 'vegetables', rating: 4.4, reviews: 67, description: 'Sweet and crunchy carrots' },
  { id: '7', name: 'Bananas', price: 50, image: '🍌', category: 'fruits', rating: 4.7, reviews: 145, description: 'Yellow and creamy bananas' },
  { id: '8', name: 'Spinach', price: 30, image: '🥬', category: 'vegetables', rating: 4.6, reviews: 102, description: 'Fresh leafy spinach' },
  { id: '9', name: 'Orange', price: 60, image: '🍊', category: 'fruits', rating: 4.8, reviews: 198, description: 'Fresh and juicy oranges' },
  { id: '10', name: 'Bell Peppers', price: 50, image: '🫑', category: 'vegetables', rating: 4.5, reviews: 88, description: 'Colorful and crisp bell peppers' },
  { id: '11', name: 'Grapes', price: 90, image: '🍇', category: 'fruits', rating: 4.9, reviews: 212, description: 'Sweet green grapes' },
  { id: '12', name: 'Onions', price: 25, image: '🧅', category: 'vegetables', rating: 4.3, reviews: 76, description: 'Fresh white onions' },
]

const categories = [
  { value: 'all', label: 'All Products' },
  { value: 'vegetables', label: 'Vegetables' },
  { value: 'fruits', label: 'Fruits' },
]

export default function ProductsPage() {
  const addItem = useCartStore((state) => state.addItem)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [sortBy, setSortBy] = useState('popular')

  const filteredProducts = useMemo(() => {
    let filtered = allProducts

    if (selectedCategory !== 'all') {
      filtered = filtered.filter((p) => p.category === selectedCategory)
    }

    if (sortBy === 'price-low') {
      filtered.sort((a, b) => a.price - b.price)
    } else if (sortBy === 'price-high') {
      filtered.sort((a, b) => b.price - a.price)
    } else if (sortBy === 'rating') {
      filtered.sort((a, b) => b.rating - a.rating)
    }

    return filtered
  }, [selectedCategory, sortBy])

  const handleAddToCart = (product: typeof allProducts[0]) => {
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      quantity: 1,
      image: product.image,
      category: product.category,
    })
  }

  return (
    <div className="min-h-screen bg-beige-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Our Products</h1>
          <p className="text-gray-600 text-lg">
            Discover our complete range of fresh organic produce
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-6 h-fit sticky top-24">
              <div className="flex items-center gap-2 mb-6">
                <Filter size={20} className="text-sage-600" />
                <h3 className="font-bold text-lg">Filters</h3>
              </div>

              <div className="mb-8">
                <h4 className="font-bold text-gray-900 mb-4">Category</h4>
                <div className="space-y-2">
                  {categories.map((cat) => (
                    <button
                      key={cat.value}
                      onClick={() => setSelectedCategory(cat.value)}
                      className={`block w-full text-left px-4 py-2 rounded-lg transition-colors ${
                        selectedCategory === cat.value
                          ? 'bg-sage-600 text-white font-medium'
                          : 'bg-beige-100 text-gray-700 hover:bg-beige-200'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-bold text-gray-900 mb-4">Sort By</h4>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-4 py-2 border border-beige-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-600"
                >
                  <option value="popular">Popular</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="rating">Top Rated</option>
                </select>
              </div>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProducts.map((product) => (
                <div key={product.id} className="card group">
                  <div className="h-40 bg-gradient-to-br from-sage-100 to-beige-100 rounded-lg flex items-center justify-center text-6xl mb-4 group-hover:scale-105 transition-transform">
                    {product.image}
                  </div>

                  <h3 className="font-bold text-lg text-gray-900 mb-2">
                    {product.name}
                  </h3>

                  <p className="text-sm text-gray-600 mb-3">
                    {product.description}
                  </p>

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
                    <span className="text-xs text-gray-600">
                      ({product.reviews})
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-sage-600">
                      ₹{product.price}
                    </span>
                    <button
                      onClick={() => handleAddToCart(product)}
                      className="p-2 bg-sage-600 text-white rounded-lg hover:bg-sage-700 transition-colors"
                      title="Add to cart"
                    >
                      <ShoppingCart size={20} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}