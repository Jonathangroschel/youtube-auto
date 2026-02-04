import Image from "next/image";
import { Youtube, Twitter } from "lucide-react";

export default function CoFounder() {
  return (
    <section className="py-16 px-4 bg-white">
      <div className="max-w-4xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-bold text-[#1a1240]">
            Meet our Co-Founder
          </h2>
        </div>

        {/* Co-Founder Card */}
        <div className="bg-white border border-gray-100 rounded-2xl p-8 shadow-sm">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
            {/* Left side - Photo with soft background */}
            <div className="flex flex-col items-center md:items-start">
              <div className="relative h-56 w-44 overflow-hidden rounded-2xl border-4 border-purple-100 bg-gradient-to-b from-purple-100 to-purple-200 mb-4">
                <Image
                  src="/deven-photo.png"
                  alt="Deven Seenath"
                  fill
                  sizes="176px"
                  className="object-cover object-top"
                />
              </div>
              <h3 className="text-xl font-bold text-[#1a1240]">Deven Seenath</h3>
              <p className="text-gray-500 text-sm mb-3">Co-Founder of Satura</p>

              {/* Social Links */}
              <div className="flex gap-2">
                <a
                  href="https://www.youtube.com/@DevenSeenath"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  <Youtube className="h-4 w-4 text-gray-600" />
                </a>
                <a
                  href="https://x.com/DevenSeenath"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  <Twitter className="h-4 w-4 text-gray-600" />
                </a>
              </div>
            </div>

            {/* Right side - Quote and Stats */}
            <div className="flex-1">
              <blockquote className="text-2xl md:text-3xl text-gray-700 italic leading-relaxed mb-8">
                &quot;I&apos;ve helped creators generate billions of views. Now I&apos;m building the tool that makes it possible for anyone to do the same.&quot;
              </blockquote>

              {/* Stats */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-[#1a1240] rounded-full px-4 py-2">
                  <Youtube className="h-5 w-5 text-[#9aed00]" />
                  <span className="text-white font-bold text-lg">27B+</span>
                </div>
                <p className="text-gray-600 font-medium">Views Generated On YouTube</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
