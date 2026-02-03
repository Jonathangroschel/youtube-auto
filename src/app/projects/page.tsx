"use client";

import SearchOverlay from "@/components/search-overlay";
import { SaturaLogo } from "@/components/satura-logo";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import type {
  ProjectLibraryItem,
  ProjectRenderStatus,
} from "@/lib/projects/types";

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
        className="h-5 w-5 text-[#898a8b] transition-colors"
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
        className="h-5 w-5 text-[#9aed00] transition-colors"
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
        className="h-5 w-5 text-[#898a8b] transition-colors"
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
        className="h-5 w-5 text-[#898a8b] transition-colors"
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
        className="h-5 w-5 text-[#898a8b] transition-colors"
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
        className="h-5 w-5 text-[#898a8b] transition-colors"
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

const PAGE_SIZE = 24;

const projectSortOptions = [
  { key: "updated", label: "Last Updated" },
  { key: "created", label: "Created" },
  { key: "title", label: "Title" },
] as const;

type ProjectSortKey = (typeof projectSortOptions)[number]["key"];

const sortLabelByKey = new Map<ProjectSortKey, string>(
  projectSortOptions.map((option) => [option.key, option.label])
);

const parseSortKey = (value: string | null): ProjectSortKey =>
  value === "created" || value === "title" ? value : "updated";

const parsePageParam = (value: string | null) => {
  if (!value) {
    return 1;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 1;
  }
  const rounded = Math.floor(parsed);
  return rounded > 0 ? rounded : 1;
};

const normalizeProjectTitle = (value: string) => {
  const trimmed = value.slice(0, 80).trim();
  return trimmed.length > 0 ? trimmed : "Untitled Project";
};

const clampPage = (value: number, totalPages: number) =>
  Math.min(Math.max(1, value), Math.max(1, totalPages));

const toNonNegativeInt = (value: unknown, fallback: number) => {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim().length > 0
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  const rounded = Math.floor(parsed);
  return rounded >= 0 ? rounded : fallback;
};

const formatRelativeTimeLabel = (value: string, prefix: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return `${prefix} just now`;
  }
  const diffSeconds = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 1000)
  );
  const formatUnit = (amount: number, unit: string) =>
    `${prefix} ${amount} ${unit}${amount === 1 ? "" : "s"} ago`;
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

type ProjectRenderUiState = {
  renderStatus: ProjectRenderStatus;
  isRendering: boolean;
  isReady: boolean;
  isError: boolean;
  badgeLabel: string;
  badgeClassName: string;
  badgeShowPing: boolean;
  stageLabel: string | null;
  progressPercent: number | null;
  canDownload: boolean;
};

type ProjectRenderUpdate = {
  id: string;
  renderStatus: ProjectRenderStatus;
  renderStage: string | null;
  renderProgress: number | null;
  downloadAvailable: boolean;
  hasOutput: boolean;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const resolveRenderStatus = (project: ProjectLibraryItem): ProjectRenderStatus =>
  project.renderStatus ?? (project.kind === "clip" ? "complete" : "idle");

type ProjectsPagination = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  sort: ProjectSortKey;
};

const defaultPagination: ProjectsPagination = {
  page: 1,
  pageSize: PAGE_SIZE,
  totalCount: 0,
  totalPages: 1,
  sort: "updated",
};

const safePreviewTime = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;

function ProjectPreviewMedia({ project }: { project: ProjectLibraryItem }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewTime = safePreviewTime(project.previewTimeSeconds);

  const setPreviewFrame = useCallback(
    (node: HTMLVideoElement | null) => {
      if (!node || project.previewSourceKind !== "video") {
        return;
      }
      const duration = node.duration;
      if (!Number.isFinite(duration) || duration <= 0) {
        return;
      }
      const maxTime = Math.max(0, duration - 0.05);
      const nextTime = Math.min(Math.max(0, previewTime), maxTime);
      if (Math.abs(node.currentTime - nextTime) < 0.01) {
        return;
      }
      try {
        node.currentTime = nextTime;
      } catch {
        // Ignore preview seek failures.
      }
    },
    [previewTime, project.previewSourceKind]
  );

  useEffect(() => {
    setPreviewFrame(videoRef.current);
  }, [setPreviewFrame, project.previewSourceUrl]);

  if (project.previewSourceUrl && project.previewSourceKind === "video") {
    return (
      <video
        ref={videoRef}
        src={project.previewSourceUrl}
        poster={project.previewImage ?? undefined}
        className="h-48 w-full object-cover"
        preload="metadata"
        muted
        playsInline
        onLoadedMetadata={(event) => setPreviewFrame(event.currentTarget)}
      />
    );
  }

  const imageSrc = project.previewSourceUrl ?? project.previewImage ?? null;
  if (imageSrc) {
    return (
      <img
        src={imageSrc}
        alt={project.title}
        className="h-48 w-full object-cover"
        loading="lazy"
      />
    );
  }

  return (
    <div className="h-48 w-full bg-gradient-to-br from-[#191240] via-[#252729] to-[#0e1012]" />
  );
}

export default function ProjectsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0e1012] font-sans text-[#f7f7f8]">
          <div className="mx-auto flex w-full max-w-[90rem] px-4 py-10 text-sm text-[#898a8b] md:px-6">
            Loading projects...
          </div>
        </div>
      }
    >
      <ProjectsPageInner />
    </Suspense>
  );
}

const resolveProjectRenderUi = (
  project: ProjectLibraryItem
): ProjectRenderUiState => {
  const renderStatus = resolveRenderStatus(project);
  const canDownload =
    project.kind === "clip" || Boolean(project.downloadAvailable);
  const isRendering = renderStatus === "rendering";
  const isReady = renderStatus === "complete" && canDownload;
  const isError = renderStatus === "error";
  const progressPercent =
    isRendering && typeof project.renderProgress === "number"
      ? Math.round(clamp01(project.renderProgress) * 100)
      : null;
  const stageLabel = isRendering
    ? typeof project.renderStage === "string" &&
      project.renderStage.trim().length > 0
      ? project.renderStage
      : "Rendering"
    : isError
      ? typeof project.renderStage === "string" &&
        project.renderStage.trim().length > 0
        ? project.renderStage
        : "Export failed"
      : isReady
        ? "Ready"
        : null;

  if (isRendering) {
    return {
      renderStatus,
      isRendering,
      isReady,
      isError,
      badgeLabel: "Rendering",
      badgeClassName: "border-transparent bg-[rgba(154,237,0,0.1)] text-[#9aed00]",
      badgeShowPing: true,
      stageLabel,
      progressPercent,
      canDownload,
    };
  }
  if (isReady) {
    return {
      renderStatus,
      isRendering,
      isReady,
      isError,
      badgeLabel: project.kind === "clip" ? "Exported" : "Ready",
      badgeClassName: "border-transparent bg-[rgba(76,175,80,0.1)] text-[#4caf50]",
      badgeShowPing: false,
      stageLabel,
      progressPercent: null,
      canDownload,
    };
  }
  if (isError) {
    return {
      renderStatus,
      isRendering,
      isReady,
      isError,
      badgeLabel: "Failed",
      badgeClassName: "border-transparent bg-[rgba(231,41,48,0.1)] text-[#e72930]",
      badgeShowPing: false,
      stageLabel,
      progressPercent: null,
      canDownload,
    };
  }
  return {
    renderStatus,
    isRendering,
    isReady,
    isError,
    badgeLabel: project.kind === "editor" ? "Draft" : "Exported",
    badgeClassName: "border-transparent bg-[rgba(255,255,255,0.05)] text-[#898a8b]",
    badgeShowPing: false,
    stageLabel: null,
    progressPercent: null,
    canDownload,
  };
};

function ProjectsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPage = parsePageParam(searchParams.get("page"));
  const initialSort = parseSortKey(searchParams.get("sort"));
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
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [openProjectMenuIndex, setOpenProjectMenuIndex] = useState<
    number | null
  >(null);
  const [page, setPage] = useState(initialPage);
  const [sortKey, setSortKey] = useState<ProjectSortKey>(initialSort);
  const [pagination, setPagination] = useState<ProjectsPagination>(() => ({
    ...defaultPagination,
    page: initialPage,
    sort: initialSort,
  }));
  const [projects, setProjects] = useState<ProjectLibraryItem[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [projectTitleDrafts, setProjectTitleDrafts] = useState<
    Record<string, string>
  >({});
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(
    null
  );
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
  const sortMenuRef = useRef<HTMLDivElement | null>(null);
  const projectsRequestIdRef = useRef(0);
  const projectsRef = useRef<ProjectLibraryItem[]>([]);
  const projectTitleDraftsRef = useRef<Record<string, string>>({});
  const savedProjectTitlesRef = useRef<Record<string, string>>({});
  const renameTimeoutsRef = useRef<Map<string, number>>(new Map());
  const renameRequestIdRef = useRef<Map<string, number>>(new Map());
  const editingProjectIdRef = useRef<string | null>(null);
  const renderPollInFlightRef = useRef(false);
  const isUnmountedRef = useRef(false);
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

  const buildProjectsUrl = useCallback((nextPage: number, nextSort: ProjectSortKey) => {
    const params = new URLSearchParams();
    params.set("page", String(nextPage));
    if (nextSort !== "updated") {
      params.set("sort", nextSort);
    }
    return `/projects?${params.toString()}`;
  }, []);

  const clearRenameTimeout = useCallback((projectId: string) => {
    const timeoutId = renameTimeoutsRef.current.get(projectId);
    if (timeoutId != null) {
      window.clearTimeout(timeoutId);
      renameTimeoutsRef.current.delete(projectId);
    }
  }, []);

  const bumpRenameRequestId = useCallback((projectId: string) => {
    const next = (renameRequestIdRef.current.get(projectId) ?? 0) + 1;
    renameRequestIdRef.current.set(projectId, next);
    return next;
  }, []);

  const setProjectTitleLocally = useCallback((projectId: string, title: string) => {
    setProjects((prev) =>
      prev.map((project) =>
        project.id === projectId ? { ...project, title } : project
      )
    );
    setPreviewProject((prev) =>
      prev && prev.id === projectId ? { ...prev, title } : prev
    );
  }, []);

  const saveProjectTitle = useCallback(
    async (projectId: string, rawTitle: string) => {
      const requestId = bumpRenameRequestId(projectId);
      const normalizedTitle = normalizeProjectTitle(rawTitle);
      try {
        const response = await fetch("/api/projects", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: projectId,
            title: normalizedTitle,
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const message =
            typeof payload?.error === "string"
              ? payload.error
              : "Unable to rename project.";
          throw new Error(message);
        }
        if (
          isUnmountedRef.current ||
          renameRequestIdRef.current.get(projectId) !== requestId
        ) {
          return;
        }
        const savedTitle =
          typeof payload?.project?.title === "string"
            ? normalizeProjectTitle(payload.project.title)
            : normalizedTitle;
        savedProjectTitlesRef.current[projectId] = savedTitle;
        setProjectTitleLocally(projectId, savedTitle);
        if (editingProjectIdRef.current !== projectId) {
          setProjectTitleDrafts((prev) =>
            prev[projectId] === savedTitle
              ? prev
              : { ...prev, [projectId]: savedTitle }
          );
        }
      } catch (error) {
        if (
          isUnmountedRef.current ||
          renameRequestIdRef.current.get(projectId) !== requestId
        ) {
          return;
        }
        const persistedTitle = savedProjectTitlesRef.current[projectId];
        if (typeof persistedTitle === "string") {
          setProjectTitleLocally(projectId, persistedTitle);
          setProjectTitleDrafts((prev) =>
            prev[projectId] === persistedTitle
              ? prev
              : { ...prev, [projectId]: persistedTitle }
          );
        }
        setProjectsError(
          error instanceof Error ? error.message : "Unable to rename project."
        );
      }
    },
    [bumpRenameRequestId, setProjectTitleLocally]
  );

  const scheduleProjectTitleSave = useCallback(
    (projectId: string, rawTitle: string) => {
      clearRenameTimeout(projectId);
      const timeoutId = window.setTimeout(() => {
        renameTimeoutsRef.current.delete(projectId);
        void saveProjectTitle(projectId, rawTitle);
      }, 500);
      renameTimeoutsRef.current.set(projectId, timeoutId);
    },
    [clearRenameTimeout, saveProjectTitle]
  );

  const handleProjectTitleClick = useCallback((project: ProjectLibraryItem) => {
    setEditingProjectId(project.id);
    setProjectTitleDrafts((prev) =>
      prev[project.id] === project.title
        ? prev
        : { ...prev, [project.id]: project.title }
    );
  }, []);

  const handleProjectTitleChange = useCallback(
    (projectId: string, title: string) => {
      setProjectTitleDrafts((prev) =>
        prev[projectId] === title ? prev : { ...prev, [projectId]: title }
      );
      setProjectTitleLocally(projectId, title);
      scheduleProjectTitleSave(projectId, title);
    },
    [scheduleProjectTitleSave, setProjectTitleLocally]
  );

  const flushProjectTitleSave = useCallback(
    (projectId: string) => {
      clearRenameTimeout(projectId);
      const draftTitle = projectTitleDraftsRef.current[projectId];
      if (typeof draftTitle !== "string") {
        return;
      }
      const nextNormalized = normalizeProjectTitle(draftTitle);
      const savedNormalized = normalizeProjectTitle(
        savedProjectTitlesRef.current[projectId] ?? ""
      );
      if (nextNormalized === savedNormalized) {
        setProjectTitleLocally(projectId, savedNormalized);
        return;
      }
      void saveProjectTitle(projectId, draftTitle);
    },
    [clearRenameTimeout, saveProjectTitle, setProjectTitleLocally]
  );

  const handleProjectTitleBlur = useCallback(
    (projectId: string) => {
      setEditingProjectId((prev) => (prev === projectId ? null : prev));
      flushProjectTitleSave(projectId);
    },
    [flushProjectTitleSave]
  );

  const handleProjectTitleKeyDown = useCallback(
    (
      event: ReactKeyboardEvent<HTMLInputElement>,
      project: ProjectLibraryItem
    ) => {
      if (event.key === "Enter") {
        event.preventDefault();
        event.currentTarget.blur();
        return;
      }
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      clearRenameTimeout(project.id);
      bumpRenameRequestId(project.id);
      const persistedTitle =
        savedProjectTitlesRef.current[project.id] ?? project.title;
      setProjectTitleDrafts((prev) => ({
        ...prev,
        [project.id]: persistedTitle,
      }));
      setProjectTitleLocally(project.id, persistedTitle);
      setEditingProjectId((prev) => (prev === project.id ? null : prev));
      event.currentTarget.blur();
    },
    [bumpRenameRequestId, clearRenameTimeout, setProjectTitleLocally]
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
      } catch {
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
      const renderUi = resolveProjectRenderUi(project);
      if (!renderUi.isReady) {
        return;
      }
      const url = buildProjectVideoUrl(project.id, "attachment");
      window.open(url, "_blank", "noopener,noreferrer");
    },
    [buildProjectVideoUrl]
  );

  const handleSortChange = useCallback(
    (nextSort: ProjectSortKey) => {
      setSortMenuOpen(false);
      if (nextSort === sortKey && page === 1) {
        return;
      }
      const nextPage = 1;
      setOpenProjectMenuIndex(null);
      setPage(nextPage);
      setSortKey(nextSort);
      setPagination((prev) => ({ ...prev, page: nextPage, sort: nextSort }));
      router.replace(buildProjectsUrl(nextPage, nextSort), { scroll: false });
    },
    [buildProjectsUrl, page, router, sortKey]
  );

  const handlePageChange = useCallback(
    (nextPage: number) => {
      const clamped = clampPage(nextPage, pagination.totalPages);
      if (clamped === page) {
        return;
      }
      setOpenProjectMenuIndex(null);
      setSortMenuOpen(false);
      setPage(clamped);
      setPagination((prev) => ({ ...prev, page: clamped }));
      router.replace(buildProjectsUrl(clamped, sortKey), { scroll: false });
    },
    [buildProjectsUrl, page, pagination.totalPages, router, sortKey]
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
    if (!sortMenuOpen) {
      return;
    }
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && sortMenuRef.current?.contains(target)) {
        return;
      }
      setSortMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [sortMenuOpen]);

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
    projectsRef.current = projects;
  }, [projects]);

  useEffect(() => {
    projectTitleDraftsRef.current = projectTitleDrafts;
  }, [projectTitleDrafts]);

  useEffect(() => {
    editingProjectIdRef.current = editingProjectId;
  }, [editingProjectId]);

  useEffect(() => {
    const renameTimeouts = renameTimeoutsRef.current;
    return () => {
      isUnmountedRef.current = true;
      renameTimeouts.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      renameTimeouts.clear();
    };
  }, []);

  useEffect(() => {
    const nextPage = parsePageParam(searchParams.get("page"));
    const nextSort = parseSortKey(searchParams.get("sort"));
    setPage((prev) => (prev === nextPage ? prev : nextPage));
    setSortKey((prev) => (prev === nextSort ? prev : nextSort));
    setPagination((prev) =>
      prev.page === nextPage && prev.sort === nextSort
        ? prev
        : { ...prev, page: nextPage, sort: nextSort }
    );
  }, [searchParams]);

  const loadProjects = useCallback(
    async (options?: { silent?: boolean }) => {
      const requestId = projectsRequestIdRef.current + 1;
      projectsRequestIdRef.current = requestId;
      const silent = options?.silent === true;
      if (!silent) {
        setProjectsLoading(true);
      }
      setProjectsError(null);
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        if (sortKey !== "updated") {
          params.set("sort", sortKey);
        }
        const response = await fetch(`/api/projects?${params.toString()}`);
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const message =
            typeof payload?.error === "string"
              ? payload.error
              : "Unable to load projects.";
          throw new Error(message);
        }
        if (!isUnmountedRef.current) {
          const nextProjects: ProjectLibraryItem[] = Array.isArray(
            payload?.projects
          )
            ? (payload.projects as ProjectLibraryItem[])
            : [];
          if (requestId !== projectsRequestIdRef.current) {
            return;
          }
          const currentDrafts = projectTitleDraftsRef.current;
          const mergedProjects = nextProjects.map((project) => {
            const draftTitle = currentDrafts[project.id];
            return typeof draftTitle === "string"
              ? { ...project, title: draftTitle }
              : project;
          });
          setProjects(mergedProjects);
          savedProjectTitlesRef.current = Object.fromEntries(
            nextProjects.map((project) => [project.id, project.title])
          );
          setProjectTitleDrafts((prev) => {
            const activeProjectIds = new Set(nextProjects.map((project) => project.id));
            const nextDrafts = Object.fromEntries(
              Object.entries(prev).filter(([id]) => activeProjectIds.has(id))
            );
            return Object.keys(nextDrafts).length === Object.keys(prev).length
              ? prev
              : nextDrafts;
          });

          const paginationPayload = payload?.pagination;
          if (paginationPayload && typeof paginationPayload === "object") {
            const nextPage = parsePageParam(
              typeof paginationPayload.page === "number" ||
                typeof paginationPayload.page === "string"
                ? String(paginationPayload.page)
                : String(page)
            );
            const nextSort = parseSortKey(
              typeof paginationPayload.sort === "string"
                ? paginationPayload.sort
                : sortKey
            );
            const nextPagination: ProjectsPagination = {
              page: nextPage,
              sort: nextSort,
              pageSize: toNonNegativeInt(paginationPayload.pageSize, PAGE_SIZE) || PAGE_SIZE,
              totalCount: toNonNegativeInt(paginationPayload.totalCount, nextProjects.length),
              totalPages:
                Math.max(1, toNonNegativeInt(paginationPayload.totalPages, 1)) || 1,
            };
            setPagination(nextPagination);
            if (nextPage !== page || nextSort !== sortKey) {
              router.replace(buildProjectsUrl(nextPage, nextSort), {
                scroll: false,
              });
              setPage(nextPage);
              setSortKey(nextSort);
            }
          } else {
            setPagination((prev) => ({
              ...prev,
              page,
              sort: sortKey,
              pageSize: PAGE_SIZE,
              totalCount: nextProjects.length,
              totalPages: 1,
            }));
          }
        }
      } catch (error) {
        if (!isUnmountedRef.current) {
          setProjectsError(
            error instanceof Error ? error.message : "Unable to load projects."
          );
        }
      } finally {
        if (!silent && !isUnmountedRef.current && requestId === projectsRequestIdRef.current) {
          setProjectsLoading(false);
        }
      }
    },
    [buildProjectsUrl, page, router, sortKey]
  );

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleDeleteProject = useCallback(
    async (project: ProjectLibraryItem) => {
      if (deletingProjectId) {
        return;
      }
      const confirmed = window.confirm(
        `Delete project \"${project.title}\"? This cannot be undone.`
      );
      if (!confirmed) {
        return;
      }
      clearRenameTimeout(project.id);
      bumpRenameRequestId(project.id);
      setProjectTitleDrafts((prev) => {
        if (!(project.id in prev)) {
          return prev;
        }
        const next = { ...prev };
        delete next[project.id];
        return next;
      });
      delete savedProjectTitlesRef.current[project.id];
      setDeletingProjectId(project.id);
      setProjectsError(null);
      try {
        const response = await fetch(
          `/api/projects?id=${encodeURIComponent(project.id)}`,
          {
            method: "DELETE",
          }
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const message =
            typeof payload?.error === "string"
              ? payload.error
              : "Unable to delete project.";
          throw new Error(message);
        }
        if (!isUnmountedRef.current) {
          setPreviewProject((prev) => (prev?.id === project.id ? null : prev));
          setProjects((prev) => prev.filter((item) => item.id !== project.id));
        }
        await loadProjects({ silent: true });
      } catch (error) {
        if (!isUnmountedRef.current) {
          setProjectsError(
            error instanceof Error ? error.message : "Unable to delete project."
          );
        }
      } finally {
        if (!isUnmountedRef.current) {
          setDeletingProjectId(null);
        }
      }
    },
    [bumpRenameRequestId, clearRenameTimeout, deletingProjectId, loadProjects]
  );

  const pollRenderingProjects = useCallback(async () => {
    if (renderPollInFlightRef.current) {
      return;
    }
    renderPollInFlightRef.current = true;
    try {
      const currentProjects = projectsRef.current;
      const renderingProjectsWithJobs = currentProjects.filter((project) => {
        if (!resolveProjectRenderUi(project).isRendering) {
          return false;
        }
        return (
          typeof project.renderJobId === "string" &&
          project.renderJobId.trim().length > 0
        );
      });

      if (renderingProjectsWithJobs.length === 0) {
        await loadProjects({ silent: true });
        return;
      }

      const updates = await Promise.all<ProjectRenderUpdate | null>(
        renderingProjectsWithJobs.map(async (project) => {
          const jobId = project.renderJobId?.trim();
          if (!jobId) {
            return null;
          }
          const params = new URLSearchParams({
            jobId,
            projectId: project.id,
          });
          try {
            const response = await fetch(
              `/api/editor/export/status?${params.toString()}`
            );
            if (!response.ok) {
              return null;
            }
            const data = await response.json().catch(() => ({}));
            const statusRaw =
              typeof data?.status === "string" ? data.status : "rendering";
            const renderStatus: ProjectRenderStatus =
              statusRaw === "complete"
                ? "complete"
                : statusRaw === "error"
                  ? "error"
                  : "rendering";
            const renderStage =
              typeof data?.stage === "string" && data.stage.trim().length > 0
                ? data.stage
                : project.renderStage ?? null;
            const renderProgress =
              typeof data?.progress === "number"
                ? clamp01(data.progress)
                : project.renderProgress ?? null;
            return {
              id: project.id,
              renderStatus,
              renderStage,
              renderProgress,
              downloadAvailable:
                renderStatus === "complete"
                  ? true
                  : project.downloadAvailable ?? false,
              hasOutput:
                renderStatus === "complete" ? true : project.hasOutput ?? false,
            };
          } catch {
            return null;
          }
        })
      );

      const updatesById = new Map(
        updates
          .filter((update): update is ProjectRenderUpdate => update != null)
          .map((update) => [update.id, update])
      );

      if (updatesById.size > 0 && !isUnmountedRef.current) {
        setProjects((prev) =>
          prev.map((project) => {
            const update = updatesById.get(project.id);
            return update ? { ...project, ...update } : project;
          })
        );
      }

      await loadProjects({ silent: true });
    } finally {
      renderPollInFlightRef.current = false;
    }
  }, [loadProjects]);

  const hasRenderingProjects = projects.some(
    (project) => resolveProjectRenderUi(project).isRendering
  );

  useEffect(() => {
    if (!hasRenderingProjects) {
      return;
    }
    pollRenderingProjects();
    const intervalId = window.setInterval(() => {
      pollRenderingProjects();
    }, 4000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [hasRenderingProjects, pollRenderingProjects]);

  useEffect(() => {
    if (!previewProject) {
      return;
    }
    const updated = projects.find((project) => project.id === previewProject.id);
    if (updated && updated !== previewProject) {
      setPreviewProject(updated);
    }
  }, [previewProject, projects]);

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

  const previewRenderUi = previewProject
    ? resolveProjectRenderUi(previewProject)
    : null;
  const previewCanStream = Boolean(previewProject && previewRenderUi?.isReady);
  const previewVideoUrl =
    previewProject && previewCanStream
      ? buildProjectVideoUrl(previewProject.id, "inline")
      : null;
  const previewCreatedLabel = previewProject
    ? formatDateLabel(previewProject.createdAt)
    : "--";
  const previewUpdatedLabel = previewProject
    ? formatDateLabel(previewProject.updatedAt ?? previewProject.createdAt)
    : "--";
  const previewStageLabel = previewRenderUi?.stageLabel ?? null;
  const previewProgressPercent = previewRenderUi?.progressPercent ?? null;
  const previewDownloadEnabled = Boolean(previewRenderUi?.isReady);
  const previewDownloadLabel = previewRenderUi?.isRendering
    ? "Rendering..."
    : previewDownloadEnabled
      ? "Download MP4"
      : previewRenderUi?.isError
        ? "Export failed"
        : "Export to download";
  const previewStatusLabel = previewRenderUi?.badgeLabel ?? "Draft";
  const previewStatusClassName = previewRenderUi?.isRendering
    ? "text-[#9aed00]"
    : previewRenderUi?.isReady
      ? "text-[#4caf50]"
      : previewRenderUi?.isError
        ? "text-[#e72930]"
        : "text-[#898a8b]";
  const previewRenderMessage =
    previewRenderUi?.isRendering && previewStageLabel
      ? previewProgressPercent != null
        ? `${previewStageLabel} - ${previewProgressPercent}%`
        : previewStageLabel
      : previewStageLabel;
  const sortLabel = sortLabelByKey.get(sortKey) ?? "Last Updated";
  const currentPage = pagination.page;
  const totalPages = Math.max(1, pagination.totalPages);
  const pageSizeLabel = pagination.pageSize || PAGE_SIZE;
  const canPreviousPage = currentPage > 1;
  const canNextPage = currentPage < totalPages;
  const pageWindowSize = 7;
  const windowStart = Math.max(1, currentPage - Math.floor(pageWindowSize / 2));
  const windowEnd = Math.min(totalPages, windowStart + pageWindowSize - 1);
  const adjustedStart = Math.max(1, windowEnd - pageWindowSize + 1);
  const pageNumbers = Array.from(
    { length: windowEnd - adjustedStart + 1 },
    (_, index) => adjustedStart + index
  );

  return (
    <div className="min-h-screen bg-[#0e1012] font-sans text-[#f7f7f8]">
      <div className="mx-auto flex w-full max-w-[90rem]">
        <aside className="sticky top-0 hidden min-h-screen w-24 flex-col items-center border-r border-[rgba(255,255,255,0.08)] bg-[#0e1012] py-3 md:flex">
          <div
            ref={navContainerRef}
            className="relative flex w-full flex-1 flex-col items-center gap-4"
          >
            <div
              className="pointer-events-none absolute left-0 top-0 w-1.5 rounded-r-lg bg-[#6a47ff] transition-[transform,height,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{
                transform: `translateY(${indicatorStyle.top}px)`,
                height: `${indicatorStyle.height}px`,
                opacity: indicatorStyle.opacity,
                transition: indicatorReady ? undefined : "none",
                boxShadow: "0px 0px 12px rgba(106, 71, 255, 0.5)",
              }}
            />
            <SaturaLogo size="md" />
            <div className="h-px w-10 bg-[rgba(255,255,255,0.08)]" />
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
                  className={`flex h-11 w-11 items-center justify-center rounded-lg transition-all duration-200 ${
                    item.active ? "bg-[rgba(154,237,0,0.1)]" : "hover:bg-[rgba(255,255,255,0.05)]"
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

        <main className="flex min-h-screen flex-1 flex-col px-4 pb-10 pt-4 md:px-6 md:py-6">
          <div className="sticky top-0 z-20 -mx-4 flex items-center justify-between bg-[#0e1012]/90 px-4 py-3 backdrop-blur-xl md:hidden">
            <SaturaLogo size="sm" />
            <button
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] transition-colors hover:bg-[#252729]"
              type="button"
              aria-label="Open menu"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-4 w-4 text-[#f7f7f8]"
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
              className={`absolute inset-0 bg-black/50 transition-opacity ${
                mobileMenuOpen ? "opacity-100" : "opacity-0"
              }`}
              onClick={() => setMobileMenuOpen(false)}
            />
            <div
              className={`absolute left-0 top-0 h-full w-[82%] max-w-xs bg-[#0e1012] shadow-xl transition-transform ${
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
                    <p className="text-sm font-medium text-[#f7f7f8]">
                      Jonathan Groschel
                    </p>
                    <p className="text-xs text-[#898a8b]">
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
                      className="border-b border-[rgba(255,255,255,0.08)] last:border-0"
                    >
                      <button
                        className="flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-[rgba(255,255,255,0.05)] focus:outline-none"
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls={`section-${sectionId}`}
                        onClick={() => toggleSection(section.label)}
                      >
                        <div className="flex items-center space-x-2">
                          {section.icon}
                          <span className="text-sm font-medium text-[#f7f7f8]">
                            {section.label}
                          </span>
                        </div>
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          className={`h-4 w-4 text-[#898a8b] transition-transform duration-200 ${
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
                              className="flex w-full items-center px-10 py-2 text-left text-sm text-[#898a8b] transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-[#f7f7f8] focus:outline-none"
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
                        ? "text-[#e72930] hover:bg-[rgba(231,41,48,0.1)]"
                        : "text-[#898a8b] hover:bg-[rgba(255,255,255,0.05)] hover:text-[#f7f7f8]"
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {action.label}
                  </a>
                ))}
              </div>
            </div>
          </div>

          <div className="sticky top-0 z-20 hidden items-center justify-between bg-[#0e1012]/95 py-3 backdrop-blur-xl md:flex">
            <div className="flex items-center gap-2">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e]">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-5 w-5 text-[#9aed00]"
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
                <h2 className="font-[family-name:var(--font-geist-sans)] text-lg font-semibold uppercase tracking-tight text-[#f7f7f8]">Projects</h2>
              </div>
            </div>
            <div className="relative" ref={profileMenuRef}>
              <button
                className="flex h-10 w-auto items-center space-x-3 rounded-full border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] p-1 px-2 transition-colors hover:bg-[#252729] focus:outline-none"
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
                  className="h-4 w-4 text-[#898a8b]"
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
                className={`absolute right-0 top-full z-30 mt-2 w-64 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] shadow-lg transition-all duration-150 ${
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
                    <p className="text-base font-medium text-[#f7f7f8]">Jonathan Groschel</p>
                    <p className="text-xs text-[#898a8b]">
                      jonathangroschel5@gmail.com
                    </p>
                  </div>
                </div>
                <button
                  className="block w-full px-3 py-1.5 text-left text-xs font-normal text-[#898a8b] transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-[#f7f7f8] sm:px-3 sm:py-2 sm:text-sm"
                  type="button"
                  onClick={() => setProfileMenuOpen(false)}
                >
                  Settings
                </button>
                <button
                  className="block w-full px-3 py-1.5 text-left text-xs font-normal text-[#898a8b] transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-[#f7f7f8] sm:px-3 sm:py-2 sm:text-sm"
                  type="button"
                  onClick={() => setProfileMenuOpen(false)}
                >
                  Upgrade
                </button>
                <button
                  className="block w-full px-3 py-1.5 text-left text-xs font-normal text-[#898a8b] transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-[#f7f7f8] sm:px-3 sm:py-2 sm:text-sm"
                  type="button"
                  onClick={() => setProfileMenuOpen(false)}
                >
                  24/7 Support
                </button>
                <button
                  className="block w-full rounded-b-lg px-3 py-1.5 text-left text-xs font-normal text-[#e72930] transition-colors hover:bg-[rgba(231,41,48,0.1)] sm:px-3 sm:py-2 sm:text-sm"
                  type="button"
                  onClick={() => setProfileMenuOpen(false)}
                >
                  Log Out
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-4 border-t border-[rgba(255,255,255,0.08)] pt-4 md:border-none md:pt-0">
            <div className="flex flex-col space-y-3 lg:flex-row lg:items-end lg:justify-between lg:space-y-0">
              <div className="relative w-full lg:w-64" ref={sortMenuRef}>
                <button
                  className="group w-full"
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={sortMenuOpen}
                  onClick={() => setSortMenuOpen((open) => !open)}
                >
                  <div className="flex items-center justify-between rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] px-3 py-2 text-left transition-colors hover:bg-[#252729]">
                    <p className="text-sm text-[#f7f7f8]">{sortLabel}</p>
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="h-4 w-4 text-[#898a8b]"
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
                <div
                  role="listbox"
                  aria-label="Sort projects"
                  className={`absolute z-30 mt-2 w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] p-1 text-sm shadow-lg transition-all ${
                    sortMenuOpen
                      ? "pointer-events-auto translate-y-0 opacity-100"
                      : "pointer-events-none translate-y-1 opacity-0"
                  }`}
                >
                  {projectSortOptions.map((option) => {
                    const isSelected = option.key === sortKey;
                    return (
                      <button
                        key={option.key}
                        role="option"
                        aria-selected={isSelected}
                        className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left transition-colors ${
                          isSelected
                            ? "bg-[rgba(154,237,0,0.1)] text-[#f7f7f8]"
                            : "text-[#898a8b] hover:bg-[rgba(255,255,255,0.05)] hover:text-[#f7f7f8]"
                        }`}
                        type="button"
                        onClick={() => handleSortChange(option.key)}
                      >
                        <span>{option.label}</span>
                        {isSelected ? (
                          <svg
                            aria-hidden="true"
                            viewBox="0 0 24 24"
                            className="h-4 w-4 text-[#9aed00]"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="m20 6-11 11-5-5" />
                          </svg>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
              <button
                className="hidden max-h-[42px] w-full items-center justify-center gap-2 rounded-lg bg-[#9aed00] px-4 py-3 text-sm font-medium text-black transition-all hover:shadow-[0px_0px_12px_rgba(154,237,0,0.4)] sm:flex sm:w-fit"
                type="button"
                onClick={() => router.push("/editor/advanced")}
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
                <div className="col-span-full rounded-xl border border-dashed border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] p-6 text-sm text-[#898a8b]">
                  Loading projects...
                </div>
              ) : projectsError ? (
                <div className="col-span-full rounded-xl border border-[rgba(231,41,48,0.3)] bg-[rgba(231,41,48,0.1)] p-6 text-sm text-[#e72930]">
                  {projectsError}
                </div>
              ) : projects.length ? (
                projects.map((project, index) => {
                  const renderUi = resolveProjectRenderUi(project);
                  const renderDetailLabel =
                    renderUi.stageLabel && renderUi.progressPercent != null
                      ? `${renderUi.stageLabel} - ${renderUi.progressPercent}%`
                      : renderUi.stageLabel;
                  const isDeleting = deletingProjectId === project.id;
                  const updatedLabel = formatRelativeTimeLabel(
                    project.updatedAt ?? project.createdAt,
                    "Updated"
                  );
                  const isEditingTitle = editingProjectId === project.id;
                  const titleDraft =
                    projectTitleDrafts[project.id] ?? project.title;
                  return (
                    <div
                      key={project.id}
                      className={`relative flex w-full cursor-pointer flex-col rounded-lg border border-[rgba(217,217,217,0.04)] bg-[#1a1c1e] transition-all duration-200 hover:border-[rgba(106,71,255,0.3)] ${
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
                        <ProjectPreviewMedia project={project} />
                      </div>
                      <div className="flex w-full flex-col gap-1 border-t border-[rgba(255,255,255,0.08)] p-3.5">
                        <div className="flex w-full items-center gap-2">
                          <div className="flex min-w-[100px] flex-1 items-center gap-2">
                            {isEditingTitle ? (
                              <input
                                value={titleDraft}
                                autoFocus
                                maxLength={80}
                                className="h-7 w-full min-w-0 rounded-md border border-[#9aed00]/30 bg-[#0e1012] px-2 text-sm text-[#f7f7f8] outline-none ring-0 transition focus:border-[#9aed00] focus:ring-2 focus:ring-[#9aed00]/20"
                                onChange={(event) =>
                                  handleProjectTitleChange(
                                    project.id,
                                    event.currentTarget.value
                                  )
                                }
                                onBlur={() => handleProjectTitleBlur(project.id)}
                                onClick={(event) => event.stopPropagation()}
                                onKeyDown={(event) => {
                                  event.stopPropagation();
                                  handleProjectTitleKeyDown(event, project);
                                }}
                                aria-label="Project name"
                              />
                            ) : (
                              <button
                                type="button"
                                className="min-w-0 flex-1 truncate rounded px-1 text-left text-sm text-[#f7f7f8] transition-colors hover:bg-[rgba(255,255,255,0.05)]"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleProjectTitleClick(project);
                                }}
                                onDoubleClick={(event) => {
                                  event.stopPropagation();
                                  handleProjectTitleClick(project);
                                }}
                                aria-label={`Rename ${project.title}`}
                              >
                                <span className="truncate">{project.title}</span>
                              </button>
                            )}
                            <div
                              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${renderUi.badgeClassName}`}
                            >
                              {renderUi.badgeShowPing ? (
                                <span className="relative flex h-1.5 w-1.5">
                                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#9aed00]/60" />
                                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#9aed00]" />
                                </span>
                              ) : null}
                              {renderUi.badgeLabel}
                            </div>
                          </div>
                          <div className="relative" data-project-menu>
                            <button
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-[#898a8b] transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-[#f7f7f8]"
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
                              className={`absolute right-0 top-9 z-30 w-48 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] p-2 text-sm shadow-lg transition-all ${
                                openProjectMenuIndex === index
                                  ? "pointer-events-auto translate-y-0 opacity-100"
                                  : "pointer-events-none translate-y-1 opacity-0"
                              }`}
                            >
                              <button
                                className="block w-full rounded-lg px-2 py-1.5 text-left text-[#898a8b] transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-[#f7f7f8]"
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
                                className={`mt-1 block w-full rounded-lg px-2 py-1.5 text-left text-[#e72930] transition-colors hover:bg-[rgba(231,41,48,0.1)] disabled:cursor-not-allowed disabled:opacity-60 ${
                                  isDeleting ? "pointer-events-none" : ""
                                }`}
                                type="button"
                                disabled={isDeleting}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setOpenProjectMenuIndex(null);
                                  handleDeleteProject(project);
                                }}
                              >
                                {isDeleting ? "Deleting..." : "Delete project"}
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-[#898a8b]">
                            {updatedLabel}
                          </span>
                        </div>
                        {renderUi.isRendering && renderDetailLabel ? (
                          <div className="mt-1 truncate text-[11px] font-medium text-[#9aed00]">
                            {renderDetailLabel}
                          </div>
                        ) : null}
                        {renderUi.isError && renderUi.stageLabel ? (
                          <div className="mt-1 truncate text-[11px] font-medium text-[#e72930]">
                            {renderUi.stageLabel}
                          </div>
                        ) : null}
                        {renderUi.isRendering || renderUi.isReady ? (
                          <div className="mt-2 flex items-center gap-2">
                            {renderUi.isRendering ? (
                              <button
                                type="button"
                                className="inline-flex h-8 items-center justify-center rounded-full bg-[rgba(154,237,0,0.1)] px-3 text-xs font-semibold text-[#9aed00]"
                                disabled
                              >
                                Rendering...
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="inline-flex h-8 items-center justify-center rounded-full bg-[#9aed00] px-3 text-xs font-semibold text-black shadow-[0_8px_16px_rgba(154,237,0,0.22)] transition hover:shadow-[0_8px_20px_rgba(154,237,0,0.35)]"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleDownloadProject(project);
                                }}
                              >
                                Download
                              </button>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-full rounded-xl border border-dashed border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] p-6 text-sm text-[#898a8b]">
                  No projects yet. Start editing to see them here.
                </div>
              )}
            </div>

            <div className="flex flex-col items-center space-y-2 sm:hidden">
              <span className="text-xs text-[#898a8b]">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center justify-center gap-1">
                <button
                  className="inline-flex h-8 min-w-[32px] items-center justify-center rounded-md px-1 text-sm text-[#898a8b] transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-[#f7f7f8] disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  aria-label="First page"
                  disabled={!canPreviousPage}
                  onClick={() => handlePageChange(1)}
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
                  className="inline-flex h-8 min-w-[32px] items-center justify-center rounded-md px-1 text-sm text-[#898a8b] transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-[#f7f7f8] disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  aria-label="Previous page"
                  disabled={!canPreviousPage}
                  onClick={() => handlePageChange(currentPage - 1)}
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
                {pageNumbers.map((pageNumber) => {
                  const isCurrent = pageNumber === currentPage;
                  return (
                    <button
                      key={`mobile-page-${pageNumber}`}
                      className={`inline-flex h-8 min-w-[32px] items-center justify-center rounded-md px-1 text-sm transition-colors ${
                        isCurrent
                          ? "bg-[rgba(154,237,0,0.1)] text-[#9aed00]"
                          : "text-[#898a8b] hover:bg-[rgba(255,255,255,0.05)] hover:text-[#f7f7f8]"
                      }`}
                      type="button"
                      aria-current={isCurrent ? "page" : undefined}
                      onClick={() => handlePageChange(pageNumber)}
                    >
                      {pageNumber}
                    </button>
                  );
                })}
                <button
                  className="inline-flex h-8 min-w-[32px] items-center justify-center rounded-md px-1 text-sm text-[#898a8b] transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-[#f7f7f8] disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  aria-label="Next page"
                  disabled={!canNextPage}
                  onClick={() => handlePageChange(currentPage + 1)}
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
                  className="inline-flex h-8 min-w-[32px] items-center justify-center rounded-md px-1 text-sm text-[#898a8b] transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-[#f7f7f8] disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  aria-label="Last page"
                  disabled={!canNextPage}
                  onClick={() => handlePageChange(totalPages)}
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
              <span className="absolute left-0 text-sm text-[#898a8b]">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center justify-center gap-1">
                <button
                  className="inline-flex h-8 min-w-[32px] items-center justify-center rounded-md px-1 text-sm text-[#898a8b] transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-[#f7f7f8] disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  aria-label="First page"
                  disabled={!canPreviousPage}
                  onClick={() => handlePageChange(1)}
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
                  className="inline-flex h-8 min-w-[32px] items-center justify-center rounded-md px-1 text-sm text-[#898a8b] transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-[#f7f7f8] disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  aria-label="Previous page"
                  disabled={!canPreviousPage}
                  onClick={() => handlePageChange(currentPage - 1)}
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
                {pageNumbers.map((pageNumber) => {
                  const isCurrent = pageNumber === currentPage;
                  return (
                    <button
                      key={`desktop-page-${pageNumber}`}
                      className={`inline-flex h-8 min-w-[32px] items-center justify-center rounded-md px-1 text-sm transition-colors ${
                        isCurrent
                          ? "bg-[rgba(154,237,0,0.1)] text-[#9aed00]"
                          : "text-[#898a8b] hover:bg-[rgba(255,255,255,0.05)] hover:text-[#f7f7f8]"
                      }`}
                      type="button"
                      aria-current={isCurrent ? "page" : undefined}
                      onClick={() => handlePageChange(pageNumber)}
                    >
                      {pageNumber}
                    </button>
                  );
                })}
                <button
                  className="inline-flex h-8 min-w-[32px] items-center justify-center rounded-md px-1 text-sm text-[#898a8b] transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-[#f7f7f8] disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  aria-label="Next page"
                  disabled={!canNextPage}
                  onClick={() => handlePageChange(currentPage + 1)}
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
                  className="inline-flex h-8 min-w-[32px] items-center justify-center rounded-md px-1 text-sm text-[#898a8b] transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-[#f7f7f8] disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  aria-label="Last page"
                  disabled={!canNextPage}
                  onClick={() => handlePageChange(totalPages)}
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
              <span className="absolute right-0 text-sm text-[#898a8b]">
                {pageSizeLabel} / page
              </span>
            </div>
          </div>
        </main>
      </div>
      {previewProject ? (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
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
              className="flex w-full max-w-[90vw] max-h-[90svh] flex-col gap-0 overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0e1012] shadow-lg focus:outline-none md:max-w-2xl"
              onClick={(event) => event.stopPropagation()}
              tabIndex={-1}
            >
              <div className="flex w-full items-center justify-between gap-2 border-b border-[rgba(255,255,255,0.08)] px-4 py-4 sm:px-6 sm:py-5">
                <h2
                  id="project-preview-title"
                  className="flex min-w-0 flex-1 items-center gap-2 text-lg font-medium leading-none tracking-tight text-[#f7f7f8]"
                >
                  <span className="truncate text-xl font-medium leading-none sm:text-2xl">
                    {previewProject.title}
                  </span>
                </h2>
                <button
                  className="rounded-sm text-[#898a8b] transition-colors hover:text-[#f7f7f8] focus:outline-none"
                  type="button"
                  aria-label="Close"
                  onClick={handleClosePreview}
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
                    <div className="grid gap-3 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] p-3 text-sm text-[#898a8b]">
                      <div className="flex items-center justify-between">
                        <p>Created on</p>
                        <p className="font-medium text-[#f7f7f8]">
                          {previewCreatedLabel}
                        </p>
                      </div>
                      <div className="flex items-center justify-between">
                        <p>Updated on</p>
                        <p className="font-medium text-[#f7f7f8]">
                          {previewUpdatedLabel}
                        </p>
                      </div>
                      <div className="flex items-center justify-between">
                        <p>Status</p>
                        <p className={`font-medium ${previewStatusClassName}`}>
                          {previewStatusLabel}
                        </p>
                      </div>
                    </div>
                    <div className="flex w-full flex-col gap-2 sm:flex-row">
                      <button
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] px-4 py-2 text-sm font-medium text-[#898a8b] transition-colors hover:bg-[#252729] hover:text-[#f7f7f8]"
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
                        className={`inline-flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                          previewDownloadEnabled
                            ? "border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] text-[#898a8b] hover:bg-[#252729] hover:text-[#f7f7f8]"
                            : "cursor-not-allowed border-[rgba(255,255,255,0.04)] bg-[#0e1012] text-[#525252]"
                        }`}
                        type="button"
                        disabled={!previewDownloadEnabled}
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
                        {previewDownloadLabel}
                      </button>
                    </div>
                  </div>
                  <div className="order-first flex flex-1 items-center justify-center overflow-hidden border-b border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] p-4 sm:order-none sm:border-b-0 sm:border-l">
                    {previewVideoUrl ? (
                      <video
                        src={previewVideoUrl}
                        controls
                        playsInline
                        preload="metadata"
                        poster={previewProject.previewImage ?? undefined}
                        className="h-full max-h-full w-auto max-w-full rounded-2xl object-contain"
                      />
                    ) : previewRenderUi?.isRendering ? (
                      <div className="flex h-full w-full flex-col items-center justify-center text-center text-sm font-medium text-[#9aed00]">
                        <p>{previewRenderMessage ?? "Rendering"}</p>
                        <p className="mt-1 text-xs font-normal text-[#9aed00]/80">
                          You can keep working. We will update this automatically.
                        </p>
                      </div>
                    ) : previewRenderUi?.isError ? (
                      <div className="flex h-full w-full items-center justify-center text-sm font-medium text-[#e72930]">
                        {previewRenderMessage ?? "Export failed"}
                      </div>
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm text-[#898a8b]">
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
