"use client";

import { ChevronRight, ImageIcon, Mic, Video, Download, Eraser, Lightbulb, AudioLines, Music } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  {
    title: "AI Images",
    icon: ImageIcon,
    gradient: "from-orange-50 to-amber-100",
  },
  {
    title: "AI Voiceovers",
    icon: Mic,
    gradient: "from-blue-50 to-cyan-100",
  },
  {
    title: "AI Videos",
    icon: Video,
    gradient: "from-purple-50 to-violet-100",
  },
  {
    title: "Download Social Videos",
    icon: Download,
    gradient: "from-green-50 to-emerald-100",
  },
  {
    title: "Image & Video Background Remover",
    icon: Eraser,
    gradient: "from-pink-50 to-rose-100",
  },
  {
    title: "Brainstorm Content Ideas",
    icon: Lightbulb,
    gradient: "from-yellow-50 to-amber-100",
  },
  {
    title: "Speech Enhancer",
    icon: AudioLines,
    gradient: "from-teal-50 to-cyan-100",
  },
  {
    title: "Vocal Remover",
    icon: Music,
    gradient: "from-indigo-50 to-blue-100",
  },
];

export default function Features() {
  return (
    <section className="py-16 px-4 bg-white">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="mb-10">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            Satura has everything you need to go viral and get paid for it
          </h2>
          <p className="text-gray-500 mb-4">
            From cutting-edge speech enhancement to downloading videos, we&apos;ve got you covered.
          </p>
          <Button 
            onClick={() => document.getElementById('waitlist')?.scrollIntoView({ behavior: 'smooth' })}
            className="bg-[#9aed00] hover:bg-[#8ad600] text-[#1a1240] rounded-full px-6 py-3 text-sm font-bold"
          >
            Join Waitlist
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>

        {/* Features Grid - First Row (3 items) */}
        <div className="grid md:grid-cols-3 gap-4 mb-4">
          {features.slice(0, 3).map((feature) => (
            <div
              key={feature.title}
              className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow p-5"
            >
              <h3 className="font-semibold text-gray-900 mb-4">{feature.title}</h3>
              <div className={`relative h-40 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center`}>
                <div className="w-16 h-16 rounded-2xl bg-white shadow-lg flex items-center justify-center">
                  <feature.icon className="w-8 h-8 text-[#1a1240]" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Features Grid - Second Row (3 items) */}
        <div className="grid md:grid-cols-3 gap-4 mb-4">
          {features.slice(3, 6).map((feature) => (
            <div
              key={feature.title}
              className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow p-5"
            >
              <h3 className="font-semibold text-gray-900 mb-4">{feature.title}</h3>
              <div className={`relative h-40 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center`}>
                <div className="w-16 h-16 rounded-2xl bg-white shadow-lg flex items-center justify-center">
                  <feature.icon className="w-8 h-8 text-[#1a1240]" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Features Grid - Third Row (2 items wide) */}
        <div className="grid md:grid-cols-2 gap-4">
          {features.slice(6, 8).map((feature) => (
            <div
              key={feature.title}
              className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow p-5"
            >
              <h3 className="font-semibold text-gray-900 mb-4">{feature.title}</h3>
              <div className={`relative h-32 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center`}>
                <div className="w-14 h-14 rounded-2xl bg-white shadow-lg flex items-center justify-center">
                  <feature.icon className="w-7 h-7 text-[#1a1240]" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
