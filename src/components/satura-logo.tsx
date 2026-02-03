"use client";

import { useEffect, useRef, useState } from "react";

type SaturaLogoProps = {
  href?: string;
  size?: "sm" | "md" | "lg" | "login";
  className?: string;
  asDiv?: boolean;
};

export const SaturaLogo = ({ href = "/dashboard", size = "md", className = "", asDiv = false }: SaturaLogoProps) => {
  const containerRef = useRef<HTMLElement>(null);
  const [glowIntensity, setGlowIntensity] = useState(0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const distance = Math.sqrt(
        Math.pow(e.clientX - centerX, 2) + Math.pow(e.clientY - centerY, 2)
      );

      // Max distance at which glow starts (150px), fully intense at 0px
      const maxDistance = 150;
      const intensity = Math.max(0, 1 - distance / maxDistance);
      setGlowIntensity(intensity);
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const sizeConfig = {
    sm: {
      container: "h-10 w-10",
      image: "h-6 w-6 scale-[1.5] origin-center",
    },
    md: {
      container: "h-12 w-12",
      image: "h-7 w-7 scale-[1.5] origin-center",
    },
    lg: {
      container: "h-10 w-10",
      image: "h-9 w-9 ml-[-2px]",
    },
    login: {
      container: "h-12 w-12",
      image: "h-12 w-12",
    },
  };

  const config = sizeConfig[size];

  const glowStyle = {
    filter:
      glowIntensity > 0
        ? `drop-shadow(0 0 ${12 * glowIntensity}px rgba(168, 85, 247, ${0.7 * glowIntensity}))`
        : "none",
  };

  if (asDiv) {
    return (
      <div
        ref={containerRef as React.RefObject<HTMLDivElement>}
        className={`flex items-center justify-center rounded-2xl ${config.container} ${className}`}
      >
        <img src="/icon-2.svg" alt="Satura" className={config.image} style={{ ...glowStyle, transition: "filter 150ms" }} />
      </div>
    );
  }

  return (
    <a
      ref={containerRef as React.RefObject<HTMLAnchorElement>}
      className={`flex items-center justify-center rounded-2xl ${config.container} ${className}`}
      href={href}
      aria-label="Dashboard"
    >
      <img src="/icon-2.svg" alt="Satura" className={config.image} style={{ ...glowStyle, transition: "filter 150ms" }} />
    </a>
  );
};

export default SaturaLogo;
