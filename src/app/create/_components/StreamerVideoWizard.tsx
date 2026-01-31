"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  uploadAssetFile,
  type AssetLibraryItem,
} from "@/lib/assets/library";
import { cn } from "@/lib/utils";
import {
  type StreamerVideoImportPayloadV1,
} from "@/lib/editor/imports";
import { subtitleStylePresets } from "@/app/editor/advanced/data";

type WizardStep = 1 | 2;

type SelectedVideo = {
  url: string;
  name: string;
  assetId?: string | null;
};

const isYouTubeUrl = (value: string) => {
  const lower = value.toLowerCase();
  return lower.includes("youtube.com/") || lower.includes("youtu.be/");
};

const isTikTokUrl = (value: string) => value.toLowerCase().includes("tiktok.com/");

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
          value === "one-word" ? "text-gray-900" : "text-gray-500"
        )}
      >
        One Word
      </span>
      <button
        type="button"
        aria-label="Toggle subtitle mode"
        className={cn(
          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
          value === "lines" ? "bg-[#335CFF]" : "bg-gray-200"
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
      <span
        className={cn(
          "text-sm font-medium",
          value === "lines" ? "text-gray-900" : "text-gray-500"
        )}
      >
        Lines
      </span>
    </div>
  );
};

export default function StreamerVideoWizard() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [step, setStep] = useState<WizardStep>(1);

  const [inputMode, setInputMode] = useState<"upload" | "link">("upload");
  const [sourceVideo, setSourceVideo] = useState<SelectedVideo | null>(null);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [sourceBusy, setSourceBusy] = useState(false);
  const [sourceLink, setSourceLink] = useState("");

  const [titleText, setTitleText] = useState("");

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
      return subtitleStylePresets.filter((preset) =>
        Boolean((preset as any)?.settings?.wordHighlightEnabled)
      );
    }
    return subtitleStylePresets.filter(
      (preset) => !Boolean((preset as any)?.settings?.wordHighlightEnabled)
    );
  }, [subtitleMode]);

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

  const canContinueToDetails = Boolean(sourceVideo);
  const canGenerate = Boolean(
    sourceVideo && subtitleStyleId && titleText.trim().length > 0
  );

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

  const handleDownloadFromLink = useCallback(async () => {
    const url = sourceLink.trim();
    if (!url) {
      setSourceError("Paste a YouTube or TikTok link.");
      return;
    }
    const provider = isTikTokUrl(url)
      ? "tiktok"
      : isYouTubeUrl(url)
        ? "youtube"
        : null;
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
      const assetId = typeof data?.assetId === "string" ? data.assetId.trim() : "";
      const name =
        typeof data?.title === "string" && data.title.trim().length > 0
          ? data.title.trim()
          : "Downloaded video";
      if (!assetUrl || !assetId) {
        throw new Error(
          "Download completed but saving to your library failed. Please try again."
        );
      }
      setSourceVideo({
        url: assetUrl,
        assetId,
        name,
      });
      setSourceError(null);
    } catch (error) {
      setSourceError(error instanceof Error ? error.message : "Download failed.");
    } finally {
      setSourceBusy(false);
    }
  }, [sourceLink]);

  const handleNext = useCallback(() => {
    if (step === 1 && !canContinueToDetails) return;
    setStep(2);
  }, [canContinueToDetails, step]);

  const handleBack = useCallback(() => {
    setStep(1);
  }, []);

  const handleGenerate = useCallback(() => {
    if (!sourceVideo || !subtitleStyleId || titleText.trim().length === 0) {
      return;
    }
    if (!sourceVideo.assetId) {
      setSourceError("Please upload or download a video first.");
      setStep(1);
      return;
    }
    const payload: StreamerVideoImportPayloadV1 = {
      version: 1,
      mainVideo: {
        url: sourceVideo.url,
        name: sourceVideo.name,
        assetId: sourceVideo.assetId ?? null,
      },
      titleText: titleText.trim(),
      subtitles: {
        autoGenerate: autoGenerateSubtitles,
        styleId: subtitleStyleId,
      },
    };

    const params = new URLSearchParams();
    params.set("import", "streamer-video");
    params.set("ts", String(Date.now()));
    params.set("assetId", sourceVideo.assetId);
    params.set("assetName", sourceVideo.name);
    params.set("titleText", payload.titleText);
    if (payload.subtitles.styleId) {
      params.set("subtitleStyleId", payload.subtitles.styleId);
    }
    params.set("autoSubtitles", payload.subtitles.autoGenerate ? "1" : "0");

    router.push(`/editor/advanced?${params.toString()}`);
  }, [autoGenerateSubtitles, router, sourceVideo, subtitleStyleId, titleText]);

  const stepLabel = useMemo(() => {
    if (step === 1) return "Upload Video";
    return "Title + Subtitles";
  }, [step]);

  return (
    <div className="mx-auto flex h-[100dvh] w-full max-w-[1920px] flex-col space-y-4 p-2 md:p-4">
      <header className="sticky top-0 z-40 flex items-center justify-between rounded-xl border border-gray-200 bg-white/70 px-3 py-3 backdrop-blur md:px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-5 w-5 text-gray-900"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7z" />
              <path d="M9 9h6" />
              <path d="M9 13h6" />
            </svg>
          </div>
          <div className="flex flex-col">
            <h1 className="text-base font-medium text-black md:text-lg">
              Streamer Video
            </h1>
            <p className="text-xs text-gray-500 md:text-sm">{stepLabel}</p>
          </div>
        </div>
      </header>

      <div className="flex w-full flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 px-3 py-3 md:px-4">
          <div className="flex items-center gap-3 overflow-x-auto">
            {[
              { id: 1, label: "Upload" },
              { id: 2, label: "Title" },
            ].map((entry) => {
              const isActive = step === (entry.id as WizardStep);
              const isDone = step > (entry.id as WizardStep);
              return (
                <div
                  key={entry.id}
                  className="flex items-center gap-2 whitespace-nowrap"
                >
                  <div
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full text-xs",
                      isActive || isDone
                        ? "bg-[#335CFF] text-white"
                        : "border border-gray-200 bg-white text-gray-500"
                    )}
                  >
                    {entry.id}
                  </div>
                  <p
                    className={cn(
                      "text-sm",
                      isActive ? "text-gray-950" : "text-gray-500"
                    )}
                  >
                    {entry.label}
                  </p>
                  {entry.id !== 2 && (
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 320 512"
                      className="h-3.5 w-3.5 text-gray-400"
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
            {step < 2 ? (
              <Button onClick={handleNext} disabled={!canContinueToDetails}>
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
              <Button onClick={handleGenerate} disabled={!canGenerate}>
                Generate
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

        <div className="flex-1 overflow-y-auto bg-[#F7F7F7] p-3 md:p-6">
          {step === 1 && (
            <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-medium text-gray-950">
                      Upload your video
                    </h2>
                    <p className="text-sm text-gray-500">
                      Upload a clip, or download from YouTube/TikTok.
                    </p>
                  </div>
                  <div className="flex rounded-lg bg-gray-100 p-1">
                    <button
                      type="button"
                      className={cn(
                        "rounded-md px-3 py-1.5 text-sm font-medium",
                        inputMode === "upload"
                          ? "bg-white text-gray-950 shadow-sm"
                          : "text-gray-600"
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
                          ? "bg-white text-gray-950 shadow-sm"
                          : "text-gray-600"
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
                        "flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center transition",
                        sourceBusy ? "opacity-60" : "hover:border-gray-400"
                      )}
                    >
                      <p className="text-base text-gray-700">
                        Choose a clip or drag & drop it here.
                      </p>
                      <p className="mt-1 text-sm text-gray-400">
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
                    <label className="text-sm text-gray-500">
                      Add YouTube or TikTok link
                    </label>
                    <div className="flex gap-2">
                      <input
                        value={sourceLink}
                        onChange={(e) => setSourceLink(e.target.value)}
                        placeholder="https://youtube.com/watch?v=..."
                        className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm focus:border-[#335CFF] focus:outline-none"
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
                  <p className="mt-3 text-sm text-red-600">{sourceError}</p>
                )}
              </div>

              {sourceVideo && (
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-gray-500">Selected video</p>
                      <p className="truncate text-base font-medium text-gray-950">
                        {sourceVideo.name}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
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
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-medium text-gray-950">
                    Title + Subtitles
                  </h2>
                  <p className="text-sm text-gray-600">
                    We’ll build the blur background + title + subtitles timeline for you.
                  </p>
                </div>
                <SubtitleModeToggle value={subtitleMode} onChange={setSubtitleMode} />
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <label className="text-sm font-medium text-gray-950">
                  Title text
                </label>
                <input
                  value={titleText}
                  onChange={(e) => setTitleText(e.target.value)}
                  placeholder="ex: This streamer clip is unreal..."
                  className="mt-2 w-full rounded-md border border-gray-200 bg-white px-4 py-4 text-base focus:border-[#335CFF] focus:outline-none"
                />
                <p className="mt-2 text-sm text-gray-500">
                  Added as a text layer in the editor (you can resize/move it later).
                </p>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4">
                <div>
                  <p className="text-sm font-medium text-gray-950">
                    Auto-generate subtitles
                  </p>
                  <p className="text-sm text-gray-500">
                    Creates subtitles in the editor automatically after import.
                  </p>
                </div>
                <button
                  type="button"
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                    autoGenerateSubtitles ? "bg-[#335CFF]" : "bg-gray-200"
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
                        selected
                          ? "ring-2 ring-[#335CFF] ring-offset-2 ring-offset-[#F7F7F7]"
                          : "hover:opacity-95"
                      )}
                      onClick={() => setSubtitleStyleId(preset.id)}
                    >
                      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.14),_rgba(255,255,255,0)_55%)]" />
                      {selected && (
                        <div className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-[#335CFF] text-white">
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

        <div className="flex items-center justify-between gap-2 border-t border-gray-200 bg-white px-3 py-3 md:hidden">
          <Button variant="outline" onClick={handleBack} disabled={step === 1}>
            Back
          </Button>
          {step < 2 ? (
            <Button
              onClick={handleNext}
              disabled={!canContinueToDetails}
              className="flex-1"
            >
              Next
            </Button>
          ) : (
            <Button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="flex-1"
            >
              Generate video
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
