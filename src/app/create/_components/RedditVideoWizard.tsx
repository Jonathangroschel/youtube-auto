"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { uploadAssetFile } from "@/lib/assets/library";
import { captureVideoPoster } from "@/lib/media/video-poster";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  type RedditVideoImportPayloadV1,
} from "@/lib/editor/imports";
import { subtitleStylePresets } from "@/app/editor/advanced/data";
import { useSubtitleStyleFontPreload } from "./use-subtitle-style-font-preload";

type WizardStep = 1 | 2 | 3 | 4;

type GameplayItem = {
  name: string;
  path: string;
  publicUrl: string;
  thumbnailUrl?: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  width?: number | null;
  height?: number | null;
};

type PublicAudioItem = {
  id: string;
  name: string;
  url: string;
  path: string;
  size: number;
};

const DEFAULT_INTRO_SECONDS = 3;
const GAMEPLAY_BUCKET = "gameplay-footage";
const GAMEPLAY_THUMBNAIL_PREFIX = "thumbnails";
const GAMEPLAY_LIST_LIMIT = 120;
const GAMEPLAY_FETCH_TIMEOUT_MS = 15000;
const GAMEPLAY_PROBE_TIMEOUT_MS = 8000;
const GAMEPLAY_POSTER_CONCURRENCY = 8;
const GAMEPLAY_INITIAL_FETCH_LIMIT = 4;
const GAMEPLAY_INITIAL_VISIBLE_COUNT = 4;
const GAMEPLAY_VISIBLE_BATCH_SIZE = 8;
const GAMEPLAY_LOAD_MORE_ROOT_MARGIN = "300px 0px";
const SQUARE_TOLERANCE_PX = 2;

const toGameplayThumbnailPath = (videoPath: string) =>
  `${GAMEPLAY_THUMBNAIL_PREFIX}/${videoPath.replace(/^\/+/, "").replace(/\.[^/.]+$/, ".jpg")}`;

const DEFAULT_REDDIT_PFPS = [
  "/reddit-default-pfp/0qoqln2f5bu71.webp",
  "/reddit-default-pfp/3ebpjz1f5bu71.webp",
  "/reddit-default-pfp/69btno2f5bu71.webp",
  "/reddit-default-pfp/6sh1pd4c5bu71.webp",
  "/reddit-default-pfp/6yyqvx1f5bu71.webp",
  "/reddit-default-pfp/bemsen2f5bu71.webp",
  "/reddit-default-pfp/harcap5c5bu71.webp",
  "/reddit-default-pfp/j6n0dp5c5bu71.webp",
];

const SubtitleModeToggle = ({
  value,
  onChange,
}: {
  value: "one-word" | "lines";
  onChange: (next: "one-word" | "lines") => void;
}) => {
  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          "text-sm font-medium",
          value === "one-word" ? "text-[#f7f7f8]" : "text-[#898a8b]"
        )}
      >
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
            "inline-block h-4 w-4 transform rounded-full bg-[#1a1c1e] transition-transform",
            value === "lines" ? "translate-x-6" : "translate-x-1"
          )}
        />
      </button>
      <span
        className={cn(
          "text-sm font-medium",
          value === "lines" ? "text-[#f7f7f8]" : "text-[#898a8b]"
        )}
      >
        Lines
      </span>
    </div>
  );
};

const VerifiedBadge = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    className="ml-1 h-5 w-5"
    fill="currentColor"
    style={{ color: "rgb(25, 165, 252)" }}
  >
    <path d="M10.007 2.10377C8.60544 1.65006 7.08181 2.28116 6.41156 3.59306L5.60578 5.17023C5.51004 5.35763 5.35763 5.51004 5.17023 5.60578L3.59306 6.41156C2.28116 7.08181 1.65006 8.60544 2.10377 10.007L2.64923 11.692C2.71404 11.8922 2.71404 12.1078 2.64923 12.308L2.10377 13.993C1.65006 15.3946 2.28116 16.9182 3.59306 17.5885L5.17023 18.3942C5.35763 18.49 5.51004 18.6424 5.60578 18.8298L6.41156 20.407C7.08181 21.7189 8.60544 22.35 10.007 21.8963L11.692 21.3508C11.8922 21.286 12.1078 21.286 12.308 21.3508L13.993 21.8963C15.3946 22.35 16.9182 21.7189 17.5885 20.407L18.3942 18.8298C18.49 18.6424 18.6424 18.49 18.8298 18.3942L20.407 17.5885C21.7189 16.9182 22.35 15.3946 21.8963 13.993L21.3508 12.308C21.286 12.1078 21.286 11.8922 21.3508 11.692L21.8963 10.007C22.35 8.60544 21.7189 7.08181 20.407 6.41156L18.8298 5.60578C18.6424 5.51004 18.49 5.35763 18.3942 5.17023L17.5885 3.59306C16.9182 2.28116 15.3946 1.65006 13.993 2.10377L12.308 2.64923C12.1078 2.71403 11.8922 2.71404 11.692 2.64923L10.007 2.10377ZM6.75977 11.7573L8.17399 10.343L11.0024 13.1715L16.6593 7.51465L18.0735 8.92886L11.0024 15.9999L6.75977 11.7573Z" />
  </svg>
);

function RedditIntroCard({
  avatarUrl,
  username,
  title,
  likes,
  comments,
  darkMode,
}: {
  avatarUrl: string;
  username: string;
  title: string;
  likes: string;
  comments: string;
  darkMode: boolean;
}) {
  const stroke = darkMode ? "#575757" : "#adadad";
  const textPrimary = darkMode ? "text-white" : "text-[#f7f7f8]";
  const cardBg = darkMode ? "bg-black" : "bg-[#1a1c1e]";
  const iconText = darkMode ? "text-[#ADADAD]" : "text-[#898a8b]";

  return (
    <div
      id="reddit-card"
        className={cn(
        cardBg,
        "max-w-xs select-none overflow-hidden border border-[rgba(255,255,255,0.08)] p-4"
      )}
      style={{
        borderRadius: 12,
        transform: "scale(1)",
        transformOrigin: "left top",
      }}
    >
      <div className="flex flex-col">
        <div className="flex items-center">
          <div className="-mt-2 flex h-10 w-10 items-center justify-center overflow-hidden rounded-full">
            <img
              alt="Profile Picture"
              className="w-full rounded-full"
              draggable={false}
              src={avatarUrl}
            />
          </div>
          <div className="-mt-6 ml-2 flex items-center">
            <span className={cn(textPrimary, "font-semibold")}>
              {username}
            </span>
            <VerifiedBadge />
          </div>
        </div>
        <div className="relative -mt-4 ml-[45px]">
          <img
            alt="AWARDS"
            width={140}
            height={40}
            src="/awards.png"
          />
        </div>
      </div>

      <div className="mb-2 mt-2 text-left font-medium">
        <p className={textPrimary}>{title}</p>
      </div>

      <div className="flex justify-between">
        <div className="-mb-2 flex items-center space-x-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke={stroke}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="lucide lucide-heart scale-x-[-1] transform"
            aria-hidden="true"
          >
            <path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" />
          </svg>
          <span className={cn("ml-1 text-sm font-normal", iconText)}>
            {likes}
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke={stroke}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="lucide lucide-message-circle scale-x-[-1] transform"
            aria-hidden="true"
          >
            <path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" />
          </svg>
          <span className={cn("ml-1 mt-[0.2px] text-sm font-normal", iconText)}>
            {comments}
          </span>
        </div>

        <div className="-mb-2 flex items-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke={stroke}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="lucide lucide-share"
            aria-hidden="true"
          >
            <path d="M12 2v13" />
            <path d="m16 6-4-4-4 4" />
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          </svg>
          <span className={cn("ml-1 text-sm font-normal", iconText)}>share</span>
        </div>
      </div>
    </div>
  );
}

function ScriptGeneratorModal({
  open,
  onClose,
  titleHint,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  titleHint: string;
  onApply: (script: string) => void;
}) {
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("");
  const [length, setLength] = useState<"short" | "medium" | "long">("medium");
  const [hook, setHook] = useState("");
  const [cta, setCta] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setError(null);
    setLoading(false);
    setTopic((prev) => prev || titleHint);
  }, [open, titleHint]);

  const handleGenerate = useCallback(async () => {
    const resolvedTopic = topic.trim();
    if (!resolvedTopic) {
      setError("Enter a story topic.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/reddit-video/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: resolvedTopic,
          tone: tone.trim() || undefined,
          length,
          hook: hook.trim() || undefined,
          cta: cta.trim() || undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof data?.error === "string" && data.error ? data.error : "Script generation failed."
        );
      }
      const script =
        typeof data?.script === "string" ? data.script.trim() : "";
      if (!script) {
        throw new Error("Script generation returned empty output.");
      }
      onApply(script);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Script generation failed.");
    } finally {
      setLoading(false);
    }
  }, [cta, hook, length, onApply, onClose, tone, topic]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-[750px] overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] shadow-[0_24px_60px_rgba(15,23,42,0.2)]">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="hidden rounded-full border border-[rgba(255,255,255,0.08)] p-2.5 md:flex">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4.5 w-4.5"
                aria-hidden="true"
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
            <div className="flex flex-col items-start">
              <h2 className="text-base font-medium md:text-lg">Generate Script</h2>
              <p className="text-left text-xs text-[#898a8b] md:text-sm">
                Create your script with ease using AI
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-[rgba(255,255,255,0.05)]"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
        <div className="border-t border-[rgba(255,255,255,0.08)]" />

        <div className="flex h-[600px] flex-col space-y-6 px-4 py-4">
          <div className="flex-1 overflow-y-auto">
            <div className="flex h-full flex-col gap-4">
              <div className="space-y-2">
                <label className="text-base font-medium text-[#f7f7f8]">Story topic</label>
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Enter your story topic here"
                  className="h-12 w-full rounded-md border border-[rgba(255,255,255,0.08)] bg-[#0e1012] px-3 py-5 text-[#f7f7f8] outline-none transition-all focus:border-[#9aed00]/30 focus:ring-[#9aed00]/20"
                />
              </div>

              <div className="flex flex-col gap-2 md:flex-row">
                <div className="w-full space-y-2">
                  <label className="text-base font-medium text-[#f7f7f8]">Tone</label>
                  <input
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    placeholder="e.g. Funny, dramatic, wholesome"
                    className="h-12 w-full rounded-md border border-[rgba(255,255,255,0.08)] bg-[#0e1012] px-3 py-5 text-[#f7f7f8] outline-none transition-all focus:border-[#9aed00]/30 focus:ring-[#9aed00]/20"
                  />
                </div>
                <div className="w-full space-y-2">
                  <label className="text-base font-medium text-[#f7f7f8]">Length</label>
                  <select
                    value={length}
                    onChange={(e) =>
                      setLength(e.target.value as "short" | "medium" | "long")
                    }
                    className="h-12 w-full rounded-md border border-[rgba(255,255,255,0.08)] bg-[#0e1012] px-3 text-[#f7f7f8] outline-none transition-all focus:border-[#9aed00]/30 focus:ring-[#9aed00]/20"
                  >
                    <option value="short">Short</option>
                    <option value="medium">Medium</option>
                    <option value="long">Long</option>
                  </select>
                </div>
              </div>

              <div className="hidden space-y-2 md:block">
                <label className="text-base font-medium text-[#f7f7f8]">
                  Video Starting (Hook)
                </label>
                <input
                  value={hook}
                  onChange={(e) => setHook(e.target.value)}
                  placeholder="Have you ever wondered how to..."
                  className="h-12 w-full rounded-md border border-[rgba(255,255,255,0.08)] bg-[#0e1012] px-3 py-5 text-[#f7f7f8] outline-none transition-all focus:border-[#9aed00]/30 focus:ring-[#9aed00]/20"
                />
              </div>
              <div className="hidden space-y-2 md:block">
                <label className="text-base font-medium text-[#f7f7f8]">
                  Video Ending (CTA)
                </label>
                <input
                  value={cta}
                  onChange={(e) => setCta(e.target.value)}
                  placeholder="Follow for more..."
                  className="h-12 w-full rounded-md border border-[rgba(255,255,255,0.08)] bg-[#0e1012] px-3 py-5 text-[#f7f7f8] outline-none transition-all focus:border-[#9aed00]/30 focus:ring-[#9aed00]/20"
                />
              </div>

              {error ? (
                <div className="rounded-lg border border-[rgba(231,41,48,0.2)] bg-[rgba(231,41,48,0.1)] p-3 text-sm text-[#e72930]">
                  {error}
                </div>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            className={cn(
              "flex h-12 w-full items-center justify-center gap-3 rounded-lg px-2 py-3 text-black transition hover:opacity-90",
              "[background:linear-gradient(180deg,_rgba(255,_255,_255,_0.16)_0%,_rgba(255,_255,_255,_0)_100%),_#9aed00]",
              loading && "cursor-wait opacity-80"
            )}
          >
            <span>{loading ? "Generating..." : "Generate Script"}</span>
            <span className="rounded-md bg-black/10 px-2 py-0.5 text-xs font-medium text-black/70">
              Enter
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RedditVideoWizard() {
  const router = useRouter();
  const pfpUploadRef = useRef<HTMLInputElement | null>(null);
  const gameplayUploadInputRef = useRef<HTMLInputElement | null>(null);
  const gameplaySupabase = useMemo(() => createClient(), []);

  const [step, setStep] = useState<WizardStep>(1);

  const [postUsername, setPostUsername] = useState("reddit-user");
  const [postAvatarUrl, setPostAvatarUrl] = useState(DEFAULT_REDDIT_PFPS[0] ?? "");
  const [postLikes, setPostLikes] = useState("99+");
  const [postComments, setPostComments] = useState("99+");
  const [postTitle, setPostTitle] = useState("");
  const [postDarkMode, setPostDarkMode] = useState(false);
  const [postShowIntroCard, setPostShowIntroCard] = useState(true);
  const [script, setScript] = useState("");

  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileSelected, setProfileSelected] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileUploading, setProfileUploading] = useState(false);

  const [scriptModalOpen, setScriptModalOpen] = useState(false);

  const [subtitleMode, setSubtitleMode] = useState<"one-word" | "lines">("lines");
  const defaultLinesStyleId =
    subtitleStylePresets.find(
      (preset) => !Boolean(preset.settings?.wordHighlightEnabled)
    )?.id ??
    subtitleStylePresets[0]?.id ??
    null;
  const defaultOneWordStyleId =
    subtitleStylePresets.find((preset) =>
      Boolean(preset.settings?.wordHighlightEnabled)
    )?.id ??
    subtitleStylePresets[0]?.id ??
    null;

  const [subtitleStyleId, setSubtitleStyleId] = useState<string | null>(
    defaultLinesStyleId
  );

  const subtitleStyleOptions = useMemo(() => {
    if (subtitleMode === "one-word") {
      return subtitleStylePresets.filter(
        (preset) => Boolean(preset.settings?.wordHighlightEnabled)
      );
    }
    return subtitleStylePresets.filter(
      (preset) => !Boolean(preset.settings?.wordHighlightEnabled)
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

  useEffect(() => {
    setSubtitleStyleId(
      subtitleMode === "one-word" ? defaultOneWordStyleId : defaultLinesStyleId
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtitleMode]);

  const [gameplayLoading, setGameplayLoading] = useState(false);
  const [gameplayLoadingMore, setGameplayLoadingMore] = useState(false);
  const [gameplayError, setGameplayError] = useState<string | null>(null);
  const [gameplayUploadError, setGameplayUploadError] = useState<string | null>(
    null
  );
  const [gameplayUploading, setGameplayUploading] = useState(false);
  const [gameplayItems, setGameplayItems] = useState<GameplayItem[]>([]);
  const [gameplaySelected, setGameplaySelected] = useState<GameplayItem | null>(null);
  const [gameplayPosterByPath, setGameplayPosterByPath] = useState<Record<string, string>>(
    {}
  );
  const [activeGameplayPreviewPath, setActiveGameplayPreviewPath] = useState<string | null>(
    null
  );
  const [gameplayVisibleCount, setGameplayVisibleCount] = useState(
    GAMEPLAY_INITIAL_VISIBLE_COUNT
  );
  const gameplayPrefetchStartedRef = useRef(false);
  const gameplayThumbnailUploadAttemptedRef = useRef<Set<string>>(new Set());
  const gameplayLoadMoreRef = useRef<HTMLDivElement | null>(null);

  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voices, setVoices] = useState<PublicAudioItem[]>([]);
  const [voiceSearch, setVoiceSearch] = useState("");
  const [introVoice, setIntroVoice] = useState<string | null>(null);
  const [scriptVoice, setScriptVoice] = useState<string | null>(null);
  const [voiceSelectTarget, setVoiceSelectTarget] = useState<"intro" | "script">(
    "script"
  );

  const [musicLoading, setMusicLoading] = useState(false);
  const [musicError, setMusicError] = useState<string | null>(null);
  const [musicTracks, setMusicTracks] = useState<PublicAudioItem[]>([]);
  const [selectedMusic, setSelectedMusic] = useState<PublicAudioItem | null>(null);
  const [musicVolume, setMusicVolume] = useState(20);
  const [generateBusy, setGenerateBusy] = useState(false);

  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [previewTrackId, setPreviewTrackId] = useState<string | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

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

  const isClearlyNonVertical = useCallback((width: number, height: number) => {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return false;
    }
    if (Math.abs(width - height) <= SQUARE_TOLERANCE_PX) {
      return true;
    }
    return width > height + SQUARE_TOLERANCE_PX;
  }, []);

  const probeVideoIsVertical = useCallback((url: string) => {
    return new Promise<boolean>((resolve) => {
      const video = document.createElement("video");
      let settled = false;
      const cleanup = () => {
        video.onloadedmetadata = null;
        video.onerror = null;
        video.src = "";
      };
      const finish = (value: boolean) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        resolve(value);
      };
      const timeoutId = window.setTimeout(() => finish(true), GAMEPLAY_PROBE_TIMEOUT_MS);
      video.preload = "metadata";
      video.playsInline = true;
      video.muted = true;
      video.onloadedmetadata = () => {
        window.clearTimeout(timeoutId);
        const width = video.videoWidth;
        const height = video.videoHeight;
        if (width > 0 && height > 0) {
          finish(!isClearlyNonVertical(width, height));
          return;
        }
        // Keep unknown cases so we only remove clearly incompatible footage.
        finish(true);
      };
      video.onerror = () => {
        window.clearTimeout(timeoutId);
        // Keep unknown cases so we only remove clearly incompatible footage.
        finish(true);
      };
      video.src = url;
    });
  }, [isClearlyNonVertical]);

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
      const localObjectUrl = URL.createObjectURL(file);
      const isVerticalUpload = await (async () => {
        try {
          return await probeVideoIsVertical(localObjectUrl);
        } finally {
          URL.revokeObjectURL(localObjectUrl);
        }
      })();
      if (!isVerticalUpload) {
        setGameplayUploadError(
          "Please upload vertical gameplay footage (portrait / 9:16)."
        );
        return;
      }
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
    [gameplaySupabase, probeVideoIsVertical]
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

  const loadGameplay = useCallback(async () => {
    const fetchGameplayItems = async (limit: number, signal?: AbortSignal) => {
      const response = await fetch(
        `/api/gameplay-footage/list?limit=${Math.max(
          1,
          Math.floor(limit)
        )}&t=${Date.now()}`,
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
      setGameplaySelected((prev) =>
        prev && initialItems.some((item) => item.path === prev.path) ? prev : null
      );

      if (GAMEPLAY_LIST_LIMIT <= initialLimit) {
        return;
      }

      setGameplayLoading(false);
      setGameplayLoadingMore(true);
      try {
        const fullItems = await fetchGameplayItems(GAMEPLAY_LIST_LIMIT);
        setGameplayItems(fullItems);
        setGameplaySelected((prev) =>
          prev && fullItems.some((item) => item.path === prev.path) ? prev : null
        );
      } catch (error) {
        console.warn(
          "[reddit-video][wizard] Failed to load full gameplay list",
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
      const nextEntries = Object.entries(prev).filter(([path]) => activePaths.has(path));
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
    if (gameplayVisibleCount >= gameplayItems.length || gameplayItems.length === 0) {
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
  ]);

  const loadVoices = useCallback(async () => {
    setVoiceLoading(true);
    setVoiceError(null);
    try {
      const response = await fetch("/api/tts-voices/list", { method: "GET" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Failed to load voices.");
      }
      const items = Array.isArray(data?.items) ? (data.items as PublicAudioItem[]) : [];
      setVoices(items);
      if (!scriptVoice && items.length > 0) {
        setScriptVoice(items[0]!.name);
      }
    } catch (error) {
      setVoiceError(error instanceof Error ? error.message : "Failed to load voices.");
    } finally {
      setVoiceLoading(false);
    }
  }, [scriptVoice]);

  const loadMusic = useCallback(async () => {
    setMusicLoading(true);
    setMusicError(null);
    try {
      const response = await fetch("/api/reddit-background-music/list", { method: "GET" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Failed to load background music.");
      }
      const items = Array.isArray(data?.items) ? (data.items as PublicAudioItem[]) : [];
      setMusicTracks(items);
    } catch (error) {
      setMusicError(
        error instanceof Error ? error.message : "Failed to load background music."
      );
    } finally {
      setMusicLoading(false);
    }
  }, []);

  useEffect(() => {
    if (gameplayPrefetchStartedRef.current) {
      return;
    }
    gameplayPrefetchStartedRef.current = true;
    loadGameplay().catch(() => {});
  }, [loadGameplay]);

  useEffect(() => {
    if (step !== 4) {
      return;
    }
    if (!voiceLoading && voices.length === 0 && !voiceError) {
      loadVoices().catch(() => {});
    }
    if (!musicLoading && musicTracks.length === 0 && !musicError) {
      loadMusic().catch(() => {});
    }
  }, [
    loadMusic,
    loadVoices,
    musicError,
    musicLoading,
    musicTracks.length,
    step,
    voiceError,
    voiceLoading,
    voices.length,
  ]);

  const canContinueFromScript =
    postAvatarUrl.trim().length > 0 &&
    postTitle.trim().length > 0 &&
    script.trim().length > 0;
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
  const canContinueFromStyle = Boolean(subtitleStyleId);
  const canContinueFromVideo = Boolean(gameplaySelected);
  const canGenerate = Boolean(
    canContinueFromScript &&
      subtitleStyleId &&
      gameplaySelected &&
      scriptVoice
  );

  const handleNext = useCallback(() => {
    if (step === 1 && !canContinueFromScript) return;
    if (step === 2 && !canContinueFromStyle) return;
    if (step === 3 && !canContinueFromVideo) return;
    setStep((prev) => (prev === 1 ? 2 : prev === 2 ? 3 : prev === 3 ? 4 : 4));
  }, [canContinueFromScript, canContinueFromStyle, canContinueFromVideo, step]);

  const handleBack = useCallback(() => {
    setStep((prev) => (prev === 4 ? 3 : prev === 3 ? 2 : prev === 2 ? 1 : 1));
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!gameplaySelected || !subtitleStyleId || !scriptVoice) {
      return;
    }
    const payload: RedditVideoImportPayloadV1 = {
      version: 1,
      post: {
        username: postUsername.trim() || "reddit-user",
        avatarUrl: postAvatarUrl.trim(),
        likes: postLikes.trim() || "0",
        comments: postComments.trim() || "0",
        title: postTitle.trim(),
        darkMode: postDarkMode,
        showIntroCard: postShowIntroCard,
      },
      script: script.trim(),
      gameplay: {
        url: gameplaySelected.publicUrl,
        name: gameplaySelected.name,
      },
      subtitles: {
        styleId: subtitleStyleId,
        mode: subtitleMode,
      },
      audio: {
        introVoice: introVoice?.trim() || null,
        scriptVoice: scriptVoice.trim(),
        backgroundMusic: selectedMusic
          ? {
              url: selectedMusic.url,
              name: selectedMusic.name,
              volume: Number.isFinite(musicVolume) ? musicVolume : undefined,
            }
          : null,
      },
      timing: {
        introSeconds: DEFAULT_INTRO_SECONDS,
      },
    };

    setGenerateBusy(true);
    try {
      const response = await fetch("/api/editor/import-payload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "reddit-video",
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
      router.push(
        `/editor/advanced?import=reddit-video&payloadId=${encodeURIComponent(payloadId)}&ts=${Date.now()}`
      );
    } catch (error) {
      setVoiceError(
        error instanceof Error ? error.message : "Unable to continue."
      );
    } finally {
      setGenerateBusy(false);
    }
  }, [
    gameplaySelected,
    introVoice,
    musicVolume,
    postAvatarUrl,
    postComments,
    postDarkMode,
    postLikes,
    postShowIntroCard,
    postTitle,
    postUsername,
    router,
    script,
    scriptVoice,
    selectedMusic,
    subtitleMode,
    subtitleStyleId,
  ]);

  const stepLabel = useMemo(() => {
    if (step === 1) return "Script";
    if (step === 2) return "Style";
    if (step === 3) return "Video";
    return "Audio";
  }, [step]);

  const filteredVoices = useMemo(() => {
    const query = voiceSearch.trim().toLowerCase();
    if (!query) {
      return voices;
    }
    return voices.filter((voice) => voice.name.toLowerCase().includes(query));
  }, [voiceSearch, voices]);

  const stopPreview = useCallback(() => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
    }
    setIsPreviewPlaying(false);
    setPreviewTrackId(null);
  }, []);

  const playPreview = useCallback(
    async (track: PublicAudioItem) => {
      if (!track?.url) {
        return;
      }
      const audio = previewAudioRef.current ?? new Audio();
      previewAudioRef.current = audio;
      if (previewTrackId === track.id) {
        stopPreview();
        return;
      }
      audio.pause();
      audio.currentTime = 0;
      audio.src = track.url;
      audio.volume = 0.9;
      try {
        await audio.play();
        setPreviewTrackId(track.id);
        setIsPreviewPlaying(true);
        audio.onended = () => {
          setIsPreviewPlaying(false);
          setPreviewTrackId(null);
        };
      } catch {
        // ignore
      }
    },
    [previewTrackId, stopPreview]
  );

  const triggerPfpUpload = useCallback(() => {
    pfpUploadRef.current?.click();
  }, []);

  const handlePfpUpload = useCallback(
    async (file: File) => {
      setProfileUploading(true);
      setProfileError(null);
      try {
        const asset = await uploadAssetFile(file, {
          name: file.name || "Reddit profile picture",
          source: "upload",
        });
        if (!asset?.url) {
          throw new Error("Upload failed.");
        }
        setPostAvatarUrl(asset.url);
        setProfileSelected(asset.url);
      } catch (error) {
        setProfileError(error instanceof Error ? error.message : "Upload failed.");
      } finally {
        setProfileUploading(false);
      }
    },
    []
  );

  const handlePfpUploadChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) {
        return;
      }
      await handlePfpUpload(file);
    },
    [handlePfpUpload]
  );

  const handleProfileSelect = useCallback(() => {
    const nextUrl = profileSelected ?? postAvatarUrl;
    if (!nextUrl) {
      setProfileError("Select a profile picture.");
      return;
    }
    setPostAvatarUrl(nextUrl);
    setProfileModalOpen(false);
  }, [postAvatarUrl, profileSelected]);

  const applySampleData = useCallback(() => {
    setPostUsername("mango-librarian");
    setPostAvatarUrl(DEFAULT_REDDIT_PFPS[0] ?? "");
    setPostLikes("99+");
    setPostComments("99+");
    setPostTitle("My neighbor keeps stealing our packages: what’s a cheap deterrent?");
    setPostDarkMode(false);
    setPostShowIntroCard(true);
    setScript(
      "We’ve had 6 packages disappear in the last month, always within an hour of delivery.\n\nI put a cheap door camera up and it’s the same guy every time — walks up like he lives here, grabs it, and leaves.\n\nI don’t want to do anything dangerous or illegal, but I’d love something that actually works on a tight budget (like $30–$60).\n\nWhat’s the best deterrent you’ve used? Lock box? “Deliver to back door” sign? Decoy package? Anything that made the thefts stop?"
    );
  }, []);

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
              <path d="M3 12h18" />
              <path d="M12 3v18" />
            </svg>
          </div>
          <div className="flex flex-col">
            <h1 className="text-base font-medium text-[#f7f7f8] md:text-lg">
              Reddit Video
            </h1>
            <p className="text-xs text-[#898a8b] md:text-sm">{stepLabel}</p>
          </div>
        </div>
      </header>

      <div className="flex w-full flex-1 flex-col overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e]">
        <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.08)] px-3 py-3 md:px-4">
          <div className="flex items-center gap-3 overflow-x-auto">
            {[
              { id: 1, label: "Script" },
              { id: 2, label: "Style" },
              { id: 3, label: "Video" },
              { id: 4, label: "Audio" },
            ].map((entry, index) => {
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
                  {index < 3 && (
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
            {step < 4 ? (
              <Button
                onClick={handleNext}
                disabled={
                  step === 1
                    ? !canContinueFromScript
                    : step === 2
                      ? !canContinueFromStyle
                      : !canContinueFromVideo
                }
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
            <div className="flex h-full flex-col gap-4 md:flex-row md:gap-6">
              <div className="flex w-full flex-col space-y-3 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] p-3 md:h-full md:space-y-4 md:p-4">
                <div className="flex flex-col justify-between gap-2 md:flex-row md:items-center">
                  <h2 className="text-base font-medium text-[#f7f7f8] md:text-lg">
                    Generate Reddit Video
                  </h2>
                  <div className="flex flex-row items-center gap-2">
                    <button
                      type="button"
                      onClick={applySampleData}
                      className="flex w-40 items-center justify-center rounded-lg border border-[rgba(255,255,255,0.08)] px-3 py-2 text-[#f7f7f8] transition hover:bg-[rgba(255,255,255,0.05)]"
                    >
                      Sample Data
                    </button>
                    <button
                      type="button"
                      onClick={() => setScriptModalOpen(true)}
                      className={cn(
                        "flex h-10 items-center justify-center rounded-lg px-3.5 text-sm text-black transition hover:opacity-90",
                        "outline outline-1 outline-[#9aed00] outline-offset-[-1px]",
                        "filter drop-shadow-[0_1px_1px_rgba(14,_18,_27,_0.24)]",
                        "[background:linear-gradient(180deg,_rgba(255,_255,_255,_0.37),_rgba(255,_255,_255,_0)),_#9aed00]"
                      )}
                    >
                      AI script
                    </button>
                  </div>
                </div>

                <div className="flex w-full flex-col space-y-4 md:space-y-6">
                  <div className="flex w-full flex-col items-start space-y-2">
                    <div className="flex w-full flex-col items-start space-y-2 sm:flex-row sm:space-x-2 sm:space-y-0">
                      <div className="flex w-full flex-row items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            setProfileModalOpen(true);
                            setProfileSelected(postAvatarUrl);
                            setProfileError(null);
                          }}
                          className="flex h-10 w-full items-center justify-center rounded-md border border-[rgba(255,255,255,0.08)] px-3 py-2 text-sm text-[#f7f7f8] transition hover:bg-[rgba(255,255,255,0.05)] sm:w-48"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="mr-2 h-3 w-3"
                            aria-hidden="true"
                          >
                            <path d="M12 3v12" />
                            <path d="m17 8-5-5-5 5" />
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          </svg>
                          Swap PFP
                        </button>
                        <input
                          className="h-10 w-full rounded-md border border-[rgba(255,255,255,0.08)] bg-[#0e1012] px-3 py-2 text-sm text-[#f7f7f8] focus:border-[#9aed00]/30 focus:outline-none focus:ring-[#9aed00]/20"
                          placeholder="Name"
                          value={postUsername}
                          onChange={(e) => setPostUsername(e.target.value)}
                        />
                      </div>
                      <div className="flex w-full flex-row items-center space-x-2 sm:w-fit">
                        <input
                          className="h-10 w-full rounded-md border border-[rgba(255,255,255,0.08)] bg-[#0e1012] px-3 py-2 text-sm text-center text-[#f7f7f8] focus:border-[#9aed00]/30 focus:outline-none focus:ring-[#9aed00]/20 sm:w-16"
                          placeholder="99"
                          maxLength={6}
                          value={postLikes}
                          onChange={(e) => setPostLikes(e.target.value)}
                        />
                        <input
                          className="h-10 w-full rounded-md border border-[rgba(255,255,255,0.08)] bg-[#0e1012] px-3 py-2 text-sm text-center text-[#f7f7f8] focus:border-[#9aed00]/30 focus:outline-none focus:ring-[#9aed00]/20 sm:w-16"
                          placeholder="99"
                          maxLength={6}
                          value={postComments}
                          onChange={(e) => setPostComments(e.target.value)}
                        />
                      </div>
                    </div>

                    <textarea
                      className="min-h-[60px] w-full rounded-md border border-[rgba(255,255,255,0.08)] bg-transparent px-3 py-2 text-sm text-[#f7f7f8] shadow-sm focus:border-[#9aed00]/30 focus:outline-none focus:ring-[#9aed00]/20"
                      placeholder="Post title"
                      value={postTitle}
                      onChange={(e) => setPostTitle(e.target.value)}
                    />

                    <div className="flex w-full flex-col items-center space-y-2 sm:flex-row sm:space-x-2 sm:space-y-0">
                      <button
                        type="button"
                        onClick={() => setPostDarkMode((prev) => !prev)}
                        className={cn(
                          "w-full rounded-lg border border-[rgba(255,255,255,0.08)] p-2 focus:outline-none",
                          postDarkMode ? "bg-black text-white" : "bg-[#1a1c1e] text-[#f7f7f8]"
                        )}
                      >
                        {postDarkMode ? "Light Mode" : "Dark Mode"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPostShowIntroCard((prev) => !prev)}
                        className={cn(
                          "w-full rounded-lg border border-[rgba(255,255,255,0.08)] p-2 focus:outline-none",
                          postDarkMode ? "bg-black text-white" : "bg-[#1a1c1e] text-[#f7f7f8]"
                        )}
                      >
                        {postShowIntroCard
                          ? "Show Intro Card ✅"
                          : "Will not show intro card ❌"}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[#898a8b]">
                      Video Script
                    </label>
                    <textarea
                      className="min-h-[300px] w-full rounded-md border border-[rgba(255,255,255,0.08)] bg-transparent px-3 py-4 text-sm text-[#f7f7f8] shadow-sm focus:border-[#9aed00]/30 focus:outline-none focus:ring-[#9aed00]/20"
                      placeholder="Enter video script content..."
                      value={script}
                      onChange={(e) => setScript(e.target.value)}
                    />
                    {!canContinueFromScript ? (
                      <p className="text-xs text-[#e72930]">
                        Add a title, profile picture, and a script to continue.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="h-fit w-full space-y-3 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] p-3 md:h-full md:w-3/4 md:overflow-hidden md:p-4">
                <div className="flex flex-col space-y-1.5">
                  <h3 className="text-lg font-medium text-[#f7f7f8]">Intro Preview</h3>
                  <div className="max-w-lg">
                    <RedditIntroCard
                      avatarUrl={postAvatarUrl || DEFAULT_REDDIT_PFPS[0] || ""}
                      username={postUsername.trim() || "reddit-user"}
                      title={postTitle || "Your title..."}
                      likes={postLikes || "0"}
                      comments={postComments || "0"}
                      darkMode={postDarkMode}
                    />
                    {!postShowIntroCard ? (
                      <p className="mt-2 text-xs text-[#898a8b]">
                        Intro card disabled — your video will start directly with the voiceover.
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex h-full flex-col space-y-1.5 pb-4">
                  <h3 className="text-lg font-medium text-[#f7f7f8]">Script Preview</h3>
                  <div className="min-h-40 flex-1 overflow-y-auto rounded-md border border-[rgba(255,255,255,0.08)] bg-[#0e1012] p-3">
                    <p className="whitespace-pre-wrap text-sm text-[#898a8b]">
                      {script || "Your script will appear here..."}
                    </p>
                  </div>
                </div>
              </div>

              {profileModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
                  <div className="grid h-[90svh] w-[95vw] max-w-4xl translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] shadow-lg sm:h-auto sm:max-h-[90vh] sm:w-full">
                    <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.08)] px-4 py-3 sm:px-6 sm:py-4">
                      <h2 className="text-lg font-medium leading-none tracking-tight text-[#f7f7f8]">
                        Choose Profile Picture
                      </h2>
                      <button
                        type="button"
                        onClick={() => setProfileModalOpen(false)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-[rgba(255,255,255,0.05)]"
                        aria-label="Close"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-4 w-4"
                          aria-hidden="true"
                        >
                          <path d="M18 6 6 18" />
                          <path d="m6 6 12 12" />
                        </svg>
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
                      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        <div className="space-y-3">
                          <h3 className="text-sm font-medium text-[#898a8b]">
                            Select from gallery
                          </h3>
                          <div className="grid grid-cols-3 gap-2 sm:gap-3">
                            {DEFAULT_REDDIT_PFPS.map((url) => {
                              const selected = profileSelected === url;
                              return (
                                <button
                                  key={url}
                                  type="button"
                                  onClick={() => setProfileSelected(url)}
                                  className={cn(
                                    "relative cursor-pointer overflow-hidden rounded-lg border-2 transition-all",
                                    selected
                                      ? "border-[#9aed00]"
                                      : "border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.15)]"
                                  )}
                                >
                                  <img
                                    src={url}
                                    alt="Reddit avatar"
                                    className="aspect-square w-full select-none object-cover"
                                    draggable={false}
                                  />
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="space-y-3 overflow-hidden">
                          <h3 className="text-sm font-medium text-[#898a8b]">
                            Upload custom image
                          </h3>
                          <div className="w-full">
                            <input
                              ref={pfpUploadRef}
                              accept="image/*,.png,.jpg,.jpeg,.webp,.gif"
                              type="file"
                              className="hidden"
                              onChange={handlePfpUploadChange}
                            />
                            <button
                              type="button"
                              onClick={triggerPfpUpload}
                              disabled={profileUploading}
                              className={cn(
                                "relative flex w-full cursor-pointer flex-col items-center justify-center space-y-4 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] py-8 transition-all duration-300 hover:border-[rgba(255,255,255,0.15)] hover:bg-[rgba(255,255,255,0.05)]",
                                profileUploading && "cursor-wait opacity-80"
                              )}
                            >
                              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[rgba(255,255,255,0.08)] bg-[#0e1012]">
                                <svg
                                  stroke="currentColor"
                                  fill="none"
                                  strokeWidth="2"
                                  viewBox="0 0 24 24"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  className="text-3xl text-[#898a8b]"
                                  height="1em"
                                  width="1em"
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
                                </svg>
                              </div>
                              <div className="space-y-2 text-center">
                                <p className="text-lg font-medium text-[#f7f7f8]">
                                  {profileUploading ? "Uploading..." : "Upload image"}
                                </p>
                                <p className="text-sm text-[#898a8b]">
                                  Drag and drop or click to browse
                                </p>
                                <p className="mx-auto px-6 text-xs text-[#898a8b] sm:px-0">
                                  .png, .jpg, .jpeg, .webp, .gif • Max 10 MB
                                </p>
                              </div>
                            </button>

                            {profileError ? (
                              <div className="mt-3 flex items-center space-x-2 rounded-lg border border-[rgba(231,41,48,0.2)] bg-[rgba(231,41,48,0.1)] p-3">
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="24"
                                  height="24"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  className="h-4 w-4 flex-shrink-0 text-[#e72930]"
                                  aria-hidden="true"
                                >
                                  <circle cx="12" cy="12" r="10" />
                                  <line x1="12" x2="12" y1="8" y2="12" />
                                  <line x1="12" x2="12.01" y1="16" y2="16" />
                                </svg>
                                <p className="text-sm text-[#e72930]">{profileError}</p>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col-reverse border-t border-[rgba(255,255,255,0.08)] px-4 py-3 sm:flex-row sm:justify-end sm:space-x-2 sm:px-6 sm:py-4">
                      <button
                        type="button"
                        onClick={handleProfileSelect}
                        className={cn(
                          "flex w-full items-center justify-center gap-2.5 rounded-lg py-3 text-black transition hover:opacity-90 sm:w-auto sm:px-4",
                          "[background:linear-gradient(180deg,_rgba(255,_255,_255,_0.16)_0%,_rgba(255,_255,_255,_0)_100%),_#9aed00]"
                        )}
                      >
                        Select Profile Picture
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <ScriptGeneratorModal
                open={scriptModalOpen}
                onClose={() => setScriptModalOpen(false)}
                titleHint={postTitle}
                onApply={(value) => setScript(value)}
              />
            </div>
          )}

          {step === 2 && (
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
              <div className="flex flex-col gap-2 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-lg font-medium text-[#f7f7f8]">
                      Select Subtitle Template
                    </h2>
                    <p className="text-sm text-[#898a8b]">
                      Pick a style that matches your channel.
                    </p>
                  </div>
                  <SubtitleModeToggle value={subtitleMode} onChange={setSubtitleMode} />
                </div>
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
                        selected
                          ? "ring-2 ring-[#9aed00] ring-offset-2 ring-offset-[#1c1e20]"
                          : "hover:opacity-95"
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
                            color: preset.settings.color ?? "#fff",
                            textShadow: preset.settings.shadowEnabled
                              ? `0 6px ${Math.max(8, preset.settings.shadowBlur ?? 12)}px rgba(0,0,0,0.55)`
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

          {step === 3 && (
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
              <input
                ref={gameplayUploadInputRef}
                type="file"
                accept="video/*,.mp4,.mov,.m4v,.webm"
                className="hidden"
                onChange={handleGameplayUploadInputChange}
              />
              <div className="flex items-start justify-between gap-3 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] p-4">
                <div className="flex flex-col gap-1">
                  <h2 className="text-lg font-medium text-[#f7f7f8] md:text-xl">
                    Select Background Video
                  </h2>
                  <p className="text-sm text-[#898a8b] md:text-base">
                    <span className="font-semibold">Tip:</span> You can replace the
                    background video after generation in the editor.
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

              {gameplayUploadError ? (
                <div className="rounded-xl border border-[rgba(231,41,48,0.2)] bg-[rgba(231,41,48,0.1)] p-4 text-sm text-[#e72930]">
                  {gameplayUploadError}
                </div>
              ) : null}

              {gameplayError ? (
                <div className="rounded-xl border border-[rgba(231,41,48,0.2)] bg-[rgba(231,41,48,0.1)] p-4 text-sm text-[#e72930]">
                  {gameplayError}
                </div>
              ) : null}

              {gameplayLoading && gameplayItems.length === 0 ? (
                <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] p-6 text-sm text-[#898a8b]">
                  Loading gameplay footage...
                </div>
              ) : null}

              {!gameplayLoading && gameplayItems.length === 0 ? (
                <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] p-6 text-sm text-[#898a8b]">
                  No gameplay footage yet. Upload your own clip to continue, or wait
                  for the <code className="rounded bg-[#252729] px-1">gameplay-footage</code>{" "}
                  bucket to finish syncing.
                </div>
              ) : null}

              {gameplayVisibleItems.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {gameplayVisibleItems.map((item, index) => {
                    const selected = gameplaySelected?.path === item.path;
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
                          selected
                            ? "border-[#9aed00] shadow-lg shadow-[#9aed00]/10"
                            : "border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.15)]"
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
                        <div
                          className={cn(
                            "absolute left-3 top-3 z-30 h-5 w-5 rounded-full border",
                            selected ? "border-[#9aed00] bg-[#9aed00]" : "hidden border-[rgba(255,255,255,0.08)]"
                          )}
                        >
                          {selected ? (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-full w-full text-black"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          ) : null}
                        </div>
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
              ) : null}

              {gameplayPreviewPendingCount > 0 ? (
                <p className="text-xs text-[#898a8b]">
                  Loading {gameplayPreviewPendingCount} more preview
                  {gameplayPreviewPendingCount === 1 ? "" : "s"}...
                </p>
              ) : null}

              {gameplayLoadingMore && gameplayVisibleItems.length > 0 ? (
                <p className="text-xs text-[#898a8b]">Loading more gameplay videos...</p>
              ) : null}

              {gameplayVisibleItems.length > 0 && hasMoreGameplayToReveal ? (
                <div
                  ref={gameplayLoadMoreRef}
                  className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] px-4 py-3 text-center text-xs text-[#898a8b]"
                >
                  Scroll to load more gameplay videos...
                </div>
              ) : null}
            </div>
          )}

          {step === 4 && (
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 md:flex-row">
              <div className="flex w-full flex-col gap-4 md:w-1/2">
                <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-medium text-[#f7f7f8]">
                        Voice Settings
                      </h2>
                      <p className="text-sm text-[#898a8b]">
                        Use your existing editor voices here.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-3">
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium text-[#898a8b]">
                        Search voices
                      </label>
                      <input
                        value={voiceSearch}
                        onChange={(e) => setVoiceSearch(e.target.value)}
                        placeholder="Search name..."
                        className="h-10 w-full rounded-md border border-[rgba(255,255,255,0.08)] bg-[#0e1012] px-3 text-sm text-[#f7f7f8] outline-none focus:border-[#9aed00]/30 focus:ring-[#9aed00]/20"
                      />
                    </div>

                    {voiceError ? (
                      <div className="rounded-lg border border-[rgba(231,41,48,0.2)] bg-[rgba(231,41,48,0.1)] p-3 text-sm text-[#e72930]">
                        {voiceError}
                      </div>
                    ) : null}

                    {voiceLoading ? (
                      <div className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0e1012] p-3 text-sm text-[#898a8b]">
                        Loading voices...
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="rounded-lg border border-[rgba(255,255,255,0.08)] p-3">
                          <p className="text-sm font-medium text-[#f7f7f8]">
                            Pick voices
                          </p>
                          <div className="mt-2 grid grid-cols-1 gap-2">
                            <button
                              type="button"
                              onClick={() => setVoiceSelectTarget("script")}
                              className={cn(
                                "flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm",
                                voiceSelectTarget === "script"
                                  ? "border-[#9aed00] bg-[rgba(154,237,0,0.1)] text-[#9aed00]"
                                  : "border-[rgba(255,255,255,0.08)] text-[#f7f7f8] hover:bg-[rgba(255,255,255,0.05)]"
                              )}
                            >
                              <span className="font-medium">
                                Script voice (required)
                              </span>
                              <span className="ml-3 truncate text-xs font-medium">
                                {scriptVoice ?? "Select…"}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setVoiceSelectTarget("intro")}
                              className={cn(
                                "flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm",
                                voiceSelectTarget === "intro"
                                  ? "border-[#9aed00] bg-[rgba(154,237,0,0.1)] text-[#9aed00]"
                                  : "border-[rgba(255,255,255,0.08)] text-[#f7f7f8] hover:bg-[rgba(255,255,255,0.05)]"
                              )}
                            >
                              <span className="font-medium">
                                Intro voice (optional)
                              </span>
                              <span className="ml-3 truncate text-xs font-medium">
                                {introVoice ?? "None"}
                              </span>
                            </button>
                          </div>
                          {!scriptVoice ? (
                            <p className="mt-2 text-xs text-[#e72930]">
                              Select a script voice to continue.
                            </p>
                          ) : null}
                        </div>

                        <div className="rounded-lg border border-[rgba(255,255,255,0.08)] p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-[#f7f7f8]">
                                {voiceSelectTarget === "script"
                                  ? "Choose script voice"
                                  : "Choose intro voice"}
                              </p>
                              <p className="mt-1 text-xs text-[#898a8b]">
                                {voiceSelectTarget === "script"
                                  ? "This voice reads your full script."
                                  : "Optional hook voice for the title card."}
                              </p>
                            </div>
                            {voiceSelectTarget === "intro" ? (
                              <button
                                type="button"
                                onClick={() => setIntroVoice(null)}
                                className={cn(
                                  "rounded-full border px-3 py-1 text-xs font-medium",
                                  !introVoice
                                    ? "border-[#9aed00] bg-[rgba(154,237,0,0.1)] text-[#9aed00]"
                                    : "border-[rgba(255,255,255,0.08)] text-[#898a8b] hover:bg-[rgba(255,255,255,0.05)]"
                                )}
                              >
                                None
                              </button>
                            ) : null}
                          </div>

                          <div className="mt-3 overflow-hidden rounded-md border border-[rgba(255,255,255,0.08)]">
                            <div className="max-h-72 overflow-auto divide-y divide-[rgba(255,255,255,0.08)]">
                              {filteredVoices.slice(0, 30).map((voice) => {
                                const selected =
                                  voiceSelectTarget === "script"
                                    ? scriptVoice === voice.name
                                    : introVoice === voice.name;
                                return (
                                  <div
                                    key={voice.id}
                                    role="button"
                                    tabIndex={0}
                                    className={cn(
                                      "flex items-center justify-between gap-3 px-3 py-2 transition",
                                      selected
                                        ? "bg-[rgba(154,237,0,0.1)]"
                                        : "bg-[#1a1c1e] hover:bg-[rgba(255,255,255,0.05)]"
                                    )}
                                    onClick={() => {
                                      if (voiceSelectTarget === "script") {
                                        setScriptVoice(voice.name);
                                      } else {
                                        setIntroVoice(voice.name);
                                      }
                                    }}
                                    onKeyDown={(event) => {
                                      if (event.key === "Enter" || event.key === " ") {
                                        event.preventDefault();
                                        if (voiceSelectTarget === "script") {
                                          setScriptVoice(voice.name);
                                        } else {
                                          setIntroVoice(voice.name);
                                        }
                                      }
                                    }}
                                  >
                                    <div className="min-w-0">
                                      <p
                                        className={cn(
                                          "truncate text-sm font-medium",
                                          selected
                                            ? "text-[#9aed00]"
                                            : "text-[#f7f7f8]"
                                        )}
                                      >
                                        {voice.name}
                                      </p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        playPreview(voice);
                                      }}
                                      className="ml-3 inline-flex items-center justify-center rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-1 text-xs font-medium text-[#898a8b] hover:bg-[rgba(255,255,255,0.05)]"
                                    >
                                      {previewTrackId === voice.id && isPreviewPlaying
                                        ? "Stop"
                                        : "Play"}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {filteredVoices.length > 30 ? (
                            <p className="mt-2 text-xs text-[#898a8b]">
                              Showing the first 30 voices. Search to narrow the list.
                            </p>
                          ) : null}
                          {filteredVoices.length === 0 ? (
                            <p className="mt-2 text-xs text-[#898a8b]">
                              No voices match your search.
                            </p>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex w-full flex-col gap-4 md:w-1/2">
                <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] p-4">
                  <h2 className="text-lg font-medium text-[#f7f7f8]">
                    Background Music (optional)
                  </h2>

                  <div className="mt-4 space-y-3">
                    {musicError ? (
                      <div className="rounded-lg border border-[rgba(231,41,48,0.2)] bg-[rgba(231,41,48,0.1)] p-3 text-sm text-[#e72930]">
                        {musicError}
                      </div>
                    ) : null}

                    {musicLoading ? (
                      <div className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0e1012] p-3 text-sm text-[#898a8b]">
                        Loading background music...
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedMusic(null)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelectedMusic(null);
                            }
                          }}
                          className={cn(
                            "flex w-full cursor-pointer items-start justify-between rounded-lg border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-[#9aed00]/30",
                            !selectedMusic
                              ? "border-[#9aed00] bg-[rgba(154,237,0,0.1)]"
                              : "border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.05)]"
                          )}
                        >
                          <div>
                            <p className="text-sm font-medium text-[#f7f7f8]">
                              No background music
                            </p>
                            <p className="text-xs text-[#898a8b]">
                              You can add your own music later in the editor.
                            </p>
                          </div>
                        </div>

                        {musicTracks.slice(0, 12).map((track) => {
                          const active = selectedMusic?.id === track.id;
                          const selectTrack = () => setSelectedMusic(track);
                          return (
                            <div
                              key={track.id}
                              role="button"
                              tabIndex={0}
                              onClick={selectTrack}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  selectTrack();
                                }
                              }}
                              className={cn(
                                "flex w-full cursor-pointer items-start justify-between rounded-lg border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-[#9aed00]/30",
                                active
                                  ? "border-[#9aed00] bg-[rgba(154,237,0,0.1)]"
                                  : "border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.05)]"
                              )}
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-[#f7f7f8]">
                                  {track.name}
                                </p>
                                <p className="truncate text-xs text-[#898a8b]">
                                {track.path}
                              </p>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  playPreview(track);
                                }}
                                className="ml-3 inline-flex items-center justify-center rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-1 text-xs font-medium text-[#898a8b] hover:bg-[rgba(255,255,255,0.05)]"
                              >
                                {previewTrackId === track.id && isPreviewPlaying
                                  ? "Stop"
                                  : "Play"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="rounded-lg border border-[rgba(255,255,255,0.08)] p-3">
                      <label className="text-sm font-medium text-[#f7f7f8]">
                        Music volume
                      </label>
                      <div className="mt-2 flex items-center gap-3">
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={musicVolume}
                          onChange={(e) => setMusicVolume(Number(e.target.value))}
                          className="w-full"
                        />
                        <span className="w-12 text-right text-sm text-[#898a8b]">
                          {musicVolume}%
                        </span>
                      </div>
                    </div>
	                  </div>
	                </div>
	              </div>
	            </div>
	          )}
	        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] px-3 py-3 md:hidden">
          <Button variant="outline" onClick={handleBack} disabled={step === 1}>
            Back
          </Button>
          {step < 4 ? (
            <Button
              onClick={handleNext}
              disabled={
                step === 1
                  ? !canContinueFromScript
                  : step === 2
                    ? !canContinueFromStyle
                    : !canContinueFromVideo
              }
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
