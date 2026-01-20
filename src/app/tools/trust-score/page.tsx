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
  swipeScore: "Start rate",
  retentionScore: "Retention",
  rewatchScore: "Rewatch",
  engagementScore: "Engagement",
  formattingScore: "Formatting",
  consistencyScore: "Consistency",
  nicheScore: "Niche clarity",
};

const SCORE_TARGET = 70;

const componentMaxes: Record<string, number> = {
  channelAge: 1,
  featureEligibility: 1,
  channelTags: 1,
  channelDescription: 1,
  entertainmentCategory: 1,
  enhancements: 1,
  swipeScore: 25,
  retentionScore: 40,
  rewatchScore: 10,
  engagementScore: 8,
  formattingScore: 2,
  consistencyScore: 6,
  nicheScore: 3,
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

const getScoreLabel = (score: number) => {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Strong";
  if (score >= 50) return "Developing";
  return "Needs work";
};

const getSeverityRank = (severity?: string) => {
  if (severity === "high") return 3;
  if (severity === "medium") return 2;
  if (severity === "low") return 1;
  return 0;
};

const getImpactMeta = (severity?: string) => {
  if (severity === "high") {
    return { label: "High impact", tone: "text-rose-600 bg-rose-50" };
  }
  if (severity === "medium") {
    return { label: "Medium impact", tone: "text-amber-600 bg-amber-50" };
  }
  return { label: "Low impact", tone: "text-emerald-600 bg-emerald-50" };
};

const getWhyItMatters = (severity?: string) => {
  if (severity === "high") {
    return "Why it matters: This is a primary trust signal for viewers and the algorithm.";
  }
  if (severity === "medium") {
    return "Why it matters: It improves viewer satisfaction and recommendation odds.";
  }
  return "Why it matters: Small gains compound into long-term trust with viewers and the algorithm.";
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

const formatHandle = (handle?: string | null) => {
  if (!handle) {
    return "No handle";
  }
  const trimmed = handle.trim().replace(/^@/, "");
  return trimmed ? `@${trimmed}` : "No handle";
};

const getScoreMessage = (score: number | null) => {
  if (score === null || Number.isNaN(score)) {
    return "Run your first analysis to see your Trust Score.";
  }
  if (score < 30) {
    return `Trust Score ${score}. Don't worry, it only goes up from here.`;
  }
  if (score < 50) {
    return `Trust Score ${score}. Solid start - let's chase the quick wins below.`;
  }
  if (score < 70) {
    return `Trust Score ${score}. You're building momentum. A few tweaks can push you higher.`;
  }
  if (score < 85) {
    return `Trust Score ${score}. Strong signals. Stay consistent and polish the details.`;
  }
  return `Trust Score ${score}. Elite channel signals - keep the bar high.`;
};

const getTopChanges = (latest?: Snapshot, previous?: Snapshot) => {
  if (!latest?.components || !previous?.components) return [];
  const deltas = Object.keys(componentLabels)
    .map((key) => ({
      key,
      label: componentLabels[key] ?? key,
      delta:
        (normalizeComponentScore(key, latest.components?.[key]) ?? 0) -
        (normalizeComponentScore(key, previous.components?.[key]) ?? 0),
    }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 6);

  const significant = deltas.filter((item) => Math.abs(item.delta) >= 6);
  if (significant.length > 0) {
    return significant.slice(0, 3);
  }

  const subtle = deltas.filter((item) => Math.abs(item.delta) >= 3);
  return subtle.slice(0, 3);
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
  const userEmail = user?.email ?? "";
  const userName =
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    userEmail.split("@")[0] ??
    "User";
  const userAvatar =
    user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture ?? null;
  const userInitials = userName.slice(0, 2).toUpperCase();

  const sparklinePoints = useMemo(() => {
    const scores = [...history]
      .reverse()
      .map((entry) => entry.score)
      .filter((score) => typeof score === "number");
    return buildSparkline(scores);
  }, [history]);

  const topChanges = getTopChanges(latestSnapshot, previousSnapshot);
  const driverMessage =
    history.length < 2
      ? "Run two analyses to see what moved the needle."
      : topChanges.length === 0
      ? "No big shifts yet. Keep running to spot the drivers."
      : null;

  const topLifts = useMemo(() => {
    return [...actionItems]
      .sort((a, b) => getSeverityRank(b.severity) - getSeverityRank(a.severity))
      .slice(0, 3);
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

  const diagnosisText = selectedChannel
    ? topDrags.length > 0
      ? `Your score is held back most by ${topDrags
          .slice(0, 2)
          .map((item) => item.label)
          .join(" + ")}. Fixing these first moves the score fastest. Small wins stack fast.`
      : "Run your first analysis to see what's holding your score back."
    : "Connect your channel to get a clear, prioritized action plan. Small wins stack fast.";

  const heroTitle = selectedChannel
    ? `Your Trust Score for ${selectedChannel.title}`
    : "Connect a YouTube Channel to Get Your Trust Score";

  const channelHandle = selectedChannel?.handle
    ? formatHandle(selectedChannel.handle)
    : null;
  const biggestDriver = topChanges[0];

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

          <div className="flex flex-1 flex-col gap-6 border-t border-gray-200 pt-4 md:border-none md:pt-0">
            <section className="rounded-3xl border border-gray-200 bg-white p-5 md:p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-gray-400">
                    Trust Score
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-semibold text-gray-900 md:text-3xl">
                      {heroTitle}
                    </h1>
                    {analysisActive ? (
                      <span className="inline-flex items-center gap-2 rounded-full bg-[#EEF2FF] px-3 py-1 text-[10px] font-semibold text-[#335CFF]">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-[#335CFF]" />
                        Updating...
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 max-w-2xl text-sm text-gray-500">
                    {diagnosisText}
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
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
                    {selectedChannel
                      ? "Connect another channel"
                      : "Connect YouTube channel"}
                  </a>
                </div>
              </div>
            </section>

            {analysisActive && !analysisModalOpen ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#DDE3FF] bg-[#F5F7FF] px-4 py-2 text-xs text-[#2E46B8]">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-[#335CFF]" />
                  <span>
                    Updating{" "}
                    {selectedChannel?.title
                      ? `Trust Score for ${selectedChannel.title}`
                      : "Trust Score"}
                  </span>
                </div>
                <button
                  className="text-xs font-semibold text-[#335CFF] hover:text-[#2B4FE0]"
                  type="button"
                  onClick={() => setAnalysisModalOpen(true)}
                >
                  View progress
                </button>
              </div>
            ) : null}

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
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-[#EEF2FF] px-3 py-1 text-xs font-semibold text-[#335CFF]">
                      {channels.length} connected
                    </span>
                    <button
                      className="text-xs font-semibold text-gray-500 transition-colors hover:text-gray-800"
                      type="button"
                      onClick={loadChannels}
                    >
                      Refresh
                    </button>
                  </div>
                </div>
                {disconnectError ? (
                  <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
                    {disconnectError}
                  </div>
                ) : null}
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
                            {formatHandle(channel.handle)}{" "}
                            -{" "}
                            {channel.lastScoreAt
                              ? `Scored ${formatDate(channel.lastScoreAt)}`
                              : "Not scored yet"}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2 text-right">
                          <div>
                            <p
                              className={`text-lg font-semibold ${getScoreTone(
                                channel.lastScore ?? null
                              )}`}
                            >
                              {channel.lastScore ?? "--"}
                            </p>
                            <p className="text-xs text-gray-400">Trust</p>
                          </div>
                          <button
                            className="text-[11px] font-medium text-gray-400 transition-colors hover:text-rose-600 disabled:cursor-not-allowed disabled:text-gray-300"
                            type="button"
                            onClick={(event) =>
                              handleDisconnect(event, channel.id, channel.title)
                            }
                            disabled={disconnectingChannelId === channel.id}
                          >
                            {disconnectingChannelId === channel.id
                              ? "Disconnecting..."
                              : "Disconnect"}
                          </button>
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
                      Insights
                    </h2>
                    <p className="text-xs text-gray-500">
                      Clear next steps and what moved your score.
                    </p>
                  </div>
                  {analysisActive ? (
                    <span className="inline-flex items-center gap-2 rounded-full bg-[#EEF2FF] px-3 py-1 text-[10px] font-semibold text-[#335CFF]">
                      <span className="h-2 w-2 animate-spin rounded-full border-2 border-[#335CFF] border-t-transparent" />
                      Updating...
                    </span>
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
                          Trust score now
                        </p>
                        <p
                          className={`mt-2 text-4xl font-semibold ${getScoreTone(
                            currentScore ?? null
                          )}`}
                        >
                          {currentScore ?? "--"}
                        </p>
                        <p className="text-xs text-gray-500">
                          Last run {formatDate(latestSnapshot?.created_at)}
                        </p>
                        <p className="mt-2 text-xs text-gray-500">
                          {getScoreMessage(currentScore)}
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
                    <div className="mt-4 text-xs text-gray-600">
                      {biggestDriver ? (
                        <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                          <span>Biggest driver since last run</span>
                          <span
                            className={`font-semibold ${
                              biggestDriver.delta >= 0
                                ? "text-emerald-600"
                                : "text-rose-600"
                            }`}
                          >
                            {biggestDriver.label}{" "}
                            {biggestDriver.delta >= 0 ? "+" : ""}
                            {Math.round(biggestDriver.delta)}
                          </span>
                        </div>
                      ) : (
                        <p className="text-gray-400">{driverMessage}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
                  <div className="rounded-2xl border border-gray-200 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-gray-400">
                      Do These Next
                    </p>
                    <div className="mt-4 space-y-4">
                      {analysisActive ? (
                        Array.from({ length: 3 }, (_, index) => (
                          <div
                            key={`lift-skeleton-${index}`}
                            className="animate-pulse space-y-2 border-b border-gray-100 pb-4 last:border-0 last:pb-0"
                          >
                            <div className="h-3 w-32 rounded-full bg-gray-200" />
                            <div className="h-2 w-full rounded-full bg-gray-200" />
                            <div className="h-2 w-4/5 rounded-full bg-gray-200" />
                          </div>
                        ))
                      ) : topLifts.length === 0 ? (
                        <p className="text-sm text-gray-500">
                          Run a trust score to generate personalized
                          recommendations.
                        </p>
                      ) : (
                        topLifts.map((item) => {
                          const impact = getImpactMeta(item.severity);
                          return (
                            <div
                              key={item.title}
                              className="border-b border-gray-100 pb-4 last:border-0 last:pb-0"
                            >
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-semibold text-gray-900">
                                  {item.title}
                                </p>
                                <span
                                  className={`rounded-full px-2 py-1 text-[10px] font-semibold ${impact.tone}`}
                                >
                                  {impact.label}
                                </span>
                              </div>
                              <p className="mt-2 text-xs text-gray-500">
                                {getWhyItMatters(item.severity)}
                              </p>
                              <p className="mt-1 text-xs text-gray-600">
                                What to do next: {item.detail}
                              </p>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-gray-400">
                      Top 3 drags
                    </p>
                    <div className="mt-4 space-y-3 text-xs text-gray-600">
                      {analysisActive ? (
                        Array.from({ length: 3 }, (_, index) => (
                          <div
                            key={`drag-skeleton-${index}`}
                            className="animate-pulse space-y-2"
                          >
                            <div className="h-3 w-28 rounded-full bg-gray-200" />
                            <div className="h-2 w-24 rounded-full bg-gray-200" />
                          </div>
                        ))
                      ) : topDrags.length === 0 ? (
                        <p className="text-sm text-gray-500">
                          Run a trust score to see what's holding you back.
                        </p>
                      ) : (
                        topDrags.map((item) => {
                          const scoreLabel = getScoreLabel(item.score);
                          const hasDelta = item.delta !== null;
                          const deltaValue = item.delta ?? 0;
                          const deltaLabel =
                            !hasDelta
                              ? "No prior run"
                              : `${deltaValue >= 0 ? "+" : ""}${deltaValue} pts`;
                          return (
                            <div
                              key={item.key}
                              className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
                            >
                              <div>
                                <p className="text-sm font-semibold text-gray-900">
                                  {item.label}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {item.score}/100 - {scoreLabel}
                                </p>
                              </div>
                              <div className="text-right">
                                <p
                                  className={`text-xs font-semibold ${
                                    hasDelta && deltaValue < 0
                                      ? "text-rose-600"
                                      : "text-emerald-600"
                                  }`}
                                >
                                  {deltaLabel}
                                </p>
                                {hasDelta ? (
                                  <p className="text-[10px] text-gray-400">
                                    since last run
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                <details className="mt-6 rounded-2xl border border-gray-200 p-4">
                  <summary className="cursor-pointer text-xs uppercase tracking-[0.2em] text-gray-400">
                    Score breakdown
                  </summary>
                  <div className="mt-4 space-y-3 text-xs text-gray-600">
                    {analysisActive ? (
                      Array.from({ length: 4 }, (_, index) => (
                        <div
                          key={`breakdown-skeleton-${index}`}
                          className="animate-pulse space-y-2"
                        >
                          <div className="h-3 w-32 rounded-full bg-gray-200" />
                          <div className="h-2 w-full rounded-full bg-gray-200" />
                        </div>
                      ))
                    ) : breakdownItems.length > 0 ? (
                      breakdownItems.map((item) => {
                        const scoreLabel = getScoreLabel(item.score);
                        return (
                          <div
                            key={item.key}
                            className="rounded-lg bg-gray-50 px-3 py-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-900">
                                {item.label}
                              </span>
                              <span className="text-xs text-gray-500">
                                {item.score}/100 - {scoreLabel}
                              </span>
                            </div>
                            <div className="relative mt-2 h-2 rounded-full bg-white">
                              <div
                                className="h-2 rounded-full bg-[#335CFF]"
                                style={{ width: `${item.score}%` }}
                              />
                              <div
                                className="absolute top-0 h-2 w-px bg-gray-300"
                                style={{ left: `${SCORE_TARGET}%` }}
                              />
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-sm text-gray-500">
                        Component breakdown appears after your first score.
                      </p>
                    )}
                  </div>
                  <p className="mt-3 text-[10px] uppercase tracking-[0.2em] text-gray-400">
                    Target line at {SCORE_TARGET}
                  </p>
                </details>
              </div>
            </section>

            <section className="rounded-3xl border border-gray-200 bg-white p-5 md:p-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Score history
                  </h2>
                  <p className="text-xs text-gray-500">
                    Every run is saved so you can see what moved the needle.
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
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </main>
      </div>

      {analysisActive && analysisModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0F1A]/70 px-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
              <button
                className="inline-flex items-center justify-center rounded-full border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                type="button"
                onClick={() => setAnalysisModalOpen(false)}
              >
                Run in background
              </button>
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
                      className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                        isComplete
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
                          className={`h-2 w-2 rounded-full ${
                            isActive ? "bg-[#335CFF]" : "bg-gray-300"
                          }`}
                        />
                      )}
                    </div>
                    <div>
                      <p
                        className={`text-sm font-medium ${
                          isActive ? "text-gray-900" : "text-gray-600"
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
