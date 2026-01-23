"use client";

import SearchOverlay from "@/components/search-overlay";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

type NavItem = {
  label: string;
  href: string;
  active?: boolean;
  icon: ReactNode;
};

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
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
    active: true,
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

type QuickTool = {
  title: string;
  description: string;
  href: string;
  icon: ReactNode;
};

const quickTools: QuickTool[] = [
  {
    title: "Free Tools",
    description: "",
    href: "/tools/free",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5 text-blue-500"
        fill="currentColor"
      >
        <g>
          <path d="M12 21.942a9.942 9.942 0 1 1 9.942-9.942A9.953 9.953 0 0 1 12 21.942ZM12 3.058a8.942 8.942 0 1 0 8.942 8.942A8.952 8.952 0 0 0 12 3.058Z" />
          <path d="M16.693 13.744a5.041 5.041 0 0 1-9.387 0c-.249-.59-1.111-.081-.863.505a6.026 6.026 0 0 0 11.114 0c.247-.586-.614-1.1-.864-.505Z" />
          <circle cx="9" cy="9.011" r="1.25" />
          <circle cx="15" cy="9.011" r="1.25" />
        </g>
      </svg>
    ),
  },
  {
    title: "Youtube Downloader",
    description: "Download Youtube videos",
    href: "/editor/advanced",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5 text-blue-500"
        fill="currentColor"
      >
        <path d="M12.244 4c.534.003 1.87.016 3.29.073l.504.022c1.429.067 2.858.183 3.566.381.945.266 1.687 1.041 1.938 2.022.4 1.559.45 4.602.456 5.339l.001.152v.01l-.001.153c-.006.736-.056 3.779-.456 5.338-.254.986-.997 1.761-1.938 2.023-.708.197-2.137.313-3.566.381l-.504.022c-1.42.057-2.756.07-3.29.073l-.234.001h-.01l-.235-.001c-1.13-.006-5.856-.057-7.359-.475-.945-.266-1.688-1.041-1.939-2.023-.4-1.559-.45-4.602-.456-5.338v-.327c.006-.736.056-3.779.456-5.338.254-.986.997-1.761 1.939-2.023C5.898 4.006 10.624 3.955 11.755 3.949h.489ZM10 8.499v7l6-3.5-6-3.5Z" />
      </svg>
    ),
  },
  {
    title: "Tiktok Downloader",
    description: "Download TikTok videos",
    href: "/editor/advanced",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5 text-blue-500"
        fill="currentColor"
      >
        <path d="M16 8.245V15.5C16 19.09 13.09 22 9.5 22S3 19.09 3 15.5 5.91 9 9.5 9c.516 0 1.018.06 1.5.174v3.163A3.5 3.5 0 0 0 9.5 12 3.5 3.5 0 0 0 6 15.5 3.5 3.5 0 0 0 9.5 19 3.5 3.5 0 0 0 13 15.5V2h3a5 5 0 0 0 5 5v3c-1.892 0-3.63-.657-5-1.755Z" />
      </svg>
    ),
  },
];

type ToolCard = {
  title: string;
  description: string;
  href: string;
  badge?: string;
};

const toolCards: ToolCard[] = [
  {
    title: "AI Image Generator",
    description: "Generate high quality images with AI in seconds.",
    href: "/tools/images",
  },
  {
    title: "AI Voiceover Generator",
    description: "Make high quality voiceovers in seconds with 50+ narrators.",
    href: "/tools/voiceovers",
  },
  {
    title: "AI Speech Enhancer",
    description: "Enhance the quality of any audio or video file with AI.",
    href: "/tools/enhance-speech",
    badge: "New",
  },
  {
    title: "AI Video Generator",
    description: "VEO3 is a tool that allows you to create videos with AI.",
    href: "/tools/veo3",
  },
  {
    title: "AI Vocal Remover",
    description: "Remove vocals from any audio or video file with AI.",
    href: "/tools/vocal-remover",
  },
  {
    title: "AI Brainstormer",
    description: "Generate viral content ideas based on your niche.",
    href: "/tools/brainstorm",
  },
  {
    title: "Reddit Video Generator",
    description: "Convert Reddit posts into viral videos with AI.",
    href: "/create/reddit-video",
  },
  {
    title: "Fake Texts Video Generator",
    description: "Create engaging fake texts videos with AI to go viral.",
    href: "/create/text-video",
  },
];

export default function ToolsPage() {
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
  const navContainerRef = useRef<HTMLDivElement | null>(null);
  const navItemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const activeNavIndex = navItems.findIndex((item) => item.active);
  const resolvedNavIndex =
    hoveredNavIndex ?? (activeNavIndex >= 0 ? activeNavIndex : 0);

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

        <main className="flex min-h-[100dvh] w-full flex-1 flex-col px-4 pb-16 pt-3 md:px-6 md:py-6">
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
                  <img
                    src="https://lh3.googleusercontent.com/a/ACg8ocIpO3tPyuyBmmElNF-TQRNnIwAow9n7zGLo64RDHYAw7zMMX1ogFA=s96-c"
                    alt="Profile"
                    className="h-10 w-10 rounded-full object-cover"
                    draggable="false"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      Jonathan Groschel
                    </p>
                    <p className="text-xs text-gray-500">
                      jonathangroschel5@gmail.com
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
                {mobileFooterActions.map((action) => (
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
                ))}
              </div>
            </div>
          </div>

          <div className="sticky top-0 z-20 hidden items-center justify-between bg-[#F6F8FC]/95 py-3 backdrop-blur-xl md:flex">
            <div className="flex items-center gap-2">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-5 w-5 text-gray-700"
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
              </div>
              <div>
                <h2 className="text-lg font-medium text-black">Tools</h2>
              </div>
            </div>
            <div className="relative" ref={profileMenuRef}>
              <button
                className="flex h-10 w-auto items-center space-x-3 rounded-full border border-gray-300 bg-white p-1 px-2 hover:bg-gray-100 focus:outline-none"
                type="button"
                aria-haspopup="menu"
                aria-expanded={profileMenuOpen}
                aria-controls="tools-profile-menu"
                onClick={() => setProfileMenuOpen((open) => !open)}
              >
                <img
                  src="https://lh3.googleusercontent.com/a/ACg8ocIpO3tPyuyBmmElNF-TQRNnIwAow9n7zGLo64RDHYAw7zMMX1ogFA=s96-c"
                  alt="Profile"
                  className="h-6 w-6 select-none rounded-full object-cover md:h-8 md:w-8"
                  draggable="false"
                />
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
                id="tools-profile-menu"
                className={`absolute right-0 top-full z-30 mt-2 w-64 rounded-lg border border-gray-200 bg-white shadow-md transition-all duration-150 ${
                  profileMenuOpen
                    ? "pointer-events-auto translate-y-0 opacity-100"
                    : "pointer-events-none translate-y-1 opacity-0"
                }`}
              >
                <div className="flex flex-row items-center space-x-2 px-3 py-2">
                  <img
                    src="https://lh3.googleusercontent.com/a/ACg8ocIpO3tPyuyBmmElNF-TQRNnIwAow9n7zGLo64RDHYAw7zMMX1ogFA=s96-c"
                    alt="Profile"
                    className="h-6 w-6 select-none rounded-full object-cover md:h-8 md:w-8"
                    draggable="false"
                  />
                  <div className="flex flex-col items-start justify-start">
                    <p className="text-base font-medium">Jonathan Groschel</p>
                    <p className="text-xs text-gray-500">
                      jonathangroschel5@gmail.com
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
                  className="block w-full rounded-b-lg px-3 py-1.5 text-left text-xs font-normal text-red-500 hover:bg-gray-100 sm:px-3 sm:py-2 sm:text-sm"
                  type="button"
                  onClick={() => setProfileMenuOpen(false)}
                >
                  Log Out
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-4 border-t border-gray-200 pt-4 md:border-none md:pt-0">
            <div className="flex flex-col space-y-3">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {quickTools.map((tool) => (
                  <a
                    key={tool.title}
                    className="group flex items-center justify-between rounded-xl border border-gray-200 bg-[#FAFAFA] p-3"
                    href={tool.href}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#E1E4EA] bg-white">
                        {tool.icon}
                      </div>
                      <div>
                        <h3 className="font-medium">{tool.title}</h3>
                        <p className="text-sm text-gray-500">
                          {tool.description}
                        </p>
                      </div>
                    </div>
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="h-4 w-4 text-gray-400 transition-all group-hover:text-blue-500"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </a>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                {toolCards.map((tool) => (
                  <div
                    key={tool.title}
                    className="flex flex-col rounded-2xl border border-gray-200 bg-white"
                  >
                    <div className="h-40 w-full rounded-t-2xl border-b border-gray-200 bg-gradient-to-br from-slate-100 via-slate-200 to-slate-300" />
                    <div className="flex h-full flex-col justify-between space-y-2 p-4 pb-3">
                      <div className="flex flex-col space-y-px">
                        <div className="flex items-start justify-between">
                          <h3 className="text-lg font-medium">{tool.title}</h3>
                          {tool.badge ? (
                            <span className="rounded-full bg-blue-600 px-2 py-1 text-xs text-white">
                              {tool.badge}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-sm text-gray-600">
                          {tool.description}
                        </p>
                      </div>
                      <div className="mt-auto">
                        <a href={tool.href}>
                          <button
                            className="w-full rounded-xl border border-gray-300 py-2 text-center transition-colors hover:bg-gray-50"
                            type="button"
                          >
                            Get Started
                          </button>
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
      <SearchOverlay open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
