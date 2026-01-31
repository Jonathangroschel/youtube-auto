"use client";

import SearchOverlay from "@/components/search-overlay";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { signOut } from "@/app/login/actions";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

type NavItem = {
  label: string;
  href: string;
  icon: ReactNode;
  active?: boolean;
};

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    active: true,
    href: "/dashboard",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5 text-[#335CFF]"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
        <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      </svg>
    ),
  },
  {
    label: "Projects",
    href: "/projects",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5 text-gray-500"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
      </svg>
    ),
  },
  {
    label: "Assets",
    href: "/assets",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5 text-gray-500"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M15 2a2 2 0 0 1 1.414.586l4 4A2 2 0 0 1 21 8v7a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
        <path d="M15 2v4a2 2 0 0 0 2 2h4" />
        <path d="M5 7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8a2 2 0 0 0 1.732-1" />
      </svg>
    ),
  },
  {
    label: "Tools",
    href: "/tools",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5 text-gray-500"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72" />
        <path d="m14 7 3 3" />
        <path d="M5 6v4" />
        <path d="M19 14v4" />
        <path d="M10 2v2" />
        <path d="M7 8H3" />
        <path d="M21 16h-4" />
        <path d="M11 3H9" />
      </svg>
    ),
  },
  {
    label: "AutoClip",
    href: "/tools/autoclip",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5 text-gray-500"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" />
        <path d="M20 2v4" />
        <path d="M22 4h-4" />
        <circle cx="4" cy="20" r="2" />
      </svg>
    ),
  },
  {
    label: "Trust Score",
    href: "/tools/trust-score",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5 text-gray-500"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 3l7 4v6c0 5-3.5 7.5-7 8-3.5-.5-7-3-7-8V7l7-4z" />
        <path d="M9.5 12.5 11 14l3.5-3.5" />
      </svg>
    ),
  },
];

type MainAction = {
  title: string;
  subtitle: string;
  tone: "primary" | "neutral";
  icon: ReactNode;
  href?: string;
  highlight?: string;
  suffix?: string;
};

const mainActions: MainAction[] = [
  {
    title: "Create new project in editor",
    subtitle: "Start from scratch now",
    tone: "primary",
    href: "/editor/advanced?new=1",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 512 512"
        className="h-5 w-5 text-white"
        fill="currentColor"
      >
        <path d="M194.82 496a18.36 18.36 0 0 1-18.1-21.53v-.11L204.83 320H96a16 16 0 0 1-12.44-26.06L302.73 23a18.45 18.45 0 0 1 32.8 13.71c0 .3-.08.59-.13.89L307.19 192H416a16 16 0 0 1 12.44 26.06L209.24 489a18.45 18.45 0 0 1-14.42 7z" />
      </svg>
    ),
  },
  {
    title: "Try our",
    highlight: "FREE",
    suffix: "Tools",
    subtitle: "Audio balancer, video compressor, and more",
    tone: "neutral",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 256 256"
        className="h-5 w-5 text-white"
        fill="currentColor"
      >
        <path d="M235.24 84.38 207.18 108l8.56 35.39a13.34 13.34 0 0 1-5.09 13.91 13.54 13.54 0 0 1-15 .69L164 139l-31.65 19.06a13.51 13.51 0 0 1-15-.69 13.32 13.32 0 0 1-5.1-13.91L120.81 108 92.76 84.38a13.39 13.39 0 0 1 7.66-23.58l36.94-2.92 14.21-33.66a13.51 13.51 0 0 1 24.86 0l14.21 33.66 36.94 2.92a13.39 13.39 0 0 1 7.66 23.58Z" />
        <path d="M88.11 111.89a8 8 0 0 0-11.32 0L18.34 170.34a8 8 0 0 0 11.32 11.32l58.45-58.45a8 8 0 0 0 0-11.32Z" />
        <path d="M87.61 173.08 34.34 226.34a8 8 0 0 0 11.32 11.32l53.26-53.27a8 8 0 0 0-11.31-11.31Z" />
        <path d="M160.62 172.08 106.33 226.36a8 8 0 0 0 11.32 11.32L172 183.4a8 8 0 1 0-11.31-11.32Z" />
      </svg>
    ),
  },
];

type Feature = {
  title: string;
  description: string;
};

const primaryFeatures: Feature[] = [
  {
    title: "AutoClip",
    description: "Transform long videos into viral clips automatically",
  },
  {
    title: "Quick Subtitles",
    description: "Add viral-ready subtitles to your videos in seconds",
  },
];

const secondaryFeatures: Feature[] = [
  {
    title: "Split Screen",
    description: "Classic tested and trusted split screen background",
  },
  {
    title: "Reddit Videos",
    description: "Generate viral Reddit story videos with AI in seconds",
  },
  {
    title: "Streamer Blur",
    description: "Format your video with our streamer blur template",
  },
];

const secondaryFeatureHrefByTitle: Record<string, string> = {
  "Split Screen": "/create/split-video",
  "Reddit Videos": "/create/reddit-videos",
  "Streamer Blur": "/create/streamer-video",
};

type ToolCard = {
  label: string;
  href: string;
  icon: ReactNode;
};

const toolCards: ToolCard[] = [
  {
    label: "Image Generator",
    href: "/tools/images",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5 text-[#122368]"
        fill="currentColor"
      >
        <path fill="none" d="M0 0h24v24H0z" />
        <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zm-12.5-5.5L11 16.5 14.5 12l4.5 6H5l3.5-4.5z" />
      </svg>
    ),
  },
  {
    label: "Speech Enhancer",
    href: "/tools/enhance-speech",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5 text-[#122368]"
        fill="currentColor"
      >
        <path fill="none" d="M0 0h24v24H0z" />
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm2 11h-3v3.75A2.25 2.25 0 0 1 10.75 19 2.25 2.25 0 0 1 8.5 16.75a2.25 2.25 0 0 1 2.25-2.25c.46 0 .89.14 1.25.38V11h4v2zm-3-4V3.5L18.5 9H13z" />
      </svg>
    ),
  },
  {
    label: "Voiceover Generator",
    href: "/tools/voiceovers",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5 text-[#122368]"
        fill="currentColor"
      >
        <path fill="none" d="M0 0h24v24H0z" />
        <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.49 6-3.31 6-6.72h-1.7z" />
      </svg>
    ),
  },
  {
    label: "Background Remover",
    href: "/tools/remove-bg",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5 text-[#122368]"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 9v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7" />
        <line x1="16" x2="22" y1="5" y2="5" />
        <circle cx="9" cy="9" r="2" />
        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
      </svg>
    ),
  },
  {
    label: "VEO3 Generator",
    href: "/tools/veo3",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5 text-[#122368]"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z" />
        <path d="m6.2 5.3 3.1 3.9" />
        <path d="m12.4 3.4 3.1 4" />
        <path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
      </svg>
    ),
  },
  {
    label: "YouTube Downloader",
    href: "/editor/advanced?new=1",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 576 512"
        className="h-5 w-5 text-[#122368]"
        fill="currentColor"
      >
        <path d="M549.655 124.083c-6.281-23.65-24.787-42.276-48.284-48.597C458.781 64 288 64 288 64S117.22 64 74.629 75.486c-23.497 6.322-42.003 24.947-48.284 48.597-11.412 42.867-11.412 132.305-11.412 132.305s0 89.438 11.412 132.305c6.281 23.65 24.787 41.5 48.284 47.821C117.22 448 288 448 288 448s170.78 0 213.371-11.486c23.497-6.321 42.003-24.171 48.284-47.821 11.412-42.867 11.412-132.305 11.412-132.305s0-89.438-11.412-132.305zm-317.51 213.508V175.185l142.739 81.205-142.739 81.201z" />
      </svg>
    ),
  },
];

type MobileSection = {
  label: string;
  items: { label: string; href: string }[];
  icon?: ReactNode;
  defaultOpen?: boolean;
};

const mobileSections: MobileSection[] = [
  {
    label: "Dashboard",
    defaultOpen: true,
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-4 w-4 text-gray-600"
        fill="currentColor"
      >
        <path fill="none" d="M0 0h24v24H0V0z" />
        <path d="M19 5v2h-4V5h4M9 5v6H5V5h4m10 8v6h-4v-6h4M9 17v2H5v-2h4M21 3h-8v6h8V3zM11 3H3v10h8V3zm10 8h-8v10h8V11zm-10 4H3v6h8v-6z" />
      </svg>
    ),
    items: [
      { label: "Home", href: "/dashboard" },
      { label: "My Projects", href: "/projects" },
      { label: "My Assets", href: "/assets" },
    ],
  },
  {
    label: "Quick Edit",
    items: [
      { label: "Reddit Video", href: "/create/reddit-video" },
      { label: "Split Video", href: "/create/split-video" },
      { label: "Streamer Video", href: "/create/streamer-video" },
      { label: "Quick Subtitles", href: "/create/subtitles" },
    ],
  },
  {
    label: "Tools",
    items: [
      { label: "Editor", href: "/tools" },
      { label: "AutoClip", href: "/tools/autoclip" },
    ],
  },
  {
    label: "Trust Score",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-4 w-4 text-gray-600"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 3l7 4v6c0 5-3.5 7.5-7 8-3.5-.5-7-3-7-8V7l7-4z" />
        <path d="M9.5 12.5 11 14l3.5-3.5" />
      </svg>
    ),
    items: [{ label: "Overview", href: "/tools/trust-score" }],
  },
  {
    label: "More",
    items: [
      { label: "24/7 Support", href: "/support" },
    ],
  },
];

type MobileFooterAction = {
  label: string;
  href: string;
  tone: "neutral" | "danger";
};

const mobileFooterActions: MobileFooterAction[] = [
  { label: "Upgrade", href: "/upgrade", tone: "neutral" },
  { label: "Settings", href: "/settings", tone: "neutral" },
  { label: "Log Out", href: "/logout", tone: "danger" },
];

export default function DashboardPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    () =>
      Object.fromEntries(
        mobileSections.map((section) => [
          section.label,
          section.defaultOpen ?? false,
        ])
      )
  );
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [hoveredNavIndex, setHoveredNavIndex] = useState<number | null>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<{
    top: number;
    height: number;
    opacity: number;
  }>({
    top: 0,
    height: 0,
    opacity: 0,
  });
  const [indicatorReady, setIndicatorReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const navContainerRef = useRef<HTMLDivElement | null>(null);
  const navItemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const activeNavIndex = navItems.findIndex((item) => item.active);
  const resolvedNavIndex =
    hoveredNavIndex ?? (activeNavIndex >= 0 ? activeNavIndex : 0);

  // Fetch user on mount
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
  }, []);

  const handleSignOut = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
    } catch {
      setIsLoggingOut(false);
    }
  };

  // Get user display info
  const userEmail = user?.email ?? "";
  const userName = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? userEmail.split("@")[0] ?? "User";
  const userAvatar = user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture ?? null;
  const userInitials = userName.slice(0, 2).toUpperCase();

  const updateIndicator = useCallback((index: number) => {
    const container = navContainerRef.current;
    const item = navItemRefs.current[index];
    if (!container || !item) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    setIndicatorStyle({
      top: itemRect.top - containerRect.top,
      height: itemRect.height,
      opacity: 1,
    });
  }, []);

  const toggleSection = (label: string) => {
    setOpenSections((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  useEffect(() => {
    if (!profileMenuOpen) {
      return;
    }

    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && profileMenuRef.current?.contains(target)) {
        return;
      }
      setProfileMenuOpen(false);
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [profileMenuOpen]);

  useEffect(() => {
    if (resolvedNavIndex == null || resolvedNavIndex < 0) {
      return;
    }
    updateIndicator(resolvedNavIndex);
    if (!indicatorReady) {
      const frame = requestAnimationFrame(() => setIndicatorReady(true));
      return () => cancelAnimationFrame(frame);
    }
  }, [resolvedNavIndex, updateIndicator, indicatorReady]);

  useEffect(() => {
    const handleResize = () => {
      if (resolvedNavIndex == null || resolvedNavIndex < 0) {
        return;
      }
      updateIndicator(resolvedNavIndex);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [resolvedNavIndex, updateIndicator]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#F6F8FC] font-sans text-[#0E121B]">
      <div className="mx-auto flex w-full md:max-w-[90rem]">
        <aside className="sticky top-0 hidden min-h-screen w-24 flex-col items-center border-r border-gray-200 bg-white py-3 md:flex">
          <div
            ref={navContainerRef}
            className="relative flex w-full flex-1 flex-col items-center gap-4"
          >
            <div
              className="pointer-events-none absolute left-0 top-0 w-1.5 rounded-r-lg bg-[#335CFF] transition-[transform,height,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{
                transform: `translateY(${indicatorStyle.top}px)`,
                height: `${indicatorStyle.height}px`,
                opacity: indicatorStyle.opacity,
                transition: indicatorReady ? undefined : "none",
              }}
            />
            <a
              className="flex h-12 w-12 items-center justify-center rounded-2xl"
              href="/dashboard"
              aria-label="Dashboard"
            >
              <img
                src="/icon.svg"
                alt="Youtube Auto"
                className="h-7 w-7 scale-[1.5] origin-center"
              />
            </a>
            <div className="h-px w-10 bg-gray-200" />
            <nav
              className="flex flex-col gap-2"
              onMouseLeave={() => setHoveredNavIndex(null)}
            >
              {navItems.map((item, index) => (
                <a
                  key={item.label}
                  href={item.href}
                  ref={(element) => {
                    navItemRefs.current[index] = element;
                  }}
                  className={`flex h-11 w-11 items-center justify-center rounded-lg transition-colors ${
                    item.active ? "bg-[#EEF2FF]" : "hover:bg-gray-100"
                  }`}
                  aria-label={item.label}
                  onMouseEnter={() => setHoveredNavIndex(index)}
                >
                  {item.icon}
                </a>
              ))}
            </nav>
            <div className="mt-auto pb-6">
              <button
                className="group flex h-12 w-12 flex-col items-center justify-center rounded-xl border border-transparent transition-colors hover:border-gray-200 hover:bg-gray-100 xl:h-14 xl:w-14"
                type="button"
                aria-label="Search"
                onClick={() => setSearchOpen(true)}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-5 w-5 text-gray-400 group-hover:text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                <span className="text-[10px] font-medium text-gray-400 group-hover:text-gray-600">
                  Cmd+K
                </span>
              </button>
            </div>
          </div>
        </aside>

        <main className="flex min-h-[100dvh] w-full flex-1 flex-col px-4 pb-16 pt-3 md:px-10 md:py-6">
          <div className="sticky top-0 z-20 -mx-4 flex items-center justify-between bg-[#F6F8FC]/80 px-4 py-3 backdrop-blur-xl md:hidden">
            <a
              className="flex h-10 w-10 items-center justify-center rounded-2xl"
              href="/dashboard"
              aria-label="Dashboard"
            >
              <img
                src="/icon.svg"
                alt="Youtube Auto"
                className="h-6 w-6 scale-[1.5] origin-center"
              />
            </a>
            <button
              className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white transition-colors hover:bg-gray-50"
              type="button"
              aria-label="Open menu"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-4 w-4 text-gray-700"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 6h16" />
                <path d="M4 12h16" />
                <path d="M4 18h16" />
              </svg>
            </button>
          </div>

          <div
            className={`fixed inset-0 z-40 md:hidden ${
              mobileMenuOpen ? "" : "pointer-events-none"
            }`}
          >
            <div
              className={`absolute inset-0 bg-black/20 transition-opacity ${
                mobileMenuOpen ? "opacity-100" : "opacity-0"
              }`}
              onClick={() => setMobileMenuOpen(false)}
            />
            <div
              className={`absolute left-0 top-0 h-full w-[82%] max-w-xs bg-white shadow-xl transition-transform ${
                mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
              }`}
            >
              <div className="p-3">
                <div className="flex items-center space-x-3">
                  {userAvatar ? (
                    <img
                      src={userAvatar}
                      alt="Profile"
                      className="h-10 w-10 rounded-full object-cover"
                      draggable="false"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-sm font-semibold text-white">
                      {userInitials}
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {userName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {userEmail}
                    </p>
                  </div>
                </div>
              </div>

              <div className="py-1">
                {mobileSections.map((section) => {
                  const sectionId = section.label
                    .toLowerCase()
                    .replace(/\s+/g, "-");
                  const isOpen = openSections[section.label];

                  return (
                    <div
                      key={section.label}
                      className="border-b border-gray-100 last:border-0"
                    >
                      <button
                        className="flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-gray-50 focus:outline-none"
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls={`section-${sectionId}`}
                        onClick={() => toggleSection(section.label)}
                      >
                        <div className="flex items-center space-x-2">
                          {section.icon}
                          <span className="text-sm font-medium text-gray-900">
                            {section.label}
                          </span>
                        </div>
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${
                            isOpen ? "rotate-90" : ""
                          }`}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                      </button>
                      <div
                        id={`section-${sectionId}`}
                        className={`overflow-hidden transition-all duration-200 ease-in-out ${
                          isOpen ? "max-h-96" : "max-h-0"
                        }`}
                      >
                        <div className="py-1">
                          {section.items.map((item) => (
                            <a
                              key={item.label}
                              href={item.href}
                              className="flex w-full items-center px-10 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none"
                              onClick={() => setMobileMenuOpen(false)}
                            >
                              {item.label}
                            </a>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-2">
                {mobileFooterActions.map((action) =>
                  action.label === "Log Out" ? (
                    <button
                      key={action.label}
                      className="mb-1 block w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                      onClick={handleSignOut}
                      disabled={isLoggingOut}
                    >
                      {isLoggingOut ? "Logging out..." : action.label}
                    </button>
                  ) : (
                    <a
                      key={action.label}
                      href={action.href}
                      className={`mb-1 block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                        action.tone === "danger"
                          ? "text-red-600 hover:bg-red-50"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {action.label}
                    </a>
                  )
                )}
              </div>
            </div>
          </div>

          <div className="sticky top-0 z-20 hidden items-center justify-between bg-[#F6F8FC]/95 py-3 backdrop-blur-xl md:flex">
            <p className="text-lg font-semibold text-black">
              Welcome back, {userName.split(" ")[0]} 👋
            </p>
            <div className="relative" ref={profileMenuRef}>
              <button
                className="flex h-10 w-auto items-center space-x-3 rounded-full border border-gray-300 bg-white p-1 px-2 hover:bg-gray-100 focus:outline-none"
                type="button"
                aria-haspopup="menu"
                aria-expanded={profileMenuOpen}
                aria-controls="dashboard-profile-menu"
                onClick={() => setProfileMenuOpen((open) => !open)}
              >
                {userAvatar ? (
                  <img
                    src={userAvatar}
                    alt="Profile"
                    className="h-6 w-6 select-none rounded-full object-cover md:h-8 md:w-8"
                    draggable="false"
                  />
                ) : (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-xs font-semibold text-white md:h-8 md:w-8 md:text-sm">
                    {userInitials}
                  </div>
                )}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-4 w-4 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              <div
                id="dashboard-profile-menu"
                className={`absolute right-0 top-full z-30 mt-2 w-64 rounded-lg border border-gray-200 bg-white shadow-md transition-all duration-150 ${
                  profileMenuOpen
                    ? "pointer-events-auto translate-y-0 opacity-100"
                    : "pointer-events-none translate-y-1 opacity-0"
                }`}
              >
                <div className="flex flex-row items-center space-x-2 px-3 py-2">
                  {userAvatar ? (
                    <img
                      src={userAvatar}
                      alt="Profile"
                      className="h-6 w-6 select-none rounded-full object-cover md:h-8 md:w-8"
                      draggable="false"
                    />
                  ) : (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-xs font-semibold text-white md:h-8 md:w-8 md:text-sm">
                      {userInitials}
                    </div>
                  )}
                  <div className="flex flex-col items-start justify-start">
                    <p className="text-base font-medium">{userName}</p>
                    <p className="text-xs text-gray-500">
                      {userEmail}
                    </p>
                  </div>
                </div>
                <button
                  className="block w-full px-3 py-1.5 text-left text-xs font-normal text-gray-800 hover:bg-gray-100 sm:px-3 sm:py-2 sm:text-sm"
                  type="button"
                  onClick={() => setProfileMenuOpen(false)}
                >
                  Settings
                </button>
                <button
                  className="block w-full px-3 py-1.5 text-left text-xs font-normal text-gray-800 hover:bg-gray-100 sm:px-3 sm:py-2 sm:text-sm"
                  type="button"
                  onClick={() => setProfileMenuOpen(false)}
                >
                  Upgrade
                </button>
                <button
                  className="block w-full px-3 py-1.5 text-left text-xs font-normal text-gray-800 hover:bg-gray-100 sm:px-3 sm:py-2 sm:text-sm"
                  type="button"
                  onClick={() => setProfileMenuOpen(false)}
                >
                  24/7 Support
                </button>
                <button
                  className="block w-full rounded-b-lg px-3 py-1.5 text-left text-xs font-normal text-red-500 hover:bg-gray-100 disabled:opacity-50 sm:px-3 sm:py-2 sm:text-sm"
                  type="button"
                  onClick={handleSignOut}
                  disabled={isLoggingOut}
                >
                  {isLoggingOut ? "Logging out..." : "Log Out"}
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">
              {mainActions.map((action) => {
                const content = (
                  <>
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-xl sm:h-10 sm:w-10 ${
                          action.tone === "primary"
                            ? "bg-[#6895FF]"
                            : "bg-[#335CFF]"
                        }`}
                      >
                        {action.icon}
                      </div>
                      <div>
                        <h2
                          className={`text-sm font-semibold sm:text-base md:text-lg lg:text-xl ${
                            action.tone === "primary"
                              ? "text-white"
                              : "text-black"
                          }`}
                        >
                          {action.highlight ? (
                            <>
                              {action.title}{" "}
                              <span className="text-[#335CFF]">
                                {action.highlight}
                              </span>{" "}
                              {action.suffix}
                            </>
                          ) : (
                            action.title
                          )}
                        </h2>
                        <p
                          className={`text-[11px] sm:text-xs ${
                            action.tone === "primary"
                              ? "text-blue-100"
                              : "text-gray-600"
                          }`}
                        >
                          {action.subtitle}
                        </p>
                      </div>
                    </div>
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-xl self-end sm:h-10 sm:w-10 sm:self-auto ${
                        action.tone === "primary"
                          ? "bg-[#6895FF]"
                          : "bg-white"
                      }`}
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        className={`h-5 w-5 ${
                          action.tone === "primary"
                            ? "text-white"
                            : "text-[#525866]"
                        }`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                    </div>
                  </>
                );

                const className = `flex flex-col gap-4 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5 ${
                  action.tone === "primary"
                    ? "bg-[#335CFF] text-white"
                    : "border border-[#E1E4EA] bg-[#F5F7FA]"
                }`;

                if (action.href) {
                  return (
                    <a
                      key={action.title}
                      className={className}
                      href={action.href}
                    >
                      {content}
                    </a>
                  );
                }

                return (
                  <div key={action.title} className={className}>
                    {content}
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {primaryFeatures.map((feature) => (
                <div
                  key={feature.title}
                  className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 md:p-5"
                >
                  <div className="h-40 w-full rounded-xl bg-gradient-to-br from-slate-100 via-slate-200 to-slate-300" />
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-base font-semibold sm:text-lg">
                        {feature.title}
                      </h3>
                      <p className="text-xs text-gray-500 sm:text-sm">
                        {feature.description}
                      </p>
                    </div>
                    {feature.title === "AutoClip" ? (
                      <a
                        className="flex w-full items-center justify-center gap-1 rounded-lg bg-[#EBF1FF] px-4 py-2 text-sm font-semibold text-[#122368] transition-colors hover:bg-[#C9D4F5] sm:w-auto"
                        href="/tools/autoclip"
                      >
                        Try Now
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                      </a>
                    ) : (
                      <button
                        className="flex w-full items-center justify-center gap-1 rounded-lg bg-[#EBF1FF] px-4 py-2 text-sm font-semibold text-[#122368] transition-colors hover:bg-[#C9D4F5] sm:w-auto"
                        type="button"
                      >
                        Try Now
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="md:hidden">
              <div className="-mx-4 overflow-x-auto px-4 [-webkit-overflow-scrolling:touch]">
                <div className="flex snap-x snap-mandatory gap-3 pb-1">
                  {secondaryFeatures.map((feature) => {
                    const href = secondaryFeatureHrefByTitle[feature.title] ?? null;
                    return (
                      <div
                        key={feature.title}
                        className="flex w-[82%] flex-none snap-center items-center gap-3 rounded-xl border border-gray-200 bg-white p-3"
                      >
                      <div className="h-24 w-20 flex-shrink-0 rounded-lg bg-gradient-to-br from-slate-200 via-slate-100 to-slate-300" />
                      <div className="flex h-full flex-1 flex-col justify-between">
                        <div>
                          <h3 className="text-base font-semibold text-gray-900">
                            {feature.title}
                          </h3>
                          <p className="text-xs text-gray-500">
                            {feature.description}
                          </p>
                        </div>
                        {href ? (
                          <a
                            className="flex w-fit items-center gap-1 rounded-lg bg-[#EBF1FF] px-3 py-1.5 text-sm font-semibold text-[#122368] transition-colors hover:bg-[#C9D4F5]"
                            href={href}
                          >
                            Try Now
                            <svg
                              aria-hidden="true"
                              viewBox="0 0 24 24"
                              className="h-4 w-4"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="m9 18 6-6-6-6" />
                            </svg>
                          </a>
                        ) : null}
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
              <div className="mt-4 flex items-center justify-center gap-2">
                {secondaryFeatures.map((feature, index) => (
                  <button
                    key={feature.title}
                    className={`h-2 rounded-full transition-colors ${
                      index === 1 ? "w-6 bg-gray-800" : "w-2 bg-gray-300"
                    }`}
                    type="button"
                    aria-label={`Go to ${feature.title}`}
                  />
                ))}
              </div>
            </div>

            <div className="hidden md:grid md:grid-cols-3 md:gap-4">
              {secondaryFeatures.map((feature) => {
                const href = secondaryFeatureHrefByTitle[feature.title] ?? null;
                return (
                  <div
                    key={feature.title}
                    className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4"
                  >
                  <div className="h-24 w-24 rounded-xl bg-gradient-to-br from-slate-200 via-slate-100 to-slate-300" />
                  <div className="flex flex-1 flex-col gap-2">
                    <div>
                      <h3 className="text-base font-semibold">
                        {feature.title}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {feature.description}
                      </p>
                    </div>
                    {href ? (
                      <a
                        className="flex w-fit items-center gap-1 rounded-lg bg-[#EBF1FF] px-3 py-1.5 text-sm font-semibold text-[#122368] transition-colors hover:bg-[#C9D4F5]"
                        href={href}
                      >
                        Try Now
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                      </a>
                    ) : null}
                  </div>
                </div>
                );
              })}
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold sm:text-lg">
                  Tools
                </h2>
                <a
                  className="flex items-center gap-1 text-sm font-medium text-[#0E121B]"
                  href="/tools"
                >
                  View All Tools
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </a>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-6">
                {toolCards.map((tool) => (
                  <a
                    key={tool.label}
                    href={tool.href}
                    className="flex flex-col items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 text-center transition-colors hover:bg-gray-50 sm:p-4 md:p-6"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#EBF1FF]">
                      {tool.icon}
                    </div>
                    <p className="text-xs font-semibold">{tool.label}</p>
                  </a>
                ))}
              </div>
            </div>
          </div>
          <footer className="mt-10 flex flex-col items-center justify-between gap-2 border-t border-gray-200 pt-4 text-[11px] text-gray-500 sm:flex-row">
            <span>Privacy and terms</span>
            <div className="flex items-center gap-4">
              <a className="transition-colors hover:text-gray-700" href="/privacy-policy">
                Privacy Policy
              </a>
              <a className="transition-colors hover:text-gray-700" href="/terms-of-service">
                Terms of Service
              </a>
            </div>
          </footer>
        </main>
      </div>
      <SearchOverlay open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
