"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, TrendingUp, Eye, Share2, Calendar, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BorderBeam } from "@/components/ui/border-beam";
import GaugeDefault from "@/registry/default/example/gauge/gauge-default";

const insights = [
  {
    icon: Eye,
    title: "Swipe Ratio",
    description: "See what percentage of viewers watch past your hook vs swipe away in the first second",
  },
  {
    icon: Share2,
    title: "Share Rate",
    description: "Track how often your content gets shared — the strongest signal YouTube uses to push videos",
  },
  {
    icon: Calendar,
    title: "Upload Consistency",
    description: "Measure your posting frequency and identify gaps that hurt your algorithmic momentum",
  },
];

const benefits = [
  "Identify exactly why your videos aren't getting pushed",
  "Get plain-English fixes you can apply today",
  "Track improvements across every metric over time",
  "We analyze 20+ signals that determine your Trustscore",
  "Even small Trustscore gains will multiply your views",
];

export default function TrustScore() {
  const gaugeRef = useRef<HTMLDivElement | null>(null);
  const [gaugeActive, setGaugeActive] = useState(false);

  useEffect(() => {
    const target = gaugeRef.current;
    if (!target || gaugeActive) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setGaugeActive(true);
          observer.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [gaugeActive]);

  return (
    <section className="py-24 px-4 bg-gradient-to-b from-white via-gray-50/50 to-white overflow-hidden">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-2 bg-[#1a1240] text-white rounded-full px-5 py-2.5 mb-8 shadow-lg shadow-[#1a1240]/10">
            <TrendingUp className="w-4 h-4 text-[#9aed00]" />
            <span className="font-medium text-sm tracking-wide">Trustscore Analytics</span>
          </div>
          
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-[#1a1240] leading-tight mb-6">
            We&apos;ve Cracked The YouTube Algo,
            <br className="hidden sm:block" />
            {" "}So You Don&apos;t Have To.
          </h2>
          
          <p className="text-gray-500 text-lg max-w-2xl mx-auto leading-relaxed">
            After{" "}
            <span className="font-semibold text-[#1a1240]">10,000+ hours</span>{" "}
            dissecting what makes channels blow up, we built Trustscore — the only tool that shows you exactly what&apos;s stopping your videos from going viral.
          </p>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Side - Score Card Mockup */}
          <div className="relative flex justify-center lg:justify-start">
            {/* Ambient glow */}
            <div className="absolute -inset-4 bg-gradient-to-br from-[#9aed00]/20 via-[#1a1240]/5 to-transparent rounded-[2.5rem] blur-2xl opacity-60" />
            
            <div className="relative w-full max-w-md">
              {/* Card */}
              <div className="relative bg-[#1a1240] rounded-[2rem] p-8 shadow-2xl shadow-[#1a1240]/30 overflow-hidden">
                <BorderBeam size={200} duration={12} colorFrom="rgba(154, 237, 0, 0.6)" colorTo="rgba(154, 237, 0, 0.1)" />
                
                {/* Score Display */}
                <div className="relative z-10 text-center mb-10">
                  <p className="text-gray-400 text-sm font-medium mb-4 tracking-wide uppercase">Channel Trustscore</p>
                  <div className="relative inline-flex items-center justify-center mb-4">
                    <div ref={gaugeRef} className="absolute w-36 h-36">
                      {gaugeActive ? <GaugeDefault /> : null}
                    </div>
                    {/* Score circle */}
                    <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-[#9aed00]/20 to-transparent p-1">
                      <div className="w-full h-full rounded-full bg-[#1a1240] flex items-center justify-center shadow-inner">
                        <span className="text-5xl font-bold text-white tracking-tight">62</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-[#9aed00] font-semibold text-sm tracking-wide">Room for Growth</p>
                </div>

                {/* Metrics */}
                <div className="relative z-10 space-y-3">
                  <div className="flex items-center justify-between bg-white/[0.04] backdrop-blur-sm rounded-2xl px-5 py-4 border border-white/[0.06]">
                    <span className="text-white/90 text-sm font-medium">Swipe Ratio</span>
                    <span className="text-[#9aed00] font-bold text-lg">72%</span>
                  </div>
                  
                  <div className="flex items-center justify-between bg-white/[0.04] backdrop-blur-sm rounded-2xl px-5 py-4 border border-white/[0.06]">
                    <span className="text-white/90 text-sm font-medium">Share Rate</span>
                    <span className="text-[#9aed00] font-bold text-lg">0.12%</span>
                  </div>
                  
                  <div className="flex items-center justify-between bg-white/[0.04] backdrop-blur-sm rounded-2xl px-5 py-4 border border-white/[0.06]">
                    <span className="text-white/90 text-sm font-medium">Upload Consistency</span>
                    <span className="text-amber-400 font-bold text-lg">4/6</span>
                  </div>
                  
                  <div className="flex items-center justify-between bg-white/[0.04] backdrop-blur-sm rounded-2xl px-5 py-4 border border-white/[0.06]">
                    <span className="text-white/90 text-sm font-medium">Retention Score</span>
                    <span className="text-rose-400 font-bold text-sm">Needs Work</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Benefits */}
          <div className="space-y-8">
            {/* Insight Cards */}
            <div className="space-y-4">
              {insights.map((insight) => (
                <div
                  key={insight.title}
                  className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-lg hover:shadow-gray-100/50 transition-all duration-300 hover:border-[#9aed00]/20 group"
                >
                  <div className="flex items-start gap-5">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#9aed00]/20 to-[#9aed00]/5 flex items-center justify-center shrink-0 group-hover:from-[#9aed00]/30 group-hover:to-[#9aed00]/10 transition-all duration-300">
                      <insight.icon className="w-5 h-5 text-[#1a1240]" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[#1a1240] mb-1.5">{insight.title}</h3>
                      <p className="text-gray-500 text-sm leading-relaxed">{insight.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Benefits List */}
            <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-2xl p-7 border border-gray-100">
              <h4 className="font-semibold text-[#1a1240] mb-5">What you&apos;ll discover:</h4>
              <ul className="space-y-4">
                {benefits.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-[#9aed00] shrink-0 mt-0.5" />
                    <span className="text-gray-600 text-sm leading-relaxed">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* CTA */}
            <Button
              onClick={() => document.getElementById('waitlist')?.scrollIntoView({ behavior: 'smooth' })}
              className="w-full sm:w-auto bg-[#9aed00] hover:bg-[#8ad600] text-[#1a1240] rounded-full px-10 py-6 text-base font-bold shadow-xl shadow-[#9aed00]/25 hover:shadow-[#9aed00]/40 transition-all duration-300"
            >
              Get Your Trustscore
              <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
