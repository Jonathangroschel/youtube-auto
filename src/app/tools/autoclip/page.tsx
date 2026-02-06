"use client";

import { NavTooltip } from "@/components/nav-tooltip";
import SearchOverlay from "@/components/search-overlay";
import { SaturaLogo } from "@/components/satura-logo";
import Link from "next/link";
import { useUserProfile } from "@/lib/supabase/use-user-profile";
import {
  buildAssetLibraryItem,
  type AssetLibraryItem,
} from "@/lib/assets/library";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

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
    active: true,
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5 text-[#9aed00] transition-colors"
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
        className="h-4 w-4 text-[#9aed00]"
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
      { label: "Tools Home", href: "/tools" },
      { label: "AutoClip", href: "/tools/autoclip" },
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

type AutoClipView =
  | "home"
  | "instructions"
  | "processingMoments"
  | "review"
  | "processingMagic"
  | "final";

type AutoClipInputMeta = {
  sourceType: "youtube" | "file";
  sourceUrl?: string;
  localPath?: string;
  title?: string;
  originalFilename?: string;
  durationSeconds?: number | null;
  width?: number | null;
  height?: number | null;
  sizeBytes?: number | null;
};

type AutoClipHighlight = {
  start: number;
  end: number;
  content: string;
  title?: string;
};

type AutoClipOutputMeta = {
  filename: string;
  highlightIndex: number;
};

type TranscriptWord = {
  start: number;
  end: number;
  text: string;
};

type TranscriptSegment = {
  start: number;
  end: number;
  text: string;
  words?: TranscriptWord[];
};

type StepDefinition = {
  id: number;
  label: string;
  detail: string;
  icon: (className: string) => ReactNode;
};

const MIN_CLIP_SECONDS = 1;
const MAX_CLIP_SECONDS = Number.POSITIVE_INFINITY;
const TRANSCRIPTION_POLL_INTERVAL_MS = 2500;
const TRANSCRIPTION_POLL_TIMEOUT_MS = 45 * 60 * 1000;
const TRANSCRIPTION_FETCH_RETRY_ATTEMPTS = 3;
const TRANSCRIPTION_FETCH_RETRY_DELAY_MS = 1000;
const TRANSCRIPTION_POLL_NETWORK_FAILURE_LIMIT = 8;

const waitFor = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const isTransientFetchError = (error: unknown) => {
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  return /failed to fetch|fetch failed|network|load failed|timeout|timed out|connection|socket|econn|abort/i.test(
    message.toLowerCase()
  );
};

const fetchWithTransientRetry = async (
  input: RequestInfo | URL,
  init: RequestInit,
  options?: {
    attempts?: number;
    delayMs?: number;
  }
) => {
  const attempts = Math.max(1, options?.attempts ?? TRANSCRIPTION_FETCH_RETRY_ATTEMPTS);
  const delayMs = Math.max(100, options?.delayMs ?? TRANSCRIPTION_FETCH_RETRY_DELAY_MS);
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetch(input, init);
    } catch (error) {
      lastError = error;
      if (!isTransientFetchError(error) || attempt >= attempts) {
        throw error;
      }
      await waitFor(delayMs * attempt);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to fetch the server endpoint.");
};

const stepDefinitions: StepDefinition[] = [
  {
    id: 1,
    label: "Instructions",
    detail: "Set preferences",
    icon: (className: string) => (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    id: 2,
    label: "Review Clips",
    detail: "AI suggestions",
    icon: (className: string) => (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
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
    id: 3,
    label: "Final Review",
    detail: "Perfect clips",
    icon: (className: string) => (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
    ),
  },
];

// Removed slot cards - now using single upload interface

const howItWorksItems = [
  {
    title: "Upload Video",
    description: "Upload your long form video for processing and analysis.",
    iconBg: "bg-[#252729]",
    iconColor: "text-[#9aed00]",
    icon: (
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
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="M7 3v18" />
        <path d="M3 7.5h4" />
        <path d="M3 12h18" />
        <path d="M3 16.5h4" />
        <path d="M17 3v18" />
        <path d="M17 7.5h4" />
        <path d="M17 16.5h4" />
      </svg>
    ),
  },
  {
    title: "Finds Viral Moments",
    description: "AI identifies the most viral moments in your video.",
    iconBg: "bg-[#252729]",
    iconColor: "text-[#9aed00]",
    icon: (
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
    title: "Review and Approve",
    description: "Review and adjust timestamps before auto editing.",
    iconBg: "bg-[#252729]",
    iconColor: "text-[#9aed00]",
    icon: (
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
        <path d="M6 2v14a2 2 0 0 0 2 2h14" />
        <path d="M18 22V8a2 2 0 0 0-2-2H2" />
      </svg>
    ),
  },
  {
    title: "Auto Edit",
    description: "We auto edit the clips into vertical content format.",
    iconBg: "bg-[#252729]",
    iconColor: "text-[#9aed00]",
    icon: (
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
        <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z" />
      </svg>
    ),
  },
  {
    title: "Automatic Face Detection",
    description: "Always keep the subject centered and in frame.",
    iconBg: "bg-[#252729]",
    iconColor: "text-[#9aed00]",
    icon: (
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
        <circle cx="12" cy="12" r="7" />
        <circle cx="12" cy="12" r="2" />
        <path d="M12 5v2" />
        <path d="M12 17v2" />
        <path d="M5 12h2" />
        <path d="M17 12h2" />
      </svg>
    ),
  },
  {
    title: "Export",
    description: "Export your videos as MP4 files with no watermark.",
    iconBg: "bg-[#252729]",
    iconColor: "text-[#9aed00]",
    icon: (
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
    ),
  },
];

const defaultInstructions =
  "Find the most viral moments with a strong hook, clear payoff, and emotional reaction.";

const formatSeconds = (value: number | null | undefined) => {
  if (value == null || !Number.isFinite(value)) {
    return "0:00";
  }
  const total = Math.max(0, Math.floor(value));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const formatDurationSeconds = (value: number | null | undefined) => {
  if (value == null || !Number.isFinite(value)) {
    return "0s";
  }
  const total = Math.max(0, Math.round(value));
  return `${total}s`;
};

const formatBytes = (bytes: number | null | undefined) => {
  if (!bytes || !Number.isFinite(bytes)) {
    return "0 MB";
  }
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  const precision = size >= 10 || unitIndex === 0 ? 0 : 1;
  return `${size.toFixed(precision)} ${units[unitIndex]}`;
};

const buildClipTitle = (content: string | null | undefined) => {
  if (!content) {
    return "AutoClip Highlight";
  }
  const cleaned = content.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 90) {
    return cleaned;
  }
  return `${cleaned.slice(0, 87)}...`;
};

const resolveHighlightTitle = (highlight: AutoClipHighlight | null) =>
  highlight?.title ? highlight.title : buildClipTitle(highlight?.content);

const buildTranscriptSnippet = (
  segments: TranscriptSegment[],
  start: number,
  end: number
) => {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return "";
  }
  const lines: string[] = [];
  segments.forEach((segment) => {
    if (segment.end <= start || segment.start >= end) {
      return;
    }
    if (segment.words?.length) {
      segment.words.forEach((word) => {
        if (word.end <= start || word.start >= end) {
          return;
        }
        const text = String(word.text ?? "").trim();
        if (text) {
          lines.push(text);
        }
      });
      return;
    }
    const text = String(segment.text ?? "").trim();
    if (!text) {
      return;
    }
    const segmentDuration = Math.max(0.001, segment.end - segment.start);
    const overlapStart = Math.max(segment.start, start);
    const overlapEnd = Math.min(segment.end, end);
    const startRatio = Math.max(
      0,
      Math.min(1, (overlapStart - segment.start) / segmentDuration)
    );
    const endRatio = Math.max(
      0,
      Math.min(1, (overlapEnd - segment.start) / segmentDuration)
    );
    if (startRatio <= 0 && endRatio >= 1) {
      lines.push(text);
      return;
    }
    const words = text.split(/\s+/);
    const startIndex = Math.max(0, Math.floor(words.length * startRatio));
    const endIndex = Math.min(
      words.length,
      Math.max(startIndex + 1, Math.ceil(words.length * endRatio))
    );
    const sliced = words.slice(startIndex, endIndex).join(" ").trim();
    if (sliced) {
      lines.push(sliced);
    }
  });
  return lines.join(" ").replace(/\s+/g, " ").trim();
};

export default function AutoClipPage() {
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
  const [view, setView] = useState<AutoClipView>("home");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionBusy, setSessionBusy] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<"upload" | "youtube">("upload");
  const [inputMeta, setInputMeta] = useState<AutoClipInputMeta | null>(null);
  const [inputPreviewMeta, setInputPreviewMeta] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [inputPreviewUrl, setInputPreviewUrl] = useState<string | null>(null);
  const [inputUploading, setInputUploading] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadReady, setUploadReady] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [instructions, setInstructions] = useState("");
  const [description, setDescription] = useState("");
  const [highlights, setHighlights] = useState<AutoClipHighlight[]>([]);
  const [activeHighlightIndex, setActiveHighlightIndex] = useState<number | null>(
    null
  );
  const [transcriptSegments, setTranscriptSegments] = useState<
    TranscriptSegment[]
  >([]);
  const [approvedHighlightIndexes, setApprovedHighlightIndexes] = useState<
    number[]
  >([]);
  const [removedHighlightIndexes, setRemovedHighlightIndexes] = useState<
    number[]
  >([]);
  const [editedHighlightIndexes, setEditedHighlightIndexes] = useState<
    number[]
  >([]);
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<
    "transcribing" | "highlighting" | null
  >(null);
  const [transcriptionProgress, setTranscriptionProgress] = useState<
    number | null
  >(null);
  const [transcriptionStageLabel, setTranscriptionStageLabel] = useState<
    string | null
  >(null);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [outputs, setOutputs] = useState<AutoClipOutputMeta[]>([]);
  const [outputAspectRatios, setOutputAspectRatios] = useState<
    Record<number, { width: number; height: number }>
  >({});
  const [selectedClipIds, setSelectedClipIds] = useState<number[]>([]);
  const [savedClipIds, setSavedClipIds] = useState<number[]>([]);
  const [savingClipIds, setSavingClipIds] = useState<number[]>([]);
  const [projectSaveError, setProjectSaveError] = useState<string | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [adjustMode, setAdjustMode] = useState(false);
  const [draftStart, setDraftStart] = useState<number | null>(null);
  const [draftEnd, setDraftEnd] = useState<number | null>(null);
  const [draggingHandle, setDraggingHandle] = useState<"start" | "end" | null>(
    null
  );
  const [highlightUpdating, setHighlightUpdating] = useState(false);
  const [transcriptionLanguage, setTranscriptionLanguage] = useState("en");
  const navContainerRef = useRef<HTMLDivElement | null>(null);
  const navItemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragCounterRef = useRef(0);
  const reviewVideoRef = useRef<HTMLVideoElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const dragHandleRef = useRef<"start" | "end" | null>(null);
  const draftRangeRef = useRef({ start: 0, end: 0 });
  const activeNavIndex = navItems.findIndex((item) => item.active);
  const resolvedNavIndex =
    hoveredNavIndex ?? (activeNavIndex >= 0 ? activeNavIndex : 0);
  const { userAvatarSrc, userEmail, userName } = useUserProfile();

  const currentStep =
    view === "instructions" || view === "processingMoments"
      ? 1
      : view === "review"
        ? 2
        : view === "processingMagic" || view === "final"
          ? 3
          : null;

  const progressPercent = currentStep ? Math.round((currentStep / 3) * 100) : 0;
  const inputName =
    inputMeta?.originalFilename ||
    inputMeta?.title ||
    (inputMode === "youtube" ? "youtube-video" : "uploaded-video");
  const resolvedInputWidth = inputMeta?.width ?? inputPreviewMeta?.width ?? null;
  const resolvedInputHeight =
    inputMeta?.height ?? inputPreviewMeta?.height ?? null;
  const inputSizeLabel = formatBytes(inputMeta?.sizeBytes ?? null);
  const inputWidthLabel = resolvedInputWidth
    ? `${resolvedInputWidth}px`
    : "--";
  const inputHeightLabel = resolvedInputHeight
    ? `${resolvedInputHeight}px`
    : "--";
  const inputAspectStyle = useMemo(() => {
    const width = resolvedInputWidth;
    const height = resolvedInputHeight;
    if (
      !width ||
      !height ||
      !Number.isFinite(width) ||
      !Number.isFinite(height)
    ) {
      return { aspectRatio: "16 / 9" };
    }
    return { aspectRatio: `${width} / ${height}` };
  }, [resolvedInputHeight, resolvedInputWidth]);
  const inputIsPortrait = useMemo(() => {
    const width = resolvedInputWidth;
    const height = resolvedInputHeight;
    if (
      !width ||
      !height ||
      !Number.isFinite(width) ||
      !Number.isFinite(height)
    ) {
      return false;
    }
    return height >= width;
  }, [resolvedInputHeight, resolvedInputWidth]);
  const inputPreviewFrameClass = inputIsPortrait
    ? "mx-auto h-[290px] w-auto max-w-full md:h-[420px]"
    : "h-auto w-full max-h-[290px] md:max-h-[420px]";
  const reviewPreviewFrameClass = inputIsPortrait
    ? "mx-auto h-[240px] w-auto max-w-full sm:h-[330px]"
    : "h-auto w-full max-h-[240px] sm:max-h-[330px]";
  const updateInputPreviewMeta = useCallback(
    (width: number, height: number) => {
      if (
        !Number.isFinite(width) ||
        !Number.isFinite(height) ||
        width <= 0 ||
        height <= 0
      ) {
        return;
      }
      if (inputMeta?.width && inputMeta?.height) {
        return;
      }
      setInputPreviewMeta((prev) => {
        if (prev && prev.width === width && prev.height === height) {
          return prev;
        }
        return { width, height };
      });
    },
    [inputMeta?.height, inputMeta?.width]
  );
  const registerOutputAspectRatio = useCallback(
    (clipId: number, width: number, height: number) => {
      if (
        !Number.isFinite(width) ||
        !Number.isFinite(height) ||
        width <= 0 ||
        height <= 0
      ) {
        return;
      }
      setOutputAspectRatios((prev) => {
        const existing = prev[clipId];
        if (existing && existing.width === width && existing.height === height) {
          return prev;
        }
        return { ...prev, [clipId]: { width, height } };
      });
    },
    []
  );
  const resolveOutputFrameClass = useCallback(
    (clipId: number) => {
      const aspect = outputAspectRatios[clipId];
      if (!aspect) {
        return "h-full w-full";
      }
      return aspect.height >= aspect.width
        ? "h-full w-auto max-w-full"
        : "w-full h-auto max-h-full";
    },
    [outputAspectRatios]
  );
  const resolveOutputAspectStyle = useCallback(
    (clipId: number) => {
      const aspect = outputAspectRatios[clipId];
      if (!aspect) {
        return { aspectRatio: "9 / 16" };
      }
      return { aspectRatio: `${aspect.width} / ${aspect.height}` };
    },
    [outputAspectRatios]
  );
  const activeHighlight =
    activeHighlightIndex != null ? highlights[activeHighlightIndex] ?? null : null;
  const highlightRange = activeHighlight
    ? `${formatSeconds(activeHighlight.start)} - ${formatSeconds(activeHighlight.end)}`
    : "--";
  const highlightDuration = activeHighlight
    ? formatDurationSeconds(activeHighlight.end - activeHighlight.start)
    : "0s";
  const highlightTitle = resolveHighlightTitle(activeHighlight);
  const removedHighlightSet = useMemo(
    () => new Set(removedHighlightIndexes),
    [removedHighlightIndexes]
  );
  const activeHighlightApproved =
    activeHighlightIndex != null &&
    approvedHighlightIndexes.includes(activeHighlightIndex) &&
    !removedHighlightSet.has(activeHighlightIndex);
  const activeHighlightIndexes = useMemo(
    () =>
      highlights
        .map((_highlight, index) => index)
        .filter((index) => !removedHighlightSet.has(index)),
    [highlights, removedHighlightSet]
  );
  const getOutputDownloadUrl = useCallback(
    (clipIndex: number, disposition: "attachment" | "inline" = "attachment") =>
      sessionId
        ? `/api/autoclip/download?sessionId=${sessionId}&clipIndex=${clipIndex}&disposition=${disposition}`
        : null,
    [sessionId]
  );
  const videoDuration = inputMeta?.durationSeconds ?? null;
  const transcriptDuration = useMemo(() => {
    if (!transcriptSegments.length) {
      return null;
    }
    let maxEnd = 0;
    transcriptSegments.forEach((segment) => {
      if (Number.isFinite(segment.end)) {
        maxEnd = Math.max(maxEnd, segment.end);
      }
    });
    return maxEnd > 0 ? maxEnd : null;
  }, [transcriptSegments]);
  const activeHighlightEnd =
    activeHighlight && Number.isFinite(activeHighlight.end)
      ? activeHighlight.end
      : null;
  const timelineDuration = useMemo(() => {
    if (videoDuration && Number.isFinite(videoDuration) && videoDuration > 0) {
      return videoDuration;
    }
    const candidates = [transcriptDuration, activeHighlightEnd];
    let max = 0;
    candidates.forEach((value) => {
      if (value != null && Number.isFinite(value)) {
        max = Math.max(max, value);
      }
    });
    return max > 0 ? max : 1;
  }, [activeHighlightEnd, transcriptDuration, videoDuration]);
  const resolvedDraftStart =
    draftStart != null ? draftStart : activeHighlight?.start ?? 0;
  const resolvedDraftEnd =
    draftEnd != null ? draftEnd : activeHighlight?.end ?? resolvedDraftStart + 1;
  const reviewClipDuration = Math.max(
    0,
    resolvedDraftEnd - resolvedDraftStart
  );
  const reviewUsesPreview = Boolean(
    sessionId && activeHighlight && !inputPreviewUrl
  );
  const reviewPlaybackStart = reviewUsesPreview ? 0 : resolvedDraftStart;
  const reviewPlaybackEnd = reviewUsesPreview
    ? reviewClipDuration
    : resolvedDraftEnd;
  const reviewPreviewUrl = reviewUsesPreview
    ? `/api/autoclip/preview?sessionId=${sessionId}&start=${resolvedDraftStart.toFixed(
        3
      )}&end=${resolvedDraftEnd.toFixed(3)}`
    : inputPreviewUrl;
  const reviewTranscript = useMemo(() => {
    if (!activeHighlight) {
      return "";
    }
    if (!transcriptSegments.length) {
      return activeHighlight.content || "";
    }
    const snippet = buildTranscriptSnippet(
      transcriptSegments,
      resolvedDraftStart,
      resolvedDraftEnd
    );
    return snippet || activeHighlight.content || "";
  }, [activeHighlight, resolvedDraftEnd, resolvedDraftStart, transcriptSegments]);
  const draftRangeChanged =
    activeHighlight != null &&
    (Math.abs(resolvedDraftStart - activeHighlight.start) > 0.01 ||
      Math.abs(resolvedDraftEnd - activeHighlight.end) > 0.01);
  const approveButtonLabel = activeHighlightApproved
    ? draftRangeChanged
      ? "Save changes"
      : "Approved"
    : "Approve Clip";
  const approveButtonDisabled =
    approvalLoading ||
    highlightUpdating ||
    (!draftRangeChanged && activeHighlightApproved);
  const timelineStartPercent = Math.max(
    0,
    Math.min(100, (resolvedDraftStart / timelineDuration) * 100)
  );
  const timelineEndPercent = Math.max(
    timelineStartPercent,
    Math.min(100, (resolvedDraftEnd / timelineDuration) * 100)
  );
  const timelineWidthPercent = Math.max(
    0.5,
    timelineEndPercent - timelineStartPercent
  );
  const processingLabel =
    processingStage === "transcribing"
      ? transcriptionProgress != null
        ? `${transcriptionStageLabel || "Transcribing your audio"} (${Math.round(
            transcriptionProgress
          )}%)`
        : transcriptionStageLabel || "Transcribing your audio"
      : processingStage === "highlighting"
        ? "Selecting the best highlights"
        : "Preparing your clip";
  const totalHighlights = highlights.length;
  const activeHighlightsCount = activeHighlightIndexes.length;
  const approvedActiveCount = approvedHighlightIndexes.filter(
    (index) => !removedHighlightSet.has(index)
  ).length;
  const approvalProgress = activeHighlightsCount
    ? Math.round((approvedActiveCount / activeHighlightsCount) * 100)
    : 0;
  const approvalReady =
    activeHighlightsCount > 0 && approvedActiveCount === activeHighlightsCount;
  const approvalStatusLabel = approvalReady
    ? "Ready to continue"
    : activeHighlightsCount === 0
      ? "Restore a clip to continue"
      : `${activeHighlightsCount - approvedActiveCount} left to review`;
  const approvalStatusTone = approvalReady
    ? "text-[#4caf50]"
    : activeHighlightsCount === 0
      ? "text-[#e72930]"
      : "text-[#ffa726]";
  const approvalMessage =
    activeHighlightsCount === 0
      ? "Restore at least one clip to continue."
      : approvalReady
        ? "All active clips approved."
        : `Approve or remove ${activeHighlightsCount - approvedActiveCount} more to continue.`;
  const finalClips = outputs.map((output, outputIndex) => {
    const outputHighlight = highlights[output.highlightIndex];
    const range = outputHighlight
      ? `${formatSeconds(outputHighlight.start)} - ${formatSeconds(
          outputHighlight.end
        )}`
      : "--";
    const title = resolveHighlightTitle(outputHighlight ?? null);
    const downloadUrl = getOutputDownloadUrl(outputIndex, "attachment");
    const previewUrl = getOutputDownloadUrl(outputIndex, "inline");
    return {
      id: outputIndex,
      outputIndex,
      title,
      range,
      previewUrl,
      downloadUrl,
    };
  });

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

  const ensureSession = useCallback(async () => {
    if (sessionId) {
      return sessionId;
    }
    setSessionBusy(true);
    setSessionError(null);
    try {
      const response = await fetch("/api/autoclip/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ options: { autoApprove: false } }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.id) {
        const message =
          typeof payload?.error === "string"
            ? payload.error
            : "Unable to start AutoClip session.";
        throw new Error(message);
      }
      setSessionId(payload.id);
      return String(payload.id);
    } finally {
      setSessionBusy(false);
    }
  }, [sessionId]);

  const resetPipeline = useCallback(() => {
    setHighlights([]);
    setActiveHighlightIndex(null);
    setTranscriptSegments([]);
    setApprovedHighlightIndexes([]);
    setRemovedHighlightIndexes([]);
    setEditedHighlightIndexes([]);
    setApprovalLoading(false);
    setProcessing(false);
    setProcessingStage(null);
    setTranscriptionProgress(null);
    setTranscriptionStageLabel(null);
    setProcessingError(null);
    setRenderError(null);
    setRendering(false);
    setOutputs([]);
    setOutputAspectRatios({});
    setSelectedClipIds([]);
    setSavedClipIds([]);
    setSavingClipIds([]);
    setProjectSaveError(null);
    setReviewModalOpen(false);
    setAdjustMode(false);
    setDraftStart(null);
    setDraftEnd(null);
    setHighlightUpdating(false);
  }, []);

  const resetInput = useCallback(() => {
    if (inputPreviewUrl) {
      URL.revokeObjectURL(inputPreviewUrl);
    }
    setInputPreviewUrl(null);
    setInputPreviewMeta(null);
    setInputMeta(null);
    setUploadReady(false);
    setInputUploading(false);
    setInputError(null);
    setVideoUrl("");
    setInputMode("upload");
    setTranscriptionLanguage("en");
    setInstructions("");
    setDescription("");
    resetPipeline();
  }, [inputPreviewUrl, resetPipeline]);

  const handleStartOver = useCallback(() => {
    resetInput();
    setSessionId(null);
    setSessionError(null);
    setView("home");
  }, [resetInput]);

  const handleStartNew = useCallback(async () => {
    resetInput();
    setSessionId(null);
    setSessionError(null);
    try {
      await ensureSession();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to start session.";
      setSessionError(message);
    }
  }, [ensureSession, resetInput]);

  const handleFileUpload = useCallback(
    async (file: File) => {
      if (inputUploading || sessionBusy) {
        return;
      }
      resetPipeline();
      setInputError(null);
      setRenderError(null);
      setProcessingError(null);
      setInputMeta(null);
      setInputPreviewMeta(null);
      setUploadReady(false);
      if (inputPreviewUrl) {
        URL.revokeObjectURL(inputPreviewUrl);
      }
      const previewUrl = URL.createObjectURL(file);
      setInputPreviewUrl(previewUrl);
      setInputUploading(true);
      try {
        const activeSession = await ensureSession();
        
        // Step 1: Get signed upload URL from our API
        const urlResponse = await fetch("/api/autoclip/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: activeSession,
            filename: file.name,
            contentType: file.type || "video/mp4",
          }),
        });
        const urlData = await urlResponse.json().catch(() => ({}));
        if (!urlResponse.ok) {
          throw new Error(urlData.error || "Failed to get upload URL");
        }

        // Step 2: Upload directly to Supabase Storage
        const uploadResponse = await fetch(urlData.uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": file.type || "video/mp4",
          },
          body: file,
        });
        if (!uploadResponse.ok) {
          throw new Error("Failed to upload file to storage");
        }

        // Step 3: Notify our API that upload is complete
        const completeResponse = await fetch("/api/autoclip/upload-complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: activeSession,
            videoKey: urlData.videoKey,
            workerSessionId: urlData.workerSessionId,
            sizeBytes: file.size,
          }),
        });
        const payload = await completeResponse.json().catch(() => ({}));
        if (!completeResponse.ok) {
          throw new Error(payload.error || "Upload verification failed");
        }

        setInputMeta(payload.input ?? null);
        setUploadReady(true);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Upload failed.";
        setInputError(message);
        setUploadReady(false);
      } finally {
        setInputUploading(false);
      }
    },
    [ensureSession, inputPreviewUrl, inputUploading, resetPipeline, sessionBusy]
  );

  const handleFileSelect = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }
      await handleFileUpload(file);
      event.target.value = "";
    },
    [handleFileUpload]
  );

  const handleDragEnter = useCallback(
    (event: DragEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (inputUploading || sessionBusy) {
        return;
      }
      dragCounterRef.current += 1;
      setDragActive(true);
    },
    [inputUploading, sessionBusy]
  );

  const handleDragLeave = useCallback(
    (event: DragEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (inputUploading || sessionBusy) {
        return;
      }
      dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
      if (dragCounterRef.current === 0) {
        setDragActive(false);
      }
    },
    [inputUploading, sessionBusy]
  );

  const handleDragOver = useCallback(
    (event: DragEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (inputUploading || sessionBusy) {
        return;
      }
      event.dataTransfer.dropEffect = "copy";
    },
    [inputUploading, sessionBusy]
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (inputUploading || sessionBusy) {
        return;
      }
      dragCounterRef.current = 0;
      setDragActive(false);
      const file = event.dataTransfer.files?.[0];
      if (!file) {
        return;
      }
      void handleFileUpload(file);
    },
    [handleFileUpload, inputUploading, sessionBusy]
  );

  const handleUrlUpload = useCallback(async () => {
    if (!videoUrl.trim()) {
      setInputError("Enter a YouTube URL to continue.");
      return;
    }
    resetPipeline();
    setInputError(null);
    setInputUploading(true);
    setInputMeta(null);
    setUploadReady(false);
    if (inputPreviewUrl) {
      URL.revokeObjectURL(inputPreviewUrl);
    }
    setInputPreviewUrl(null);
    try {
      const activeSession = await ensureSession();
      const response = await fetch("/api/autoclip/input", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: activeSession, url: videoUrl.trim() }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          typeof payload?.error === "string"
            ? payload.error
            : "YouTube import failed.";
        throw new Error(message);
      }
      setInputMeta(payload.input ?? null);
      setUploadReady(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "YouTube import failed.";
      setInputError(message);
      setUploadReady(false);
    } finally {
      setInputUploading(false);
    }
  }, [ensureSession, inputPreviewUrl, resetPipeline, videoUrl]);

  const pollTranscriptionUntilComplete = useCallback(
    async (activeSessionId: string) => {
      const startedAt = Date.now();
      let networkFailures = 0;
      while (Date.now() - startedAt < TRANSCRIPTION_POLL_TIMEOUT_MS) {
        await waitFor(TRANSCRIPTION_POLL_INTERVAL_MS);

        let statusResponse: Response;
        try {
          statusResponse = await fetchWithTransientRetry(
            `/api/autoclip/transcribe?sessionId=${encodeURIComponent(
              activeSessionId
            )}&recover=1`,
            {
              method: "GET",
              cache: "no-store",
            },
            {
              attempts: 2,
              delayMs: 800,
            }
          );
          networkFailures = 0;
        } catch (error) {
          if (isTransientFetchError(error)) {
            networkFailures += 1;
            setTranscriptionStageLabel(
              "Connection interrupted. Reconnecting to transcription service..."
            );
            if (networkFailures < TRANSCRIPTION_POLL_NETWORK_FAILURE_LIMIT) {
              continue;
            }
            throw new Error(
              "Lost connection while checking transcription status. Please try again."
            );
          }
          throw error;
        }

        const statusPayload = await statusResponse.json().catch(() => ({}));

        if (statusResponse.status === 202) {
          const progress =
            typeof statusPayload?.progress === "number" &&
            Number.isFinite(statusPayload.progress)
              ? Math.max(0, Math.min(100, statusPayload.progress))
              : null;
          setTranscriptionProgress(progress);
          setTranscriptionStageLabel(
            typeof statusPayload?.stage === "string" &&
              statusPayload.stage.trim().length > 0
              ? statusPayload.stage.trim()
              : "Transcribing your audio"
          );
          continue;
        }

        if (!statusResponse.ok) {
          const message =
            typeof statusPayload?.error === "string"
              ? statusPayload.error
              : "Transcription failed.";
          throw new Error(message);
        }

        return statusPayload;
      }

      throw new Error(
        "Transcription is taking longer than expected. Please wait a moment and try again."
      );
    },
    []
  );

  const handleFindMoments = useCallback(async () => {
    if (!sessionId || !uploadReady) {
      return;
    }
    const resolvedInstructions =
      instructions.trim() || defaultInstructions;
    if (!instructions.trim()) {
      setInstructions(resolvedInstructions);
    }
    setProcessing(true);
    setProcessingStage("transcribing");
    setTranscriptionProgress(null);
    setTranscriptionStageLabel("Transcribing your audio");
    setProcessingError(null);
    setOutputs([]);
    setSelectedClipIds([]);
    setView("processingMoments");
    try {
      const transcribeResponse = await fetchWithTransientRetry(
        "/api/autoclip/transcribe",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            language:
              transcriptionLanguage === "auto"
                ? null
                : transcriptionLanguage,
          }),
        }
      );
      const transcribePayload = await transcribeResponse.json().catch(() => ({}));

      if (transcribeResponse.status === 202) {
        const initialProgress =
          typeof transcribePayload?.progress === "number" &&
          Number.isFinite(transcribePayload.progress)
            ? Math.max(0, Math.min(100, transcribePayload.progress))
            : null;
        setTranscriptionProgress(initialProgress);
        setTranscriptionStageLabel(
          typeof transcribePayload?.stage === "string" &&
            transcribePayload.stage.trim().length > 0
            ? transcribePayload.stage.trim()
            : "Transcribing your audio"
        );
      } else if (!transcribeResponse.ok) {
        const message =
          typeof transcribePayload?.error === "string"
            ? transcribePayload.error
            : "Transcription failed.";
        throw new Error(message);
      }

      const completedTranscription =
        transcribeResponse.status === 202
          ? await pollTranscriptionUntilComplete(sessionId)
          : transcribePayload;

      setTranscriptSegments(
        Array.isArray(completedTranscription?.transcript?.segments)
          ? completedTranscription.transcript.segments
          : []
      );
      setTranscriptionProgress(100);
      setTranscriptionStageLabel("Transcription complete");
      setProcessingStage("highlighting");
      const highlightResponse = await fetchWithTransientRetry(
        "/api/autoclip/highlight",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            instructions: resolvedInstructions,
            description: description.trim(),
          }),
        }
      );
      const highlightPayload = await highlightResponse.json().catch(() => ({}));
      if (!highlightResponse.ok) {
        const message =
          typeof highlightPayload?.error === "string"
            ? highlightPayload.error
            : "Highlight selection failed.";
        throw new Error(message);
      }
      const nextHighlights = Array.isArray(highlightPayload?.highlights)
        ? highlightPayload.highlights
        : [];
      setHighlights(nextHighlights);
      setActiveHighlightIndex(nextHighlights.length ? 0 : null);
      setApprovedHighlightIndexes([]);
      setRemovedHighlightIndexes([]);
      setEditedHighlightIndexes([]);
      setView("review");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to find highlights.";
      setProcessingError(message);
      setView("instructions");
    } finally {
      setProcessing(false);
      setProcessingStage(null);
      setTranscriptionProgress(null);
      setTranscriptionStageLabel(null);
    }
  }, [
    description,
    instructions,
    pollTranscriptionUntilComplete,
    sessionId,
    transcriptionLanguage,
    uploadReady,
  ]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || (!event.metaKey && !event.ctrlKey)) {
        return;
      }
      if (processing || inputUploading || sessionBusy || !uploadReady) {
        return;
      }
      if (view !== "instructions") {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      handleFindMoments();
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [handleFindMoments, inputUploading, processing, sessionBusy, uploadReady, view]);

  const handleApprove = useCallback(
    async (index: number) => {
      if (!sessionId) {
        return;
      }
      setApprovalLoading(true);
      try {
        const response = await fetch("/api/autoclip/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, action: "approve", index }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const message =
            typeof payload?.error === "string"
              ? payload.error
              : "Approval failed.";
          throw new Error(message);
        }
        if (Array.isArray(payload?.approvedIndexes)) {
          setApprovedHighlightIndexes(payload.approvedIndexes);
        } else {
          setApprovedHighlightIndexes((prev) =>
            prev.includes(index) ? prev : [...prev, index]
          );
        }
        if (Array.isArray(payload?.removedIndexes)) {
          setRemovedHighlightIndexes(payload.removedIndexes);
        } else {
          setRemovedHighlightIndexes((prev) =>
            prev.filter((removedIndex) => removedIndex !== index)
          );
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Approval failed.";
        setProcessingError(message);
      } finally {
        setApprovalLoading(false);
      }
    },
    [sessionId]
  );

  const handleUpdateHighlight = useCallback(
    async (index: number, start: number, end: number, title?: string) => {
      if (!sessionId) {
        return false;
      }
      setHighlightUpdating(true);
      setProcessingError(null);
      try {
        const response = await fetch("/api/autoclip/highlight", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            action: "update",
            index,
            start,
            end,
            title,
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const message =
            typeof payload?.error === "string"
              ? payload.error
              : "Update failed.";
          throw new Error(message);
        }
        setHighlights((prev) => {
          if (!prev.length || !payload?.highlight) {
            return prev;
          }
          const next = [...prev];
          next[index] = payload.highlight;
          return next;
        });
        setApprovedHighlightIndexes((prev) =>
          prev.filter((approvedIndex) => approvedIndex !== index)
        );
        setRemovedHighlightIndexes((prev) =>
          prev.filter((removedIndex) => removedIndex !== index)
        );
        setEditedHighlightIndexes((prev) =>
          prev.includes(index) ? prev : [...prev, index]
        );
        return true;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Update failed.";
        setProcessingError(message);
        return false;
      } finally {
        setHighlightUpdating(false);
      }
    },
    [sessionId]
  );

  const handleRemoveHighlight = useCallback(
    async (index: number) => {
      if (!sessionId || !Number.isFinite(index) || index < 0) {
        return;
      }
      setApprovalLoading(true);
      setProcessingError(null);
      try {
        const response = await fetch("/api/autoclip/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, action: "remove", index }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const message =
            typeof payload?.error === "string"
              ? payload.error
              : "Remove failed.";
          throw new Error(message);
        }
        if (Array.isArray(payload?.approvedIndexes)) {
          setApprovedHighlightIndexes(payload.approvedIndexes);
        }
        if (Array.isArray(payload?.removedIndexes)) {
          setRemovedHighlightIndexes(payload.removedIndexes);
        } else {
          setRemovedHighlightIndexes((prev) =>
            prev.includes(index) ? prev : [...prev, index]
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Remove failed.";
        setProcessingError(message);
      } finally {
        setApprovalLoading(false);
      }
    },
    [sessionId]
  );

  const handleRestoreHighlight = useCallback(
    async (index: number) => {
      if (!sessionId || !Number.isFinite(index) || index < 0) {
        return;
      }
      setApprovalLoading(true);
      setProcessingError(null);
      try {
        const response = await fetch("/api/autoclip/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, action: "restore", index }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const message =
            typeof payload?.error === "string"
              ? payload.error
              : "Restore failed.";
          throw new Error(message);
        }
        if (Array.isArray(payload?.approvedIndexes)) {
          setApprovedHighlightIndexes(payload.approvedIndexes);
        }
        if (Array.isArray(payload?.removedIndexes)) {
          setRemovedHighlightIndexes(payload.removedIndexes);
        } else {
          setRemovedHighlightIndexes((prev) =>
            prev.filter((removedIndex) => removedIndex !== index)
          );
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Restore failed.";
        setProcessingError(message);
      } finally {
        setApprovalLoading(false);
      }
    },
    [sessionId]
  );

  const getDraftLimits = useCallback(
    (start: number, end: number) => {
      const maxDuration =
        timelineDuration && Number.isFinite(timelineDuration)
          ? timelineDuration
          : Math.max(end, start + MIN_CLIP_SECONDS);
      const minLength = Math.min(MIN_CLIP_SECONDS, maxDuration);
      let maxLength = Math.min(MAX_CLIP_SECONDS, maxDuration);
      if (maxLength < minLength) {
        maxLength = minLength;
      }
      return { maxDuration, minLength, maxLength };
    },
    [timelineDuration]
  );

  const clampRange = useCallback(
    (start: number, end: number) => {
      const { maxDuration, minLength, maxLength } = getDraftLimits(start, end);
      let nextStart = Number.isFinite(start) ? start : 0;
      let nextEnd = Number.isFinite(end) ? end : nextStart + minLength;
      if (nextEnd < nextStart) {
        const swap = nextEnd;
        nextEnd = nextStart;
        nextStart = swap;
      }
      const requestedLength = nextEnd - nextStart;
      if (requestedLength < minLength) {
        nextEnd = nextStart + minLength;
      } else if (requestedLength > maxLength) {
        nextEnd = nextStart + maxLength;
      }
      nextStart = Math.max(0, Math.min(nextStart, maxDuration - minLength));
      nextEnd = Math.max(nextStart + minLength, Math.min(nextEnd, maxDuration));
      if (nextEnd - nextStart > maxLength) {
        nextEnd = Math.min(maxDuration, nextStart + maxLength);
      }
      if (nextEnd - nextStart < minLength) {
        nextStart = Math.max(0, nextEnd - minLength);
      }
      return { start: nextStart, end: nextEnd };
    },
    [getDraftLimits]
  );

  const updateDraftRange = useCallback(
    (start: number, end: number) => {
      const clamped = clampRange(start, end);
      draftRangeRef.current = clamped;
      setDraftStart(clamped.start);
      setDraftEnd(clamped.end);
    },
    [clampRange]
  );

  const nudgeDraftStart = useCallback(
    (delta: number) => {
      const currentStart =
        draftStart != null ? draftStart : activeHighlight?.start ?? 0;
      const currentEnd =
        draftEnd != null
          ? draftEnd
          : activeHighlight?.end ?? currentStart + 1;
      updateDraftRange(currentStart + delta, currentEnd);
    },
    [activeHighlight, draftEnd, draftStart, updateDraftRange]
  );

  const nudgeDraftEnd = useCallback(
    (delta: number) => {
      const currentStart =
        draftStart != null ? draftStart : activeHighlight?.start ?? 0;
      const currentEnd =
        draftEnd != null
          ? draftEnd
          : activeHighlight?.end ?? currentStart + 1;
      updateDraftRange(currentStart, currentEnd + delta);
    },
    [activeHighlight, draftEnd, draftStart, updateDraftRange]
  );

  const resetDraftRange = useCallback(() => {
    if (!activeHighlight) {
      return;
    }
    updateDraftRange(activeHighlight.start, activeHighlight.end);
  }, [activeHighlight, updateDraftRange]);

  const updateDragFromClientX = useCallback(
    (clientX: number, handle: "start" | "end") => {
      const timeline = timelineRef.current;
      if (!timeline) {
        return;
      }
      const rect = timeline.getBoundingClientRect();
      if (!rect.width) {
        return;
      }
      const { start: currentStart, end: currentEnd } = draftRangeRef.current;
      const { maxDuration, minLength, maxLength } = getDraftLimits(
        currentStart,
        currentEnd
      );
      if (!Number.isFinite(maxDuration) || maxDuration <= 0) {
        return;
      }
      const clampedX = Math.min(Math.max(clientX - rect.left, 0), rect.width);
      const candidateSeconds = (clampedX / rect.width) * maxDuration;
      if (handle === "start") {
        const minStart = Math.max(0, currentEnd - maxLength);
        const maxStart = Math.max(0, currentEnd - minLength);
        const nextStart = Math.min(
          Math.max(candidateSeconds, minStart),
          maxStart
        );
        updateDraftRange(nextStart, currentEnd);
      } else {
        const minEnd = currentStart + minLength;
        const maxEnd = Math.min(maxDuration, currentStart + maxLength);
        const nextEnd = Math.min(
          Math.max(candidateSeconds, minEnd),
          maxEnd
        );
        updateDraftRange(currentStart, nextEnd);
      }
    },
    [getDraftLimits, updateDraftRange]
  );

  const handleTimelineHandlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>, handle: "start" | "end") => {
      event.preventDefault();
      event.stopPropagation();
      draftRangeRef.current = {
        start: resolvedDraftStart,
        end: resolvedDraftEnd,
      };
      dragHandleRef.current = handle;
      setDraggingHandle(handle);
      updateDragFromClientX(event.clientX, handle);
    },
    [resolvedDraftEnd, resolvedDraftStart, updateDragFromClientX]
  );

  const handleApproveWithDraft = useCallback(async () => {
    if (!activeHighlight || activeHighlightIndex == null) {
      return;
    }
    const nextStart = resolvedDraftStart;
    const nextEnd = resolvedDraftEnd;
    if (draftRangeChanged) {
      const updated = await handleUpdateHighlight(
        activeHighlightIndex,
        nextStart,
        nextEnd,
        activeHighlight.title
      );
      if (!updated) {
        return;
      }
    }
    if (!activeHighlightApproved || draftRangeChanged) {
      await handleApprove(activeHighlightIndex);
    }
    setReviewModalOpen(false);
  }, [
    handleApprove,
    handleUpdateHighlight,
    activeHighlight,
    activeHighlightIndex,
    activeHighlightApproved,
    draftRangeChanged,
    resolvedDraftEnd,
    resolvedDraftStart,
  ]);

  const handlePlayReview = useCallback(() => {
    const video = reviewVideoRef.current;
    if (!video) {
      return;
    }
    const currentTime = video.currentTime;
    if (
      currentTime < reviewPlaybackStart ||
      currentTime >= reviewPlaybackEnd
    ) {
      video.currentTime = reviewPlaybackStart;
    }
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [reviewPlaybackEnd, reviewPlaybackStart]);

  const handlePlayFromStart = useCallback(() => {
    const video = reviewVideoRef.current;
    if (!video) {
      return;
    }
    video.currentTime = reviewPlaybackStart;
    video.play().catch(() => {});
  }, [reviewPlaybackStart]);

  const handleRender = useCallback(async () => {
    if (!sessionId || !approvalReady) {
      return;
    }
    setRendering(true);
    setRenderError(null);
    setView("processingMagic");
    try {
      const response = await fetch("/api/autoclip/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          highlightIndexes: approvedHighlightIndexes,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          typeof payload?.error === "string"
            ? payload.error
            : "Render failed.";
        throw new Error(message);
      }
      const nextOutputs = Array.isArray(payload?.outputs)
        ? payload.outputs
        : [];
      setOutputs(nextOutputs);
      setSelectedClipIds(
        nextOutputs.map((_output: AutoClipOutputMeta, index: number) => index)
      );
      setView("final");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Render failed.";
      setRenderError(message);
      setView("review");
    } finally {
      setRendering(false);
    }
  }, [approvalReady, approvedHighlightIndexes, sessionId]);

  const handleDownload = useCallback(
    (outputIndex: number) => {
      const output = outputs[outputIndex];
      const url = getOutputDownloadUrl(outputIndex, "attachment");
      if (!url) {
        return;
      }
      const params = new URLSearchParams({
        outputIndex: String(outputIndex),
      });
      if (output?.filename) {
        params.set("filename", output.filename);
      }
      const anchor = document.createElement("a");
      anchor.href = `${url}&${params.toString()}`;
      anchor.setAttribute("download", output?.filename || `clip-${outputIndex + 1}.mp4`);
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    },
    [getOutputDownloadUrl, outputs]
  );

  const buildClipAsset = useCallback(
    (outputIndex: number): AssetLibraryItem | null => {
      const downloadUrl = getOutputDownloadUrl(outputIndex);
      if (!downloadUrl) {
        return null;
      }
      const output = outputs[outputIndex];
      const highlight =
        output?.highlightIndex != null
          ? highlights[output.highlightIndex] ?? null
          : null;
      const duration = highlight
        ? Math.max(0, highlight.end - highlight.start)
        : undefined;
      return buildAssetLibraryItem({
        name: output?.filename ?? "AutoClip Highlight",
        kind: "video",
        url: `${downloadUrl}&disposition=inline`,
        size: 0,
        duration,
        source: "autoclip",
      });
    },
    [getOutputDownloadUrl, highlights, outputs]
  );

  const handleOpenInEditor = useCallback(
    (outputIndexes: number | number[]) => {
      const indexes = Array.isArray(outputIndexes)
        ? outputIndexes
        : [outputIndexes];
      const assets = indexes
        .map((index) => buildClipAsset(index))
        .filter((item): item is AssetLibraryItem => Boolean(item));
      if (!assets.length) {
        return;
      }
      try {
        window.localStorage.setItem(
          "autoclip:assets",
          JSON.stringify(assets)
        );
        window.localStorage.removeItem("autoclip:asset");
      } catch (error) {
        // Ignore localStorage failures.
      }
      window.location.href = "/editor/advanced?new=1";
    },
    [buildClipAsset]
  );

  const handleSelectClip = useCallback((id: number) => {
    setSelectedClipIds((prev) =>
      prev.includes(id) ? prev.filter((clipId) => clipId !== id) : [...prev, id]
    );
  }, []);

  const handleDownloadSelected = useCallback(() => {
    if (!selectedClipIds.length) {
      return;
    }
    const unique = Array.from(new Set(selectedClipIds)).sort((a, b) => a - b);
    unique.forEach((index, position) => {
      window.setTimeout(() => {
        handleDownload(index);
      }, position * 250);
    });
  }, [handleDownload, selectedClipIds]);

  const handleOpenSelectedInEditor = useCallback(() => {
    if (!selectedClipIds.length) {
      return;
    }
    handleOpenInEditor(selectedClipIds);
  }, [handleOpenInEditor, selectedClipIds]);

  const handleSaveToProjectLibrary = useCallback(
    async (outputIndex: number, title: string) => {
      if (!sessionId) {
        return;
      }
      if (savedClipIds.includes(outputIndex)) {
        return;
      }
      if (savingClipIds.includes(outputIndex)) {
        return;
      }
      setProjectSaveError(null);
      setSavingClipIds((prev) => [...prev, outputIndex]);
      try {
        const response = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, clipIndex: outputIndex, title }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const message =
            typeof payload?.error === "string"
              ? payload.error
              : "Unable to save clip.";
          throw new Error(message);
        }
        setSavedClipIds((prev) =>
          prev.includes(outputIndex) ? prev : [...prev, outputIndex]
        );
      } catch (error) {
        setProjectSaveError(
          error instanceof Error ? error.message : "Unable to save clip."
        );
      } finally {
        setSavingClipIds((prev) =>
          prev.filter((clipId) => clipId !== outputIndex)
        );
      }
    },
    [savedClipIds, savingClipIds, sessionId]
  );

  const handleSaveSelectedToLibrary = useCallback(() => {
    if (!selectedClipIds.length) {
      return;
    }
    selectedClipIds.forEach((clipId) => {
      const clip = finalClips.find((item) => item.id === clipId);
      if (!clip) {
        return;
      }
      handleSaveToProjectLibrary(clip.outputIndex, clip.title);
    });
  }, [finalClips, handleSaveToProjectLibrary, selectedClipIds]);

  // Hover intent refs for profile menu
  const hoverOpenTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hoverCloseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleProfileMouseEnter = useCallback(() => {
    if (hoverCloseTimeoutRef.current) {
      clearTimeout(hoverCloseTimeoutRef.current);
      hoverCloseTimeoutRef.current = null;
    }
    hoverOpenTimeoutRef.current = setTimeout(() => {
      setProfileMenuOpen(true);
    }, 80);
  }, []);

  const handleProfileMouseLeave = useCallback(() => {
    if (hoverOpenTimeoutRef.current) {
      clearTimeout(hoverOpenTimeoutRef.current);
      hoverOpenTimeoutRef.current = null;
    }
    hoverCloseTimeoutRef.current = setTimeout(() => {
      setProfileMenuOpen(false);
    }, 150);
  }, []);

  useEffect(() => {
    return () => {
      if (hoverOpenTimeoutRef.current) clearTimeout(hoverOpenTimeoutRef.current);
      if (hoverCloseTimeoutRef.current) clearTimeout(hoverCloseTimeoutRef.current);
    };
  }, []);

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

  useEffect(() => {
    if (!activeHighlight) {
      setDraftStart(null);
      setDraftEnd(null);
      draftRangeRef.current = { start: 0, end: 0 };
      return;
    }
    updateDraftRange(activeHighlight.start, activeHighlight.end);
  }, [activeHighlight, updateDraftRange]);

  useEffect(() => {
    draftRangeRef.current = {
      start: resolvedDraftStart,
      end: resolvedDraftEnd,
    };
  }, [resolvedDraftEnd, resolvedDraftStart]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const handle = dragHandleRef.current;
      if (!handle) {
        return;
      }
      updateDragFromClientX(event.clientX, handle);
    };
    const stopDrag = () => {
      if (!dragHandleRef.current) {
        return;
      }
      dragHandleRef.current = null;
      setDraggingHandle(null);
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopDrag);
    window.addEventListener("pointercancel", stopDrag);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopDrag);
      window.removeEventListener("pointercancel", stopDrag);
    };
  }, [updateDragFromClientX]);

  useEffect(() => {
    if (view === "review" && activeHighlight) {
      setReviewModalOpen(true);
      setAdjustMode(false);
    }
  }, [activeHighlight, view]);

  useEffect(() => {
    const video = reviewVideoRef.current;
    if (!video || !reviewModalOpen) {
      return;
    }
    try {
      if (Number.isFinite(reviewPlaybackStart)) {
        video.currentTime = reviewPlaybackStart;
      }
    } catch {
      // Ignore seek errors before metadata is ready.
    }
    const handleTimeUpdate = () => {
      if (video.currentTime >= reviewPlaybackEnd) {
        video.pause();
      }
    };
    const handleLoaded = () => {
      if (Number.isFinite(reviewPlaybackStart)) {
        video.currentTime = reviewPlaybackStart;
      }
    };
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("loadedmetadata", handleLoaded);
    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("loadedmetadata", handleLoaded);
    };
  }, [reviewModalOpen, reviewPlaybackEnd, reviewPlaybackStart]);

  useEffect(() => {
    return () => {
      if (inputPreviewUrl) {
        URL.revokeObjectURL(inputPreviewUrl);
      }
    };
  }, [inputPreviewUrl]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0e1012] font-sans text-[#f7f7f8]">
      <div className="mx-auto flex w-full md:max-w-[90rem]">
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
                <Link
                  key={item.label}
                  href={item.href}
                  ref={(element) => {
                    navItemRefs.current[index] = element;
                  }}
                  className={`flex h-11 w-11 items-center justify-center rounded-lg transition-colors ${item.active ? "bg-[rgba(154,237,0,0.1)]" : "hover:bg-[rgba(255,255,255,0.05)]"
                    }`}
                  aria-label={item.label}
                  onMouseEnter={() => setHoveredNavIndex(index)}
                >
                  {item.icon}
                  <NavTooltip label={item.label} anchor={navItemRefs.current[index]} visible={hoveredNavIndex === index} onDismiss={() => setHoveredNavIndex(null)} />
                </Link>
              ))}
            </nav>
            <div className="mt-auto pb-6">
              <button
                className="group flex h-12 w-12 flex-col items-center justify-center rounded-xl border border-transparent transition-colors hover:border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.05)] xl:h-14 xl:w-14"
                type="button"
                aria-label="Search"
                onClick={() => setSearchOpen(true)}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-5 w-5 text-[#898a8b] group-hover:text-[#f7f7f8]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                <span className="text-[10px] font-medium text-[#898a8b] group-hover:text-[#f7f7f8]">
                  Cmd+K
                </span>
              </button>
            </div>
          </div>
        </aside>

        <main className="flex min-h-[100dvh] w-full flex-1 flex-col px-4 pb-16 pt-3 md:px-6 md:py-6">
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
            className={`fixed inset-0 z-40 md:hidden ${mobileMenuOpen ? "" : "pointer-events-none"
              }`}
          >
<div
            className={`absolute inset-0 bg-black/50 transition-opacity ${mobileMenuOpen ? "opacity-100" : "opacity-0"
              }`}
            onClick={() => setMobileMenuOpen(false)}
          />
            <div
              className={`absolute left-0 top-0 h-full w-[82%] max-w-xs bg-[#0e1012] shadow-xl transition-transform ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
                }`}
            >
              <div className="p-3">
                <div className="flex items-center space-x-3">
                  <img
                    src={userAvatarSrc}
                    alt="Profile"
                    className="h-10 w-10 rounded-full object-cover"
                    draggable="false"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#f7f7f8]">
                      {userName}
                    </p>
                    <p className="text-xs text-[#898a8b]">
                      {userEmail}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2 px-3 pb-3">
                {mobileSections.map((section) => (
                  <div key={section.label} className="rounded-xl border border-[rgba(255,255,255,0.08)]">
                    <button
                      className="flex w-full items-center justify-between px-3 py-2 text-left"
                      type="button"
                      onClick={() => toggleSection(section.label)}
                    >
                      <span className="flex items-center gap-2 text-sm font-medium text-[#f7f7f8]">
                        {section.icon}
                        {section.label}
                      </span>
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        className={`h-4 w-4 text-[#898a8b] transition-transform ${openSections[section.label] ? "rotate-180" : ""
                          }`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </button>
                    {openSections[section.label] && (
                      <div className="flex flex-col gap-1 px-3 pb-2">
                        {section.items.map((item) => (
                          <Link
                            key={item.label}
                            href={item.href}
                            className="rounded-lg px-2 py-1 text-sm text-[#898a8b] hover:bg-[rgba(255,255,255,0.05)] hover:text-[#f7f7f8]"
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-auto space-y-2 border-t border-[rgba(255,255,255,0.08)] px-3 py-3">
                {mobileFooterActions.map((action) => (
                  <Link
                    key={action.label}
                    href={action.href}
                    className={`block rounded-lg px-3 py-2 text-sm font-medium ${action.tone === "danger"
                      ? "text-[#e72930] hover:bg-[rgba(231,41,48,0.1)]"
                      : "text-[#898a8b] hover:bg-[rgba(255,255,255,0.05)] hover:text-[#f7f7f8]"
                      }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {action.label}
                  </Link>
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
                  <path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" />
                  <path d="M20 2v4" />
                  <path d="M22 4h-4" />
                  <circle cx="4" cy="20" r="2" />
                </svg>
              </div>
              <div>
                <h2 className="font-[family-name:var(--font-geist-sans)] text-lg font-semibold uppercase tracking-tight text-[#f7f7f8]">AutoClip</h2>
              </div>
            </div>
            <div
              className="relative"
              ref={profileMenuRef}
              onMouseEnter={handleProfileMouseEnter}
              onMouseLeave={handleProfileMouseLeave}
            >
              <button
                className={`flex h-10 w-auto items-center space-x-3 rounded-full border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] p-1 px-2 transition-all duration-200 hover:bg-[#252729] focus:outline-none ${
                  profileMenuOpen ? "bg-[#252729]" : ""
                }`}
                type="button"
                aria-haspopup="menu"
                aria-expanded={profileMenuOpen}
                aria-controls="autoclip-profile-menu"
                onClick={() => setProfileMenuOpen((open) => !open)}
              >
                <img
                  src={userAvatarSrc}
                  alt="Profile"
                  className="h-6 w-6 select-none rounded-full object-cover md:h-8 md:w-8"
                  draggable="false"
                />
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className={`h-4 w-4 transition-transform duration-200 ${
                    profileMenuOpen ? "rotate-180 text-[#f7f7f8]" : "text-[#898a8b]"
                  }`}
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
                className={`absolute right-0 top-full h-2 w-full ${
                  profileMenuOpen ? "pointer-events-auto" : "pointer-events-none"
                }`}
              />
              <div
                id="autoclip-profile-menu"
                className={`absolute right-0 top-full z-30 mt-2 w-64 origin-top-right rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] shadow-lg transition-all duration-200 ease-out ${
                  profileMenuOpen
                    ? "pointer-events-auto scale-100 opacity-100"
                    : "pointer-events-none scale-95 opacity-0"
                }`}
              >
                <div className="flex flex-row items-center space-x-3 px-3 py-3">
                  <img
                    src={userAvatarSrc}
                    alt="Profile"
                    className="h-10 w-10 select-none rounded-full object-cover"
                    draggable="false"
                  />
                  <div className="flex flex-col items-start justify-start">
                    <p className="text-sm font-medium text-[#f7f7f8]">{userName}</p>
                    <p className="text-xs text-[#898a8b] truncate max-w-[160px]">
                      {userEmail}
                    </p>
                  </div>
                </div>
                <div className="border-t border-[rgba(255,255,255,0.08)] py-1">
                  <Link
                    href="/settings"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#898a8b] transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-[#f7f7f8]"
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    Settings
                  </Link>
                  <Link
                    href="/upgrade"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#898a8b] transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-[#f7f7f8]"
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 3h12l4 6-10 13L2 9z" />
                      <path d="M12 22V9" />
                      <path d="m2 9 10 4 10-4" />
                      <path d="m6 3 6 6 6-6" />
                    </svg>
                    Upgrade
                  </Link>
                  <Link
                    href="/support"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#898a8b] transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-[#f7f7f8]"
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                      <path d="M12 17h.01" />
                    </svg>
                    24/7 Support
                  </Link>
                </div>
                <div className="border-t border-[rgba(255,255,255,0.08)] py-1">
                  <button
                    className="flex w-full items-center gap-2 rounded-b-lg px-3 py-2 text-left text-sm text-[#e72930] transition-colors hover:bg-[rgba(231,41,48,0.1)]"
                    type="button"
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16,17 21,12 16,7" />
                      <line x1="21" x2="9" y1="12" y2="12" />
                    </svg>
                    Log Out
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-1 flex-col border-t border-[rgba(255,255,255,0.08)] md:border-none">
            {view === "home" ? (
              <div className="flex min-h-full flex-col items-center justify-center px-6 py-12 sm:px-8 sm:py-16 lg:px-12 lg:py-20">
                <div className="flex w-full max-w-2xl flex-col gap-6">
                  {/* Header */}
                  <div className="text-center">
                    <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#252729] to-[#1a1c1e]">
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        className="h-7 w-7 text-white"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" />
                      </svg>
                    </div>
                    <h1 className="text-3xl font-semibold tracking-tight text-[#f7f7f8] sm:text-4xl">
                      AutoClip
                    </h1>
                    <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-[#898a8b]">
                      Transform long videos into viral clips with AI
                    </p>
                  </div>

                  {/* Upload Card */}
                  <div className="overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] shadow-sm">
                    {/* Tabs */}
                    <div className="flex border-b border-[rgba(255,255,255,0.08)]">
                      <button
                        type="button"
                        className={`relative flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                          inputMode === "upload"
                            ? "text-[#f7f7f8]"
                            : "text-[#898a8b] hover:text-[#f7f7f8]"
                        }`}
                        onClick={() => setInputMode("upload")}
                      >
                        Upload File
                        {inputMode === "upload" && (
                          <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#9aed00]" />
                        )}
                      </button>
                      <button
                        type="button"
                        className={`relative flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                          inputMode === "youtube"
                            ? "text-[#f7f7f8]"
                            : "text-[#898a8b] hover:text-[#f7f7f8]"
                        }`}
                        onClick={() => setInputMode("youtube")}
                      >
                        YouTube URL
                        {inputMode === "youtube" && (
                          <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#9aed00]" />
                        )}
                      </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 sm:p-8">
                      {sessionError && (
                        <div className="mb-6 rounded-xl border border-[rgba(231,41,48,0.3)] bg-[rgba(231,41,48,0.1)] px-4 py-3 text-sm text-[#e72930]">
                          {sessionError}
                        </div>
                      )}

                      {inputMode === "upload" ? (
                        <div className="space-y-6">
                          {/* Dropzone */}
                          <button
                            type="button"
                            className={`group relative flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-16 transition-all duration-200 ${
                              dragActive
                                ? "border-[#9aed00] bg-[rgba(154,237,0,0.05)]"
                                : uploadReady
                                  ? "border-[rgba(255,255,255,0.12)] bg-[#0e1012]"
                                  : "border-[rgba(255,255,255,0.08)] bg-[#0e1012] hover:border-[rgba(255,255,255,0.15)] hover:bg-[rgba(255,255,255,0.02)]"
                            }`}
                            onClick={() => {
                              if (!uploadReady) {
                                handleStartNew();
                                fileInputRef.current?.click();
                              }
                            }}
                            onDragEnter={handleDragEnter}
                            onDragLeave={handleDragLeave}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                            disabled={inputUploading || sessionBusy}
                          >
                            <input
                              ref={fileInputRef}
                              accept="video/*,.mp4,.mov,.avi,.webm,.mkv,.flv,.wmv,.m4v,.mpg,.mpeg"
                              type="file"
                              className="hidden"
                              onChange={handleFileSelect}
                            />

                            {uploadReady ? (
                              <div className="flex flex-col items-center gap-1 pb-2.5">
                                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(76,175,80,0.2)]">
                                  <svg
                                    aria-hidden="true"
                                    viewBox="0 0 24 24"
                                    className="h-6 w-6 text-[#4caf50]"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <path d="M20 6 9 17l-5-5" />
                                  </svg>
                                </div>
                                <p className="max-w-[280px] truncate text-sm font-medium text-[#f7f7f8]">
                                  {inputName}
                                </p>
                                <p className="mb-3 text-xs text-[#898a8b]">
                                  {inputSizeLabel}
                                </p>
                                <span
                                  role="button"
                                  tabIndex={0}
                                  className="cursor-pointer text-xs font-medium text-[#898a8b] underline underline-offset-2 hover:text-[#f7f7f8]"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    resetInput();
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.stopPropagation();
                                      resetInput();
                                    }
                                  }}
                                >
                                  Remove and upload different file
                                </span>
                              </div>
                            ) : inputUploading ? (
                              <div className="flex flex-col items-center">
                                <div className="mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[rgba(255,255,255,0.1)] border-t-[#9aed00]" />
                                <p className="text-sm font-medium text-[#898a8b]">
                                  Uploading...
                                </p>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-1 py-2.5">
                                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#252729] transition-colors group-hover:bg-[rgba(154,237,0,0.1)]">
                                  <svg
                                    aria-hidden="true"
                                    viewBox="0 0 24 24"
                                    className="h-6 w-6 text-[#898a8b] group-hover:text-[#9aed00]"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <path d="M12 16V4" />
                                    <path d="m7 9 5-5 5 5" />
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                  </svg>
                                </div>
                                <p className="mt-4 text-base font-medium text-[#f7f7f8]">
                                  {dragActive ? "Drop your video" : "Drop video here"}
                                </p>
                                <p className="text-sm text-[#898a8b]">
                                  or click to browse
                                </p>
                                <p className="mt-3 text-xs text-[#898a8b]">
                                  MP4, MOV, AVI, WebM up to 300MB
                                </p>
                              </div>
                            )}
                          </button>

                          {inputError && (
                            <div className="rounded-xl border border-[rgba(231,41,48,0.3)] bg-[rgba(231,41,48,0.1)] px-4 py-3 text-sm text-[#e72930]">
                              {inputError}
                            </div>
                          )}

                          {/* Continue Button */}
                          <button
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#9aed00] px-6 py-4 text-sm font-medium text-black transition-all hover:bg-[#8ad600] disabled:cursor-not-allowed disabled:bg-[#252729] disabled:text-[#898a8b]"
                            type="button"
                            disabled={!uploadReady || inputUploading}
                            onClick={() => setView("instructions")}
                          >
                            Continue
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
                      ) : (
                        <div className="space-y-6">
                          {/* YouTube URL Input */}
                          <div className="space-y-3">
                            <label
                              htmlFor="youtube-url-home"
                              className="block text-sm font-medium text-[#898a8b]"
                            >
                              Paste YouTube URL
                            </label>
                            <input
                              id="youtube-url-home"
                              type="url"
                              value={videoUrl}
                              onChange={(event) => setVideoUrl(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  handleStartNew();
                                  handleUrlUpload();
                                }
                              }}
                              placeholder="https://youtube.com/watch?v=..."
                              className="h-14 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0e1012] px-4 text-base text-[#f7f7f8] placeholder:text-[#898a8b] focus:border-[#9aed00]/30 focus:outline-none focus:ring-1 focus:ring-[#9aed00]/20"
                            />
                          </div>

                          {uploadReady && (
                            <div className="flex items-center justify-between rounded-xl bg-[rgba(76,175,80,0.1)] px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(76,175,80,0.2)]">
                                  <svg
                                    aria-hidden="true"
                                    viewBox="0 0 24 24"
                                    className="h-4 w-4 text-[#4caf50]"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <path d="M20 6 9 17l-5-5" />
                                  </svg>
                                </div>
                                <div>
                                  <p className="max-w-[200px] truncate text-sm font-medium text-[#f7f7f8] sm:max-w-[300px]">
                                    {inputName}
                                  </p>
                                  <p className="text-xs text-[#898a8b]">{inputSizeLabel}</p>
                                </div>
                              </div>
                              <button
                                type="button"
                                className="text-[#898a8b] hover:text-[#f7f7f8]"
                                onClick={resetInput}
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
                          )}

                          {inputError && (
                            <div className="rounded-xl border border-[rgba(231,41,48,0.3)] bg-[rgba(231,41,48,0.1)] px-4 py-3 text-sm text-[#e72930]">
                              {inputError}
                            </div>
                          )}

                          {/* Import / Continue Button */}
                          {uploadReady ? (
                            <button
                              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#9aed00] px-6 py-4 text-sm font-medium text-black transition-all hover:bg-[#8ad600]"
                              type="button"
                              onClick={() => setView("instructions")}
                            >
                              Continue
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
                          ) : (
                            <button
                              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#9aed00] px-6 py-4 text-sm font-medium text-black transition-all hover:bg-[#8ad600] disabled:cursor-not-allowed disabled:bg-[#252729] disabled:text-[#898a8b]"
                              type="button"
                              disabled={inputUploading || sessionBusy || !videoUrl.trim()}
                              onClick={() => {
                                handleStartNew();
                                handleUrlUpload();
                              }}
                            >
                              {inputUploading ? (
                                <>
                                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-[rgba(0,0,0,0.2)] border-t-black" />
                                  Importing...
                                </>
                              ) : (
                                <>
                                  Import Video
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
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* How it works - Minimal */}
                  <div className="mt-12">
                    <div className="flex items-center justify-center gap-8 text-center sm:gap-12">
                      <div className="flex flex-col items-center">
                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#252729] text-sm font-medium text-[#9aed00]">
                          1
                        </div>
                        <p className="text-xs font-medium text-[#898a8b]">Upload</p>
                      </div>
                      <div className="h-px w-8 bg-[rgba(255,255,255,0.08)] sm:w-12" />
                      <div className="flex flex-col items-center">
                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#252729] text-sm font-medium text-[#9aed00]">
                          2
                        </div>
                        <p className="text-xs font-medium text-[#898a8b]">AI Finds Clips</p>
                      </div>
                      <div className="h-px w-8 bg-[rgba(255,255,255,0.08)] sm:w-12" />
                      <div className="flex flex-col items-center">
                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#252729] text-sm font-medium text-[#9aed00]">
                          3
                        </div>
                        <p className="text-xs font-medium text-[#898a8b]">Export</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 gap-6">
                <aside className="fixed inset-y-0 left-0 z-40 w-72 -translate-x-full transform bg-[#0e1012] shadow-lg transition-transform duration-200 ease-out lg:relative lg:w-80 lg:translate-x-0 lg:border-r lg:border-[rgba(255,255,255,0.08)] lg:shadow-none">
                  <div className="flex h-full flex-col">
                    <div className="rounded-t-2xl p-6 pb-5">
                      <button
                        className="mb-6 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-[#898a8b] transition-colors hover:text-[#f7f7f8]"
                        type="button"
                        onClick={() => setView("home")}
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
                          <path d="m12 19-7-7 7-7" />
                          <path d="M19 12H5" />
                        </svg>
                        <span>Back to AutoClip Home</span>
                      </button>
                      <h2 className="text-base font-semibold tracking-tight text-[#f7f7f8]">
                        AI Clip Creator
                      </h2>
                      <p className="mt-2 text-xs text-[#898a8b]">
                        Transform your videos into viral clips
                      </p>
                    </div>
                    <div className="flex-1 overflow-y-auto px-6">
                      <nav className="space-y-3">
                        {stepDefinitions.map((step) => {
                          const isActive = currentStep === step.id;
                          const isComplete =
                            currentStep !== null && step.id < currentStep;
                          const wrapperClass = isActive
                            ? "bg-[rgba(154,237,0,0.05)] shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
                            : "hover:bg-[rgba(255,255,255,0.03)]";
                          const iconBgClass = isActive
                            ? "bg-[rgba(154,237,0,0.15)]"
                            : "bg-[#252729]";
                          const iconColorClass = isActive
                            ? "text-[#9aed00]"
                            : isComplete
                              ? "text-[#f7f7f8]"
                              : "text-[#898a8b]";
                          const textClass = isActive
                            ? "text-[#f7f7f8]"
                            : isComplete
                              ? "text-[#f7f7f8]"
                              : "text-[#898a8b]";
                          const detailClass = isActive
                            ? "text-[#898a8b]"
                            : isComplete
                              ? "text-[#898a8b]"
                              : "text-[#666]";
                          const numberClass = isActive
                            ? "text-[#9aed00]"
                            : isComplete
                              ? "text-[#898a8b]"
                              : "text-[#666]";

                          return (
                            <button
                              key={step.id}
                              type="button"
                              className={`group relative flex w-full select-none items-center gap-3 rounded-xl px-3 py-3 text-left transition-all ${wrapperClass}`}
                              onClick={() => {
                                if (step.id === 1) {
                                  if (uploadReady) {
                                    setView("instructions");
                                  }
                                } else if (step.id === 2) {
                                  if (highlights.length > 0) {
                                    setView("review");
                                  }
                                } else if (step.id === 3) {
                                  if (outputs.length > 0) {
                                    setView("final");
                                  }
                                }
                              }}
                            >
                              <div
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all ${iconBgClass} ${iconColorClass}`}
                              >
                                {step.icon("h-4 w-4")}
                              </div>
                              <div className="flex-1">
                                <h4
                                  className={`text-sm font-semibold transition-colors ${textClass}`}
                                >
                                  {step.label}
                                </h4>
                                <p className={`text-xs ${detailClass}`}>
                                  {step.detail}
                                </p>
                              </div>
                              <span
                                className={`text-[10px] font-semibold uppercase tracking-widest ${numberClass}`}
                              >
                                {step.id}/3
                              </span>
                            </button>
                          );
                        })}
                      </nav>
                    </div>
                    <div className="border-t border-[rgba(255,255,255,0.08)] p-6">
                      <div className="mb-4">
                        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-[#898a8b]">
                          <span>Progress</span>
                          <span className="text-[#f7f7f8]">
                            {progressPercent}%
                          </span>
                        </div>
                        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#252729]">
                          <div
                            className="h-full bg-[#9aed00] transition-all duration-500 ease-out"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>
                      <button
                        className="flex w-full items-center justify-center gap-2 rounded-full border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] px-4 py-2.5 text-sm font-semibold text-[#898a8b] transition-all hover:bg-[#252729] hover:text-[#f7f7f8]"
                        type="button"
                        onClick={handleStartOver}
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
                          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                          <path d="M3 3v5h5" />
                        </svg>
                        Start Over
                      </button>
                    </div>
                  </div>
                </aside>

                <div className="flex-1 overflow-x-hidden">
                  {view === "instructions" && (
                    <div className="mx-auto h-full p-6 lg:p-10">
                      <div className="flex h-full flex-col gap-6 overflow-hidden">
                        <div className="flex flex-col gap-1">
                          <h1 className="text-2xl font-semibold tracking-tight text-[#f7f7f8] md:text-3xl">
                            Clip Instructions
                          </h1>
                          <p className="text-sm text-[#898a8b] md:text-base">
                            Tell our AI what type of viral clips to create from
                            your video
                          </p>
                        </div>
                        <div className="flex flex-col gap-6 overflow-y-auto overflow-x-hidden lg:flex-row lg:gap-6">
                          <div className="flex min-h-fit min-w-0 flex-1 flex-col gap-5 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] p-5 md:p-6">
                            <h3 className="text-base font-semibold tracking-tight text-[#f7f7f8]">
                              Instructions
                            </h3>
                            <div className="h-px w-full bg-[rgba(255,255,255,0.08)]" />
                            <div className="flex flex-col gap-3">
                              <div className="flex items-center justify-between">
                                <label
                                  className="text-sm font-semibold text-[#f7f7f8]"
                                  htmlFor="clip-request"
                                >
                                  What clips do you want to create?
                                  <span className="ml-1 text-[#e72930]">*</span>
                                </label>
                                <button
                                  className="inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#898a8b] transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-[#f7f7f8]"
                                  type="button"
                                  onClick={() => setInstructions(defaultInstructions)}
                                >
                                  <svg
                                    aria-hidden="true"
                                    viewBox="0 0 24 24"
                                    className="mr-1 h-3 w-3"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" />
                                    <path d="M20 2v4" />
                                    <path d="M22 4h-4" />
                                    <circle cx="4" cy="20" r="2" />
                                  </svg>
                                  Use default
                                </button>
                              </div>
                              <p className="text-xs text-[#898a8b]">
                                We will find 6 viral moments (7-45 seconds each)
                                based on your instructions
                              </p>
                              <textarea
                                className="min-h-[90px] w-full resize-none rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0e1012] px-3 py-2 text-sm text-[#f7f7f8] placeholder:text-[#898a8b] focus:border-[#9aed00]/30 focus:outline-none focus:ring-1 focus:ring-[#9aed00]/20"
                                id="clip-request"
                                placeholder="Find the most engaging moments, funny reactions, key insights..."
                                value={instructions}
                                onChange={(event) => setInstructions(event.target.value)}
                              />
                            </div>
                            <div className="flex flex-col gap-3">
                              <label
                                className="text-sm font-semibold text-[#f7f7f8]"
                                htmlFor="description"
                              >
                                Describe your video content
                                <span className="ml-1 text-xs font-normal text-[#898a8b]">
                                  (optional)
                                </span>
                              </label>
                              <textarea
                                className="min-h-[110px] w-full resize-none rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0e1012] px-3 py-2 text-sm text-[#f7f7f8] placeholder:text-[#898a8b] focus:border-[#9aed00]/30 focus:outline-none focus:ring-1 focus:ring-[#9aed00]/20"
                                id="description"
                                placeholder="e.g., A tutorial on React hooks, gameplay footage, product demo..."
                                maxLength={500}
                                value={description}
                                onChange={(event) => setDescription(event.target.value)}
                              />
                              <p className="text-xs text-[#898a8b]">
                                Help our AI understand your content better
                              </p>
                            </div>
                            <div className="flex flex-col gap-2">
                              <label
                                className="text-sm font-semibold text-[#f7f7f8]"
                                htmlFor="transcription-language"
                              >
                                Transcription language
                              </label>
                              <div className="flex flex-col gap-2">
                                <select
                                  id="transcription-language"
                                  value={transcriptionLanguage}
                                  onChange={(event) =>
                                    setTranscriptionLanguage(event.target.value)
                                  }
                                  className="h-10 w-full rounded-md border border-[rgba(255,255,255,0.08)] bg-[#0e1012] px-3 text-sm text-[#f7f7f8] focus:border-[#9aed00]/30 focus:outline-none focus:ring-1 focus:ring-[#9aed00]/20 sm:max-w-xs"
                                >
                                  <option value="auto">Auto detect</option>
                                  <option value="en">English</option>
                                  <option value="es">Spanish</option>
                                  <option value="fr">French</option>
                                  <option value="de">German</option>
                                  <option value="it">Italian</option>
                                  <option value="pt">Portuguese</option>
                                  <option value="nl">Dutch</option>
                                  <option value="sv">Swedish</option>
                                  <option value="pl">Polish</option>
                                </select>
                                <p className="text-xs text-[#898a8b]">
                                  Set this if the transcript language looks off.
                                </p>
                              </div>
                            </div>
                            <div className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0e1012] p-4">
                              <div className="flex gap-3">
                                <svg
                                  aria-hidden="true"
                                  viewBox="0 0 24 24"
                                  className="h-4 w-4 flex-shrink-0 text-[#9aed00]"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <circle cx="12" cy="12" r="10" />
                                  <line x1="12" x2="12" y1="8" y2="12" />
                                  <line x1="12" x2="12.01" y1="16" y2="16" />
                                </svg>
                                <div className="space-y-1">
                                  <h4 className="text-sm font-semibold text-[#f7f7f8]">
                                    Finding Viral Moments
                                  </h4>
                                  <p className="text-xs text-[#898a8b]">
                                    Our AI analyzes your video to find the most
                                    engaging moments. This process typically
                                    takes 3 to 5 minutes depending on video
                                    length.
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex min-h-fit w-full min-w-0 flex-col gap-5 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] p-5 md:p-6 lg:w-[40%] max-lg:order-first">
                            <h3 className="text-base font-semibold tracking-tight text-[#f7f7f8]">
                              Video Preview
                            </h3>
                            <div className="h-px w-full bg-[rgba(255,255,255,0.08)]" />
                            <div className="flex w-full flex-col gap-4">
                              <div className="flex w-full items-center justify-center overflow-hidden rounded-2xl bg-black/90 ring-1 ring-black/5">
                                {inputPreviewUrl ? (
                                  <div
                                    className={inputPreviewFrameClass}
                                    style={inputAspectStyle}
                                  >
                                    <video
                                      src={inputPreviewUrl}
                                      controls
                                      playsInline
                                      className="h-full w-full object-contain"
                                      style={{ objectFit: "contain" }}
                                      preload="metadata"
                                      onLoadedMetadata={(event) => {
                                        const { videoWidth, videoHeight } =
                                          event.currentTarget;
                                        updateInputPreviewMeta(
                                          videoWidth,
                                          videoHeight
                                        );
                                      }}
                                    />
                                  </div>
                                ) : (
                                  <div className="flex min-h-[290px] items-center justify-center text-xs text-[#898a8b] md:min-h-[420px]">
                                    Preview available after upload
                                  </div>
                                )}
                              </div>
                              <div className="flex w-full min-w-0 flex-col gap-4">
                                <p className="w-0 min-w-full truncate text-base font-semibold text-[#f7f7f8]">
                                  {inputName}
                                </p>
                                <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                                  <div className="space-y-1">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#898a8b]">
                                      Size
                                    </p>
                                    <p className="text-sm font-medium text-[#f7f7f8]">
                                      {inputSizeLabel}
                                    </p>
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#898a8b]">
                                      Width
                                    </p>
                                    <p className="text-sm font-medium text-[#f7f7f8]">
                                      {inputWidthLabel}
                                    </p>
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#898a8b]">
                                      Height
                                    </p>
                                    <p className="text-sm font-medium text-[#f7f7f8]">
                                      {inputHeightLabel}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        {processingError && (
                          <div className="rounded-lg border border-[rgba(231,41,48,0.3)] bg-[rgba(231,41,48,0.1)] p-3 text-sm text-[#e72930]">
                            {processingError}
                          </div>
                        )}
                        <button
                          className="flex w-fit flex-shrink-0 items-center justify-center gap-2 self-end rounded-lg px-4 py-2 text-sm font-medium text-black transition-all duration-200 [background:linear-gradient(180deg,_rgba(255,_255,_255,_0.2),_rgba(255,_255,_255,_0)),_#9aed00] outline outline-1 outline-[#9aed00] outline-offset-[-1px] shadow-[0_6px_16px_rgba(154,_237,_0,_0.25)] hover:opacity-95 hover:shadow-[0_10px_24px_rgba(154,_237,_0,_0.25)] disabled:cursor-not-allowed disabled:text-[#898a8b] disabled:shadow-none disabled:outline-[#2e3031] disabled:[background:#2e3031]"
                          type="button"
                          onClick={handleFindMoments}
                          disabled={!uploadReady || processing}
                        >
                          {processing ? "Working..." : "Find Viral Moments"}
                          <span className="rounded-full border border-black/20 bg-black/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-black/70">
                            Cmd+Enter
                          </span>
                        </button>
                      </div>
                    </div>
                  )}

                  {view === "processingMoments" && (
                    <div className="mx-auto h-full p-5 lg:p-8">
                      <div className="flex h-full flex-col pt-16 sm:items-center sm:justify-center sm:pt-0">
                        <div className="mx-auto max-w-lg text-center">
                          <div className="relative mx-auto mb-6 h-16 w-16 animate-bounce [animation-duration:4s]">
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="h-16 w-16 rounded-full border border-[rgba(255,255,255,0.08)]" />
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <svg
                                aria-hidden="true"
                                viewBox="0 0 24 24"
                                className="h-8 w-8 text-[#9aed00]"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="m21 21-4.34-4.34" />
                                <circle cx="11" cy="11" r="8" />
                              </svg>
                            </div>
                          </div>
                          <h3 className="mb-2 text-lg font-medium text-[#f7f7f8]">
                            Finding Viral Moments
                          </h3>
                          <p className="mb-2 text-sm text-[#898a8b]">
                            {processingLabel}
                          </p>
                          <p className="mb-6 text-sm text-[#898a8b]">
                            AI is analyzing your video to find the best
                            highlights...
                          </p>
                          <div className="mx-auto max-w-md rounded-lg border border-[rgba(255,167,38,0.3)] bg-[rgba(255,167,38,0.1)] shadow-sm">
                            <div className="p-6">
                              <div className="flex gap-3">
                                <svg
                                  aria-hidden="true"
                                  viewBox="0 0 24 24"
                                  className="h-5 w-5 flex-shrink-0 text-[#ffa726]"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <circle cx="12" cy="12" r="10" />
                                  <line x1="12" x2="12" y1="8" y2="12" />
                                  <line x1="12" x2="12.01" y1="16" y2="16" />
                                </svg>
                                <div className="text-left">
                                  <h4 className="text-sm font-medium text-[#ffa726]">
                                    Note
                                  </h4>
                                  <p className="mt-1 text-xs text-[#898a8b]">
                                    This may take up to 1 to 2 minutes. Progress
                                    is saved and you can come back when it is
                                    ready.
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {view === "review" && (
                    <div className="mx-auto h-full p-5 lg:p-8">
                      <div className="flex h-full w-full flex-col gap-4 overflow-hidden">
                        <div className="flex flex-col gap-2">
                          <h1 className="text-2xl font-semibold text-[#f7f7f8]">
                            Review AI Found Clips
                          </h1>
                          <p className="text-sm text-[#898a8b]">
                            We found {totalHighlights} viral moments. Review
                            and approve the clips you want, then remove the
                            rest to continue.
                          </p>
                        </div>
                        <div className="flex flex-col gap-3 overflow-hidden rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] p-3 md:p-4">
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-[#898a8b]">
                                {approvedActiveCount} of {activeHighlightsCount} clips
                                approved
                              </span>
                              <span className={`font-medium ${approvalStatusTone}`}>
                                {approvalStatusLabel}
                              </span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-[#0e1012]">
                              <div
                                className="h-full rounded-full bg-[#9aed00] transition-all duration-300 ease-out"
                                style={{ width: `${approvalProgress}%` }}
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 gap-4 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                            {highlights.length ? (
                              highlights.map((item, index) => {
                                const range = `${formatSeconds(
                                  item.start
                                )} - ${formatSeconds(item.end)}`;
                                const duration = formatDurationSeconds(
                                  item.end - item.start
                                );
                                const title = resolveHighlightTitle(item);
                                const isApproved =
                                  approvedHighlightIndexes.includes(index);
                                const isRemoved =
                                  removedHighlightIndexes.includes(index);
                                const isEdited =
                                  editedHighlightIndexes.includes(index);
                                return (
                                  <div
                                    key={`highlight-${index}`}
                                    className={`group relative min-w-fit rounded-xl border transition-all duration-200 ${isRemoved
                                      ? "border-[rgba(255,255,255,0.05)] bg-[#1a1c1e]/40 opacity-40"
                                      : isApproved
                                        ? "border-[#9aed00] bg-[rgba(154,237,0,0.05)] shadow-[0_8px_24px_rgba(154,_237,_0,_0.15)] ring-1 ring-[rgba(154,237,0,0.3)]"
                                        : "border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] shadow-sm hover:border-[rgba(255,255,255,0.15)] hover:shadow-md"
                                      }`}
                                  >
                                    <div className="flex h-full flex-col gap-3 p-4">
                                      <div className="flex items-start gap-3">
                                        <h3
                                          className="text-sm font-medium leading-5 text-[#f7f7f8]"
                                          title={item.content}
                                        >
                                          {title}
                                        </h3>
                                      </div>
                                      <div className="flex items-center gap-2 text-xs text-[#898a8b]">
                                        <div className="flex items-center gap-1">
                                          <svg
                                            aria-hidden="true"
                                            viewBox="0 0 24 24"
                                            className="h-3 w-3"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          >
                                            <path d="M12 6v6l4 2" />
                                            <circle cx="12" cy="12" r="10" />
                                          </svg>
                                          <span>{duration}</span>
                                        </div>
                                        <span>•</span>
                                        <span>{range}</span>
                                        {isEdited && !isRemoved && (
                                          <>
                                            <span>•</span>
                                            <span className="text-[#9aed00]">
                                              edited
                                            </span>
                                          </>
                                        )}
                                      </div>
                                      <div className="mt-auto flex items-center gap-2">
                                        <button
                                          className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg border border-[#9aed00] bg-[#9aed00] px-3 text-sm font-medium text-black transition-all duration-200 hover:border-[#8ad600] hover:bg-[#8ad600] disabled:cursor-not-allowed disabled:opacity-60"
                                          onClick={() => {
                                            setActiveHighlightIndex(index);
                                            setReviewModalOpen(true);
                                            setAdjustMode(false);
                                          }}
                                          disabled={approvalLoading || isRemoved}
                                        >
                                          {isApproved ? "Edit" : "Review"}
                                          <svg
                                            aria-hidden="true"
                                            viewBox="0 0 24 24"
                                            className="size-[1em]"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          >
                                            <path d="m9 18 6-6-6-6" />
                                          </svg>
                                        </button>
                                        {isRemoved ? (
                                          <button
                                            className="inline-flex h-9 items-center justify-center gap-1 rounded-lg bg-[rgba(76,175,80,0.15)] px-3 text-xs font-medium text-[#4caf50] transition-all duration-200 hover:bg-[#4caf50] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                                            onClick={() => handleRestoreHighlight(index)}
                                            disabled={approvalLoading}
                                            title="Restore clip"
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
                                              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                                              <path d="M3 3v5h5" />
                                            </svg>
                                            Restore
                                          </button>
                                        ) : (
                                          <button
                                            className="inline-flex h-9 items-center justify-center gap-1 rounded-lg bg-[rgba(231,41,48,0.15)] px-3 text-xs font-medium text-[#e72930] transition-all duration-200 hover:bg-[#e72930] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                                            onClick={() =>
                                              handleRemoveHighlight(index)
                                            }
                                            disabled={approvalLoading}
                                            title="Remove clip"
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
                                              <path d="M10 11v6" />
                                              <path d="M14 11v6" />
                                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                                              <path d="M3 6h18" />
                                              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                            </svg>
                                            Remove
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="rounded-xl border border-dashed border-[rgba(255,255,255,0.08)] p-6 text-sm text-[#898a8b]">
                                No highlights yet. Run Find Viral Moments to
                                generate clips.
                              </div>
                            )}
                          </div>
                          {processingError && (
                            <div className="rounded-lg border border-[rgba(231,41,48,0.3)] bg-[rgba(231,41,48,0.1)] p-3 text-sm text-[#e72930]">
                              {processingError}
                            </div>
                          )}
                          {renderError && (
                            <div className="rounded-lg border border-[rgba(231,41,48,0.3)] bg-[rgba(231,41,48,0.1)] p-3 text-sm text-[#e72930]">
                              {renderError}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm text-[#898a8b]">
                              {approvalMessage}
                            </p>
                          </div>
                          <button
                            className="flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium text-black transition-all duration-200 [background:linear-gradient(180deg,_rgba(255,_255,_255,_0.2),_rgba(255,_255,_255,_0)),_#9aed00] outline outline-1 outline-[#9aed00] outline-offset-[-1px] shadow-[0_6px_16px_rgba(154,_237,_0,_0.25)] hover:opacity-95 hover:shadow-[0_10px_24px_rgba(154,_237,_0,_0.25)] disabled:cursor-not-allowed disabled:text-[#898a8b] disabled:shadow-none disabled:outline-[#2e3031] disabled:[background:#2e3031]"
                            disabled={!approvalReady || rendering}
                            onClick={handleRender}
                          >
                            {rendering ? "Rendering..." : "Auto Edit"}
                          </button>
                        </div>

                        {reviewModalOpen && activeHighlight && (
                          <>
                            <div
                              data-state="open"
                              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                              style={{ pointerEvents: "auto" }}
                              aria-hidden="true"
                              onClick={() => setReviewModalOpen(false)}
                            />
                            <div
                              className="pointer-events-none fixed inset-0 z-[60]"
                              aria-hidden="true"
                            />
                            <div
                              role="dialog"
                              aria-labelledby="autoclip-review-title"
                              aria-describedby="autoclip-review-description"
                              data-state="open"
                              className="fixed left-[50%] top-[50%] z-[70] flex w-[92vw] max-w-[95svw] max-h-[85svh] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-hidden rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] px-0 py-4 shadow-lg md:max-w-3xl md:py-6"
                              style={{ pointerEvents: "auto" }}
                            >
                              <div className="flex flex-col items-start justify-between space-y-1.5 border-b border-[rgba(255,255,255,0.08)] px-4 pb-4 md:px-6 md:pb-6">
                                <h2
                                  id="autoclip-review-title"
                                  className="text-left text-xl font-semibold leading-none text-[#f7f7f8]"
                                >
                                  Review Clip
                                </h2>
                                <p
                                  id="autoclip-review-description"
                                  className="text-left text-sm text-[#898a8b]"
                                >
                                  Preview and adjust the clip timing
                                </p>
                              </div>
                              <div className="flex flex-col gap-4 overflow-y-auto px-4 md:px-6">
                                <div className="space-y-4">
                                  <div className="space-y-1">
                                    <h4 className="text-sm font-medium text-[#f7f7f8]">
                                      {highlightTitle}
                                    </h4>
                                    <p className="max-h-24 overflow-y-auto pr-2 text-xs text-[#898a8b]">
                                      {reviewTranscript}
                                    </p>
                                  </div>
                                  <div className="relative flex min-h-[240px] w-full items-center justify-center rounded-xl bg-[#0e1012] sm:min-h-[330px]">
                                    {reviewPreviewUrl ? (
                                      <div
                                        className={reviewPreviewFrameClass}
                                        style={inputAspectStyle}
                                      >
                                        <video
                                          key={reviewPreviewUrl}
                                          src={reviewPreviewUrl}
                                          ref={reviewVideoRef}
                                          className="h-full w-full object-contain"
                                          style={{ objectFit: "contain" }}
                                          preload="metadata"
                                          playsInline
                                          controls
                                          onLoadedMetadata={(event) => {
                                            const { videoWidth, videoHeight } =
                                              event.currentTarget;
                                            updateInputPreviewMeta(
                                              videoWidth,
                                              videoHeight
                                            );
                                          }}
                                        />
                                      </div>
                                    ) : (
                                      <div className="text-xs text-[#898a8b]">
                                        Preview available after upload
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex select-none flex-col gap-3">
                                    <div
                                      ref={timelineRef}
                                      className="relative h-12 bg-[#0e1012] sm:h-14"
                                    >
                                      <div className="absolute inset-0 overflow-hidden rounded-xl bg-[#0e1012]">
                                        <div
                                          className="absolute left-0 top-1/2 h-2 w-full -translate-y-1/2 rounded-full bg-[#252729]"
                                        />
                                        <div
                                          className="absolute top-1/2 z-10 flex h-5 -translate-y-1/2 items-center justify-center rounded-full bg-[rgba(154,237,0,0.3)] shadow-sm"
                                          style={{
                                            left: `${timelineStartPercent}%`,
                                            width: `${timelineWidthPercent}%`,
                                          }}
                                        >
                                          <svg
                                            aria-hidden="true"
                                            viewBox="0 0 24 24"
                                            className="h-4 w-4 text-white"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          >
                                            <circle cx="9" cy="12" r="1" />
                                            <circle cx="9" cy="5" r="1" />
                                            <circle cx="9" cy="19" r="1" />
                                            <circle cx="15" cy="12" r="1" />
                                            <circle cx="15" cy="5" r="1" />
                                            <circle cx="15" cy="19" r="1" />
                                          </svg>
                                        </div>
                                        <div
                                          className="absolute top-0 z-30 h-full w-0.5 -translate-x-1/2 bg-[#9aed00]"
                                          style={{ left: `${timelineStartPercent}%` }}
                                        />
                                        <div
                                          className={`absolute top-0 z-20 flex h-full w-3 -translate-x-full items-center justify-center bg-[#9aed00] transition-colors ${draggingHandle === "end"
                                            ? "bg-[#8ad600]"
                                            : ""
                                            } cursor-ew-resize touch-none`}
                                          style={{ left: `${timelineEndPercent}%` }}
                                          role="button"
                                          aria-label="Trim clip end"
                                          onPointerDown={(event) =>
                                            handleTimelineHandlePointerDown(
                                              event,
                                              "end"
                                            )
                                          }
                                        >
                                          <svg
                                            aria-hidden="true"
                                            viewBox="0 0 24 24"
                                            className="h-3 w-3 text-black"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          >
                                            <path d="m9 18 6-6-6-6" />
                                          </svg>
                                        </div>
                                        <div
                                          className={`absolute top-0 z-20 flex h-full w-3 items-center justify-center bg-[#9aed00] transition-colors ${draggingHandle === "start"
                                            ? "bg-[#8ad600]"
                                            : ""
                                            } cursor-ew-resize touch-none`}
                                          style={{ left: `${timelineStartPercent}%` }}
                                          role="button"
                                          aria-label="Trim clip start"
                                          onPointerDown={(event) =>
                                            handleTimelineHandlePointerDown(
                                              event,
                                              "start"
                                            )
                                          }
                                        >
                                          <svg
                                            aria-hidden="true"
                                            viewBox="0 0 24 24"
                                            className="h-3 w-3 text-black"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          >
                                            <path d="m15 18-6-6 6-6" />
                                          </svg>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">
                                      <div className="flex w-full items-center justify-between sm:w-auto sm:justify-start">
                                        <span className="font-mono text-[#898a8b]">
                                          0:00
                                        </span>
                                        <span className="font-mono text-[#898a8b] sm:hidden">
                                          {formatSeconds(timelineDuration)}
                                        </span>
                                      </div>
                                      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                                        <span className="font-mono font-medium text-[#f7f7f8]">
                                          {formatSeconds(resolvedDraftStart)}
                                        </span>
                                        <span className="text-[#898a8b]">•</span>
                                        <div className="inline-flex items-center rounded-full bg-[#252729] px-2 py-0.5 text-xs font-semibold text-[#9aed00]">
                                          {formatDurationSeconds(
                                            resolvedDraftEnd - resolvedDraftStart
                                          )}
                                        </div>
                                        <span className="text-[#898a8b]">•</span>
                                        <span className="font-mono font-medium text-[#f7f7f8]">
                                          {formatSeconds(resolvedDraftEnd)}
                                        </span>
                                      </div>
                                      <span className="hidden font-mono text-[#898a8b] sm:block">
                                        {formatSeconds(timelineDuration)}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <div className="flex flex-row items-stretch gap-2 sm:items-center sm:gap-3">
                                      <button
                                        className="inline-flex h-10 w-full items-center justify-center rounded-md border border-[rgba(255,255,255,0.08)] bg-[#0e1012] px-4 py-2 text-sm font-medium text-[#f7f7f8] hover:bg-[#252729] sm:h-9 sm:w-32"
                                        type="button"
                                        onClick={handlePlayReview}
                                      >
                                        <svg
                                          aria-hidden="true"
                                          viewBox="0 0 24 24"
                                          className="mr-2 h-4 w-4"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        >
                                          <path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z" />
                                        </svg>
                                        Play
                                      </button>
                                      <button
                                        className="inline-flex h-10 items-center justify-center rounded-md border border-[rgba(255,255,255,0.08)] bg-[#0e1012] px-4 py-2 text-sm font-medium text-[#f7f7f8] hover:bg-[#252729] sm:h-9"
                                        type="button"
                                        onClick={handlePlayFromStart}
                                      >
                                        <svg
                                          aria-hidden="true"
                                          viewBox="0 0 24 24"
                                          className="mr-2 h-4 w-4"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        >
                                          <path d="M17.971 4.285A2 2 0 0 1 21 6v12a2 2 0 0 1-3.029 1.715l-9.997-5.998a2 2 0 0 1-.003-3.432z" />
                                          <path d="M3 20V4" />
                                        </svg>
                                        <span className="hidden sm:inline">
                                          Play from start of clip
                                        </span>
                                        <span className="sm:hidden">From start</span>
                                      </button>
                                    </div>
                                    <p className="hidden text-center text-xs text-[#898a8b] sm:block sm:text-left">
                                      Tip: Preview plays only the selected clip
                                    </p>
                                  </div>
                                </div>
                                <button
                                  className="inline-flex w-full items-center justify-center rounded-md border border-[rgba(255,255,255,0.08)] bg-[#0e1012] px-4 py-2 text-sm font-medium text-[#f7f7f8] hover:bg-[#252729]"
                                  type="button"
                                  onClick={() => setAdjustMode((prev) => !prev)}
                                >
                                  <svg
                                    aria-hidden="true"
                                    viewBox="0 0 24 24"
                                    className="mr-2 h-4 w-4"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
                                  </svg>
                                  {adjustMode ? "Hide Boundaries" : "Adjust Boundaries"}
                                </button>
                                {adjustMode && (
                                  <div className="space-y-4">
                                    <div className="space-y-3">
                                      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
                                        <span className="w-full text-sm font-medium text-[#f7f7f8] sm:w-20">
                                          Start
                                        </span>
                                        <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                                          <button
                                            className="rounded-md border border-[rgba(255,255,255,0.08)] px-2 py-1 text-sm text-[#f7f7f8] hover:bg-[#252729]"
                                            type="button"
                                            onClick={() => nudgeDraftStart(-5)}
                                          >
                                            -5s
                                          </button>
                                          <button
                                            className="rounded-md border border-[rgba(255,255,255,0.08)] px-2 py-1 text-sm text-[#f7f7f8] hover:bg-[#252729]"
                                            type="button"
                                            onClick={() => nudgeDraftStart(-1)}
                                          >
                                            -1s
                                          </button>
                                          <div className="rounded-md bg-[#0e1012] px-3 py-1 font-mono text-sm text-[#9aed00]">
                                            {formatSeconds(resolvedDraftStart)}
                                          </div>
                                          <button
                                            className="rounded-md border border-[rgba(255,255,255,0.08)] px-2 py-1 text-sm text-[#f7f7f8] hover:bg-[#252729]"
                                            type="button"
                                            onClick={() => nudgeDraftStart(1)}
                                          >
                                            +1s
                                          </button>
                                          <button
                                            className="rounded-md border border-[rgba(255,255,255,0.08)] px-2 py-1 text-sm text-[#f7f7f8] hover:bg-[#252729]"
                                            type="button"
                                            onClick={() => nudgeDraftStart(5)}
                                          >
                                            +5s
                                          </button>
                                        </div>
                                      </div>
                                      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
                                        <span className="w-full text-sm font-medium text-[#f7f7f8] sm:w-20">
                                          End
                                        </span>
                                        <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                                          <button
                                            className="rounded-md border border-[rgba(255,255,255,0.08)] px-2 py-1 text-sm text-[#f7f7f8] hover:bg-[#252729]"
                                            type="button"
                                            onClick={() => nudgeDraftEnd(-5)}
                                          >
                                            -5s
                                          </button>
                                          <button
                                            className="rounded-md border border-[rgba(255,255,255,0.08)] px-2 py-1 text-sm text-[#f7f7f8] hover:bg-[#252729]"
                                            type="button"
                                            onClick={() => nudgeDraftEnd(-1)}
                                          >
                                            -1s
                                          </button>
                                          <div className="rounded-md bg-[#0e1012] px-3 py-1 font-mono text-sm text-[#9aed00]">
                                            {formatSeconds(resolvedDraftEnd)}
                                          </div>
                                          <button
                                            className="rounded-md border border-[rgba(255,255,255,0.08)] px-2 py-1 text-sm text-[#f7f7f8] hover:bg-[#252729]"
                                            type="button"
                                            onClick={() => nudgeDraftEnd(1)}
                                          >
                                            +1s
                                          </button>
                                          <button
                                            className="rounded-md border border-[rgba(255,255,255,0.08)] px-2 py-1 text-sm text-[#f7f7f8] hover:bg-[#252729]"
                                            type="button"
                                            onClick={() => nudgeDraftEnd(5)}
                                          >
                                            +5s
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                    <button
                                      className="inline-flex w-full items-center justify-center rounded-md border border-[rgba(255,255,255,0.08)] bg-[#0e1012] px-3 py-2 text-sm font-medium text-[#f7f7f8] hover:bg-[#252729]"
                                      type="button"
                                      onClick={resetDraftRange}
                                      disabled={highlightUpdating}
                                    >
                                      <svg
                                        aria-hidden="true"
                                        viewBox="0 0 24 24"
                                        className="mr-2 h-3 w-3"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      >
                                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                                        <path d="M3 3v5h5" />
                                      </svg>
                                      Reset to Original
                                    </button>
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-col gap-2 px-4 md:px-6 sm:flex-row sm:justify-end">
                                <button
                                  className="inline-flex h-10 w-full items-center justify-center rounded-md border border-[rgba(255,255,255,0.08)] bg-[#0e1012] px-4 py-2 text-sm font-medium text-[#f7f7f8] hover:bg-[#252729]"
                                  type="button"
                                  onClick={() => setReviewModalOpen(false)}
                                >
                                  Cancel
                                </button>
                                <button
                                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-[rgba(231,41,48,0.3)] bg-[rgba(231,41,48,0.1)] px-4 py-2 text-sm font-medium text-[#e72930] transition-all hover:bg-[rgba(231,41,48,0.2)] disabled:cursor-not-allowed disabled:opacity-60"
                                  type="button"
                                  onClick={() => {
                                    if (activeHighlightIndex == null) {
                                      return;
                                    }
                                    handleRemoveHighlight(activeHighlightIndex);
                                    setReviewModalOpen(false);
                                  }}
                                  disabled={approvalLoading || highlightUpdating}
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
                                    <path d="M10 11v6" />
                                    <path d="M14 11v6" />
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                                    <path d="M3 6h18" />
                                    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                  </svg>
                                  Remove Clip
                                </button>
                                <button
                                  className="flex h-10 w-full items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-black transition-all duration-200 [background:linear-gradient(180deg,_rgba(255,_255,_255,_0.2)_0%,_rgba(255,_255,_255,_0)_100%),_#9aed00] shadow-[0_6px_16px_rgba(154,_237,_0,_0.2)] hover:opacity-95 hover:shadow-[0_10px_24px_rgba(154,_237,_0,_0.2)] disabled:cursor-not-allowed disabled:text-[#898a8b] disabled:shadow-none disabled:[background:#2e3031]"
                                  type="button"
                                  onClick={handleApproveWithDraft}
                                  disabled={approveButtonDisabled}
                                >
                                  {approveButtonLabel}
                                </button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {view === "processingMagic" && (
                    <div className="mx-auto h-full p-5 lg:p-8">
                      <div className="flex h-full flex-col pt-16 sm:items-center sm:justify-center sm:pt-0">
                        <div className="mx-auto max-w-lg text-center">
                          <div className="relative mx-auto mb-6 h-16 w-16 animate-bounce [animation-duration:4s]">
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="h-16 w-16 rounded-full border border-[rgba(255,255,255,0.08)]" />
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <svg
                                aria-hidden="true"
                                viewBox="0 0 24 24"
                                className="h-8 w-8 text-[#9aed00]"
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
                          </div>
                          <h3 className="mb-2 text-lg font-medium text-[#f7f7f8]">
                            Processing Magic Crop
                          </h3>
                          <p className="mb-6 text-sm text-[#898a8b]">
                            Optimizing your clips as vertical content with auto
                            editing...
                          </p>
                          <div className="mx-auto max-w-md rounded-lg border border-[rgba(255,167,38,0.3)] bg-[rgba(255,167,38,0.1)] shadow-sm">
                            <div className="p-4 md:p-6">
                              <div className="flex gap-3">
                                <svg
                                  aria-hidden="true"
                                  viewBox="0 0 24 24"
                                  className="h-5 w-5 flex-shrink-0 text-[#ffa726]"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <circle cx="12" cy="12" r="10" />
                                  <line x1="12" x2="12" y1="8" y2="12" />
                                  <line x1="12" x2="12.01" y1="16" y2="16" />
                                </svg>
                                <div className="text-left">
                                  <h4 className="text-sm font-medium text-[#ffa726]">
                                    Note
                                  </h4>
                                  <p className="mt-1 text-xs text-[#898a8b]">
                                    This sometimes takes up to 5 to 10 minutes.
                                    Progress is saved and you can come back when
                                    it is ready.
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {view === "final" && (
                    <div className="mx-auto h-full p-5 lg:p-8">
                      <div className="flex h-full w-full flex-col gap-4 overflow-hidden">
                        <div className="flex flex-col gap-2">
                          <h1 className="text-2xl font-semibold text-[#f7f7f8]">
                            Review Your Clips
                          </h1>
                          <p className="text-sm text-[#898a8b]">
                            Download your ready clips or open them in the
                            editor to add subtitles.
                          </p>
                        </div>
                        <div className="grid gap-4 overflow-y-auto rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] p-3 sm:grid-cols-2 md:p-4 lg:grid-cols-3">
                          {finalClips.length ? (
                            finalClips.map((clip) => {
                              const isSelected = selectedClipIds.includes(clip.id);
                              const isSaved = savedClipIds.includes(clip.outputIndex);
                              const isSaving = savingClipIds.includes(clip.outputIndex);
                              return (
                                <div
                                  key={`output-${clip.id}`}
                                  className={`group relative flex flex-col overflow-hidden rounded-xl border bg-[#0e1012] transition-all duration-200 ${isSelected
                                    ? "border-[#9aed00] ring-1 ring-[rgba(154,237,0,0.3)] shadow-[0_8px_20px_rgba(154,_237,_0,_0.15)]"
                                    : "border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.15)] hover:shadow-md"
                                    }`}
                                >
                                  <div className="relative flex h-[320px] w-full items-center justify-center overflow-hidden bg-black transition-all duration-200 md:h-[360px]">
                                    {clip.previewUrl ? (
                                      <div
                                        className={resolveOutputFrameClass(clip.id)}
                                        style={resolveOutputAspectStyle(clip.id)}
                                      >
                                        <video
                                          src={clip.previewUrl}
                                          controls
                                          className="h-full w-full object-contain"
                                          style={{ objectFit: "contain" }}
                                          preload="metadata"
                                          playsInline
                                          onLoadedMetadata={(event) => {
                                            const { videoWidth, videoHeight } =
                                              event.currentTarget;
                                            registerOutputAspectRatio(
                                              clip.id,
                                              videoWidth,
                                              videoHeight
                                            );
                                          }}
                                        />
                                      </div>
                                    ) : (
                                      <div className="flex h-full items-center justify-center text-xs text-[#898a8b]">
                                        Preview ready after render
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex flex-1 flex-col gap-3 p-3">
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <h3 className="text-base font-medium text-[#f7f7f8]">
                                          {clip.title}
                                        </h3>
                                        <p className="mt-1 flex items-center gap-2 text-xs text-[#898a8b]">
                                          <span className="font-mono">
                                            {clip.range}
                                          </span>
                                          <span className="text-[10px] uppercase tracking-wider opacity-60">
                                            Clip {clip.id + 1}
                                          </span>
                                        </p>
                                      </div>
                                      <button
                                        className={`inline-flex items-center justify-center whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition-all disabled:cursor-not-allowed disabled:opacity-60 ${isSaved
                                          ? "border-[rgba(76,175,80,0.3)] bg-[rgba(76,175,80,0.15)] text-[#4caf50]"
                                          : "border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] text-[#898a8b] hover:border-[rgba(106,71,255,0.3)] hover:text-[#8270ff]"
                                          }`}
                                        type="button"
                                        onClick={() =>
                                          handleSaveToProjectLibrary(
                                            clip.outputIndex,
                                            clip.title
                                          )
                                        }
                                        disabled={!clip.downloadUrl || isSaved || isSaving}
                                        title={
                                          isSaved
                                            ? "Saved to Project Library"
                                            : "Save to Project Library"
                                        }
                                      >
                                        {isSaved
                                          ? "Saved"
                                          : isSaving
                                            ? "Saving"
                                            : "Save"}
                                      </button>
                                    </div>
                                    <div className="mt-auto flex flex-col gap-2">
                                      <button
                                        className={`inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${isSelected
                                          ? "border border-[#9aed00] bg-[#9aed00] text-black hover:bg-[#8ad600]"
                                          : "border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] text-[#f7f7f8] hover:bg-[#252729]"
                                          }`}
                                        type="button"
                                        onClick={() => handleSelectClip(clip.id)}
                                      >
                                        {isSelected ? (
                                          <>
                                            <svg
                                              aria-hidden="true"
                                              viewBox="0 0 24 24"
                                              className="mr-2 h-3.5 w-3.5"
                                              fill="none"
                                              stroke="currentColor"
                                              strokeWidth="2"
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                            >
                                              <path d="M20 6 9 17l-5-5" />
                                            </svg>
                                            Selected
                                          </>
                                        ) : (
                                          "Select clip"
                                        )}
                                      </button>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <button
                                          className="inline-flex items-center justify-center rounded-md border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] px-2.5 py-1.5 text-[11px] font-medium text-[#f7f7f8] transition-all hover:bg-[#252729] disabled:cursor-not-allowed disabled:opacity-60"
                                          type="button"
                                          onClick={() => handleDownload(clip.outputIndex)}
                                          disabled={!clip.downloadUrl}
                                        >
                                          <svg
                                            aria-hidden="true"
                                            viewBox="0 0 24 24"
                                            className="mr-1 h-3 w-3"
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
                                          Download
                                        </button>
                                        <button
                                          className="inline-flex items-center justify-center rounded-md border border-[rgba(154,237,0,0.3)] bg-[rgba(154,237,0,0.1)] px-2.5 py-1.5 text-[11px] font-medium text-[#9aed00] transition-all hover:bg-[rgba(154,237,0,0.2)] disabled:cursor-not-allowed disabled:opacity-60"
                                          type="button"
                                          onClick={() =>
                                            handleOpenInEditor(clip.outputIndex)
                                          }
                                          disabled={!clip.downloadUrl}
                                        >
                                          <svg
                                            aria-hidden="true"
                                            viewBox="0 0 24 24"
                                            className="mr-1 h-3 w-3"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          >
                                            <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
                                          </svg>
                                          Open in Editor
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div className="rounded-xl border border-dashed border-[rgba(255,255,255,0.08)] p-6 text-sm text-[#898a8b]">
                              Render a clip to see it here.
                            </div>
                          )}
                        </div>
                        {(selectedClipIds.length > 0 || projectSaveError) && (
                          <div className="flex flex-col gap-3 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] p-3 sm:flex-row sm:items-center sm:justify-between md:p-4">
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-[#f7f7f8]">
                                {selectedClipIds.length}/{finalClips.length} clips
                                selected
                              </p>
                              <p className="text-xs text-[#898a8b]">
                                Bulk actions apply to selected clips.
                              </p>
                              {projectSaveError ? (
                                <p className="text-xs text-[#e72930]">
                                  {projectSaveError}
                                </p>
                              ) : null}
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row">
                              <button
                                className="flex w-full items-center justify-center rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0e1012] px-4 py-2.5 text-sm font-medium text-[#f7f7f8] transition-all hover:bg-[#252729] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                                type="button"
                                onClick={handleDownloadSelected}
                                disabled={
                                  finalClips.length === 0 ||
                                  selectedClipIds.length === 0
                                }
                              >
                                Download Selected
                              </button>
                              <button
                                className="flex w-full items-center justify-center rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0e1012] px-4 py-2.5 text-sm font-medium text-[#f7f7f8] transition-all hover:bg-[#252729] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                                type="button"
                                onClick={handleSaveSelectedToLibrary}
                                disabled={
                                  finalClips.length === 0 ||
                                  selectedClipIds.length === 0
                                }
                              >
                                Save Selected
                              </button>
                              <button
                                className="flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium text-black transition-all duration-200 [background:linear-gradient(180deg,_rgba(255,_255,_255,_0.2)_0%,_rgba(255,_255,_255,_0)_100%),_#9aed00] shadow-[0_6px_16px_rgba(154,_237,_0,_0.2)] hover:opacity-95 hover:shadow-[0_10px_24px_rgba(154,_237,_0,_0.2)] disabled:cursor-not-allowed disabled:text-[#898a8b] disabled:shadow-none disabled:[background:#2e3031] sm:w-auto"
                                type="button"
                                onClick={handleOpenSelectedInEditor}
                                disabled={
                                  finalClips.length === 0 ||
                                  selectedClipIds.length === 0
                                }
                              >
                                Open in Editor
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      <SearchOverlay open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
