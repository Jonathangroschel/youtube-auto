"use client";

import { useState } from "react";
import Image from "next/image";
import { BorderBeam } from "@/components/ui/border-beam";
import { Loader2, Check } from "lucide-react";

const avatarUrls = [
  "/profile-images/1.png",
  "/profile-images/2.png",
  "/profile-images/3.png",
  "/profile-images/4.png",
  "/profile-images/5.png",
];

export default function Hero() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setStatus("error");
      setMessage("Please enter your email");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus("success");
        setMessage("You're on the list! We'll be in touch soon.");
        setEmail("");
      } else {
        setStatus("error");
        setMessage(data.error || "Something went wrong. Please try again.");
      }
    } catch (error) {
      setStatus("error");
      setMessage("Something went wrong. Please try again.");
    }
  };

  return (
    <section id="waitlist" className="pt-32 pb-16 px-4 bg-white">
      <div className="max-w-5xl mx-auto text-center">
        {/* Trust Badge */}
        <div className="inline-flex items-center gap-2 bg-purple-100 border border-purple-200 rounded-full px-4 py-2 mb-8">
          <span className="text-[#1a1240] font-medium text-sm">Built By Creators, For Creators</span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-[#1a1240] leading-tight mb-6">
          #1 Tool for
          <br className="sm:hidden" />{" "}
          <span className="bg-[#9aed00] text-[#1a1240] px-4 py-1 rounded-lg">
            Getting More Views
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-gray-500 text-lg max-w-2xl mx-auto mb-8">
          Satura uses AI to create viral-ready clips, smart subtitles, and polished edits in minutes. You just upload, Satura does the rest.{" "}
          <span
            className="font-bold underline decoration-[#c9a3ff] decoration-2 underline-offset-4 text-[#1a1240]"
            style={{ textShadow: "0 6px 14px rgba(169, 85, 247, 0.35)" }}
          >
            Get Discovered, Get Paid.
          </span>
        </p>

        {/* Email Signup Form */}
        <form onSubmit={handleSubmit} className="max-w-md mx-auto mb-4">
          <div className="relative flex items-center bg-[#1a1240] rounded-full p-1.5">
            <BorderBeam size={100} duration={8} colorFrom="rgba(154, 237, 0, 0.7)" colorTo="rgba(154, 237, 0, 0.3)" />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={status === "loading" || status === "success"}
              className="flex-1 bg-transparent text-white placeholder-gray-400 px-4 py-3 text-sm focus:outline-none relative z-10 disabled:opacity-50"
            />
            <button 
              type="submit"
              disabled={status === "loading" || status === "success"}
              className="bg-[#9aed00] hover:bg-[#8ad600] disabled:bg-[#9aed00]/70 text-[#1a1240] font-bold text-sm px-6 py-3 rounded-full transition-colors relative z-10 flex items-center gap-2"
            >
              {status === "loading" && <Loader2 className="w-4 h-4 animate-spin" />}
              {status === "success" && <Check className="w-4 h-4" />}
              {status === "success" ? "Joined!" : "Join Waitlist"}
            </button>
          </div>
        </form>

        <p className="text-gray-500 text-xs max-w-md mx-auto mb-6">
          By joining, you agree to our{" "}
          <a
            href="/terms-of-service"
            className="underline underline-offset-2 hover:text-gray-700"
          >
            Terms of Service
          </a>{" "}
          and{" "}
          <a
            href="/privacy-policy"
            className="underline underline-offset-2 hover:text-gray-700"
          >
            Privacy Policy
          </a>
          .
        </p>

        {/* Status Message */}
        {message && (
          <p className={`text-sm mb-4 ${status === "success" ? "text-green-600" : "text-red-500"}`}>
            {message}
          </p>
        )}

        {/* Waitlist Social Proof */}
        <div className="flex items-center justify-center gap-3">
          <div className="flex -space-x-3">
            {avatarUrls.map((url, index) => (
              <Image
                key={index}
                src={url}
                alt="User"
                width={32}
                height={32}
                className="rounded-full border-2 border-white"
              />
            ))}
          </div>
          <p className="text-gray-500 text-sm">
            Join <span className="font-semibold text-[#1a1240]">7800+</span> others on the waitlist
          </p>
        </div>
      </div>
    </section>
  );
}
