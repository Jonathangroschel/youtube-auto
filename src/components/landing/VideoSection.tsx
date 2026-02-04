"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const VideoPlayer = dynamic(() => import("@/components/ui/video-player"), {
  ssr: false,
});

const VIDEO_SRC =
  "https://eslwirmmwflkmbfqzxxs.supabase.co/storage/v1/object/public/VSL/test-vsl.mp4";

export default function VideoSection() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [shouldLoadPlayer, setShouldLoadPlayer] = useState(false);

  useEffect(() => {
    const target = sectionRef.current;
    if (!target || shouldLoadPlayer) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShouldLoadPlayer(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px 0px", threshold: 0.1 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [shouldLoadPlayer]);

  return (
    <section ref={sectionRef} className="py-16 px-4 bg-white">
      <div className="max-w-4xl mx-auto">
        {/* Video Container with Glow Effect */}
        <div className="relative">
          {/* Purple Glow Effect */}
          <div className="absolute -inset-4 bg-gradient-to-r from-purple-500/20 via-[#1a1240]/30 to-purple-500/20 rounded-3xl blur-2xl" />
          <div className="absolute -inset-2 bg-gradient-to-r from-[#9aed00]/10 via-purple-500/20 to-[#9aed00]/10 rounded-2xl blur-xl" />

          {/* Video Frame */}
          <div className="relative bg-[#1a1240] rounded-2xl p-2 shadow-2xl">
            {shouldLoadPlayer ? (
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
