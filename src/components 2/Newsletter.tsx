'use client'

import { Mail } from 'lucide-react'
import { useState } from 'react'

export default function Newsletter() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (email) {
      setSubmitted(true)
      setEmail('')
      setTimeout(() => setSubmitted(false), 3000)
    }
  }

  return (
    <section className="py-16 md:py-24 bg-gradient-to-r from-sage-600 to-sage-700">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Get Fresh Deals & Updates
        </h2>
        <p className="text-sage-100 text-lg mb-8">
          Subscribe to our newsletter for weekly specials, new products, and organic farming tips.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
          <div className="flex-1 relative">
            <Mail className="absolute left-3 top-3 text-gray-400" size={20} />
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-beige-300"
              required
            />
          </div>
          <button
            type="submit"
            className="px-6 py-3 bg-beige-100 text-sage-600 font-bold rounded-lg hover:bg-white transition-colors cursor-pointer"
          >
            {submitted ? '✓ Subscribed!' : 'Subscribe'}
          </button>
        </form>

        <p className="text-sage-100 text-sm mt-4">
          We respect your privacy. Unsubscribe at any time.
        </p>
      </div>
    </section>
  )
}