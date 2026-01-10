"use client";

import { useState, type ReactNode } from "react";

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
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V21a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
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
        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
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
        <path d="M14 3H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
        <path d="M14 3v6h6" />
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
        <path d="m21 2-2 2-4 12 4 4 2-2-4-4z" />
        <path d="m7 14-5 5" />
        <path d="M7 9 4 6" />
      </svg>
    ),
  },
];

type MainAction = {
  title: string;
  subtitle: string;
  tone: "primary" | "neutral";
  icon: ReactNode;
  highlight?: string;
  suffix?: string;
};

const mainActions: MainAction[] = [
  {
    title: "Create new project in editor",
    subtitle: "Start from scratch now",
    tone: "primary",
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
    title: "Crayo AutoClip",
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
    href: "/tools/youtube-downloader",
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
    items: [{ label: "Crayo Editor", href: "/tools" }],
  },
  {
    label: "More",
    items: [
      { label: "24/7 Support", href: "/support" },
      { label: "Crayo Affiliate", href: "/affiliate" },
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
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    () =>
      Object.fromEntries(
        mobileSections.map((section) => [
          section.label,
          section.defaultOpen ?? false,
        ])
      )
  );

  const toggleSection = (label: string) => {
    setOpenSections((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <div className="min-h-screen bg-[#F6F8FC] font-sans text-[#0E121B]">
      <div className="mx-auto flex w-full max-w-[90rem]">
        <aside className="sticky top-0 hidden h-screen w-24 flex-col items-center border-r border-gray-200 bg-white py-3 md:flex">
          <div className="relative flex h-full w-full flex-col items-center gap-4">
            <div className="absolute left-0 top-[112px] h-10 w-1.5 rounded-r-lg bg-[#335CFF]" />
            <a
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E7EDFF] text-lg font-semibold text-[#335CFF]"
              href="/dashboard"
            >
              YA
            </a>
            <div className="h-px w-10 bg-gray-200" />
            <nav className="flex flex-col gap-2">
              {navItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className={`flex h-11 w-11 items-center justify-center rounded-lg transition-colors ${
                    item.active ? "bg-[#EEF2FF]" : "hover:bg-gray-100"
                  }`}
                  aria-label={item.label}
                >
                  {item.icon}
                </a>
              ))}
            </nav>
            <div className="mt-auto pb-2">
              <button
                className="group flex h-11 w-11 flex-col items-center justify-center rounded-lg border border-transparent transition-colors hover:border-gray-200 hover:bg-gray-100"
                type="button"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-4 w-4 text-gray-400 group-hover:text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                <span className="text-[9px] font-medium text-gray-400 group-hover:text-gray-600">
                  Cmd+K
                </span>
              </button>
            </div>
          </div>
        </aside>

        <main className="flex min-h-screen flex-1 flex-col px-4 pb-10 pt-4 md:px-10 md:py-6">
          <div className="sticky top-0 z-20 -mx-4 flex items-center justify-between bg-[#F6F8FC]/80 px-4 py-3 backdrop-blur-xl md:hidden">
            <a
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#E7EDFF] text-base font-semibold text-[#335CFF]"
              href="/dashboard"
              aria-label="Dashboard"
            >
              YA
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

          <div className="sticky top-0 z-10 hidden items-center justify-between bg-[#F6F8FC]/80 pb-6 pt-2 backdrop-blur-xl md:flex">
            <p className="text-lg font-semibold text-black">
              Welcome back, Jonathan
            </p>
            <div className="flex items-center gap-3">
              <button
                className="flex items-center justify-center rounded-full border border-[#5B7CFF] bg-[#3860FF] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
                type="button"
              >
                Earn $75+
              </button>
              <button
                className="flex items-center gap-2 rounded-full border border-gray-200 bg-white p-1.5 pr-3 transition-colors hover:bg-gray-50"
                type="button"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#6A8BFF] to-[#335CFF] text-sm font-semibold text-white">
                  JG
                </span>
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
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">
              {mainActions.map((action) => (
                <div
                  key={action.title}
                  className={`flex items-center justify-between rounded-2xl p-4 sm:p-5 ${
                    action.tone === "primary"
                      ? "bg-[#335CFF] text-white"
                      : "border border-[#E1E4EA] bg-[#F5F7FA]"
                  }`}
                >
                  <div className="flex items-center gap-3">
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
                        className={`text-base font-semibold md:text-lg lg:text-xl ${
                          action.tone === "primary" ? "text-white" : "text-black"
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
                        className={`text-xs ${
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
                    className={`flex h-8 w-8 items-center justify-center rounded-xl sm:h-10 sm:w-10 ${
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
                </div>
              ))}
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
                      <h3 className="text-lg font-semibold">{feature.title}</h3>
                      <p className="text-sm text-gray-500">
                        {feature.description}
                      </p>
                    </div>
                    <button
                      className="flex items-center gap-1 rounded-lg bg-[#EBF1FF] px-4 py-2 text-sm font-semibold text-[#122368] transition-colors hover:bg-[#C9D4F5]"
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
                  </div>
                </div>
              ))}
            </div>

            <div className="md:hidden">
              <div className="-mx-4 overflow-x-auto px-4">
                <div className="flex snap-x snap-mandatory gap-3">
                  {secondaryFeatures.map((feature) => (
                    <div
                      key={feature.title}
                      className="flex w-[75%] flex-none snap-center items-center gap-3 rounded-xl border border-gray-200 bg-white p-3"
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
                        <button
                          className="flex w-fit items-center gap-1 rounded-lg bg-[#EBF1FF] px-3 py-1.5 text-sm font-semibold text-[#122368] transition-colors hover:bg-[#C9D4F5]"
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
                      </div>
                    </div>
                  ))}
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
              {secondaryFeatures.map((feature) => (
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
                    <button
                      className="flex w-fit items-center gap-1 rounded-lg bg-[#EBF1FF] px-3 py-1.5 text-sm font-semibold text-[#122368] transition-colors hover:bg-[#C9D4F5]"
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
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Crayo Tools</h2>
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
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
                {toolCards.map((tool) => (
                  <a
                    key={tool.label}
                    href={tool.href}
                    className="flex flex-col items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 text-center transition-colors hover:bg-gray-50 md:p-6"
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
        </main>
      </div>
    </div>
  );
}
