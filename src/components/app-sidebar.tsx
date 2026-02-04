"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import SearchOverlay from "@/components/search-overlay";
import { SaturaLogo } from "@/components/satura-logo";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
  match: (pathname: string) => boolean;
  icon: (active: boolean) => ReactNode;
};

const matchesPrefix = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

const resolveActivePath = (pathname: string) => {
  if (matchesPrefix(pathname, "/create")) {
    return "/assets";
  }
  return pathname;
};

// Satura brand green: #9aed00
const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    match: (pathname) => matchesPrefix(pathname, "/dashboard"),
    icon: (active) => (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={cn("h-5 w-5 transition-colors", active ? "text-[#9aed00]" : "text-[#898a8b]")}
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
    match: (pathname) => matchesPrefix(pathname, "/projects"),
    icon: (active) => (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={cn("h-5 w-5 transition-colors", active ? "text-[#9aed00]" : "text-[#898a8b]")}
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
    match: (pathname) => matchesPrefix(pathname, "/assets"),
    icon: (active) => (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={cn("h-5 w-5 transition-colors", active ? "text-[#9aed00]" : "text-[#898a8b]")}
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
    match: (pathname) => matchesPrefix(pathname, "/tools"),
    icon: (active) => (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={cn("h-5 w-5 transition-colors", active ? "text-[#9aed00]" : "text-[#898a8b]")}
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
    match: (pathname) => matchesPrefix(pathname, "/tools/autoclip"),
    icon: (active) => (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={cn("h-5 w-5 transition-colors", active ? "text-[#9aed00]" : "text-[#898a8b]")}
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
    match: (pathname) => matchesPrefix(pathname, "/tools/trust-score"),
    icon: (active) => (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={cn("h-5 w-5 transition-colors", active ? "text-[#9aed00]" : "text-[#898a8b]")}
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

export default function AppSidebar() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const resolvedPathname = useMemo(
    () => resolveActivePath(pathname),
    [pathname]
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const navContainerRef = useRef<HTMLDivElement | null>(null);
  const navItemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [hoveredNavIndex, setHoveredNavIndex] = useState<number | null>(null);
  const [indicatorReady, setIndicatorReady] = useState(false);
  const [indicatorStyle, setIndicatorStyle] = useState(() => ({
    top: 0,
    height: 0,
    opacity: 0,
  }));

  const activeNavIndex = useMemo(
    () => navItems.findIndex((item) => item.match(resolvedPathname)),
    [resolvedPathname]
  );
  const resolvedNavIndex =
    hoveredNavIndex ?? (activeNavIndex >= 0 ? activeNavIndex : 0);

  const updateIndicator = useCallback((index: number) => {
    const container = navContainerRef.current;
    const target = navItemRefs.current[index];
    if (!container || !target) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const itemRect = target.getBoundingClientRect();
    setIndicatorStyle({
      top: itemRect.top - containerRect.top,
      height: itemRect.height,
      opacity: 1,
    });
  }, []);

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

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      router.prefetch("/editor/advanced");
      router.prefetch("/tools/autoclip");
    }, 1200);

    return () => window.clearTimeout(timeoutId);
  }, [router]);

  return (
    <>
      <SearchOverlay open={searchOpen} onOpenChange={setSearchOpen} />
      <aside className="sticky top-0 hidden min-h-screen w-24 flex-col items-center border-r border-[rgba(255,255,255,0.08)] bg-[#0e1012] py-3 md:flex">
        <div
          ref={navContainerRef}
          className="relative flex w-full flex-1 flex-col items-center gap-4"
        >
          {/* Active indicator - brand green */}
          <div
            className="pointer-events-none absolute left-0 top-0 w-1.5 rounded-r-lg bg-[#9aed00] transition-[transform,height,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{
              transform: `translateY(${indicatorStyle.top}px)`,
              height: `${indicatorStyle.height}px`,
              opacity: indicatorStyle.opacity,
              transition: indicatorReady ? undefined : "none",
              boxShadow: "0px 0px 12px rgba(154, 237, 0, 0.5)",
            }}
          />
          <SaturaLogo size="md" />
          <div className="h-px w-10 bg-[rgba(255,255,255,0.08)]" />
          <nav
            className="flex flex-col gap-2"
            onMouseLeave={() => setHoveredNavIndex(null)}
          >
            {navItems.map((item, index) => {
              const active = index === activeNavIndex;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  ref={(element) => {
                    navItemRefs.current[index] = element;
                  }}
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-lg transition-all duration-200",
                    active 
                      ? "bg-[rgba(154,237,0,0.1)]" 
                      : "hover:bg-[rgba(255,255,255,0.05)]"
                  )}
                  aria-label={item.label}
                  onMouseEnter={() => setHoveredNavIndex(index)}
                >
                  {item.icon(active)}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto pb-6">
            <button
              className="group flex h-12 w-12 flex-col items-center justify-center rounded-xl border border-transparent transition-all duration-200 hover:border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.05)] xl:h-14 xl:w-14"
              type="button"
              aria-label="Search"
              onClick={() => setSearchOpen(true)}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-5 w-5 text-[#898a8b] transition-colors group-hover:text-[#f7f7f8]"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <span className="text-[10px] font-medium text-[#898a8b] transition-colors group-hover:text-[#f7f7f8]">
                Cmd+K
              </span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
