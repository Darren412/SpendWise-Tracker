'use client'

import { CheckCircle, Leaf, Users, Truck } from 'lucide-react'

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-beige-50">
      <section className="bg-gradient-to-r from-sage-600 to-sage-700 text-white py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            About Last Club
          </h1>
          <p className="text-lg text-sage-100 max-w-2xl mx-auto">
            Connecting you directly with organic farmers for fresh, healthy, and sustainable food
          </p>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">Our Mission</h2>
              <p className="text-gray-700 mb-4 text-lg leading-relaxed">
                Last Club is dedicated to revolutionizing the way people access organic vegetables, fruits, and FMCG products in Bangalore. We believe that every family deserves access to fresh, pesticide-free, and naturally grown food.
              </p>
              <p className="text-gray-700 text-lg leading-relaxed">
                By working directly with trusted farmers and communities, we eliminate middlemen and ensure you get the freshest produce at fair prices, directly from the source to your doorstep.
              </p>
            </div>
            <div className="text-7xl text-center">🌱</div>
          </div>
        </div>
      </section>

      <section className="bg-white py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-12 text-center">
            Our Core Values
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: Leaf, title: 'Sustainability', description: 'We promote eco-friendly farming practices and sustainable agriculture' },
              { icon: CheckCircle, title: 'Quality', description: 'Every product is carefully selected and verified for freshness and purity' },
              { icon: Users, title: 'Community', description: 'We support local farmers and build a strong community of conscious consumers' },
              { icon: Truck, title: 'Reliability', description: 'Fast and reliable delivery with transparent tracking and excellent service' },
            ].map((value, index) => {
              const Icon = value.icon
              return (
                <div key={index} className="bg-beige-50 rounded-lg p-6 text-center">
                  <Icon className="mx-auto mb-4 text-sage-600" size={40} />
                  <h3 className="font-bold text-lg text-gray-900 mb-2">{value.title}</h3>
                  <p className="text-gray-600">{value.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-12 text-center">
            Why Choose Last Club?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              '🥬 100% Organic - No pesticides, no chemicals, pure natural goodness',
              '👨‍🌾 Direct from Farmers - Fair prices that reward our farming partners',
              '🚚 Free Delivery - Same day or next day delivery across Bangalore',
              '💰 Best Prices - No middlemen means better prices for you',
              '📱 Easy Ordering - Simple, user-friendly app and website',
              '✅ Quality Guarantee - Satisfaction guaranteed or money back',
            ].map((reason, index) => (
              <div key={index} className="flex items-start gap-4 p-6 bg-beige-50 rounded-lg">
                <CheckCircle className="text-sage-600 mt-1 flex-shrink-0" size={24} />
                <p className="text-gray-700 text-lg">{reason}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-sage-50 py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-12 text-center">
            Our Impact
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            {[
              { number: '5000+', label: 'Happy Customers' },
              { number: '50+', label: 'Partner Farmers' },
              { number: '10000+', label: 'Deliveries Monthly' },
            ].map((stat, index) => (
              <div key={index}>
                <p className="text-5xl font-bold text-sage-600 mb-2">{stat.number}</p>
                <p className="text-lg text-gray-700">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-r from-sage-600 to-sage-700 text-white py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Join the Last Club Community</h2>
          <p className="text-lg text-sage-100 mb-8">
            Be part of a movement towards healthier eating and sustainable farming
          </p>
          <button className="bg-beige-100 text-sage-600 px-8 py-3 rounded-lg font-bold hover:bg-white transition-colors">
            Shop Now
          </button>
        </div>
      </section>
    </div>
  )
}