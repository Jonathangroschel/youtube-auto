"use client";

import { ChevronRight, Upload, Type, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

const steps = [
  {
    number: 1,
    title: "Upload your video",
    description: "Use any file, or a YouTube/TikTok link.",
    icon: Upload,
    gradient: "from-blue-50 to-indigo-100",
  },
  {
    number: 2,
    title: "Select Subtitle style",
    description: "Choose from 15+ viral styles.",
    icon: Type,
    gradient: "from-purple-50 to-pink-100",
  },
  {
    number: 3,
    title: "Generate Video",
    description: "Watch it generate a video in seconds.",
    icon: Play,
    gradient: "from-green-50 to-emerald-100",
  },
];

export default function Workflows() {
  return (
    <section className="py-16 px-4 bg-white">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-10">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            Engineer virality to make money
            </h2>
          </div>
          <Button 
            onClick={() => document.getElementById('waitlist')?.scrollIntoView({ behavior: 'smooth' })}
            className="mt-4 md:mt-0 bg-[#9aed00] hover:bg-[#8ad600] text-[#1a1240] rounded-full px-6 py-3 text-sm font-bold w-fit"
          >
            Join Waitlist
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>

        {/* Steps Grid */}
        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((step) => (
            <div
              key={step.number}
              className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Step Illustration */}
              <div className={`relative h-48 bg-gradient-to-br ${step.gradient} flex items-center justify-center`}>
                <div className="w-20 h-20 rounded-2xl bg-white shadow-lg flex items-center justify-center">
                  <step.icon className="w-10 h-10 text-[#1a1240]" />
                </div>
              </div>

              {/* Step Content */}
              <div className="p-5">
                <div className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#9aed00] text-[#1a1240] text-xs font-bold shrink-0">
                    {step.number}
                  </span>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">{step.title}</h3>
                    <p className="text-gray-500 text-sm">{step.description}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
