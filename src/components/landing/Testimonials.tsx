"use client";

import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Image from "next/image";

const testimonials = [
  {
    name: "Lucas",
    avatar: "/profile-images/1.png",
    quote: "Trust Score got me out of view jail. It pointed out the stuff I kept missing and what to fix next.",
  },
  {
    name: "Ethan",
    avatar: "/profile-images/2.png",
    quote: "The workflow tools are just fast. I go from raw footage to finished edits without all the little extra steps.",
  },
  {
    name: "Marcus",
    avatar: "/profile-images/3.png",
    quote: "Short form is easy now. I can knock out a batch of Shorts in no time.",
  },
  {
    name: "Tyler",
    avatar: "/profile-images/4.png",
    quote: "I edit in Satura now and ditched CapCut. It’s quicker and way less annoying.",
  },
  {
    name: "Noah",
    avatar: "/profile-images/5.png",
    quote: "I don’t need five other subscriptions anymore. Everything I use is right here.",
  },
  {
    name: "Jake",
    avatar: "/profile-images/6.png",
    quote: "AutoClip saves me hours every week. I’m making more stuff and spending less time stuck in edits.",
  },
];

export default function Testimonials() {
  return (
    <section className="py-16 px-4 bg-white">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            Satura Creators Have Generated Billions Of Views
            <br />
            Get Access To The Same Tools
          </h2>
        </div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-3 gap-4 mb-10">
          {testimonials.map((testimonial) => (
            <div
              key={testimonial.name}
              className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3 mb-4">
                <Image
                  src={testimonial.avatar}
                  alt={testimonial.name}
                  width={40}
                  height={40}
                  className="rounded-full"
                />
                <span className="font-semibold text-gray-900">{testimonial.name}</span>
              </div>
              <p className="text-gray-600 text-sm leading-relaxed">{testimonial.quote}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="flex justify-center">
          <Button 
            onClick={() => document.getElementById('waitlist')?.scrollIntoView({ behavior: 'smooth' })}
            className="bg-[#9aed00] hover:bg-[#8ad600] text-[#1a1240] rounded-full px-8 py-6 text-base font-bold shadow-lg shadow-green-200"
          >
            Join Waitlist
            <ChevronRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </div>
    </section>
  );
}
