"use client";

import SearchOverlay from "@/components/search-overlay";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ProjectLibraryItem } from "@/lib/projects/types";

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

const formatCreatedLabel = (createdAt: string) => {
  const createdDate = new Date(createdAt);
  if (Number.isNaN(createdDate.getTime())) {
    return "Created just now";
  }
  const diffSeconds = Math.max(
    0,
    Math.floor((Date.now() - createdDate.getTime()) / 1000)
  );
  const formatUnit = (value: number, unit: string) =>
    `Created ${value} ${unit}${value === 1 ? "" : "s"} ago`;
  if (diffSeconds < 60) {
    return formatUnit(diffSeconds, "second");
  }
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return formatUnit(diffMinutes, "minute");
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return formatUnit(diffHours, "hour");
  }
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return formatUnit(diffDays, "day");
  }
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 5) {
    return formatUnit(diffWeeks, "week");
  }
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    return formatUnit(diffMonths, "month");
  }
  const diffYears = Math.floor(diffDays / 365);
  return formatUnit(diffYears, "year");
};

const formatDateLabel = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }
  return date.toLocaleDateString("en-US");
};

export default function ProjectsPage() {
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
  const [openProjectMenuIndex, setOpenProjectMenuIndex] = useState<
    number | null
  >(null);
  const [projects, setProjects] = useState<ProjectLibraryItem[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [previewProject, setPreviewProject] =
    useState<ProjectLibraryItem | null>(null);
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

  const buildProjectVideoUrl = useCallback(
    (projectId: string, disposition: "inline" | "attachment" = "inline") =>
      `/api/projects/download?id=${encodeURIComponent(
        projectId
      )}&disposition=${disposition}`,
    []
  );

  const handleOpenProjectInEditor = useCallback(
    (project: ProjectLibraryItem) => {
      if (project.kind === "editor") {
        window.location.href = `/editor/advanced?projectId=${encodeURIComponent(
          project.id
        )}`;
        return;
      }
      const assetUrl = buildProjectVideoUrl(project.id, "inline");
      const payload = { url: assetUrl, name: project.title, source: "autoclip" };
      try {
        window.localStorage.setItem(
          "autoclip:asset",
          JSON.stringify(payload)
        );
      } catch (error) {
        // Ignore localStorage failures.
      }
      window.location.href = "/editor/advanced?new=1";
    },
    [buildProjectVideoUrl]
  );

  const handleOpenPreview = useCallback(
    (project: ProjectLibraryItem) => {
      setOpenProjectMenuIndex(null);
      if (project.kind === "editor") {
        handleOpenProjectInEditor(project);
        return;
      }
      setPreviewProject(project);
    },
    [handleOpenProjectInEditor]
  );

  const handleClosePreview = useCallback(() => {
    setPreviewProject(null);
  }, []);

  const handleDownloadProject = useCallback(
    (project: ProjectLibraryItem) => {
      if (project.kind !== "clip") {
        return;
      }
      const url = buildProjectVideoUrl(project.id, "attachment");
      window.open(url, "_blank", "noopener,noreferrer");
    },
    [buildProjectVideoUrl]
  );

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
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }
      if (target.closest("[data-project-menu]")) {
        return;
      }
      setOpenProjectMenuIndex(null);
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
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
    let cancelled = false;
    const loadProjects = async () => {
      setProjectsLoading(true);
      setProjectsError(null);
      try {
        const response = await fetch("/api/projects");
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const message =
            typeof payload?.error === "string"
              ? payload.error
              : "Unable to load projects.";
          throw new Error(message);
        }
        if (!cancelled) {
          setProjects(
            Array.isArray(payload?.projects) ? payload.projects : []
          );
        }
      } catch (error) {
        if (!cancelled) {
          setProjectsError(
            error instanceof Error ? error.message : "Unable to load projects."
          );
        }
      } finally {
        if (!cancelled) {
          setProjectsLoading(false);
        }
      }
    };
    loadProjects();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!previewProject) {
      return;
    }
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleClosePreview();
      }
    };
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, [handleClosePreview, previewProject]);

  useEffect(() => {
    if (!previewProject) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [previewProject]);

  const previewVideoUrl = previewProject?.kind === "clip"
    ? buildProjectVideoUrl(previewProject.id, "inline")
    : null;
  const previewCreatedLabel = previewProject
    ? formatDateLabel(previewProject.createdAt)
    : "--";

  return (
    <div className="min-h-screen bg-[#F6F8FC] font-sans text-[#0E121B]">
      <div className="mx-auto flex w-full max-w-[90rem]">
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

        <main className="flex min-h-screen flex-1 flex-col px-4 pb-10 pt-4 md:px-6 md:py-6">
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
                  <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-medium text-black">Projects</h2>
              </div>
            </div>
            <div className="relative" ref={profileMenuRef}>
              <button
                className="flex h-10 w-auto items-center space-x-3 rounded-full border border-gray-300 bg-white p-1 px-2 hover:bg-gray-100 focus:outline-none"
                type="button"
                aria-haspopup="menu"
                aria-expanded={profileMenuOpen}
                aria-controls="projects-profile-menu"
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
                id="projects-profile-menu"
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
            <div className="flex flex-col space-y-3 lg:flex-row lg:items-end lg:justify-between lg:space-y-0">
              <button
                className="group w-full lg:w-64"
                type="button"
                aria-haspopup="listbox"
              >
                <div className="flex cursor-pointer items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 transition-colors hover:bg-gray-100">
                  <p className="text-sm text-gray-800">Last Updated</p>
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
                    <path d="m21 16-4 4-4-4" />
                    <path d="M17 20V4" />
                    <path d="m3 8 4-4 4 4" />
                    <path d="M7 4v16" />
                  </svg>
                </div>
              </button>
              <button
                className="hidden max-h-[42px] w-full items-center justify-center gap-2 rounded-lg bg-[#335CFF] px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 sm:flex sm:w-fit"
                type="button"
              >
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
                  <path d="M5 12h14" />
                  <path d="M12 5v14" />
                </svg>
                Create New Project
              </button>
            </div>

            <div className="grid flex-1 auto-rows-max grid-cols-1 content-start gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {projectsLoading ? (
                <div className="col-span-full rounded-xl border border-dashed border-gray-200 bg-white p-6 text-sm text-gray-500">
                  Loading projects...
                </div>
              ) : projectsError ? (
                <div className="col-span-full rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-600">
                  {projectsError}
                </div>
              ) : projects.length ? (
                projects.map((project, index) => (
                  <div
                    key={project.id}
                    className={`relative flex w-full cursor-pointer flex-col rounded-lg border border-gray-200 bg-white ${
                      openProjectMenuIndex === index ? "z-10" : "z-0"
                    }`}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleOpenPreview(project)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleOpenPreview(project);
                      }
                    }}
                  >
                    <div className="relative w-full overflow-hidden rounded-t-lg">
                      {project.previewImage ? (
                        <img
                          src={project.previewImage}
                          alt={project.title}
                          className="h-48 w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-48 w-full bg-gradient-to-br from-slate-100 via-slate-200 to-slate-300" />
                      )}
                    </div>
                    <div className="flex w-full flex-col gap-1 border-t border-gray-200 p-3.5">
                      <div className="flex w-full items-center gap-2">
                        <div className="flex min-w-[100px] flex-1 items-center gap-2">
                          <p className="truncate">{project.title}</p>
                          <div className="inline-flex items-center rounded-full border border-transparent bg-gray-100 px-2.5 py-0.5 text-[10px] font-semibold text-gray-500">
                            {project.kind === "editor" ? "Draft" : "Exported"}
                          </div>
                        </div>
                        <div className="relative" data-project-menu>
                          <button
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-black hover:bg-gray-100"
                            type="button"
                            aria-label="Project menu"
                            aria-expanded={openProjectMenuIndex === index}
                            onClick={(event) => {
                              event.stopPropagation();
                              setOpenProjectMenuIndex((prev) =>
                                prev === index ? null : index
                              );
                            }}
                          >
                            <svg
                              aria-hidden="true"
                              viewBox="0 0 24 24"
                              className="h-5 w-5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <circle cx="12" cy="12" r="1" />
                              <circle cx="19" cy="12" r="1" />
                              <circle cx="5" cy="12" r="1" />
                            </svg>
                          </button>
                          <div
                            className={`absolute right-0 top-9 z-30 w-48 rounded-lg border border-gray-200 bg-white p-2 text-sm shadow-md transition-all ${
                              openProjectMenuIndex === index
                                ? "pointer-events-auto translate-y-0 opacity-100"
                                : "pointer-events-none translate-y-1 opacity-0"
                            }`}
                          >
                            <button
                              className="block w-full rounded-lg px-2 py-1.5 text-left hover:bg-gray-100"
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setOpenProjectMenuIndex(null);
                                handleOpenProjectInEditor(project);
                              }}
                            >
                              {project.kind === "editor"
                                ? "Continue editing"
                                : "Open advanced editor"}
                            </button>
                            <button
                              className="mt-1 block w-full rounded-lg px-2 py-1.5 text-left text-red-500 hover:bg-red-50"
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setOpenProjectMenuIndex(null);
                              }}
                            >
                              Delete project
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-500">
                          {formatCreatedLabel(project.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full rounded-xl border border-dashed border-gray-200 bg-white p-6 text-sm text-gray-500">
                  No projects yet. Start editing to see them here.
                </div>
              )}
            </div>

            <div className="flex flex-col items-center space-y-3 sm:hidden">
              <div className="flex items-center justify-center gap-1">
                <button
                  className="inline-flex h-8 min-w-[32px] items-center justify-center rounded-md px-1 text-sm text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  disabled
                >
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
                    <path d="m11 17-5-5 5-5" />
                    <path d="m18 17-5-5 5-5" />
                  </svg>
                </button>
                <button
                  className="inline-flex h-8 min-w-[32px] items-center justify-center rounded-md px-1 text-sm text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  disabled
                >
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
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                </button>
                <a
                  className="inline-flex h-8 min-w-[32px] items-center justify-center rounded-md bg-gray-100 px-1 text-sm text-gray-600"
                  href="/projects?page=1"
                >
                  1
                </a>
                <button
                  className="inline-flex h-8 min-w-[32px] items-center justify-center rounded-md px-1 text-sm text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  disabled
                >
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
                <button
                  className="inline-flex h-8 min-w-[32px] items-center justify-center rounded-md px-1 text-sm text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  disabled
                >
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
                    <path d="m6 17 5-5-5-5" />
                    <path d="m13 17 5-5-5-5" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="relative hidden h-8 items-center justify-center sm:flex">
              <span className="absolute left-0 text-sm text-gray-600">
                Page 1 of 1
              </span>
              <div className="flex items-center justify-center gap-1">
                <button
                  className="inline-flex h-8 min-w-[32px] items-center justify-center rounded-md px-1 text-sm text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  disabled
                >
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
                    <path d="m11 17-5-5 5-5" />
                    <path d="m18 17-5-5 5-5" />
                  </svg>
                </button>
                <button
                  className="inline-flex h-8 min-w-[32px] items-center justify-center rounded-md px-1 text-sm text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  disabled
                >
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
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                </button>
                <a
                  className="inline-flex h-8 min-w-[32px] items-center justify-center rounded-md bg-gray-100 px-1 text-sm text-gray-600"
                  href="/projects?page=1"
                >
                  1
                </a>
                <button
                  className="inline-flex h-8 min-w-[32px] items-center justify-center rounded-md px-1 text-sm text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  disabled
                >
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
                <button
                  className="inline-flex h-8 min-w-[32px] items-center justify-center rounded-md px-1 text-sm text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  disabled
                >
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
                    <path d="m6 17 5-5-5-5" />
                    <path d="m13 17 5-5-5-5" />
                  </svg>
                </button>
              </div>
              <span className="absolute right-0 text-sm text-gray-600">
                24 / page
              </span>
            </div>
          </div>
        </main>
      </div>
      {previewProject ? (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={handleClosePreview}
            aria-hidden="true"
          />
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4"
            onClick={handleClosePreview}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="project-preview-title"
              aria-describedby="project-preview-desc"
              className="flex w-full max-w-[90vw] max-h-[90svh] flex-col gap-0 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg focus:outline-none md:max-w-2xl"
              onClick={(event) => event.stopPropagation()}
              tabIndex={-1}
            >
              <div className="flex w-full items-center justify-between gap-2 border-b border-gray-200 px-4 py-4 sm:px-6 sm:py-5">
                <h2
                  id="project-preview-title"
                  className="flex min-w-0 flex-1 items-center gap-2 text-lg font-medium leading-none tracking-tight"
                >
                  <span className="truncate text-xl font-medium leading-none sm:text-2xl">
                    {previewProject.title}
                  </span>
                </h2>
                <button
                  className="rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none"
                  type="button"
                  aria-label="Close"
                  onClick={handleClosePreview}
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-4 w-4 text-black"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>
              <p id="project-preview-desc" className="sr-only">
                Project details including properties, preview, and available
                actions
              </p>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="flex h-[min(60svh,420px)] flex-col sm:flex-row">
                  <div className="flex w-full flex-col justify-between gap-4 p-4 sm:w-[320px] sm:min-w-[320px]">
                    <div className="grid gap-3 rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-600">
                      <div className="flex items-center justify-between">
                        <p>Created on</p>
                        <p className="font-medium text-gray-500">
                          {previewCreatedLabel}
                        </p>
                      </div>
                      <div className="flex items-center justify-between">
                        <p>Updated on</p>
                        <p className="font-medium text-gray-500">
                          {previewCreatedLabel}
                        </p>
                      </div>
                    </div>
                    <div className="flex w-full flex-col gap-2 sm:flex-row">
                      <button
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
                        type="button"
                        onClick={() => handleOpenProjectInEditor(previewProject)}
                      >
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
                          <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a.5.5 0 0 0 .830-.497z" />
                          <path d="m15 5 4 4" />
                        </svg>
                        Open editor
                      </button>
                      <button
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
                        type="button"
                        onClick={() => handleDownloadProject(previewProject)}
                      >
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
                          <path d="M12 15V3" />
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <path d="m7 10 5 5 5-5" />
                        </svg>
                        Download clip
                      </button>
                    </div>
                  </div>
                  <div className="order-first flex flex-1 items-center justify-center overflow-hidden border-b border-gray-200 bg-[#F5F7FA] p-4 sm:order-none sm:border-b-0 sm:border-l">
                    {previewVideoUrl ? (
                      <video
                        src={previewVideoUrl}
                        controls
                        playsInline
                        preload="metadata"
                        poster={previewProject.previewImage ?? undefined}
                        className="h-full max-h-full w-auto max-w-full rounded-2xl object-contain"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">
                        Preview unavailable
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
      <SearchOverlay open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
