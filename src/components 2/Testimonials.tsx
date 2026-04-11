'use client'

import { Star } from 'lucide-react'

const testimonials = [
  {
    id: 1,
    name: 'Priya Sharma',
    role: 'Homemaker',
    image: '👩',
    content: 'The quality of vegetables from Last Club is exceptional! My family loves the freshness and the delivery is always on time.',
    rating: 5,
  },
  {
    id: 2,
    name: 'Rajesh Kumar',
    role: 'Software Engineer',
    image: '👨',
    content: 'Finally found a reliable source for organic products. The prices are fair and the packaging is eco-friendly. Highly recommended!',
    rating: 5,
  },
  {
    id: 3,
    name: 'Anjali Desai',
    role: 'Nutritionist',
    image: '👩‍⚕️',
    content: 'As a health professional, I trust Last Club for providing completely organic and pesticide-free products to my clients.',
    rating: 5,
  },
]

export default function Testimonials() {
  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="section-heading">What Our Customers Say</h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Real reviews from real customers
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial) => (
            <div key={testimonial.id} className="card">
              <div className="flex gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} size={16} className="fill-yellow-400 text-yellow-400" />
                ))}
              </div>

              <p className="text-gray-700 mb-6 italic">
                "{testimonial.content}"
              </p>

              <div className="flex items-center gap-3">
                <span className="text-3xl">{testimonial.image}</span>
                <div>
                  <p className="font-bold text-gray-900">{testimonial.name}</p>
                  <p className="text-sm text-gray-600">{testimonial.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}