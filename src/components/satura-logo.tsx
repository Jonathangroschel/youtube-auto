"use client";

import Link from "next/link";
import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

type SaturaLogoProps = {
  href?: string;
  size?: "sm" | "md" | "lg" | "login";
  className?: string;
  asDiv?: boolean;
};

export const SaturaLogo = ({ href = "/dashboard", size = "md", className = "", asDiv = false }: SaturaLogoProps) => {
  const containerRef = useRef<HTMLElement>(null);
  const [glowIntensity, setGlowIntensity] = useState(0);

  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const node = containerRef.current;
    if (!node) {
      return;
    }

    const rect = node.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const distance = Math.hypot(event.clientX - centerX, event.clientY - centerY);
    const maxDistance = 120;
    const intensity = Math.max(0, 1 - distance / maxDistance);
    setGlowIntensity(intensity);
  };

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
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setGlowIntensity(0)}
      >
        <img src="/icon-2.svg" alt="Satura" className={config.image} style={{ ...glowStyle, transition: "filter 150ms" }} />
      </div>
    );
  }

  return (
    <Link
      ref={containerRef as React.RefObject<HTMLAnchorElement>}
      className={`flex items-center justify-center rounded-2xl ${config.container} ${className}`}
      href={href}
      aria-label="Dashboard"
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setGlowIntensity(0)}
    >
      <img src="/icon-2.svg" alt="Satura" className={config.image} style={{ ...glowStyle, transition: "filter 150ms" }} />
    </Link>
  );
};

export default SaturaLogo;
