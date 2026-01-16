"use client";

import { useEffect, useState } from "react";

import type { StockVideoItem } from "../page-helpers";

type StockVideoCardProps = {
  video: StockVideoItem;
  durationLabel: string;
  priority?: boolean;
  onAdd: (video: StockVideoItem) => void;
  onPreviewStart: (id: string) => void;
  onPreviewStop: (id: string) => void;
  onRequestMeta?: (video: StockVideoItem) => void;
  registerPreviewRef: (id: string) => (node: HTMLVideoElement | null) => void;
};

export const StockVideoCard = ({
  video,
  durationLabel,
  priority = false,
  onAdd,
  onPreviewStart,
  onPreviewStop,
  onRequestMeta,
  registerPreviewRef,
}: StockVideoCardProps) => {
  const [shouldLoad, setShouldLoad] = useState(false);
  const [hasFrame, setHasFrame] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (!isHovering || !shouldLoad) {
      return;
    }
    onPreviewStart(video.id);
    return () => onPreviewStop(video.id);
  }, [isHovering, onPreviewStart, onPreviewStop, shouldLoad, video.id]);

  const handleHoverStart = () => {
    setShouldLoad(true);
    setIsHovering(true);
    onRequestMeta?.(video);
  };

  const handleHoverEnd = () => {
    setIsHovering(false);
  };

  const showVideoPreview = isHovering && hasFrame;
  const hasPoster = Boolean(video.thumbnailUrl) && !imageError;

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="group relative h-24 w-full overflow-hidden rounded-2xl border border-gray-200"
        onClick={() => onAdd(video)}
        onMouseEnter={handleHoverStart}
        onMouseLeave={handleHoverEnd}
        onFocus={handleHoverStart}
        onBlur={handleHoverEnd}
        aria-label={`Add ${video.name}`}
      >
        {hasPoster ? (
          <img
            src={video.thumbnailUrl ?? undefined}
            alt={video.name}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${
              showVideoPreview ? "opacity-0" : "opacity-100"
            }`}
            onError={() => setImageError(true)}
          />
        ) : (
          <div
            className={`absolute inset-0 flex h-full w-full items-center justify-center bg-gray-100 text-gray-400 transition-opacity duration-200 ${
              showVideoPreview ? "opacity-0" : "opacity-100"
            }`}
          >
            <svg viewBox="0 0 16 16" className="h-5 w-5" aria-hidden="true">
              <path
                d="M3 2.5h10a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Zm0 2.2v6.6a.6.6 0 0 0 .6.6h8.8a.6.6 0 0 0 .6-.6V4.7a.6.6 0 0 0-.6-.6H3.6a.6.6 0 0 0-.6.6Zm3.1 1.2 4.8 2.6-4.8 2.6V5.9Z"
                fill="currentColor"
              />
            </svg>
          </div>
        )}
        <video
          ref={registerPreviewRef(video.id)}
          src={shouldLoad ? video.url : undefined}
          poster={video.thumbnailUrl ?? undefined}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${
            showVideoPreview ? "opacity-100" : "opacity-0"
          }`}
          muted
          loop
          playsInline
          preload={shouldLoad ? "metadata" : "none"}
          onLoadedMetadata={(event) => {
            if (!shouldLoad) {
              return;
            }
            const target = event.currentTarget;
            if (!Number.isFinite(target.duration)) {
              return;
            }
            try {
              target.currentTime = Math.min(0.05, target.duration || 0);
            } catch (error) {}
          }}
          onLoadedData={() => setHasFrame(true)}
        />
        {hasFrame && (
          <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
            {durationLabel}
          </span>
        )}
      </button>
    </div>
  );
};

