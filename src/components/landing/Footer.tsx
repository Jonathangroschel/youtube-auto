"use client";

import Image from "next/image";
import Link from "next/link";
import { Twitter, Instagram, Youtube, MessageCircle } from "lucide-react";
import { useState } from "react";

const SUPPORT_EMAIL = "support@saturaai.com";

const footerLinks = {
  workflows: [
    { label: "Classic Split Screen", href: "#" },
    { label: "Vertical Split Screen", href: "#" },
    { label: "Reddit Story Video", href: "#" },
    { label: "Fake Texts Video", href: "#" },
    { label: "Streamer Video", href: "#" },
  ],
  aiTools: [
    { label: "Voiceover Generator", href: "#" },
    { label: "Image Generator", href: "#" },
    { label: "Video Generator (VEO3)", href: "#" },
    { label: "Vocal Remover", href: "#" },
    { label: "Video & Image Background Remover", href: "#" },
  ],
  legal: [
    { label: "Refund Policy", href: "/refund-policy" },
    { label: "Terms of Service", href: "/terms-of-service" },
    { label: "Privacy Policy", href: "/privacy-policy" },
  ],
};

export default function Footer() {
  const [showToast, setShowToast] = useState(false);

  const copyEmail = () => {
    navigator.clipboard.writeText(SUPPORT_EMAIL);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  return (
    <footer className="bg-[#1a1240] text-white relative">
      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Footer Links Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-8 mb-12">
          {/* Workflows */}
          <div>
            <h4 className="font-semibold mb-4">Workflows</h4>
            <ul className="space-y-2">
              {footerLinks.workflows.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-purple-200 hover:text-white text-sm transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* AI Tools */}
          <div>
            <h4 className="font-semibold mb-4">AI Tools</h4>
            <ul className="space-y-2">
              {footerLinks.aiTools.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-purple-200 hover:text-white text-sm transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold mb-4">Legal</h4>
            <ul className="space-y-2">
              {footerLinks.legal.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-purple-200 hover:text-white text-sm transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer Bottom */}
        <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-purple-400/30">
          {/* Logo */}
          <div className="mb-4 md:mb-0">
            <Image
              src="/satura-logo-white.png"
              alt="Satura Logo"
              width={120}
              height={32}
              className="h-8 w-auto"
            />
          </div>

          {/* Social Links */}
          <div className="flex gap-3">
            <a
              href="https://x.com/Satura_AI"
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 bg-[#9aed00] rounded-full flex items-center justify-center hover:bg-[#8ad600] transition-colors"
            >
              <Twitter className="h-5 w-5 text-[#1a1240]" />
            </a>
            <a
              href="https://www.instagram.com/saturaai"
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 bg-[#9aed00] rounded-full flex items-center justify-center hover:bg-[#8ad600] transition-colors"
            >
              <Instagram className="h-5 w-5 text-[#1a1240]" />
            </a>
            <a
              href="https://www.youtube.com/@SaturaAI"
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 bg-[#9aed00] rounded-full flex items-center justify-center hover:bg-[#8ad600] transition-colors"
            >
              <Youtube className="h-5 w-5 text-[#1a1240]" />
            </a>
            <button
              onClick={copyEmail}
              className="w-10 h-10 bg-[#9aed00] rounded-full flex items-center justify-center hover:bg-[#8ad600] transition-colors"
            >
              <MessageCircle className="h-5 w-5 text-[#1a1240]" />
            </button>
          </div>
        </div>
      </div>

      {/* Toast notification */}
      <div
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${
          showToast ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
        }`}
      >
        <div className="bg-gray-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2">
          <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Email copied
        </div>
      </div>
    </footer>
  );
}
