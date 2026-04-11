'use client'

import Link from 'next/link'
import { MapPin, Phone, Mail, Facebook, Instagram, Twitter } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-100 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-10 h-10 bg-sage-600 rounded-full flex items-center justify-center">
                <span className="text-white font-bold">LC</span>
              </div>
              <span className="font-bold text-lg">Last Club</span>
            </div>
            <p className="text-gray-400 text-sm">
              Premium organic vegetables, fruits, and FMCG products delivered fresh to your home in Bangalore.
            </p>
          </div>

          <div>
            <h3 className="font-bold mb-4 text-white">Quick Links</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link href="/products" className="hover:text-sage-400 transition-colors">Products</Link></li>
              <li><Link href="/about" className="hover:text-sage-400 transition-colors">About Us</Link></li>
              <li><Link href="/contact" className="hover:text-sage-400 transition-colors">Contact</Link></li>
              <li><Link href="#faq" className="hover:text-sage-400 transition-colors">FAQ</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-bold mb-4 text-white">Policies</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link href="#privacy" className="hover:text-sage-400 transition-colors">Privacy Policy</Link></li>
              <li><Link href="#terms" className="hover:text-sage-400 transition-colors">Terms & Conditions</Link></li>
              <li><Link href="#shipping" className="hover:text-sage-400 transition-colors">Shipping Policy</Link></li>
              <li><Link href="#returns" className="hover:text-sage-400 transition-colors">Returns</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-bold mb-4 text-white">Contact Us</h3>
            <ul className="space-y-3 text-sm text-gray-400">
              <li className="flex items-start space-x-2">
                <MapPin size={16} className="text-sage-400 mt-1 flex-shrink-0" />
                <span>Bangalore, Karnataka, India</span>
              </li>
              <li className="flex items-center space-x-2">
                <Phone size={16} className="text-sage-400" />
                <a href="tel:+919999999999" className="hover:text-sage-400 transition-colors">+91 9999 999 999</a>
              </li>
              <li className="flex items-center space-x-2">
                <Mail size={16} className="text-sage-400" />
                <a href="mailto:info@lastclub.com" className="hover:text-sage-400 transition-colors">info@lastclub.com</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-8 pb-4">
          <div className="flex justify-between items-center">
            <p className="text-gray-400 text-sm">&copy; 2026 Last Club. All rights reserved.</p>
            <div className="flex space-x-4">
              <a href="#facebook" className="text-gray-400 hover:text-sage-400 transition-colors">
                <Facebook size={20} />
              </a>
              <a href="#instagram" className="text-gray-400 hover:text-sage-400 transition-colors">
                <Instagram size={20} />
              </a>
              <a href="#twitter" className="text-gray-400 hover:text-sage-400 transition-colors">
                <Twitter size={20} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}