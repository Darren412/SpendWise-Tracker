'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export default function Hero() {
  return (
    <section className="relative bg-gradient-to-r from-sage-100 to-beige-100 py-20 md:py-32 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="z-10">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-4 leading-tight">
              Fresh Organic <span className="text-sage-600">Goodness</span> Delivered Daily
            </h1>
            <p className="text-lg text-gray-700 mb-8">
              Farm-fresh vegetables, fruits, and premium FMCG products sourced directly from trusted farmers in and around Bangalore. Quality you can taste, trust you can feel.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/products" className="btn-primary inline-flex items-center justify-center gap-2">
                Shop Now
                <ArrowRight size={20} />
              </Link>
              <Link href="/about" className="btn-secondary inline-flex items-center justify-center">
                Learn More
              </Link>
            </div>
          </div>

          <div className="relative h-96 hidden md:block">
            <div className="absolute inset-0 bg-gradient-to-br from-sage-300 to-beige-300 rounded-3xl transform rotate-6"></div>
            <div className="absolute inset-0 bg-gradient-to-tr from-beige-200 to-sage-200 rounded-3xl flex items-center justify-center text-6xl font-bold text-sage-600">
              🥬 🍅 🥬
            </div>
          </div>
        </div>
      </div>

      <div className="absolute top-0 right-0 w-96 h-96 bg-sage-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-beige-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
    </section>
  )
}