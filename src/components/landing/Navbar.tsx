"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronDown, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <Image
              src="/logo-satura.png"
              alt="Satura Logo"
              width={120}
              height={32}
              className="h-8 w-auto"
            />
          </Link>

          {/* Desktop Navigation (hidden for now) */}
          <div className="hidden items-center space-x-8">
            {/* Features Dropdown */}
            <div className="relative">
              <button
                className="flex items-center text-gray-600 hover:text-gray-900 text-sm font-medium"
                onMouseEnter={() => setFeaturesOpen(true)}
                onMouseLeave={() => setFeaturesOpen(false)}
              >
                Features
                <ChevronDown className="ml-1 h-4 w-4" />
              </button>
              {featuresOpen && (
                <div
                  className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-2"
                  onMouseEnter={() => setFeaturesOpen(true)}
                  onMouseLeave={() => setFeaturesOpen(false)}
                >
                  <Link href="#" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">AI Subtitles</Link>
                  <Link href="#" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">AI Voiceovers</Link>
                  <Link href="#" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Video Editor</Link>
                  <Link href="#" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Background Remover</Link>
                </div>
              )}
            </div>

            {/* Resources Dropdown */}
            <div className="relative">
              <button
                className="flex items-center text-gray-600 hover:text-gray-900 text-sm font-medium"
                onMouseEnter={() => setResourcesOpen(true)}
                onMouseLeave={() => setResourcesOpen(false)}
              >
                Resources
                <ChevronDown className="ml-1 h-4 w-4" />
              </button>
              {resourcesOpen && (
                <div
                  className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-2"
                  onMouseEnter={() => setResourcesOpen(true)}
                  onMouseLeave={() => setResourcesOpen(false)}
                >
                  <Link href="#" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Tutorials</Link>
                  <Link href="#" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Help Center</Link>
                  <Link href="#" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">API Docs</Link>
                </div>
              )}
            </div>

            <Link href="#" className="text-gray-600 hover:text-gray-900 text-sm font-medium">
              Blog
            </Link>
          </div>

          {/* CTA Button */}
          <div className="hidden md:block">
            <Button 
              onClick={() => document.getElementById('waitlist')?.scrollIntoView({ behavior: 'smooth' })}
              className="bg-[#9aed00] hover:bg-[#8ad600] text-[#1a1240] rounded-full px-5 py-2 text-sm font-bold"
            >
              Join Waitlist
            </Button>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6 text-gray-600" />
            ) : (
              <Menu className="h-6 w-6 text-gray-600" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100">
          <div className="px-4 py-4 space-y-3">
            <Button 
              onClick={() => {
                setMobileMenuOpen(false);
                document.getElementById('waitlist')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="w-full bg-[#9aed00] hover:bg-[#8ad600] text-[#1a1240] rounded-full px-5 py-2 text-sm font-bold mt-2"
            >
              Join Waitlist
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
}
