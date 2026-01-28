"use client";

import { useEffect, useState } from "react";
import VideoPlayer from "@/components/ui/video-player";

const VIDEO_SRC =
  "https://eslwirmmwflkmbfqzxxs.supabase.co/storage/v1/object/public/VSL/test-vsl.mp4";

export default function VideoSection() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <section className="py-16 px-4 bg-white">
      <div className="max-w-4xl mx-auto">
        {/* Video Container with Glow Effect */}
        <div className="relative">
          {/* Purple Glow Effect */}
          <div className="absolute -inset-4 bg-gradient-to-r from-purple-500/20 via-[#1a1240]/30 to-purple-500/20 rounded-3xl blur-2xl" />
          <div className="absolute -inset-2 bg-gradient-to-r from-[#9aed00]/10 via-purple-500/20 to-[#9aed00]/10 rounded-2xl blur-xl" />

          {/* Video Frame */}
          <div className="relative bg-[#1a1240] rounded-2xl p-2 shadow-2xl">
            {isMounted ? (
              <VideoPlayer src={VIDEO_SRC} />
            ) : (
              <div className="aspect-video rounded-xl bg-black" />
            )}
          </div>
        </div>

        {/* Optional caption */}
        <p className="text-center text-gray-500 text-sm mt-6">
          See how Satura helps creators get more views in minutes
        </p>
      </div>
    </section>
  );
}
