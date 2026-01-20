"use client";

import SearchOverlay from "@/components/search-overlay";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

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
      { label: "Trust Score", href: "/tools/trust-score" },
    ],
  },
  {
    label: "More",
    items: [{ label: "24/7 Support", href: "/support" }],
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

const ANALYSIS_STEPS = [
  {
    title: "Initializing trust lattice",
    detail: "Calibrating channel entropy vectors.",
    durationMs: 15000,
  },
  {
    title: "Fetching channel graph",
    detail: "Collecting uploads, metadata, and playlists.",
    durationMs: 20000,
  },
  {
    title: "Measuring swipe + retention",
    detail: "Computing start rates and target AVD curves.",
    durationMs: 25000,
  },
  {
    title: "Evaluating rewatch loops",
    detail: "Estimating replay density and completion.",
    durationMs: 20000,
  },
  {
    title: "Benchmarking engagement",
    detail: "Normalizing likes, comments, and subs.",
    durationMs: 20000,
  },
  {
    title: "Synthesizing action plan",
    detail: "Ranking improvements by expected lift.",
    durationMs: 20000,
  },
];

const MIN_ANALYSIS_MS = ANALYSIS_STEPS.reduce(
  (sum, step) => sum + step.durationMs,
  0
);

type ChannelSummary = {
  id: string;
  title: string;
  handle?: string | null;
  thumbnailUrl?: string | null;
  lastAnalyzedAt?: string | null;
  lastScore?: number | null;
  lastScoreAt?: string | null;
  components?: Record<string, number> | null;
  publishedAt?: string | null;
};

type Snapshot = {
  id: string;
  score: number;
  score_raw: number;
  account_score: number;
  performance_score: number;
  consistency_score: number;
  niche_score: number;
  swipe_avg: number | null;
  retention_avg: number | null;
  components?: Record<string, number> | null;
  action_items?: { title: string; detail: string; severity: string }[] | null;
  created_at: string;
};

type TrustScoreResult = {
  score: number;
  scoreRaw: number;
  accountScore: number;
  performanceScore: number;
  consistencyScore: number;
  nicheScore: number;
  swipeAvg: number | null;
  retentionAvg: number | null;
  windowStart: string;
  windowEnd: string;
  videoCount: number;
  actionItems: { title: string; detail: string; severity: string }[];
  components: Record<string, number>;
};

const formatDate = (value?: string | null) => {
  if (!value) return "Not yet";
  const date = new Date(value);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatTime = (value: number) => {
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const componentLabels: Record<string, string> = {
  channelAge: "Channel age",
  featureEligibility: "Long uploads",
  channelTags: "Channel tags",
  channelDescription: "Description",
  entertainmentCategory: "Category focus",
  enhancements: "Enhancements",
  swipeScore: "Start rate",
  retentionScore: "Retention",
  rewatchScore: "Rewatch",
  engagementScore: "Engagement",
  formattingScore: "Formatting",
  consistencyScore: "Consistency",
  nicheScore: "Niche clarity",
};

const getScoreTone = (score: number | null | undefined) => {
  if (score === null || score === undefined) return "text-gray-500";
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-blue-600";
  if (score >= 40) return "text-amber-600";
  return "text-rose-600";
};

const buildSparkline = (scores: number[]) => {
  if (scores.length < 2) return "";
  const width = 120;
  const height = 40;
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);
  const range = maxScore - minScore || 1;
  return scores
    .map((score, index) => {
      const x = (index / (scores.length - 1)) * width;
      const y = height - ((score - minScore) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
};

const getTopChanges = (latest?: Snapshot, previous?: Snapshot) => {
  if (!latest?.components || !previous?.components) return [];
  const deltas = Object.keys(componentLabels)
    .map((key) => ({
      key,
      label: componentLabels[key] ?? key,
      delta:
        (latest.components?.[key] ?? 0) - (previous.components?.[key] ?? 0),
    }))
    .filter((item) => Math.abs(item.delta) >= 0.25)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3);
  return deltas;
};

export default function TrustScorePage() {
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

  const [channels, setChannels] = useState<ChannelSummary[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [analysisResult, setAnalysisResult] = useState<TrustScoreResult | null>(null);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [analysisActive, setAnalysisActive] = useState(false);
  const [analysisStepIndex, setAnalysisStepIndex] = useState(0);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisElapsed, setAnalysisElapsed] = useState(0);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

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

  const loadChannels = useCallback(async () => {
    setLoadingChannels(true);
    try {
      const response = await fetch("/api/trust-score/channels");
      if (!response.ok) {
        setChannels([]);
        return;
      }
      const data = await response.json();
      const nextChannels = data.channels ?? [];
      setChannels(nextChannels);
      if (nextChannels.length > 0) {
        setSelectedChannelId((prev) => prev ?? nextChannels[0].id);
      }
    } catch {
      setChannels([]);
    } finally {
      setLoadingChannels(false);
    }
  }, []);

  const loadHistory = useCallback(async (channelId: string) => {
    try {
      const response = await fetch(
        `/api/trust-score/history?channelId=${encodeURIComponent(channelId)}`
      );
      if (!response.ok) {
        setHistory([]);
        return;
      }
      const data = await response.json();
      setHistory(data.snapshots ?? []);
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  useEffect(() => {
    if (!selectedChannelId) {
      return;
    }
    setAnalysisResult(null);
    setAnalysisError(null);
    loadHistory(selectedChannelId);
  }, [selectedChannelId, loadHistory]);

  useEffect(() => {
    if (!analysisActive) {
      return;
    }
    const start = Date.now();
    const total = MIN_ANALYSIS_MS;
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      setAnalysisElapsed(elapsed);
      const progress = Math.min(100, (elapsed / total) * 100);
      setAnalysisProgress(progress);

      let accumulated = 0;
      let stepIndex = 0;
      for (let index = 0; index < ANALYSIS_STEPS.length; index += 1) {
        accumulated += ANALYSIS_STEPS[index].durationMs;
        if (elapsed <= accumulated) {
          stepIndex = index;
          break;
        }
        stepIndex = index;
      }
      setAnalysisStepIndex(stepIndex);
    }, 1000);

    return () => clearInterval(interval);
  }, [analysisActive]);

  const handleAnalyze = async (channelId: string) => {
    setAnalysisError(null);
    setAnalysisActive(true);
    setAnalysisStepIndex(0);
    setAnalysisProgress(0);
    setAnalysisElapsed(0);

    const start = Date.now();
    try {
      const response = await fetch("/api/trust-score/compute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to compute trust score");
      }

      const elapsed = Date.now() - start;
      const remaining = Math.max(0, MIN_ANALYSIS_MS - elapsed);
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }

      setAnalysisResult(data as TrustScoreResult);
      await loadChannels();
      await loadHistory(channelId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to compute trust score";
      setAnalysisError(message);
    } finally {
      setAnalysisActive(false);
    }
  };

  const selectedChannel = channels.find(
    (channel) => channel.id === selectedChannelId
  );
  const latestSnapshot = history[0];
  const previousSnapshot = history[1];
  const currentScore =
    analysisResult?.score ??
    latestSnapshot?.score ??
    selectedChannel?.lastScore ??
    null;
  const currentComponents =
    analysisResult?.components ?? latestSnapshot?.components ?? null;
  const actionItems =
    analysisResult?.actionItems ?? latestSnapshot?.action_items ?? [];

  const sparklinePoints = useMemo(() => {
    const scores = [...history]
      .reverse()
      .map((entry) => entry.score)
      .filter((score) => typeof score === "number");
    return buildSparkline(scores);
  }, [history]);

  const topChanges = getTopChanges(latestSnapshot, previousSnapshot);

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
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E7EDFF] text-lg font-semibold text-[#335CFF]"
              href="/dashboard"
            >
              YA
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
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-sm font-semibold text-white">
                    TS
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      Trust Score
                    </p>
                    <p className="text-xs text-gray-500">
                      YouTube analytics
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
                  <path d="M12 3l7 4v6c0 5-3.5 7.5-7 8-3.5-.5-7-3-7-8V7l7-4z" />
                  <path d="M9.5 12.5 11 14l3.5-3.5" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-medium text-black">
                  Trust Score
                </h2>
                <p className="text-xs text-gray-500">
                  Nordic-grade channel credibility audit
                </p>
              </div>
            </div>
            <div className="relative" ref={profileMenuRef}>
              <button
                className="flex h-10 w-auto items-center space-x-3 rounded-full border border-gray-300 bg-white p-1 px-2 hover:bg-gray-100 focus:outline-none"
                type="button"
                aria-haspopup="menu"
                aria-expanded={profileMenuOpen}
                aria-controls="trust-score-profile-menu"
                onClick={() => setProfileMenuOpen((open) => !open)}
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-slate-600 to-slate-800 text-xs font-semibold text-white md:h-8 md:w-8 md:text-sm">
                  TS
                </div>
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
                id="trust-score-profile-menu"
                className={`absolute right-0 top-full z-30 mt-2 w-64 rounded-lg border border-gray-200 bg-white shadow-md transition-all duration-150 ${
                  profileMenuOpen
                    ? "pointer-events-auto translate-y-0 opacity-100"
                    : "pointer-events-none translate-y-1 opacity-0"
                }`}
              >
                <div className="flex flex-row items-center space-x-2 px-3 py-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-slate-600 to-slate-800 text-xs font-semibold text-white md:h-8 md:w-8 md:text-sm">
                    TS
                  </div>
                  <div className="flex flex-col items-start justify-start">
                    <p className="text-base font-medium">Trust Score</p>
                    <p className="text-xs text-gray-500">
                      Youtube analytics
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
                  className="block w-full rounded-b-lg px-3 py-1.5 text-left text-xs font-normal text-red-500 hover:bg-gray-100 sm:px-3 sm:py-2 sm:text-sm"
                  type="button"
                  onClick={() => setProfileMenuOpen(false)}
                >
                  Log Out
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-6 border-t border-gray-200 pt-4 md:border-none md:pt-0">
            <section className="rounded-3xl border border-gray-200 bg-white p-5 md:p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-gray-400">
                    Trust Score
                  </p>
                  <h1 className="mt-2 text-2xl font-semibold text-gray-900 md:text-3xl">
                    Measure credibility across every connected channel.
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm text-gray-500">
                    Connect one or more YouTube channels, run a deep trust
                    analysis, and get a step-by-step action plan. We keep a
                    timeline so you can see why your score moves over time.
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <a
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[#335CFF] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2B4FE0]"
                    href="/api/trust-score/oauth/start?returnTo=/tools/trust-score"
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
                      <path d="M12 3l7 4v6c0 5-3.5 7.5-7 8-3.5-.5-7-3-7-8V7l7-4z" />
                      <path d="M9.5 12.5 11 14l3.5-3.5" />
                    </svg>
                    Connect channel
                  </a>
                  <button
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                    type="button"
                    onClick={loadChannels}
                  >
                    Refresh list
                  </button>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_1.6fr]">
              <div className="rounded-3xl border border-gray-200 bg-white p-5 md:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      Connected channels
                    </h2>
                    <p className="text-xs text-gray-500">
                      Sync multiple channels and track each timeline.
                    </p>
                  </div>
                  <span className="rounded-full bg-[#EEF2FF] px-3 py-1 text-xs font-semibold text-[#335CFF]">
                    {channels.length} connected
                  </span>
                </div>
                <div className="mt-4 flex flex-col gap-3">
                  {loadingChannels ? (
                    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
                      Loading channels...
                    </div>
                  ) : channels.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
                      No channels connected yet. Connect your first channel to
                      generate a trust score.
                    </div>
                  ) : (
                    channels.map((channel) => (
                      <button
                        key={channel.id}
                        type="button"
                        onClick={() => setSelectedChannelId(channel.id)}
                        className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition ${
                          selectedChannelId === channel.id
                            ? "border-[#335CFF] bg-[#F3F6FF]"
                            : "border-gray-200 bg-white hover:border-gray-300"
                        }`}
                      >
                        {channel.thumbnailUrl ? (
                          <img
                            src={channel.thumbnailUrl}
                            alt={channel.title}
                            className="h-12 w-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-600">
                            {channel.title?.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-900">
                            {channel.title}
                          </p>
                          <p className="text-xs text-gray-500">
                            {channel.handle
                              ? `@${channel.handle}`
                              : "No handle"}{" "}
                            -{" "}
                            {channel.lastScoreAt
                              ? `Scored ${formatDate(channel.lastScoreAt)}`
                              : "Not scored yet"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p
                            className={`text-lg font-semibold ${getScoreTone(
                              channel.lastScore ?? null
                            )}`}
                          >
                            {channel.lastScore ?? "--"}
                          </p>
                          <p className="text-xs text-gray-400">Trust</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-gray-200 bg-white p-5 md:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      Trust score insights
                    </h2>
                    <p className="text-xs text-gray-500">
                      {selectedChannel
                        ? `Channel: ${selectedChannel.title}`
                        : "Select a channel to view details."}
                    </p>
                  </div>
                  {selectedChannel ? (
                    <button
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-[#0E121B] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-black"
                      type="button"
                      onClick={() => handleAnalyze(selectedChannel.id)}
                      disabled={analysisActive}
                    >
                      {analysisActive ? "Analyzing..." : "Recalculate score"}
                    </button>
                  ) : null}
                </div>
                {analysisError ? (
                  <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                    {analysisError}
                  </div>
                ) : null}

                <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr]">
                  <div className="rounded-2xl border border-gray-200 bg-[#F9FAFB] p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-gray-400">
                          Current score
                        </p>
                        <p
                          className={`mt-2 text-4xl font-semibold ${getScoreTone(
                            currentScore ?? null
                          )}`}
                        >
                          {currentScore ?? "--"}
                        </p>
                        <p className="text-xs text-gray-500">
                          Updated {formatDate(latestSnapshot?.created_at)}
                        </p>
                      </div>
                      <svg width="84" height="84" viewBox="0 0 120 120">
                        <circle
                          cx="60"
                          cy="60"
                          r="52"
                          stroke="#E5E7EB"
                          strokeWidth="10"
                          fill="none"
                        />
                        <circle
                          cx="60"
                          cy="60"
                          r="52"
                          stroke="#335CFF"
                          strokeWidth="10"
                          fill="none"
                          strokeLinecap="round"
                          strokeDasharray={2 * Math.PI * 52}
                          strokeDashoffset={
                            2 *
                            Math.PI *
                            52 *
                            (1 - (currentScore ?? 0) / 100)
                          }
                          transform="rotate(-90 60 60)"
                        />
                      </svg>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-gray-600">
                      <div>
                        <p className="text-[10px] uppercase text-gray-400">
                          Account
                        </p>
                        <p className="text-sm font-semibold text-gray-900">
                          {analysisResult?.accountScore ??
                            latestSnapshot?.account_score ??
                            "--"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-gray-400">
                          Performance
                        </p>
                        <p className="text-sm font-semibold text-gray-900">
                          {analysisResult?.performanceScore ??
                            latestSnapshot?.performance_score ??
                            "--"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-gray-400">
                          Consistency
                        </p>
                        <p className="text-sm font-semibold text-gray-900">
                          {analysisResult?.consistencyScore ??
                            latestSnapshot?.consistency_score ??
                            "--"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-gray-400">
                          Niche
                        </p>
                        <p className="text-sm font-semibold text-gray-900">
                          {analysisResult?.nicheScore ??
                            latestSnapshot?.niche_score ??
                            "--"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-gray-400">
                          Score trend
                        </p>
                        <p className="text-sm font-semibold text-gray-900">
                          {history.length > 1
                            ? `${latestSnapshot?.score ?? "--"} (${
                                latestSnapshot && previousSnapshot
                                  ? (latestSnapshot.score -
                                      previousSnapshot.score >=
                                    0
                                      ? "+"
                                      : "") +
                                    (latestSnapshot.score -
                                      previousSnapshot.score).toFixed(0)
                                  : ""
                              })`
                            : "No history yet"}
                        </p>
                      </div>
                      <div className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                        {history.length} runs
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-center rounded-xl bg-[#F8FAFC] py-4">
                      {sparklinePoints ? (
                        <svg width="120" height="40">
                          <polyline
                            points={sparklinePoints}
                            fill="none"
                            stroke="#335CFF"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : (
                        <p className="text-xs text-gray-400">
                          Run your first analysis to see a trendline.
                        </p>
                      )}
                    </div>
                    <div className="mt-4 space-y-2 text-xs text-gray-600">
                      {topChanges.length === 0 ? (
                        <p className="text-gray-400">
                          We will highlight score drivers after two runs.
                        </p>
                      ) : (
                        topChanges.map((change) => (
                          <div
                            key={change.key}
                            className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
                          >
                            <span>{change.label}</span>
                            <span
                              className={`font-semibold ${
                                change.delta >= 0
                                  ? "text-emerald-600"
                                  : "text-rose-600"
                              }`}
                            >
                              {change.delta >= 0 ? "+" : ""}
                              {change.delta.toFixed(1)}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
                  <div className="rounded-2xl border border-gray-200 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-gray-400">
                      Action plan
                    </p>
                    <div className="mt-3 space-y-3">
                      {actionItems.length === 0 ? (
                        <p className="text-sm text-gray-500">
                          Run a trust score to generate personalized
                          recommendations.
                        </p>
                      ) : (
                        actionItems.map((item) => (
                          <div
                            key={item.title}
                            className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-3"
                          >
                            <div
                              className={`mt-1 h-2.5 w-2.5 rounded-full ${
                                item.severity === "high"
                                  ? "bg-rose-500"
                                  : item.severity === "medium"
                                  ? "bg-amber-400"
                                  : "bg-emerald-400"
                              }`}
                            />
                            <div>
                              <p className="text-sm font-semibold text-gray-900">
                                {item.title}
                              </p>
                              <p className="text-xs text-gray-500">
                                {item.detail}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-gray-400">
                      Component scores
                    </p>
                    <div className="mt-3 space-y-2 text-xs text-gray-600">
                      {currentComponents ? (
                        Object.entries(componentLabels).map(([key, label]) => (
                          <div
                            key={key}
                            className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
                          >
                            <span>{label}</span>
                            <span className="font-semibold text-gray-900">
                              {(currentComponents[key] ?? 0).toFixed(2)}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500">
                          Component breakdown appears after your first score.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-gray-200 bg-white p-5 md:p-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Score history
                  </h2>
                  <p className="text-xs text-gray-500">
                    Review every run and identify the drivers behind the change.
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {history.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
                    No history yet. Run the trust score to log a baseline.
                  </div>
                ) : (
                  history.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-2xl border border-gray-200 bg-white p-4"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-xs uppercase tracking-[0.2em] text-gray-400">
                          {formatDate(entry.created_at)}
                        </p>
                        <span
                          className={`text-base font-semibold ${getScoreTone(
                            entry.score
                          )}`}
                        >
                          {entry.score}
                        </span>
                      </div>
                      <div className="mt-3 text-xs text-gray-500">
                        Account {entry.account_score} - Performance{" "}
                        {entry.performance_score}
                      </div>
                      <div className="mt-2 text-xs text-gray-500">
                        Consistency {entry.consistency_score} - Niche{" "}
                        {entry.niche_score}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </main>
      </div>

      {analysisActive ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0F1A]/70 px-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-gray-400">
                  Quantum analysis
                </p>
                <h3 className="mt-2 text-xl font-semibold text-gray-900">
                  Trust score computation in progress
                </h3>
                <p className="text-xs text-gray-500">
                  Estimated time: {formatTime(MIN_ANALYSIS_MS / 1000)}
                </p>
              </div>
              <div className="rounded-full bg-[#EEF2FF] px-3 py-1 text-xs font-semibold text-[#335CFF]">
                {Math.min(100, Math.round(analysisProgress))}%
              </div>
            </div>
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-[#335CFF] transition-all duration-1000"
                style={{ width: `${analysisProgress}%` }}
              />
            </div>
            <div className="mt-4 rounded-2xl border border-gray-200 bg-[#F9FAFB] p-4">
              <p className="text-sm font-semibold text-gray-900">
                {ANALYSIS_STEPS[analysisStepIndex]?.title}
              </p>
              <p className="text-xs text-gray-500">
                {ANALYSIS_STEPS[analysisStepIndex]?.detail}
              </p>
              <p className="mt-3 text-xs text-gray-400">
                Elapsed {formatTime(analysisElapsed / 1000)}
              </p>
            </div>
            {analysisError ? (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-600">
                {analysisError}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <SearchOverlay open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
