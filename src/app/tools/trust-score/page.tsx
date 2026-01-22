"use client";

import SearchOverlay from "@/components/search-overlay";
import { signOut } from "@/app/login/actions";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";

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
    label: "Trust Score",
    href: "/tools/trust-score",
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
    items: [{ label: "Editor", href: "/tools" }],
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
    title: "Getting your channel ready",
    detail: "Checking channel basics and recent uploads.",
    durationMs: 9000,
  },
  {
    title: "Pulling recent videos",
    detail: "Syncing titles, categories, and metadata.",
    durationMs: 9000,
  },
  {
    title: "Reading watch signals",
    detail: "Looking at retention and start rates.",
    durationMs: 9000,
  },
  {
    title: "Scoring engagement",
    detail: "Likes, comments, and subscriber gain.",
    durationMs: 9000,
  },
  {
    title: "Building your action plan",
    detail: "Highlighting the fastest wins.",
    durationMs: 9000,
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
  data_confidence?: "high" | "medium" | "low" | "insufficient" | null;
  created_at: string;
};

type TrustScoreResult = {
  score: number;
  scoreRaw: number;
  accountScore: number;
  performanceScore: number;
  consistencyScore: number;
  engagedViewAvg: number | null;
  shareRate: number | null;
  retentionAvg: number | null;
  windowStart: string;
  windowEnd: string;
  videoCount: number;
  actionItems: { title: string; detail: string; severity: string; category?: string }[];
  components: Record<string, number>;
  dataConfidence?: "high" | "medium" | "low" | "insufficient";
};

type ComponentBreakdownItem = {
  key: string;
  label: string;
  score: number | null;
  delta: number | null;
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

const componentLabels: Record<string, string> = {
  channelAge: "Channel age",
  featureEligibility: "Long uploads",
  channelTags: "Channel tags",
  channelDescription: "Description",
  entertainmentCategory: "Category focus",
  enhancements: "Enhancements",
  engagedViewScore: "Engaged view rate",
  retentionScore: "Retention",
  rewatchScore: "Rewatch",
  engagementScore: "Engagement",
  formattingScore: "Formatting",
  shareRateScore: "Share rate",
  consistencyScore: "Consistency",
};

const componentTooltips: Record<
  string,
  {
    summary: string;
    zero: string;
  }
> = {
  channelAge: {
    summary: "Checks whether your channel is old enough to carry baseline trust.",
    zero: "Your channel is brand new or the publish date is missing.",
  },
  featureEligibility: {
    summary: "Shows whether YouTube has enabled long-form uploads for your channel.",
    zero: "Long uploads are not enabled yet, usually because phone verification is incomplete.",
  },
  channelTags: {
    summary: "Scores higher when channel keywords are empty, which keeps your channel profile clean.",
    zero: "Channel keywords are still set.",
  },
  channelDescription: {
    summary: "Looks for a clear channel bio (20+ characters) to help YouTube classify you.",
    zero: "Your description is too short or empty.",
  },
  entertainmentCategory: {
    summary: "Checks if 80%+ of recent uploads sit in one category (Entertainment).",
    zero: "Recent uploads are split across categories.",
  },
  enhancements: {
    summary: "Rewards vertical 9:16 videos at 1080p or higher resolution.",
    zero: "Most recent uploads are not vertical or high-res.",
  },
  engagedViewScore: {
    summary: "Based on YouTube's engagedViews API metric — not the same as 'stayed to watch' in YouTube Studio. This is a stricter measure of who watched past the hook.",
    zero: "Engaged view data is missing or fewer than 55% of viewers watch past the hook.",
  },
  retentionScore: {
    summary: "Compares average view duration to target. Shorter Shorts have higher targets that expect looping — longer Shorts (45-60s) have more forgiving thresholds.",
    zero: "Watch time data is missing or viewers drop well before the target.",
  },
  rewatchScore: {
    summary: "Measures looping by comparing average view duration to video length.",
    zero: "Most viewers do not reach a full watch.",
  },
  engagementScore: {
    summary: "Based on like, comment, and subscriber gain rates versus benchmarks.",
    zero: "Engagement is below the minimum thresholds.",
  },
  formattingScore: {
    summary: "Checks vertical 9:16 framing and proper credits if content looks reused.",
    zero: "Videos are not vertical/high-res or credits are missing.",
  },
  shareRateScore: {
    summary: "How often viewers share your content. High share rate signals highly valuable, recommendation-worthy content.",
    zero: "Share data is missing or share rate is below 0.01%.",
  },
  consistencyScore: {
    summary: "Rewards frequent uploads over the last 12 days. Score is weighted down if retention or engaged view rate are below threshold — posting often only counts when the content performs.",
    zero: "Uploads are too sparse, or other metrics (retention, engaged views) are dragging down the score.",
  },
};


const componentMaxes: Record<string, number> = {
  channelAge: 1,
  featureEligibility: 1,
  channelTags: 1,
  channelDescription: 1,
  entertainmentCategory: 1,
  enhancements: 1,
  engagedViewScore: 21,
  retentionScore: 40,
  rewatchScore: 10,
  engagementScore: 8,
  formattingScore: 2,
  shareRateScore: 7,
  consistencyScore: 6,
};

const normalizeComponentScore = (
  key: string,
  value?: number | null
) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }
  const max = componentMaxes[key] ?? 1;
  const normalized = Math.round((value / max) * 100);
  return Math.min(100, Math.max(0, normalized));
};

const getComponentTooltip = (key: string, score: number | null) => {
  const entry = componentTooltips[key];
  if (!entry || score === null) {
    return "";
  }
  if (score === 0) {
    return entry.zero;
  }
  return entry.summary;
};

const getScoreLabel = (score: number) => {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Strong";
  if (score >= 50) return "Developing";
  return "Needs work";
};

const getSeverityRank = (severity?: string) => {
  if (severity === "high") return 4;
  if (severity === "medium") return 3;
  if (severity === "low") return 2;
  if (severity === "positive") return 1; // Show wins last
  return 0;
};

const getImpactMeta = (severity?: string) => {
  if (severity === "high") {
    return { label: "High", tone: "text-rose-600 bg-rose-50" };
  }
  if (severity === "medium") {
    return { label: "Med", tone: "text-amber-600 bg-amber-50" };
  }
  if (severity === "positive") {
    return { label: "Win", tone: "text-emerald-600 bg-emerald-50" };
  }
  return { label: "Low", tone: "text-sky-600 bg-sky-50" };
};


const getScoreTone = (score: number | null | undefined) => {
  if (score === null || score === undefined) return "text-gray-500";
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-blue-600";
  if (score >= 40) return "text-amber-600";
  return "text-rose-600";
};

const getDataConfidenceMeta = (confidence?: string | null) => {
  switch (confidence) {
    case "high":
      return { label: "High confidence", tone: "text-emerald-600 bg-emerald-50", icon: "✓" };
    case "medium":
      return { label: "Medium confidence", tone: "text-blue-600 bg-blue-50", icon: "~" };
    case "low":
      return { label: "Low confidence", tone: "text-amber-600 bg-amber-50", icon: "!" };
    case "insufficient":
      return { label: "Insufficient data", tone: "text-rose-600 bg-rose-50", icon: "✗" };
    default:
      return { label: "Unknown", tone: "text-gray-500 bg-gray-50", icon: "?" };
  }
};


const formatHandle = (handle?: string | null) => {
  if (!handle) {
    return "No handle";
  }
  const trimmed = handle.trim().replace(/^@/, "");
  return trimmed ? `@${trimmed}` : "No handle";
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
  const [detailsAnimKey, setDetailsAnimKey] = useState(0);
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

  const [user, setUser] = useState<User | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [channels, setChannels] = useState<ChannelSummary[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [analysisResult, setAnalysisResult] = useState<TrustScoreResult | null>(null);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [analysisActive, setAnalysisActive] = useState(false);
  const [analysisModalOpen, setAnalysisModalOpen] = useState(false);
  const [analysisStepIndex, setAnalysisStepIndex] = useState(0);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [disconnectingChannelId, setDisconnectingChannelId] = useState<string | null>(null);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);
  const autoAnalyzeTriggeredRef = useRef(false);

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

    const handleClick = (event: globalThis.MouseEvent) => {
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
    setDisconnectError(null);
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

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const url = new URL(window.location.href);
    const connected = url.searchParams.get("connected");
    if (
      connected === "1" &&
      selectedChannelId &&
      !analysisActive &&
      !autoAnalyzeTriggeredRef.current
    ) {
      autoAnalyzeTriggeredRef.current = true;
      void handleAnalyze(selectedChannelId);
      url.searchParams.delete("connected");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    }
  }, [selectedChannelId, analysisActive]);

  const handleAnalyze = async (channelId: string) => {
    setAnalysisError(null);
    setAnalysisActive(true);
    setAnalysisModalOpen(true);
    setAnalysisStepIndex(0);
    setAnalysisProgress(0);

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

  const handleDisconnect = async (
    event: ReactMouseEvent<HTMLButtonElement>,
    channelId: string,
    channelTitle: string
  ) => {
    event.stopPropagation();
    if (!window.confirm(`Disconnect ${channelTitle}?`)) {
      return;
    }
    setDisconnectError(null);
    setDisconnectingChannelId(channelId);
    try {
      const response = await fetch("/api/trust-score/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to disconnect channel.");
      }
      setChannels((prev) => {
        const next = prev.filter((channel) => channel.id !== channelId);
        if (selectedChannelId === channelId) {
          setSelectedChannelId(next[0]?.id ?? null);
          setHistory([]);
          setAnalysisResult(null);
        }
        return next;
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to disconnect channel.";
      setDisconnectError(message);
    } finally {
      setDisconnectingChannelId(null);
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
  const dataConfidence =
    analysisResult?.dataConfidence ?? latestSnapshot?.data_confidence ?? null;
  const confidenceMeta = getDataConfidenceMeta(dataConfidence);
  const userEmail = user?.email ?? "";
  const userName =
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    userEmail.split("@")[0] ??
    "User";
  const userAvatar =
    user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture ?? null;
  const userInitials = userName.slice(0, 2).toUpperCase();


  const topLifts = useMemo(() => {
    // Sort by severity (high -> medium -> low -> positive/wins)
    // Show up to 5 items, prioritizing issues over wins
    const sorted = [...actionItems].sort(
      (a, b) => getSeverityRank(b.severity) - getSeverityRank(a.severity)
    );
    return sorted.slice(0, 5);
  }, [actionItems]);

  const componentBreakdown = useMemo<ComponentBreakdownItem[]>(() => {
    if (!currentComponents) return [];
    return Object.entries(componentLabels).map(([key, label]) => {
      const score = normalizeComponentScore(key, currentComponents[key]);
      const previous = normalizeComponentScore(
        key,
        previousSnapshot?.components?.[key]
      );
      const delta =
        score === null || previous === null ? null : score - previous;
      return {
        key,
        label,
        score,
        delta,
      };
    });
  }, [currentComponents, previousSnapshot]);

  const breakdownItems = useMemo(() => {
    return componentBreakdown.filter(
      (item): item is ComponentBreakdownItem & { score: number } =>
        item.score !== null
    );
  }, [componentBreakdown]);

  const topDrags = useMemo(() => {
    return [...breakdownItems]
      .sort((a, b) => a.score - b.score)
      .slice(0, 3);
  }, [breakdownItems]);

  const channelHandle = selectedChannel?.handle
    ? formatHandle(selectedChannel.handle)
    : null;

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
                  className={`flex h-11 w-11 items-center justify-center rounded-lg transition-colors ${item.active ? "bg-[#EEF2FF]" : "hover:bg-gray-100"
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
            className={`fixed inset-0 z-40 md:hidden ${mobileMenuOpen ? "" : "pointer-events-none"
              }`}
          >
            <div
              className={`absolute inset-0 bg-black/20 transition-opacity ${mobileMenuOpen ? "opacity-100" : "opacity-0"
                }`}
              onClick={() => setMobileMenuOpen(false)}
            />
            <div
              className={`absolute left-0 top-0 h-full w-[82%] max-w-xs bg-white shadow-xl transition-transform ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
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
                    <p className="text-xs text-gray-500">{userEmail}</p>
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
                          className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isOpen ? "rotate-90" : ""
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
                        className={`overflow-hidden transition-all duration-200 ease-in-out ${isOpen ? "max-h-96" : "max-h-0"
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
                    className={`mb-1 block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${action.tone === "danger"
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
                id="trust-score-profile-menu"
                className={`absolute right-0 top-full z-30 mt-2 w-64 rounded-lg border border-gray-200 bg-white shadow-md transition-all duration-150 ${profileMenuOpen
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
                    <p className="text-xs text-gray-500">{userEmail}</p>
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
                  onClick={handleSignOut}
                  disabled={isLoggingOut}
                >
                  {isLoggingOut ? "Logging out..." : "Log Out"}
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-8 pt-2 md:pt-0">

            {/* Main score display - the hero */}
            <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.8fr]">
              {/* Score Card */}
              <div className="flex flex-col gap-6">
                <div className="rounded-[2rem] bg-[#2A2F3C] p-8 text-white">
                  <div className="flex items-start justify-between">
                    {selectedChannel ? (
                      <p className="text-sm text-white/60">{selectedChannel.title}</p>
                    ) : (
                      <p className="text-sm text-white/40">No channel selected</p>
                    )}
                    {analysisActive ? (
                      <span className="flex h-6 w-6 items-center justify-center">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-[#335CFF]" />
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-6 flex items-end justify-between">
                    <div>
                      <p className={`text-7xl font-semibold tracking-tight ${currentScore === null ? "text-white/30" : ""}`}>
                        {currentScore ?? "—"}
                      </p>
                      {currentScore !== null ? (
                        <div className="mt-2 flex items-center gap-2">
                          <p className="text-sm font-medium text-white/60">
                            {currentScore >= 85 ? "Excellent" : currentScore >= 70 ? "Strong" : currentScore >= 50 ? "Developing" : "Needs work"}
                          </p>
                          {dataConfidence ? (
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${confidenceMeta.tone}`}>
                              {confidenceMeta.icon} {confidenceMeta.label}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-white/40">Connect a channel</p>
                      )}
                    </div>
                    <svg width="100" height="100" viewBox="0 0 120 120" className="opacity-90">
                      <circle cx="60" cy="60" r="52" stroke="rgba(255,255,255,0.1)" strokeWidth="8" fill="none" />
                      <circle
                        cx="60"
                        cy="60"
                        r="52"
                        stroke="#335CFF"
                        strokeWidth="8"
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 52}
                        strokeDashoffset={2 * Math.PI * 52 * (1 - (currentScore ?? 0) / 100)}
                        transform="rotate(-90 60 60)"
                        className="transition-all duration-1000"
                      />
                    </svg>
                  </div>

                  <div className="mt-8 flex gap-2">
                    {selectedChannel ? (
                      <button
                        className="flex-1 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#2A2F3C] transition-all hover:bg-white/90"
                        type="button"
                        onClick={() => handleAnalyze(selectedChannel.id)}
                        disabled={analysisActive}
                      >
                        {analysisActive ? "Analyzing..." : "Recalculate"}
                      </button>
                    ) : null}
                    <a
                      className="flex items-center justify-center gap-2 rounded-xl bg-[#335CFF] px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-[#2B4FE0]"
                      href="/api/trust-score/oauth/start?returnTo=/tools/trust-score"
                    >
                      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                      {selectedChannel ? "Add" : "Connect"}
                    </a>
                  </div>
                </div>

                {/* Channels - simplified */}
                <div className="rounded-[2rem] border border-gray-100 bg-white p-6">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-900">Channels</p>
                    <span className="text-xs text-gray-400">{channels.length}</span>
                  </div>
                  {disconnectError ? (
                    <p className="mt-3 text-xs text-rose-500">{disconnectError}</p>
                  ) : null}
                  <div className="mt-4 space-y-2">
                    {loadingChannels ? (
                      <div className="py-8 text-center text-sm text-gray-400">Loading...</div>
                    ) : channels.length === 0 ? (
                      <div className="py-8 text-center text-sm text-gray-400">No channels connected</div>
                    ) : (
                      channels.map((channel) => (
                        <div
                          key={channel.id}
                          className={`group relative flex w-full items-center gap-3 rounded-xl p-3 text-left transition-all cursor-pointer ${selectedChannelId === channel.id
                              ? "bg-[#F3F6FF] ring-1 ring-[#335CFF]/20"
                              : "hover:bg-gray-50"
                            }`}
                          onClick={() => setSelectedChannelId(channel.id)}
                        >
                          {channel.thumbnailUrl ? (
                            <img src={channel.thumbnailUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-500">
                              {channel.title?.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-sm font-medium text-gray-900">{channel.title}</p>
                            <p className="text-xs text-gray-400">{formatHandle(channel.handle)}</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-lg font-semibold ${getScoreTone(channel.lastScore ?? null)}`}>
                              {channel.lastScore ?? "—"}
                            </p>
                          </div>
                          {/* Disconnect button - appears on hover */}
                          <button
                            type="button"
                            onClick={(e) => handleDisconnect(e, channel.id, channel.title)}
                            disabled={disconnectingChannelId === channel.id}
                            className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-rose-600 shadow-sm border border-gray-200 hover:bg-rose-50 hover:border-rose-200 disabled:opacity-50"
                          >
                            {disconnectingChannelId === channel.id ? "..." : "Disconnect"}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Insights Panel */}
              <div className="flex flex-col gap-6">
                {analysisError ? (
                  <div className="rounded-2xl border border-rose-100 bg-rose-50 px-5 py-4 text-sm text-rose-600">
                    {analysisError}
                  </div>
                ) : null}

                {/* Quick Stats Row */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="rounded-2xl border border-gray-100 bg-white p-5">
                    <p className="text-xs font-medium text-gray-400">Trend</p>
                    <p className="mt-2 text-2xl font-semibold text-gray-900">
                      {history.length > 1 && latestSnapshot && previousSnapshot
                        ? `${latestSnapshot.score - previousSnapshot.score >= 0 ? "+" : ""}${(latestSnapshot.score - previousSnapshot.score).toFixed(0)}`
                        : "—"}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">{history.length} runs</p>
                  </div>
                  <div className="rounded-2xl border border-gray-100 bg-white p-5">
                    <p className="text-xs font-medium text-gray-400">Engaged view rate</p>
                    <p className="mt-2 text-2xl font-semibold text-gray-900">
                      {analysisResult?.engagedViewAvg ?? latestSnapshot?.swipe_avg
                        ? `${Math.min(100, Math.round((analysisResult?.engagedViewAvg ?? latestSnapshot?.swipe_avg ?? 0) * 100))}%`
                        : "—"}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">watched past hook</p>
                  </div>
                  <div className="rounded-2xl border border-gray-100 bg-white p-5">
                    <p className="text-xs font-medium text-gray-400">Retention</p>
                    <p className="mt-2 text-2xl font-semibold text-gray-900">
                      {analysisResult?.retentionAvg ?? latestSnapshot?.retention_avg
                        ? `${Math.min(100, Math.round(((analysisResult?.retentionAvg ?? latestSnapshot?.retention_avg ?? 0) / 40) * 100))}%`
                        : "—"}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">avg watch time</p>
                  </div>
                  <div className="rounded-2xl border border-gray-100 bg-white p-5">
                    <p className="text-xs font-medium text-gray-400">Last run</p>
                    <p className="mt-2 text-2xl font-semibold text-gray-900">
                      {latestSnapshot?.created_at
                        ? new Date(latestSnapshot.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                        : "—"}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">{latestSnapshot ? new Date(latestSnapshot.created_at).toLocaleDateString(undefined, { year: "numeric" }) : "never"}</p>
                  </div>
                </div>

                {/* Actions - clean cards */}
                <div className="rounded-[2rem] border border-gray-100 bg-white p-6">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-900">How to improve</p>
                    {topLifts.length > 0 ? (
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        topLifts.some(i => i.severity === "positive")
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-gray-100 text-gray-600"
                      }`}>
                        {topLifts.filter(i => i.severity !== "positive").length > 0 
                          ? `${topLifts.filter(i => i.severity !== "positive").length} to fix`
                          : "Looking good"}
                        {topLifts.some(i => i.severity === "positive") && topLifts.filter(i => i.severity !== "positive").length > 0
                          ? ` · ${topLifts.filter(i => i.severity === "positive").length} win${topLifts.filter(i => i.severity === "positive").length > 1 ? "s" : ""}`
                          : ""}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-5 space-y-3">
                    {analysisActive ? (
                      Array.from({ length: 3 }, (_, index) => (
                        <div key={`skeleton-${index}`} className="animate-pulse rounded-xl bg-gray-50 p-4">
                          <div className="h-4 w-3/4 rounded bg-gray-200" />
                          <div className="mt-2 h-3 w-1/2 rounded bg-gray-100" />
                        </div>
                      ))
                    ) : topLifts.length === 0 ? (
                      <div className="py-8 text-center text-sm text-gray-400">
                        Run analysis to get recommendations
                      </div>
                    ) : (
                      topLifts.map((item, idx) => {
                        const impact = getImpactMeta(item.severity);
                        const isWin = item.severity === "positive";
                        return (
                          <div
                            key={item.title}
                            className={`flex items-start gap-4 rounded-xl p-4 transition-colors ${
                              isWin 
                                ? "bg-emerald-50/50 hover:bg-emerald-50" 
                                : "bg-gray-50 hover:bg-gray-100"
                            }`}
                          >
                            <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold shadow-sm ${
                              isWin
                                ? "bg-emerald-500 text-white"
                                : "bg-white text-gray-500"
                            }`}>
                              {isWin ? "✓" : idx + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className={`font-medium ${isWin ? "text-emerald-900" : "text-gray-900"}`}>{item.title}</p>
                              <p className={`mt-1 text-sm ${isWin ? "text-emerald-700" : "text-gray-500"}`}>{item.detail}</p>
                            </div>
                            <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${impact.tone}`}>
                              {impact.label}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Weakest areas - simplified */}
                <div className="rounded-[2rem] border border-gray-100 bg-white p-6">
                  <p className="text-sm font-semibold text-gray-900">Weakest areas</p>
                  <div className="mt-5 space-y-4">
                    {analysisActive ? (
                      Array.from({ length: 3 }, (_, index) => (
                        <div key={`drag-skeleton-${index}`} className="animate-pulse">
                          <div className="h-3 w-24 rounded bg-gray-200" />
                          <div className="mt-2 h-2 w-full rounded-full bg-gray-100" />
                        </div>
                      ))
                    ) : topDrags.length === 0 ? (
                      <div className="py-6 text-center text-sm text-gray-400">
                        Run analysis to identify weak spots
                      </div>
                    ) : (
                      topDrags.map((item) => (
                        <div key={item.key}>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-900">{item.label}</span>
                            <span className={`text-sm font-semibold ${getScoreTone(item.score)}`}>{item.score}</span>
                          </div>
                          <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${item.score >= 70 ? "bg-emerald-500" : item.score >= 50 ? "bg-amber-500" : "bg-rose-500"
                                }`}
                              style={{ width: `${item.score}%` }}
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Score breakdown - collapsible */}
                {breakdownItems.length > 0 ? (
                  <details 
                    className="group/details rounded-[2rem] border border-gray-100 bg-white"
                    onToggle={() => setDetailsAnimKey(prev => prev + 1)}
                  >
                    <summary className="flex cursor-pointer items-center justify-between p-6 text-sm font-semibold text-gray-900 [&::-webkit-details-marker]:hidden transition-colors hover:bg-gray-50/50">
                      Full breakdown
                      <svg className="h-4 w-4 text-gray-400 transition-transform duration-300 ease-in-out group-open/details:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </summary>
                    <div className="overflow-hidden">
                      <div key={detailsAnimKey} className="animate-details-content border-t border-gray-100 p-6 pt-4 overflow-visible">
                        <div className="grid gap-3 sm:grid-cols-2">
                        {breakdownItems.map((item, idx) => {
                          const tooltip = getComponentTooltip(item.key, item.score);
                          const isZero = item.score === 0;
                          // First 4 items (2 rows) show tooltip below, rest show above
                          const showTooltipBelow = idx < 4;
                          return (
                            <div
                              key={item.key}
                              tabIndex={0}
                              className="group/item relative rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                            >
                              <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3 transition-shadow group-hover/item:shadow-sm">
                                <span className="text-sm text-gray-600">{item.label}</span>
                                <span className={`text-sm font-semibold ${getScoreTone(item.score)}`}>{item.score}</span>
                              </div>
                              {tooltip ? (
                                showTooltipBelow ? (
                                  <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-3 w-72 max-w-[80vw] -translate-x-1/2 -translate-y-1 opacity-0 transition-all duration-300 ease-in-out group-hover/item:translate-y-0 group-hover/item:opacity-100 group-focus-within/item:translate-y-0 group-focus-within/item:opacity-100">
                                    <div className="mx-auto mb-2 h-2.5 w-2.5 rotate-45 rounded-[2px] bg-white/95 ring-1 ring-slate-200/80 shadow-[0_-3px_8px_rgba(15,23,42,0.08)]" />
                                    <div className="rounded-2xl border border-slate-200/80 bg-white/95 px-4 py-3 text-xs leading-relaxed text-slate-600 shadow-[0_18px_45px_rgba(15,23,42,0.15)] backdrop-blur">
                                      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-slate-400">
                                        <span className={`h-1.5 w-1.5 rounded-full ${isZero ? "bg-rose-500" : "bg-[#335CFF]"}`} />
                                        {isZero ? "Why it's 0" : "What this means"}
                                      </div>
                                      <div className="mt-2 text-sm text-slate-700">{tooltip}</div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="pointer-events-none absolute left-1/2 bottom-full z-50 mb-3 w-72 max-w-[80vw] -translate-x-1/2 translate-y-1 opacity-0 transition-all duration-300 ease-in-out group-hover/item:translate-y-0 group-hover/item:opacity-100 group-focus-within/item:translate-y-0 group-focus-within/item:opacity-100">
                                    <div className="rounded-2xl border border-slate-200/80 bg-white/95 px-4 py-3 text-xs leading-relaxed text-slate-600 shadow-[0_18px_45px_rgba(15,23,42,0.15)] backdrop-blur">
                                      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-slate-400">
                                        <span className={`h-1.5 w-1.5 rounded-full ${isZero ? "bg-rose-500" : "bg-[#335CFF]"}`} />
                                        {isZero ? "Why it's 0" : "What this means"}
                                      </div>
                                      <div className="mt-2 text-sm text-slate-700">{tooltip}</div>
                                    </div>
                                    <div className="mx-auto mt-2 h-2.5 w-2.5 rotate-45 rounded-[2px] bg-white/95 ring-1 ring-slate-200/80 shadow-[0_6px_14px_rgba(15,23,42,0.12)]" />
                                  </div>
                                )
                              ) : null}
                            </div>
                          );
                        })}
                        </div>
                      </div>
                    </div>
                  </details>
                ) : null}
              </div>
            </section>

            {/* History - minimal */}
            {history.length > 0 ? (
              <section className="rounded-[2rem] border border-gray-100 bg-white p-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-900">History</p>
                  <p className="text-xs text-gray-400">{history.length} runs</p>
                </div>
                <div className="mt-5 flex gap-3 overflow-x-auto pb-2">
                  {history.slice(0, 10).map((entry, idx) => (
                    <div
                      key={entry.id}
                      className={`flex flex-shrink-0 flex-col items-center rounded-xl px-5 py-4 ${idx === 0 ? "bg-[#2A2F3C] text-white" : "bg-gray-50"
                        }`}
                    >
                      <span className={`text-2xl font-semibold ${idx === 0 ? "" : getScoreTone(entry.score)}`}>
                        {entry.score}
                      </span>
                      <span className={`mt-1 text-xs ${idx === 0 ? "text-white/60" : "text-gray-400"}`}>
                        {new Date(entry.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </main>
      </div>

      {analysisActive ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0F1A]/70 px-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              {selectedChannel?.thumbnailUrl ? (
                <img
                  src={selectedChannel.thumbnailUrl}
                  alt={selectedChannel.title}
                  className="h-12 w-12 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-600">
                  {selectedChannel?.title?.slice(0, 2).toUpperCase() ?? "YT"}
                </div>
              )}
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-gray-400">
                  {channelHandle ? `Analyzing ${channelHandle}` : "Analyzing"}
                </p>
                <h3 className="text-lg font-semibold text-gray-900">
                  {selectedChannel?.title ?? "Your channel"}
                </h3>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
              <span>Estimated time: ~45s</span>
              <span className="rounded-full bg-[#EEF2FF] px-3 py-1 text-xs font-semibold text-[#335CFF]">
                {Math.min(100, Math.round(analysisProgress))}%
              </span>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-[#335CFF] transition-all duration-1000"
                style={{ width: `${analysisProgress}%` }}
              />
            </div>
            <div className="mt-5 space-y-3">
              {ANALYSIS_STEPS.map((step, index) => {
                const isComplete = index < analysisStepIndex;
                const isActive = index === analysisStepIndex;
                return (
                  <div key={step.title} className="flex items-start gap-3">
                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded-full border ${isComplete
                          ? "border-emerald-500 bg-emerald-50"
                          : isActive
                            ? "border-[#335CFF] bg-[#EEF2FF]"
                            : "border-gray-200 bg-white"
                        }`}
                    >
                      {isComplete ? (
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          className="h-3 w-3 text-emerald-600"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      ) : (
                        <span
                          className={`h-2 w-2 rounded-full ${isActive ? "bg-[#335CFF]" : "bg-gray-300"
                            }`}
                        />
                      )}
                    </div>
                    <div>
                      <p
                        className={`text-sm font-medium ${isActive ? "text-gray-900" : "text-gray-600"
                          }`}
                      >
                        {step.title}
                      </p>
                      <p className="text-xs text-gray-500">{step.detail}</p>
                    </div>
                  </div>
                );
              })}
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
