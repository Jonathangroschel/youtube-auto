"use client";

import { Gauge } from "@/components/gauge";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";

type TrustScoreShareExperienceMode = "reveal" | "share";

type TrustScoreShareExperienceProps = {
  open: boolean;
  score: number | null;
  channelTitle?: string | null;
  mode: TrustScoreShareExperienceMode;
  onClose: () => void;
};

type DrawCardOptions = {
  score: number;
  progress: number;
  pulse: number;
  channelTitle?: string | null;
  fontFamily: string;
  logoImage: HTMLImageElement | null;
};

const SHARE_CARD_WIDTH = 1080;
const SHARE_CARD_HEIGHT = 1350;

const buildCardSharePath = (score: number, channelTitle?: string | null) => {
  const params = new URLSearchParams({ score: String(score) });
  const safeChannelTitle = channelTitle?.trim();
  if (safeChannelTitle) {
    params.set("channel", safeChannelTitle);
  }
  return `/card-share?${params.toString()}`;
};

const roundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) => {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

const loadLogoImage = async (): Promise<HTMLImageElement | null> => {
  if (typeof window === "undefined") {
    return null;
  }

  return await new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = "/icon-2.svg";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
  });
};

const resolveCanvasFontFamily = () => {
  if (typeof window === "undefined") {
    return "Inter, system-ui, sans-serif";
  }

  const rawGeistFamily = getComputedStyle(document.documentElement)
    .getPropertyValue("--font-geist-sans")
    .trim()
    .replace(/["']/g, "");

  if (!rawGeistFamily) {
    return "Inter, system-ui, sans-serif";
  }

  return `"${rawGeistFamily}", Inter, system-ui, sans-serif`;
};

const truncateToWidth = (
  ctx: CanvasRenderingContext2D,
  value: string,
  maxWidth: number
) => {
  if (ctx.measureText(value).width <= maxWidth) {
    return value;
  }

  let text = value;
  while (text.length > 0 && ctx.measureText(`${text}…`).width > maxWidth) {
    text = text.slice(0, -1);
  }
  return text.length > 0 ? `${text}…` : "";
};

const drawShareCardFrame = (
  ctx: CanvasRenderingContext2D,
  { score, progress, pulse, channelTitle, fontFamily, logoImage }: DrawCardOptions
) => {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const font = (weight: number, size: number) => `${weight} ${size}px ${fontFamily}`;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#020306";
  ctx.fillRect(0, 0, width, height);

  const outerGlow = ctx.createRadialGradient(
    width / 2,
    height * 0.52,
    30,
    width / 2,
    height * 0.52,
    width * 0.44
  );
  outerGlow.addColorStop(0, "rgba(106, 71, 255, 0.22)");
  outerGlow.addColorStop(0.55, "rgba(56, 189, 248, 0.11)");
  outerGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = outerGlow;
  ctx.fillRect(0, 0, width, height);

  const cardWidth = width * 0.66;
  const cardHeight = cardWidth / 0.7692;
  const cardX = (width - cardWidth) / 2;
  const cardY = height * 0.12;
  const cardRadius = 54;

  roundedRect(ctx, cardX, cardY, cardWidth, cardHeight, cardRadius);
  ctx.save();
  ctx.clip();

  const cardBase = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardHeight);
  cardBase.addColorStop(0, "#000000");
  cardBase.addColorStop(1, "#000103");
  ctx.fillStyle = cardBase;
  ctx.fillRect(cardX, cardY, cardWidth, cardHeight);

  const leftGlow = ctx.createRadialGradient(
    cardX + cardWidth * 0.2,
    cardY + cardHeight * 0.95,
    40,
    cardX + cardWidth * 0.2,
    cardY + cardHeight * 0.95,
    cardWidth * 0.52
  );
  leftGlow.addColorStop(0, "rgba(56, 189, 248, 0.72)");
  leftGlow.addColorStop(1, "rgba(56, 189, 248, 0)");
  ctx.fillStyle = leftGlow;
  ctx.fillRect(cardX, cardY, cardWidth, cardHeight);

  const rightGlow = ctx.createRadialGradient(
    cardX + cardWidth * 0.78,
    cardY + cardHeight * 0.95,
    40,
    cardX + cardWidth * 0.78,
    cardY + cardHeight * 0.95,
    cardWidth * 0.58
  );
  rightGlow.addColorStop(0, `rgba(172, 92, 255, ${0.6 + pulse * 0.12})`);
  rightGlow.addColorStop(1, "rgba(172, 92, 255, 0)");
  ctx.fillStyle = rightGlow;
  ctx.fillRect(cardX, cardY, cardWidth, cardHeight);

  const glass = ctx.createLinearGradient(cardX, cardY, cardX + cardWidth, cardY + cardHeight);
  glass.addColorStop(0, "rgba(255,255,255,0.08)");
  glass.addColorStop(0.4, "rgba(255,255,255,0)");
  glass.addColorStop(1, "rgba(255,255,255,0.04)");
  ctx.fillStyle = glass;
  ctx.fillRect(cardX, cardY, cardWidth, cardHeight);

  ctx.restore();

  roundedRect(ctx, cardX, cardY, cardWidth, cardHeight, cardRadius);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.stroke();

  ctx.fillStyle = "rgba(247,247,248,0.66)";
  ctx.font = font(600, 30);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("TRUSTSCORE", cardX + cardWidth / 2, cardY + 145);

  if (channelTitle) {
    ctx.fillStyle = "rgba(247,247,248,0.52)";
    ctx.font = font(500, 38);
    ctx.fillText(
      truncateToWidth(ctx, channelTitle, cardWidth * 0.8),
      cardX + cardWidth / 2,
      cardY + 206
    );
  }

  const clampedProgress = Math.min(1, Math.max(0, progress));
  const easedProgress = 1 - Math.pow(1 - clampedProgress, 3);
  const animatedScore = Math.round(score * easedProgress);
  const gaugeX = cardX + cardWidth / 2;
  const gaugeY = cardY + cardHeight * 0.52;
  const gaugeRadius = cardWidth * 0.19;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineWidth = 18;
  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.beginPath();
  ctx.arc(gaugeX, gaugeY, gaugeRadius, 0, Math.PI * 2);
  ctx.stroke();

  const ringGradient = ctx.createLinearGradient(
    gaugeX - gaugeRadius,
    gaugeY + gaugeRadius,
    gaugeX + gaugeRadius,
    gaugeY - gaugeRadius
  );
  ringGradient.addColorStop(0, "#38bdf8");
  ringGradient.addColorStop(0.56, "#6a47ff");
  ringGradient.addColorStop(1, "#ac5cff");
  ctx.strokeStyle = ringGradient;
  ctx.shadowColor = "rgba(138, 92, 255, 0.7)";
  ctx.shadowBlur = 30 + pulse * 12;
  ctx.beginPath();
  ctx.arc(
    gaugeX,
    gaugeY,
    gaugeRadius,
    -Math.PI / 2,
    -Math.PI / 2 + Math.PI * 2 * (score / 100) * easedProgress
  );
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = "#f7f7f8";
  ctx.font = font(700, 138);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(animatedScore), gaugeX, gaugeY + 10);

  const footerY = cardY + cardHeight - 85;
  if (logoImage) {
    ctx.drawImage(logoImage, gaugeX - 158, footerY - 22, 34, 34);
  }
  ctx.fillStyle = "rgba(247,247,248,0.74)";
  ctx.font = font(600, 30);
  ctx.fillText("powered by satura", gaugeX + 30, footerY);

  const edgeGradient = ctx.createLinearGradient(cardX, cardY + cardHeight, cardX + cardWidth, cardY + cardHeight);
  edgeGradient.addColorStop(0, "rgba(255,255,255,0.04)");
  edgeGradient.addColorStop(0.5, "rgba(255,255,255,0.7)");
  edgeGradient.addColorStop(1, "rgba(255,255,255,0.04)");
  ctx.fillStyle = edgeGradient;
  ctx.fillRect(cardX, cardY + cardHeight - 2, cardWidth, 2);
};

const blobFromCanvas = (
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number
) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to export file."));
          return;
        }
        resolve(blob);
      },
      type,
      quality
    );
  });

const createShareImage = async (score: number, channelTitle?: string | null) => {
  const canvas = document.createElement("canvas");
  canvas.width = SHARE_CARD_WIDTH;
  canvas.height = SHARE_CARD_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas is unavailable in this browser.");
  }

  const logoImage = await loadLogoImage();
  drawShareCardFrame(context, {
    score,
    progress: 1,
    pulse: 0.7,
    channelTitle,
    fontFamily: resolveCanvasFontFamily(),
    logoImage,
  });
  return await blobFromCanvas(canvas, "image/png", 1);
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
};

const iconButtonClassName =
  "inline-flex h-11 w-full items-center justify-center rounded-xl border border-[var(--satura-white-10)] bg-[rgba(255,255,255,0.02)] text-sm font-semibold text-[var(--satura-font-primary)] transition-all hover:border-[rgba(255,255,255,0.2)] hover:bg-[rgba(255,255,255,0.05)] disabled:cursor-not-allowed disabled:opacity-40";

const actionButtonClassName =
  "inline-flex h-11 w-full items-center justify-center rounded-xl bg-[var(--satura-surface-secondary)] text-sm font-semibold text-[var(--satura-font-primary)] transition-all hover:bg-[var(--satura-surface-tertiary)] disabled:cursor-not-allowed disabled:opacity-40";

export function TrustScoreGradientCard({
  score,
  channelTitle,
}: {
  score: number;
  channelTitle?: string | null;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [rotation, setRotation] = useState({ x: 0, y: 0 });

  const handleMouseMove = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) {
      return;
    }
    const rect = cardRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;

    setRotation({
      x: -(y / rect.height) * 5,
      y: (x / rect.width) * 5,
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    setRotation({ x: 0, y: 0 });
  }, []);

  return (
    <motion.div
      ref={cardRef}
      className="relative h-[450px] w-[340px] overflow-hidden rounded-[32px] border border-[rgba(255,255,255,0.1)] bg-black sm:h-[468px] sm:w-[360px]"
      style={{
        transformStyle: "preserve-3d",
        boxShadow:
          "0 -10px 100px 10px rgba(78, 99, 255, 0.25), 0 0 10px 0 rgba(0, 0, 0, 0.5)",
      }}
      initial={{ y: 0 }}
      animate={{
        y: isHovered ? -5 : 0,
        rotateX: rotation.x,
        rotateY: rotation.y,
      }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 22,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
    >
      <motion.div
        className="pointer-events-none absolute inset-0 z-[35]"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 40%, rgba(255,255,255,0) 80%, rgba(255,255,255,0.05) 100%)",
          backdropFilter: "blur(2px)",
        }}
        animate={{
          opacity: isHovered ? 0.7 : 0.5,
          rotateX: -rotation.x * 0.2,
          rotateY: -rotation.y * 0.2,
        }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      />

      <motion.div
        className="absolute inset-0 z-0"
        style={{
          background: "linear-gradient(180deg, #000000 0%, #000000 70%)",
        }}
      />

      <motion.div
        className="absolute inset-0 z-10 opacity-30 mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='5' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
        }}
      />

      <motion.div
        className="pointer-events-none absolute inset-0 z-[11] opacity-10 mix-blend-soft-light"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='smudge'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.01' numOctaves='3' seed='5' stitchTiles='stitch'/%3E%3CfeGaussianBlur stdDeviation='10'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23smudge)'/%3E%3C/svg%3E\")",
          backdropFilter: "blur(1px)",
        }}
      />

      <motion.div
        className="absolute bottom-0 left-0 right-0 z-20 h-2/3"
        style={{
          background:
            "radial-gradient(ellipse at bottom right, rgba(172, 92, 255, 0.7) -10%, rgba(79, 70, 229, 0) 70%),radial-gradient(ellipse at bottom left, rgba(56, 189, 248, 0.7) -10%, rgba(79, 70, 229, 0) 70%)",
          filter: "blur(40px)",
        }}
        animate={{
          opacity: isHovered ? 0.9 : 0.8,
          y: isHovered ? rotation.x * 0.5 : 0,
        }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      />

      <motion.div
        className="absolute bottom-0 left-0 right-0 z-[21] h-2/3"
        style={{
          background:
            "radial-gradient(circle at bottom center, rgba(161, 58, 229, 0.7) -20%, rgba(79, 70, 229, 0) 60%)",
          filter: "blur(45px)",
        }}
        animate={{
          opacity: isHovered ? 0.85 : 0.75,
          y: isHovered ? `calc(10% + ${rotation.x * 0.3}px)` : "10%",
        }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      />

      <motion.div
        className="absolute bottom-0 left-0 right-0 z-[25] h-[2px]"
        style={{
          background:
            "linear-gradient(90deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.7) 50%, rgba(255, 255, 255, 0.05) 100%)",
        }}
        animate={{
          boxShadow: isHovered
            ? "0 0 20px 4px rgba(172, 92, 255, 0.9), 0 0 30px 6px rgba(138, 58, 185, 0.7), 0 0 40px 8px rgba(56, 189, 248, 0.5)"
            : "0 0 15px 3px rgba(172, 92, 255, 0.8), 0 0 25px 5px rgba(138, 58, 185, 0.6), 0 0 35px 7px rgba(56, 189, 248, 0.4)",
          opacity: isHovered ? 1 : 0.9,
        }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      />

      <motion.div className="relative z-40 flex h-full flex-col p-8">
        <motion.div
          className="mb-auto"
          animate={{
            rotateX: isHovered ? -rotation.x * 0.3 : 0,
            rotateY: isHovered ? -rotation.y * 0.3 : 0,
          }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <motion.h3
            className="pt-10 text-center text-[11px] font-semibold uppercase tracking-[0.24em] text-white/66"
            initial={{ filter: "blur(3px)", opacity: 0.7 }}
            animate={{
              filter: "blur(0px)",
              opacity: 1,
              transition: { duration: 1.2, delay: 0.2 },
            }}
          >
            TRUSTSCORE
          </motion.h3>
          {channelTitle ? (
            <motion.p
              className="mt-3 truncate text-center text-sm text-white/50"
              initial={{ filter: "blur(3px)", opacity: 0.7 }}
              animate={{
                filter: "blur(0px)",
                opacity: 0.9,
                transition: { duration: 1.2, delay: 0.3 },
              }}
            >
              {channelTitle}
            </motion.p>
          ) : null}

          <div className="mt-9 flex justify-center">
            <Gauge
              value={score}
              size={196}
              strokeWidth={10}
              showValue
              showPercentage={false}
              gradient
              glowEffect
              primary="#ac5cff"
              secondary="rgba(255,255,255,0.14)"
            />
          </div>
        </motion.div>

        <motion.div
          className="flex items-center justify-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/72"
          initial={{ filter: "blur(3px)", opacity: 0.7 }}
          animate={{
            filter: "blur(0px)",
            opacity: 1,
            transition: { duration: 1.2, delay: 0.4 },
          }}
        >
          <img src="/icon-2.svg" alt="Satura" className="h-4 w-4 object-contain" />
          <span>powered by satura</span>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

const PlatformIcon = ({ label }: { label: "x" | "instagram" | "discord" }) => {
  if (label === "x") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
        <path
          d="M18.901 1.153h3.68l-8.036 9.188L24 22.847h-7.406l-5.805-7.592-6.646 7.592H.46l8.596-9.827L0 1.153h7.594l5.248 6.932 6.059-6.932z"
        />
      </svg>
    );
  }

  if (label === "instagram") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none">
        <rect x="3.5" y="3.5" width="17" height="17" rx="5.5" stroke="currentColor" strokeWidth="2" />
        <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
        <circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path
        d="M20.317 4.369a19.695 19.695 0 0 0-4.885-1.516.074.074 0 0 0-.079.037 13.955 13.955 0 0 0-.608 1.249 18.24 18.24 0 0 0-5.487 0 13.84 13.84 0 0 0-.617-1.249.077.077 0 0 0-.079-.037 19.736 19.736 0 0 0-4.884 1.516.07.07 0 0 0-.032.028C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.19 14.19 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.099.246.196.373.292a.077.077 0 0 1-.007.128 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.04.106 15.299 15.299 0 0 0 1.225 1.994.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .03-.055c.5-5.177-.838-9.674-3.548-13.66a.061.061 0 0 0-.031-.03ZM8.02 15.332c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.418 2.157-2.418 1.21 0 2.176 1.094 2.157 2.418 0 1.334-.955 2.419-2.157 2.419Zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.418 2.157-2.418 1.21 0 2.176 1.094 2.157 2.418 0 1.334-.947 2.419-2.157 2.419Z"
      />
    </svg>
  );
};

export function TrustScoreShareExperience({
  open,
  score,
  channelTitle,
  mode,
  onClose,
}: TrustScoreShareExperienceProps) {
  const [busyAction, setBusyAction] = useState<"image" | "share" | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const copyResetTimeoutRef = useRef<number | null>(null);

  const safeScore = useMemo(() => {
    if (score === null) {
      return null;
    }
    return Math.max(0, Math.min(100, Math.round(score)));
  }, [score]);

  useEffect(() => {
    return () => {
      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current);
      }
    };
  }, []);

  const sharePath = useMemo(() => {
    if (safeScore === null) {
      return "/card-share";
    }
    return buildCardSharePath(safeScore, channelTitle);
  }, [channelTitle, safeScore]);

  const shareUrl =
    typeof window === "undefined"
      ? sharePath
      : `${window.location.origin}${sharePath}`;

  const shareCaption = useMemo(() => {
    if (safeScore === null) {
      return "";
    }
    return `trustscore: ${safeScore} — powered by satura`;
  }, [safeScore]);

  const copyShareText = useCallback(async () => {
    if (!navigator.clipboard?.writeText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(`${shareCaption}\n${shareUrl}`);
    } catch {
      // Clipboard failures should not block sharing.
    }
  }, [shareCaption, shareUrl]);

  const handleCopyShareLink = useCallback(async () => {
    if (!navigator.clipboard?.writeText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current);
      }
      copyResetTimeoutRef.current = window.setTimeout(() => {
        setLinkCopied(false);
      }, 1800);
    } catch {
      // Clipboard failures should not block sharing.
    }
  }, [shareUrl]);

  const handleDownloadImage = useCallback(async () => {
    if (safeScore === null || busyAction) {
      return;
    }

    setBusyAction("image");
    try {
      const imageBlob = await createShareImage(safeScore, channelTitle);
      downloadBlob(imageBlob, `satura-trustscore-${safeScore}.png`);
    } finally {
      setBusyAction(null);
    }
  }, [busyAction, channelTitle, safeScore]);

  const handleShareX = useCallback(() => {
    if (safeScore === null || busyAction) {
      return;
    }

    const intentUrl = new URL("https://x.com/intent/tweet");
    intentUrl.searchParams.set("text", shareCaption);
    intentUrl.searchParams.set("url", shareUrl);
    window.open(intentUrl.toString(), "_blank", "noopener,noreferrer");
  }, [busyAction, safeScore, shareCaption, shareUrl]);

  const handleShareInstagram = useCallback(async () => {
    if (safeScore === null || busyAction) {
      return;
    }

    setBusyAction("share");
    try {
      await copyShareText();
      window.open("https://www.instagram.com/create/story/", "_blank", "noopener,noreferrer");
    } finally {
      setBusyAction(null);
    }
  }, [busyAction, copyShareText, safeScore]);

  const handleShareDiscord = useCallback(async () => {
    if (safeScore === null || busyAction) {
      return;
    }

    setBusyAction("share");
    try {
      await copyShareText();
      window.open("https://discord.com/channels/@me", "_blank", "noopener,noreferrer");
    } finally {
      setBusyAction(null);
    }
  }, [busyAction, copyShareText, safeScore]);

  if (safeScore === null) {
    return null;
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-[rgba(0,0,0,0.86)] px-4 py-6 backdrop-blur-lg"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="relative w-full max-w-[980px] rounded-[32px] border border-[rgba(255,255,255,0.08)] bg-[#040507] p-4 shadow-[0_24px_90px_rgba(0,0,0,0.65)] sm:p-8"
            initial={{ y: 18, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 12, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 240, damping: 24 }}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--satura-white-10)] text-[var(--satura-font-secondary)] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--satura-font-primary)] sm:right-6 sm:top-6"
              aria-label="Close share experience"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none">
                <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>

            <div className="grid gap-7 pt-8 lg:grid-cols-[360px_1fr] lg:items-center lg:pt-0">
              <div className="flex justify-center">
                <TrustScoreGradientCard score={safeScore} channelTitle={channelTitle} />
              </div>

              <div className="flex flex-col gap-3">
                <div className="mb-1">
                  <h2 className="text-2xl font-semibold tracking-tight text-[var(--satura-font-primary)]">
                    Share your score
                  </h2>
                  <p className="mt-1 text-sm text-[var(--satura-font-secondary)]">
                    Copy your link or post with one tap
                  </p>
                </div>

                <div className="rounded-xl border border-[var(--satura-white-10)] bg-[rgba(255,255,255,0.02)] p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--satura-font-secondary)]">
                    Share link
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <p className="flex-1 truncate rounded-lg bg-[rgba(0,0,0,0.32)] px-3 py-2 text-xs text-[var(--satura-font-secondary)]">
                      {shareUrl}
                    </p>
                    <button
                      type="button"
                      onClick={handleCopyShareLink}
                      className="inline-flex h-9 items-center justify-center rounded-lg border border-[var(--satura-white-10)] px-3 text-xs font-semibold text-[var(--satura-font-primary)] transition-all hover:border-[rgba(255,255,255,0.2)] hover:bg-[rgba(255,255,255,0.06)]"
                    >
                      {linkCopied ? "Copied" : "Copy link"}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    className={iconButtonClassName}
                    onClick={handleShareX}
                    disabled={busyAction !== null}
                    aria-label="Share to X"
                  >
                    <span className="inline-flex h-4 w-4 items-center justify-center">
                      <PlatformIcon label="x" />
                    </span>
                  </button>
                  <button
                    type="button"
                    className={iconButtonClassName}
                    onClick={handleShareInstagram}
                    disabled={busyAction !== null}
                  >
                    <span className="mr-2 inline-flex h-4 w-4 items-center justify-center">
                      <PlatformIcon label="instagram" />
                    </span>
                    Instagram
                  </button>
                  <button
                    type="button"
                    className={iconButtonClassName}
                    onClick={handleShareDiscord}
                    disabled={busyAction !== null}
                  >
                    <span className="mr-2 inline-flex h-4 w-4 items-center justify-center">
                      <PlatformIcon label="discord" />
                    </span>
                    Discord
                  </button>
                </div>

                <button
                  type="button"
                  className={actionButtonClassName}
                  onClick={handleDownloadImage}
                  disabled={busyAction !== null}
                >
                  {busyAction === "image" ? "Preparing image..." : "Download image"}
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-[var(--satura-brand-primary)] px-4 text-sm font-semibold text-black transition-colors hover:bg-[var(--satura-brand-primary-300)]"
                >
                  {mode === "reveal" ? "Continue" : "Done"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
