"use client";

import Image from "next/image";
import Link from "next/link";
import { Twitter, Instagram, MessageCircle } from "lucide-react";

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
    { label: "Refund policy", href: "/refund-policy" },
    { label: "Terms of service", href: "/terms-of-service" },
    { label: "Privacy policy", href: "/privacy-policy" },
  ],
};

export default function Footer() {
  return (
    <footer className="bg-[#1a1240] text-white">
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
              href="#"
              className="w-10 h-10 bg-[#9aed00] rounded-full flex items-center justify-center hover:bg-[#8ad600] transition-colors"
            >
              <Twitter className="h-5 w-5 text-[#1a1240]" />
            </a>
            <a
              href="#"
              className="w-10 h-10 bg-[#9aed00] rounded-full flex items-center justify-center hover:bg-[#8ad600] transition-colors"
            >
              <Instagram className="h-5 w-5 text-[#1a1240]" />
            </a>
            <a
              href="#"
              className="w-10 h-10 bg-[#9aed00] rounded-full flex items-center justify-center hover:bg-[#8ad600] transition-colors"
            >
              <MessageCircle className="h-5 w-5 text-[#1a1240]" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
