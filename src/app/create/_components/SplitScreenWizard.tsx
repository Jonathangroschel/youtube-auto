"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  uploadAssetFile,
  type AssetLibraryItem,
} from "@/lib/assets/library";
import { captureVideoPoster } from "@/lib/media/video-poster";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  type SplitScreenImportPayloadV1,
  type SplitScreenLayout,
} from "@/lib/editor/imports";
import { subtitleStylePresets } from "@/app/editor/advanced/data";
import { useSubtitleStyleFontPreload } from "./use-subtitle-style-font-preload";

type WizardStep = 1 | 2 | 3;

type SelectedVideo = {
  url: string;
  name: string;
  assetId?: string | null;
  durationSeconds?: number;
};

type GameplayItem = {
  name: string;
  path: string;
  publicUrl: string;
  thumbnailUrl?: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

const isYouTubeUrl = (value: string) => {
  const lower = value.toLowerCase();
  return lower.includes("youtube.com/") || lower.includes("youtu.be/");
};

const isTikTokUrl = (value: string) => value.toLowerCase().includes("tiktok.com/");

const GAMEPLAY_BUCKET = "gameplay-footage";
const GAMEPLAY_THUMBNAIL_PREFIX = "thumbnails";
const GAMEPLAY_LIST_LIMIT = 120;
const GAMEPLAY_FETCH_TIMEOUT_MS = 15000;
const GAMEPLAY_POSTER_CONCURRENCY = 8;
const GAMEPLAY_INITIAL_FETCH_LIMIT = 4;
const GAMEPLAY_INITIAL_VISIBLE_COUNT = 4;
const GAMEPLAY_VISIBLE_BATCH_SIZE = 8;
const GAMEPLAY_LOAD_MORE_ROOT_MARGIN = "300px 0px";

const toGameplayThumbnailPath = (videoPath: string) =>
  `${GAMEPLAY_THUMBNAIL_PREFIX}/${videoPath.replace(/^\/+/, "").replace(/\.[^/.]+$/, ".jpg")}`;

const SubtitleModeToggle = ({
  value,
  onChange,
}: {
  value: "one-word" | "lines";
  onChange: (next: "one-word" | "lines") => void;
}) => {
  return (
    <div className="flex items-center gap-3">
      <span className={cn("text-sm font-medium", value === "one-word" ? "text-[#f7f7f8]" : "text-[#898a8b]")}>
        One Word
      </span>
      <button
        type="button"
        aria-label="Toggle subtitle mode"
        className={cn(
          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
          value === "lines" ? "bg-[#9aed00]" : "bg-[rgba(255,255,255,0.08)]"
        )}
        onClick={() => onChange(value === "lines" ? "one-word" : "lines")}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
            value === "lines" ? "translate-x-6" : "translate-x-1"
          )}
        />
      </button>
      <span className={cn("text-sm font-medium", value === "lines" ? "text-[#f7f7f8]" : "text-[#898a8b]")}>
        Lines
      </span>
    </div>
  );
};

export default function SplitScreenWizard({
  layout,
  title,
}: {
  layout: SplitScreenLayout;
  title: string;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const gameplayUploadInputRef = useRef<HTMLInputElement | null>(null);
  const gameplaySupabase = useMemo(() => createClient(), []);
  const [step, setStep] = useState<WizardStep>(1);

  const [inputMode, setInputMode] = useState<"upload" | "link">("upload");
  const [sourceVideo, setSourceVideo] = useState<SelectedVideo | null>(null);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [sourceBusy, setSourceBusy] = useState(false);
  const [sourceLink, setSourceLink] = useState("");
  const [generateBusy, setGenerateBusy] = useState(false);

  const [gameplayLoading, setGameplayLoading] = useState(false);
  const [gameplayLoadingMore, setGameplayLoadingMore] = useState(false);
  const [gameplayError, setGameplayError] = useState<string | null>(null);
  const [gameplayUploadError, setGameplayUploadError] = useState<string | null>(
    null
  );
  const [gameplayUploading, setGameplayUploading] = useState(false);
  const [gameplayItems, setGameplayItems] = useState<GameplayItem[]>([]);
  const [gameplaySelected, setGameplaySelected] = useState<GameplayItem | null>(
    null
  );
  const [gameplayPosterByPath, setGameplayPosterByPath] = useState<
    Record<string, string>
  >({});
  const [activeGameplayPreviewPath, setActiveGameplayPreviewPath] = useState<
    string | null
  >(null);
  const [gameplayVisibleCount, setGameplayVisibleCount] = useState(
    GAMEPLAY_INITIAL_VISIBLE_COUNT
  );
  const gameplayPrefetchStartedRef = useRef(false);
  const gameplayThumbnailUploadAttemptedRef = useRef<Set<string>>(new Set());
  const gameplayLoadMoreRef = useRef<HTMLDivElement | null>(null);

  const [subtitleMode, setSubtitleMode] = useState<"one-word" | "lines">(
    "lines"
  );
  const defaultLinesStyleId =
    subtitleStylePresets.find(
      (preset) => !Boolean((preset as any)?.settings?.wordHighlightEnabled)
    )?.id ??
    subtitleStylePresets[0]?.id ??
    null;
  const [subtitleStyleId, setSubtitleStyleId] = useState<string | null>(
    defaultLinesStyleId
  );
  const [autoGenerateSubtitles, setAutoGenerateSubtitles] = useState(true);

  const subtitleStyleOptions = useMemo(() => {
    if (subtitleMode === "one-word") {
      return subtitleStylePresets.filter(
        (preset) => Boolean((preset as any)?.settings?.wordHighlightEnabled)
      );
    }
    return subtitleStylePresets.filter(
      (preset) => !Boolean((preset as any)?.settings?.wordHighlightEnabled)
    );
  }, [subtitleMode]);
  const subtitleStyleFontFamilies = useMemo(
    () =>
      subtitleStylePresets.map((preset) => preset.preview?.fontFamily ?? null),
    []
  );
  useSubtitleStyleFontPreload(subtitleStyleFontFamilies);

  useEffect(() => {
    if (subtitleStyleOptions.length === 0) {
      setSubtitleStyleId(null);
      return;
    }
    if (!subtitleStyleId) {
      setSubtitleStyleId(subtitleStyleOptions[0]?.id ?? null);
      return;
    }
    if (!subtitleStyleOptions.some((preset) => preset.id === subtitleStyleId)) {
      setSubtitleStyleId(subtitleStyleOptions[0]?.id ?? null);
    }
  }, [subtitleStyleId, subtitleStyleOptions]);

  const canContinueToBackground = Boolean(sourceVideo);
  const gameplayVisibleItems = useMemo(
    () => gameplayItems.slice(0, gameplayVisibleCount),
    [gameplayItems, gameplayVisibleCount]
  );
  const gameplayPreviewPendingCount = useMemo(
    () =>
      gameplayVisibleItems.filter((item) => {
        const providedThumbnail =
          typeof item.thumbnailUrl === "string" ? item.thumbnailUrl.trim() : "";
        return !gameplayPosterByPath[item.path] && !providedThumbnail;
      }).length,
    [gameplayPosterByPath, gameplayVisibleItems]
  );
  const hasMoreGameplayToReveal = gameplayVisibleCount < gameplayItems.length;
  const canContinueToSubtitles = Boolean(sourceVideo && gameplaySelected);
  const canGenerate = Boolean(sourceVideo && gameplaySelected && subtitleStyleId);

  const triggerUploadPicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleUploadedAsset = useCallback((asset: AssetLibraryItem | null) => {
    if (!asset) {
      setSourceError("Upload failed. Please try again.");
      return;
    }
    setSourceVideo({
      assetId: asset.id,
      url: asset.url,
      name: asset.name,
      durationSeconds:
        typeof asset.duration === "number" && Number.isFinite(asset.duration)
          ? asset.duration
          : undefined,
    });
    setSourceError(null);
  }, []);

  const handleUploadFile = useCallback(
    async (file: File) => {
      setSourceBusy(true);
      setSourceError(null);
      try {
        const asset = await uploadAssetFile(file, {
          name: file.name || "Uploaded video",
          source: "upload",
        });
        handleUploadedAsset(asset);
      } catch (error) {
        setSourceError(
          error instanceof Error ? error.message : "Upload failed."
        );
      } finally {
        setSourceBusy(false);
      }
    },
    [handleUploadedAsset]
  );

  const handleFileInputChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) {
        return;
      }
      await handleUploadFile(file);
    },
    [handleUploadFile]
  );

  const handleDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const file = event.dataTransfer.files?.[0];
      if (!file) {
        return;
      }
      await handleUploadFile(file);
    },
    [handleUploadFile]
  );

  const triggerGameplayUploadPicker = useCallback(() => {
    gameplayUploadInputRef.current?.click();
  }, []);

  const uploadGeneratedGameplayThumbnail = useCallback(
    async (item: GameplayItem, dataUrl: string) => {
      const thumbnailPath = toGameplayThumbnailPath(item.path);
      if (gameplayThumbnailUploadAttemptedRef.current.has(thumbnailPath)) {
        return;
      }
      gameplayThumbnailUploadAttemptedRef.current.add(thumbnailPath);
      try {
        const dataUrlResponse = await fetch(dataUrl);
        const blob = await dataUrlResponse.blob();
        if (!blob.size) {
          return;
        }
        await gameplaySupabase.storage.from(GAMEPLAY_BUCKET).upload(thumbnailPath, blob, {
          contentType: "image/jpeg",
          cacheControl: "31536000",
          upsert: true,
        });
      } catch {
        // Best-effort cache write.
      }
    },
    [gameplaySupabase]
  );

  const handleGameplayUpload = useCallback(
    async (file: File) => {
      const lowerName = file.name.toLowerCase();
      const looksLikeVideo =
        file.type.startsWith("video/") ||
        lowerName.endsWith(".mp4") ||
        lowerName.endsWith(".mov") ||
        lowerName.endsWith(".m4v") ||
        lowerName.endsWith(".webm");

      if (!looksLikeVideo) {
        setGameplayUploadError("Please upload an MP4, MOV, M4V, or WEBM file.");
        return;
      }

      const contentType = file.type.startsWith("video/") ? file.type : "video/mp4";
      setGameplayUploading(true);
      setGameplayUploadError(null);
      setGameplayError(null);
      try {
        const uploadUrlResponse = await fetch("/api/gameplay-footage/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            contentType,
          }),
        });
        const uploadUrlData = await uploadUrlResponse.json().catch(() => ({}));
        if (!uploadUrlResponse.ok) {
          throw new Error(uploadUrlData?.error || "Failed to initialize upload.");
        }

        const storagePath =
          typeof uploadUrlData?.path === "string" ? uploadUrlData.path.trim() : "";
        const uploadToken =
          typeof uploadUrlData?.token === "string" ? uploadUrlData.token.trim() : "";
        if (!storagePath || !uploadToken) {
          throw new Error("Upload token missing. Please try again.");
        }

        const { error: uploadError } = await gameplaySupabase.storage
          .from("gameplay-footage")
          .uploadToSignedUrl(storagePath, uploadToken, file, {
            contentType,
            upsert: false,
          });
        if (uploadError) {
          throw new Error(uploadError.message || "Failed to upload gameplay video.");
        }

        const signResponse = await fetch(
          `/api/gameplay-footage/sign?path=${encodeURIComponent(storagePath)}`,
          { method: "GET" }
        );
        const signData = await signResponse.json().catch(() => ({}));
        if (!signResponse.ok) {
          throw new Error(signData?.error || "Upload succeeded but preview URL failed.");
        }

        const signedUrl =
          typeof signData?.url === "string"
            ? signData.url
            : typeof signData?.signedUrl === "string"
              ? signData.signedUrl
              : "";
        if (!signedUrl) {
          throw new Error("Upload succeeded but preview URL is missing.");
        }

        const uploadedItem: GameplayItem = {
          name: file.name.trim() || "Uploaded gameplay footage",
          path: storagePath,
          publicUrl: signedUrl,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        setGameplayItems((prev) => [
          uploadedItem,
          ...prev.filter((item) => item.path !== uploadedItem.path),
        ]);
        setGameplaySelected(uploadedItem);
      } catch (error) {
        setGameplayUploadError(
          error instanceof Error ? error.message : "Failed to upload gameplay footage."
        );
      } finally {
        setGameplayUploading(false);
      }
    },
    [gameplaySupabase]
  );

  const handleGameplayUploadInputChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) {
        return;
      }
      await handleGameplayUpload(file);
    },
    [handleGameplayUpload]
  );

  const handleDownloadFromLink = useCallback(async () => {
    const url = sourceLink.trim();
    if (!url) {
      setSourceError("Paste a YouTube or TikTok link.");
      return;
    }
    const provider = isTikTokUrl(url) ? "tiktok" : isYouTubeUrl(url) ? "youtube" : null;
    if (!provider) {
      setSourceError("That link doesn’t look like YouTube or TikTok.");
      return;
    }
    setSourceBusy(true);
    setSourceError(null);
    try {
      const endpoint =
        provider === "youtube" ? "/api/youtube-download" : "/api/tiktok-download";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Download failed.");
      }
      const assetUrl =
        typeof data?.assetUrl === "string" ? data.assetUrl.trim() : "";
      const assetId =
        typeof data?.assetId === "string" ? data.assetId.trim() : "";
      const name =
        typeof data?.title === "string" && data.title.trim().length > 0
          ? data.title.trim()
          : "Downloaded video";
      const durationSeconds =
        typeof data?.duration === "number" && Number.isFinite(data.duration)
          ? data.duration
          : typeof data?.durationSeconds === "number" &&
              Number.isFinite(data.durationSeconds)
            ? data.durationSeconds
            : undefined;
      if (!assetUrl || !assetId) {
        throw new Error(
          "Download completed but saving to your library failed. Please try again."
        );
      }
      setSourceVideo({
        url: assetUrl,
        assetId,
        name,
        durationSeconds,
      });
      setSourceError(null);
    } catch (error) {
      setSourceError(error instanceof Error ? error.message : "Download failed.");
    } finally {
      setSourceBusy(false);
    }
  }, [sourceLink]);

  const loadGameplay = useCallback(async () => {
    const fetchGameplayItems = async (limit: number, signal?: AbortSignal) => {
      const response = await fetch(
        `/api/gameplay-footage/list?limit=${Math.max(1, Math.floor(limit))}`,
        {
          method: "GET",
          cache: "no-store",
          signal,
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Failed to load gameplay footage.");
      }
      return Array.isArray(data?.items) ? (data.items as GameplayItem[]) : [];
    };

    setGameplayLoading(true);
    setGameplayLoadingMore(false);
    setGameplayError(null);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, GAMEPLAY_FETCH_TIMEOUT_MS);

    try {
      const initialLimit = Math.min(
        GAMEPLAY_LIST_LIMIT,
        GAMEPLAY_INITIAL_FETCH_LIMIT
      );
      const initialItems = await fetchGameplayItems(initialLimit, controller.signal);
      setGameplayItems(initialItems);
      setGameplayVisibleCount(GAMEPLAY_INITIAL_VISIBLE_COUNT);

      if (GAMEPLAY_LIST_LIMIT <= initialLimit) {
        return;
      }

      setGameplayLoading(false);
      setGameplayLoadingMore(true);
      try {
        const fullItems = await fetchGameplayItems(GAMEPLAY_LIST_LIMIT);
        setGameplayItems(fullItems);
      } catch (error) {
        console.warn(
          "[split-screen][wizard] Failed to load full gameplay list",
          error
        );
      } finally {
        setGameplayLoadingMore(false);
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setGameplayError(
          "Loading gameplay footage timed out. Try Refresh or upload your own footage."
        );
        return;
      }
      setGameplayError(
        error instanceof Error ? error.message : "Failed to load gameplay footage."
      );
    } finally {
      window.clearTimeout(timeoutId);
      setGameplayLoading(false);
    }
  }, []);

  useEffect(() => {
    const activePaths = new Set(gameplayItems.map((item) => item.path));

    setGameplayPosterByPath((prev) => {
      const nextEntries = Object.entries(prev).filter(([path]) =>
        activePaths.has(path)
      );
      if (nextEntries.length === Object.keys(prev).length) {
        return prev;
      }
      return Object.fromEntries(nextEntries);
    });

    if (activeGameplayPreviewPath && !activePaths.has(activeGameplayPreviewPath)) {
      setActiveGameplayPreviewPath(null);
    }

    const posterQueueItems = gameplayItems.slice(0, gameplayVisibleCount);
    const missingPosters = posterQueueItems.filter((item) => {
      const providedThumbnail =
        typeof item.thumbnailUrl === "string" ? item.thumbnailUrl.trim() : "";
      return !gameplayPosterByPath[item.path] && !providedThumbnail;
    });
    if (missingPosters.length === 0) {
      return;
    }

    let cancelled = false;

    const buildPosters = async () => {
      const updates: Record<string, string> = {};
      let cursor = 0;
      const workerCount = Math.max(
        1,
        Math.min(GAMEPLAY_POSTER_CONCURRENCY, missingPosters.length)
      );

      await Promise.all(
        Array.from({ length: workerCount }, async () => {
          while (true) {
            if (cancelled) {
              return;
            }
            const index = cursor;
            cursor += 1;
            if (index >= missingPosters.length) {
              return;
            }
            const item = missingPosters[index];
            if (!item) {
              return;
            }
            const poster = await captureVideoPoster(item.publicUrl, {
              seekTimeSeconds: 0.05,
              maxWidth: 480,
            });
            if (!poster || cancelled) {
              continue;
            }
            updates[item.path] = poster;
            void uploadGeneratedGameplayThumbnail(item, poster);
          }
        })
      );

      if (cancelled || Object.keys(updates).length === 0) {
        return;
      }

      setGameplayPosterByPath((prev) => {
        let changed = false;
        const next = { ...prev };
        Object.entries(updates).forEach(([path, poster]) => {
          if (!next[path]) {
            next[path] = poster;
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    };

    void buildPosters();

    return () => {
      cancelled = true;
    };
  }, [
    activeGameplayPreviewPath,
    gameplayItems,
    gameplayPosterByPath,
    gameplayVisibleCount,
    uploadGeneratedGameplayThumbnail,
  ]);

  useEffect(() => {
    if (!hasMoreGameplayToReveal || gameplayVisibleItems.length === 0) {
      return;
    }
    const node = gameplayLoadMoreRef.current;
    if (!node) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) {
          return;
        }
        setGameplayVisibleCount((prev) =>
          Math.min(gameplayItems.length, prev + GAMEPLAY_VISIBLE_BATCH_SIZE)
        );
      },
      {
        root: null,
        rootMargin: GAMEPLAY_LOAD_MORE_ROOT_MARGIN,
        threshold: 0.01,
      }
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [
    gameplayItems.length,
    gameplayVisibleCount,
    gameplayVisibleItems.length,
    hasMoreGameplayToReveal,
  ]);

  useEffect(() => {
    if (gameplayPrefetchStartedRef.current) {
      return;
    }
    gameplayPrefetchStartedRef.current = true;
    loadGameplay().catch(() => {});
  }, [loadGameplay]);

  const handleNext = useCallback(() => {
    if (step === 1 && !canContinueToBackground) return;
    if (step === 2 && !canContinueToSubtitles) return;
    setStep((prev) => (prev === 1 ? 2 : prev === 2 ? 3 : 3));
  }, [canContinueToBackground, canContinueToSubtitles, step]);

  const handleBack = useCallback(() => {
    setStep((prev) => (prev === 3 ? 2 : prev === 2 ? 1 : 1));
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!sourceVideo || !gameplaySelected || !subtitleStyleId) {
      return;
    }
    const startedAt = Date.now();
    if (!sourceVideo.assetId) {
      setSourceError("Please upload or download a video first.");
      setStep(1);
      return;
    }
    const payload: SplitScreenImportPayloadV1 = {
      version: 1,
      layout,
      mainVideo: {
        url: sourceVideo.url,
        name: sourceVideo.name,
        assetId: sourceVideo.assetId ?? null,
        durationSeconds:
          typeof sourceVideo.durationSeconds === "number" &&
          Number.isFinite(sourceVideo.durationSeconds)
            ? sourceVideo.durationSeconds
            : null,
      },
      backgroundVideo: {
        url: gameplaySelected.publicUrl,
        name: gameplaySelected.name,
      },
      subtitles: {
        autoGenerate: autoGenerateSubtitles,
        styleId: subtitleStyleId,
      },
    };
    setGenerateBusy(true);
    try {
      console.info("[split-screen][wizard] creating import payload", {
        layout,
        mainVideo: {
          name: sourceVideo.name,
          hasAssetId: Boolean(sourceVideo.assetId),
          urlPreview: sourceVideo.url.slice(0, 120),
        },
        backgroundVideo: {
          name: gameplaySelected.name,
          path: gameplaySelected.path,
        },
        subtitles: {
          autoGenerate: autoGenerateSubtitles,
          styleId: subtitleStyleId,
        },
      });
      const response = await fetch("/api/editor/import-payload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "splitscreen",
          payload,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof data?.error === "string" && data.error
            ? data.error
            : "Unable to prepare import payload."
        );
      }
      const payloadId =
        typeof data?.id === "string" && data.id.trim().length > 0
          ? data.id.trim()
          : "";
      if (!payloadId) {
        throw new Error("Import payload id missing.");
      }
      console.info("[split-screen][wizard] payload created", {
        payloadId,
        durationMs: Date.now() - startedAt,
      });
      router.push(
        `/editor/advanced?import=splitscreen&payloadId=${encodeURIComponent(payloadId)}&ts=${Date.now()}`
      );
    } catch (error) {
      console.error("[split-screen][wizard] failed to start import", error);
      setSourceError(
        error instanceof Error ? error.message : "Unable to continue."
      );
    } finally {
      setGenerateBusy(false);
    }
  }, [
    autoGenerateSubtitles,
    gameplaySelected,
    layout,
    router,
    sourceVideo,
    subtitleStyleId,
  ]);

  const stepLabel = useMemo(() => {
    if (step === 1) return "Upload Video";
    if (step === 2) return "Select Background";
    return "Select Subtitles";
  }, [step]);

  return (
    <div className="mx-auto flex h-[100dvh] w-full max-w-[1920px] flex-col space-y-4 p-2 md:p-4">
      <header className="sticky top-0 z-40 flex items-center justify-between rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e]/70 px-3 py-3 backdrop-blur md:px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e]">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-5 w-5 text-[#f7f7f8]"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" />
              {layout === "side-by-side" ? <path d="M12 3v18" /> : <path d="M3 12h18" />}
            </svg>
          </div>
          <div className="flex flex-col">
            <h1 className="text-base font-medium text-[#f7f7f8] md:text-lg">
              {title}
            </h1>
            <p className="text-xs text-[#898a8b] md:text-sm">
              {stepLabel}
            </p>
          </div>
        </div>
      </header>

      <div className="flex w-full flex-1 flex-col overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e]">
        <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.08)] px-3 py-3 md:px-4">
          <div className="flex items-center gap-3 overflow-x-auto">
            {[
              { id: 1, label: "Upload Video" },
              { id: 2, label: "Select Background" },
              { id: 3, label: "Select Subtitles" },
            ].map((entry) => {
              const isActive = step === (entry.id as WizardStep);
              const isDone = step > (entry.id as WizardStep);
              return (
                <div key={entry.id} className="flex items-center gap-2 whitespace-nowrap">
                  <div
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full text-xs",
                      isActive || isDone
                        ? "bg-[#9aed00] text-black"
                        : "border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] text-[#898a8b]"
                    )}
                  >
                    {entry.id}
                  </div>
                  <p className={cn("text-sm", isActive ? "text-[#f7f7f8]" : "text-[#898a8b]")}>
                    {entry.label}
                  </p>
                  {entry.id !== 3 && (
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 320 512"
                      className="h-3.5 w-3.5 text-[#898a8b]"
                      fill="currentColor"
                    >
                      <path d="M310.6 233.4c12.5 12.5 12.5 32.8 0 45.3l-192 192c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L242.7 256 73.4 86.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l192 192z" />
                    </svg>
                  )}
                </div>
              );
            })}
          </div>

          <div className="hidden items-center gap-2 md:flex">
            {step > 1 && (
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
            )}
            {step < 3 ? (
              <Button
                onClick={handleNext}
                disabled={step === 1 ? !canContinueToBackground : !canContinueToSubtitles}
              >
                Next
                <svg
                  aria-hidden="true"
                  viewBox="0 0 320 512"
                  className="ml-2 h-3.5 w-3.5"
                  fill="currentColor"
                >
                  <path d="M310.6 233.4c12.5 12.5 12.5 32.8 0 45.3l-192 192c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L242.7 256 73.4 86.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l192 192z" />
                </svg>
              </Button>
            ) : (
              <Button
                onClick={handleGenerate}
                disabled={!canGenerate || generateBusy}
              >
                {generateBusy ? "Preparing..." : "Generate"}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 256 256"
                  className="ml-2 h-4 w-4"
                  fill="currentColor"
                >
                  <path d="M208,144a15.78,15.78,0,0,1-10.42,14.94L146,178l-19,51.62a15.92,15.92,0,0,1-29.88,0L78,178l-51.62-19a15.92,15.92,0,0,1,0-29.88L78,110l19-51.62a15.92,15.92,0,0,1,29.88,0L146,110l51.62,19A15.78,15.78,0,0,1,208,144Z" />
                </svg>
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-[#0e1012] p-3 md:p-6">
          {step === 1 && (
            <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
              <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-medium text-[#f7f7f8]">
                      Upload your video
                    </h2>
                    <p className="text-sm text-[#898a8b]">
                      Upload a clip, or download from YouTube/TikTok.
                    </p>
                  </div>
                  <div className="flex rounded-lg bg-[#252729] p-1">
                    <button
                      type="button"
                      className={cn(
                        "rounded-md px-3 py-1.5 text-sm font-medium",
                        inputMode === "upload"
                          ? "bg-[#1a1c1e] text-[#f7f7f8] shadow-sm"
                          : "text-[#898a8b]"
                      )}
                      onClick={() => setInputMode("upload")}
                    >
                      Upload
                    </button>
                    <button
                      type="button"
                      className={cn(
                        "rounded-md px-3 py-1.5 text-sm font-medium",
                        inputMode === "link"
                          ? "bg-[#1a1c1e] text-[#f7f7f8] shadow-sm"
                          : "text-[#898a8b]"
                      )}
                      onClick={() => setInputMode("link")}
                    >
                      Link
                    </button>
                  </div>
                </div>

                {inputMode === "upload" ? (
                  <div className="mt-4">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="video/*,.mp4,.mov,.m4v,.webm"
                      className="hidden"
                      onChange={handleFileInputChange}
                    />
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={triggerUploadPicker}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleDrop}
                      className={cn(
                        "flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[rgba(255,255,255,0.08)] px-4 py-8 text-center transition",
                        sourceBusy ? "opacity-60" : "hover:border-[rgba(255,255,255,0.12)]"
                      )}
                    >
                      <p className="text-base text-[#898a8b]">
                        Choose a clip or drag & drop it here.
                      </p>
                      <p className="mt-1 text-sm text-[#898a8b]">
                        MP4/MOV/WEBM, up to 500 MB.
                      </p>
                      <div className="mt-4">
                        <Button type="button" disabled={sourceBusy}>
                          {sourceBusy ? "Uploading..." : "Browse file"}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 space-y-2">
                    <label className="text-sm text-[#898a8b]">
                      Add YouTube or TikTok link
                    </label>
                    <div className="flex gap-2">
                      <input
                        value={sourceLink}
                        onChange={(e) => setSourceLink(e.target.value)}
                        placeholder="https://youtube.com/watch?v=..."
                        className="h-10 w-full rounded-md border border-[rgba(255,255,255,0.08)] bg-[#0e1012] px-3 text-sm text-[#f7f7f8] focus:border-[#9aed00]/30 focus:ring-[#9aed00]/20 focus:outline-none"
                      />
                      <Button
                        type="button"
                        onClick={handleDownloadFromLink}
                        disabled={sourceBusy || sourceLink.trim().length === 0}
                        className="w-28"
                      >
                        {sourceBusy ? "..." : "Download"}
                      </Button>
                    </div>
                  </div>
                )}

                {sourceError && (
                  <p className="mt-3 text-sm text-[#e72930]">{sourceError}</p>
                )}
              </div>

              {sourceVideo && (
                <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-[#898a8b]">Selected video</p>
                      <p className="truncate text-base font-medium text-[#f7f7f8]">
                        {sourceVideo.name}
                      </p>
                      <p className="mt-1 text-xs text-[#898a8b]">
                        Asset ID: {sourceVideo.assetId ?? "external"}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => setSourceVideo(null)}
                      disabled={sourceBusy}
                    >
                      Change
                    </Button>
                  </div>
                  <div className="mt-4 overflow-hidden rounded-lg bg-black">
                    <video
                      src={sourceVideo.url}
                      className="h-64 w-full object-contain"
                      controls
                      playsInline
                      preload="metadata"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
              <input
                ref={gameplayUploadInputRef}
                type="file"
                accept="video/*,.mp4,.mov,.m4v,.webm"
                className="hidden"
                onChange={handleGameplayUploadInputChange}
              />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-medium text-[#f7f7f8]">
                    Select Background Video
                  </h2>
                  <p className="text-sm text-[#898a8b]">
                    Tip: You can replace the background video later in the editor.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={triggerGameplayUploadPicker}
                    disabled={gameplayUploading}
                  >
                    {gameplayUploading ? "Uploading..." : "Upload footage"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={loadGameplay}
                    disabled={gameplayLoading}
                  >
                    Refresh
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-[rgba(255,190,76,0.3)] bg-[rgba(255,190,76,0.12)] px-4 py-3">
                <p className="text-sm font-medium text-[#f1c40f]">
                  Use your own gameplay footage when possible.
                </p>
                <p className="mt-1 text-sm text-[#f7f7f8]">
                  Shared footage can be reused by other creators and YouTube may flag
                  it as duplicate or reuploaded content. Uploading original gameplay
                  gives the best results.
                </p>
              </div>

              {gameplayUploadError && (
                <div className="rounded-lg border border-[rgba(231,41,48,0.2)] bg-[rgba(231,41,48,0.1)] px-4 py-3 text-sm text-[#e72930]">
                  {gameplayUploadError}
                </div>
              )}

              {gameplayError && (
                <div className="rounded-lg border border-[rgba(231,41,48,0.2)] bg-[rgba(231,41,48,0.1)] px-4 py-3 text-sm text-[#e72930]">
                  {gameplayError}
                </div>
              )}

              {gameplayLoading && gameplayItems.length === 0 && (
                <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] p-6 text-sm text-[#898a8b]">
                  Loading gameplay footage...
                </div>
              )}

              {!gameplayLoading && gameplayItems.length === 0 && (
                <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] p-6 text-sm text-[#898a8b]">
                  No gameplay footage yet. Upload your own clip to continue, or wait
                  for the <code className="rounded bg-[#252729] px-1">gameplay-footage</code>{" "}
                  bucket to finish syncing.
                </div>
              )}

              {gameplayVisibleItems.length > 0 && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {gameplayVisibleItems.map((item, index) => {
                    const isSelected = gameplaySelected?.path === item.path;
                    const isPreviewActive = activeGameplayPreviewPath === item.path;
                    const posterUrl =
                      gameplayPosterByPath[item.path] ??
                      (typeof item.thumbnailUrl === "string"
                        ? item.thumbnailUrl.trim()
                        : "");
                    return (
                      <button
                        key={item.path}
                        type="button"
                        className={cn(
                          "group relative overflow-hidden rounded-xl border bg-[#1a1c1e] text-left transition",
                          isSelected ? "border-[#9aed00] shadow-lg shadow-[#9aed00]/10" : "border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.12)]"
                        )}
                        onClick={() => setGameplaySelected(item)}
                        onMouseEnter={() => setActiveGameplayPreviewPath(item.path)}
                        onMouseLeave={() =>
                          setActiveGameplayPreviewPath((prev) =>
                            prev === item.path ? null : prev
                          )
                        }
                        onFocus={() => setActiveGameplayPreviewPath(item.path)}
                        onBlur={() =>
                          setActiveGameplayPreviewPath((prev) =>
                            prev === item.path ? null : prev
                          )
                        }
                      >
                        {isSelected && (
                          <div className="absolute left-3 top-3 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-[#9aed00] text-black">
                            <svg
                              aria-hidden="true"
                              viewBox="0 0 20 20"
                              className="h-4 w-4"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </div>
                        )}
                        <div className="relative aspect-[9/16] w-full overflow-hidden bg-black">
                          {isPreviewActive ? (
                            <video
                              src={item.publicUrl}
                              className="h-full w-full object-cover"
                              muted
                              playsInline
                              loop
                              autoPlay
                              preload="metadata"
                            />
                          ) : posterUrl ? (
                            <img
                              src={posterUrl}
                              alt={`${item.name} first frame`}
                              className="h-full w-full object-cover"
                              loading={index < GAMEPLAY_INITIAL_VISIBLE_COUNT ? "eager" : "lazy"}
                              draggable={false}
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-[#111315] px-3 text-center text-xs text-[#898a8b]">
                              Preparing preview...
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {gameplayPreviewPendingCount > 0 && (
                <p className="text-xs text-[#898a8b]">
                  Loading {gameplayPreviewPendingCount} more preview
                  {gameplayPreviewPendingCount === 1 ? "" : "s"}...
                </p>
              )}

              {gameplayLoadingMore && gameplayVisibleItems.length > 0 && (
                <p className="text-xs text-[#898a8b]">Loading more gameplay videos...</p>
              )}

              {gameplayVisibleItems.length > 0 && hasMoreGameplayToReveal && (
                <div
                  ref={gameplayLoadMoreRef}
                  className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] px-4 py-3 text-center text-xs text-[#898a8b]"
                >
                  Scroll to load more gameplay videos...
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-medium text-[#f7f7f8]">
                    Select Subtitle Template
                  </h2>
                  <p className="text-sm text-[#898a8b]">
                    Uses the editor’s transcription + timestamped subtitle engine.
                  </p>
                </div>
                <SubtitleModeToggle value={subtitleMode} onChange={setSubtitleMode} />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] p-4">
                <div>
                  <p className="text-sm font-medium text-[#f7f7f8]">
                    Auto-generate subtitles
                  </p>
                  <p className="text-sm text-[#898a8b]">
                    Creates subtitles in the editor automatically after import.
                  </p>
                </div>
                <button
                  type="button"
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                    autoGenerateSubtitles ? "bg-[#9aed00]" : "bg-[rgba(255,255,255,0.08)]"
                  )}
                  onClick={() => setAutoGenerateSubtitles((prev) => !prev)}
                  aria-label="Toggle auto-generate subtitles"
                >
                  <span
                    className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      autoGenerateSubtitles ? "translate-x-6" : "translate-x-1"
                    )}
                  />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {subtitleStyleOptions.map((preset) => {
                  const selected = preset.id === subtitleStyleId;
                  const preview = preset.preview;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      className={cn(
                        "group relative flex h-24 w-full items-center justify-center overflow-hidden rounded-xl bg-slate-800 transition",
                        selected ? "ring-2 ring-[#9aed00] ring-offset-2 ring-offset-[#1c1e20]" : "hover:opacity-95"
                      )}
                      onClick={() => setSubtitleStyleId(preset.id)}
                    >
                      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.14),_rgba(255,255,255,0)_55%)]" />
                      {selected && (
                        <div className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-[#9aed00] text-black">
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
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                        </div>
                      )}
                      <div className="flex flex-col items-center justify-center gap-1 px-3">
                        <span
                          className="text-center"
                          style={{
                            fontFamily: preview?.fontFamily ?? "inherit",
                            fontSize: preview?.fontSize ?? 22,
                            fontWeight: preview?.bold ? 700 : 500,
                            color: (preset as any)?.settings?.color ?? "#fff",
                            textShadow: (preset as any)?.settings?.shadowEnabled
                              ? `0 6px ${Math.max(8, (preset as any)?.settings?.shadowBlur ?? 12)}px rgba(0,0,0,0.55)`
                              : "none",
                          }}
                        >
                          {preview?.text ?? preset.name}
                        </span>
                        <span className="text-xs font-medium text-white/70">
                          {preset.name}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] px-3 py-3 md:hidden">
          <Button variant="outline" onClick={handleBack} disabled={step === 1}>
            Back
          </Button>
          {step < 3 ? (
            <Button
              onClick={handleNext}
              disabled={step === 1 ? !canContinueToBackground : !canContinueToSubtitles}
              className="flex-1"
            >
              Next
            </Button>
          ) : (
            <Button
              onClick={handleGenerate}
              disabled={!canGenerate || generateBusy}
              className="flex-1"
            >
              {generateBusy ? "Preparing..." : "Generate video"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
