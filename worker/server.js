import express from "express";
import cors from "cors";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { spawn } from "child_process";
import { createReadStream, promises as fs } from "fs";
import os from "os";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { chromium } from "playwright";

const parseDotenv = (contents) => {
  const out = new Map();
  const lines = String(contents).split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (!key) continue;
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out.set(key, value);
  }
  return out;
};

const loadEnvFileIfPresent = async (filePath) => {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = parseDotenv(raw);
    for (const [key, value] of parsed.entries()) {
      if (process.env[key] == null || process.env[key] === "") {
        process.env[key] = value;
      }
    }
    return true;
  } catch {
    return false;
  }
};

// Local dev ergonomics: running `node worker/server.js` does not automatically load `.env.local`.
// Load from the repo root (or current dir) if present, without overriding existing env vars.
const ENV_CANDIDATES = [
  path.join(process.cwd(), ".env.local"),
  path.join(process.cwd(), ".env"),
  path.join(process.cwd(), "..", ".env.local"),
  path.join(process.cwd(), "..", ".env"),
];
await Promise.all(ENV_CANDIDATES.map(loadEnvFileIfPresent));

const app = express();
const PORT = process.env.PORT || 3001;
const WORKER_SECRET =
  process.env.WORKER_SECRET || process.env.AUTOCLIP_WORKER_SECRET || "dev-secret";
const TEMP_DIR = process.env.TEMP_DIR || "/tmp/autoclip";
const BUCKET = "autoclip-files";

const toPositiveInt = (value, fallback) => {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.floor(parsed);
  }
  return fallback;
};

const toEven = (value) => {
  const safe = Math.max(2, Math.floor(value));
  return safe - (safe % 2);
};

const CPU_COUNT = Math.max(1, os.cpus()?.length ?? 1);
const TOTAL_MEMORY_MB = Math.max(
  1,
  Math.floor((os.totalmem?.() ?? 0) / (1024 * 1024))
);
const MAX_RENDER_CONCURRENCY = toPositiveInt(
  process.env.AUTOCLIP_RENDER_CONCURRENCY,
  Math.max(1, Math.min(2, Math.floor(CPU_COUNT / 2)))
);
const FFMPEG_THREADS = toPositiveInt(
  process.env.AUTOCLIP_FFMPEG_THREADS,
  Math.max(1, CPU_COUNT)
);
const MAX_RENDER_FPS = toPositiveInt(process.env.AUTOCLIP_MAX_RENDER_FPS, 60);
const MAX_RENDER_HEIGHT = toPositiveInt(
  process.env.AUTOCLIP_MAX_RENDER_HEIGHT,
  1920
);
const TRANSCRIBE_CHUNK_SECONDS = toPositiveInt(
  process.env.AUTOCLIP_TRANSCRIBE_CHUNK_SECONDS,
  600
);
const TRANSCRIBE_AUDIO_BITRATE =
  process.env.AUTOCLIP_TRANSCRIBE_BITRATE || "64k";
const RENDER_PRESET = process.env.AUTOCLIP_FFMPEG_PRESET || "veryfast";
const SCALE_FLAGS = process.env.AUTOCLIP_SCALE_FLAGS || "lanczos";
const RENDER_HEIGHT = toEven(MAX_RENDER_HEIGHT);
const RENDER_WIDTH = toEven(Math.round(RENDER_HEIGHT * 9 / 16));

let activeRenders = 0;
let activeExports = 0;

const EXPORT_RENDER_URL =
  process.env.EDITOR_RENDER_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const EXPORT_RENDER_SECRET =
  process.env.EDITOR_RENDER_SECRET ||
  process.env.AUTOCLIP_WORKER_SECRET ||
  WORKER_SECRET;
const EXPORT_BUCKET = process.env.EDITOR_EXPORT_BUCKET || BUCKET;
const EXPORT_FPS_DEFAULT = toPositiveInt(process.env.EDITOR_EXPORT_FPS, 30);
const EXPORT_JPEG_QUALITY = toPositiveInt(process.env.EDITOR_EXPORT_JPEG_QUALITY, 90);
const EXPORT_FRAME_FORMAT_RAW = (process.env.EDITOR_EXPORT_FRAME_FORMAT || "png").toLowerCase();
const EXPORT_FRAME_FORMAT =
  EXPORT_FRAME_FORMAT_RAW === "jpeg" || EXPORT_FRAME_FORMAT_RAW === "jpg"
    ? "jpeg"
    : "png";
const EXPORT_FRAME_CODEC = EXPORT_FRAME_FORMAT === "jpeg" ? "mjpeg" : "png";
const EXPORT_SCALE_FLAGS = process.env.EDITOR_EXPORT_SCALE_FLAGS || "lanczos";
const EXPORT_RENDER_MODE = (
  process.env.EDITOR_EXPORT_RENDER_MODE || "css"
).toLowerCase();
const EXPORT_VIDEO_PRESET = process.env.EDITOR_EXPORT_PRESET || "slow";
const EXPORT_VIDEO_CRF = Math.min(
  24,
  Math.max(8, toPositiveInt(process.env.EDITOR_EXPORT_CRF, 12))
);
const EXPORT_VIDEO_TUNE = (process.env.EDITOR_EXPORT_TUNE || "").trim();
const EXPORT_AUDIO_BITRATE = process.env.EDITOR_EXPORT_AUDIO_BITRATE || "320k";
const EXPORT_FRAME_TIMEOUT_MS = toPositiveInt(
  process.env.EDITOR_EXPORT_FRAME_TIMEOUT_MS,
  20000
);
const EXPORT_PROGRESS_LOG_MS = toPositiveInt(
  process.env.EDITOR_EXPORT_PROGRESS_LOG_MS,
  5000
);
const EXPORT_CPU_PER_JOB = toPositiveInt(
  process.env.EDITOR_EXPORT_CPU_PER_JOB,
  1
);
const EXPORT_MEMORY_PER_JOB_MB = toPositiveInt(
  process.env.EDITOR_EXPORT_MEMORY_PER_JOB_MB,
  2200
);
const EXPORT_MEMORY_RESERVE_MB = toPositiveInt(
  process.env.EDITOR_EXPORT_MEMORY_RESERVE_MB,
  1000
);
const EXPORT_CONCURRENCY_CAP = toPositiveInt(
  process.env.EDITOR_EXPORT_MAX_CONCURRENCY,
  3
);
const memoryBoundExportConcurrency = Math.max(
  1,
  Math.floor(
    Math.max(0, TOTAL_MEMORY_MB - EXPORT_MEMORY_RESERVE_MB) /
      EXPORT_MEMORY_PER_JOB_MB
  )
);
const cpuBoundExportConcurrency = Math.max(
  1,
  Math.floor(CPU_COUNT / EXPORT_CPU_PER_JOB)
);
const AUTO_EXPORT_CONCURRENCY = Math.max(
  1,
  Math.min(
    EXPORT_CONCURRENCY_CAP,
    memoryBoundExportConcurrency,
    cpuBoundExportConcurrency
  )
);
const MAX_EXPORT_CONCURRENCY = toPositiveInt(
  process.env.EDITOR_EXPORT_CONCURRENCY,
  AUTO_EXPORT_CONCURRENCY
);
const EXPORT_FFMPEG_THREADS = toPositiveInt(
  process.env.EDITOR_EXPORT_FFMPEG_THREADS,
  Math.max(1, Math.floor(CPU_COUNT / Math.max(1, MAX_EXPORT_CONCURRENCY)))
);

const exportQueue = [];
const exportJobs = new Map();
let exportQueueRunning = false;
let sharedExportBrowser = null;
let sharedExportBrowserLaunch = null;

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Middleware
app.use(cors());
app.use(express.json({ limit: "25mb" }));

// Auth middleware
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${WORKER_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

// Multer for file uploads
const upload = multer({
  dest: TEMP_DIR,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
});

// Ensure temp directory exists
await fs.mkdir(TEMP_DIR, { recursive: true });

const exportTempDir = path.join(TEMP_DIR, "exports");
await fs.mkdir(exportTempDir, { recursive: true });

const updateExportJob = (jobId, patch) => {
  const existing = exportJobs.get(jobId);
  if (!existing) {
    return null;
  }
  const next = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  exportJobs.set(jobId, next);
  return next;
};

const getOrCreateSharedExportBrowser = async () => {
  if (sharedExportBrowser) {
    return sharedExportBrowser;
  }
  if (!sharedExportBrowserLaunch) {
    sharedExportBrowserLaunch = chromium
      .launch({
        args: ["--disable-dev-shm-usage", "--no-sandbox"],
      })
      .then((browser) => {
        sharedExportBrowser = browser;
        sharedExportBrowserLaunch = null;
        browser.on("disconnected", () => {
          if (sharedExportBrowser === browser) {
            sharedExportBrowser = null;
          }
          sharedExportBrowserLaunch = null;
          console.error("[export][browser] shared browser disconnected");
        });
        return browser;
      })
      .catch((error) => {
        sharedExportBrowserLaunch = null;
        throw error;
      });
  }
  return sharedExportBrowserLaunch;
};

const uploadPathToStorage = async ({
  bucket,
  key,
  filePath,
  contentType,
}) => {
  let streamUploadError = null;
  try {
    const { error } = await supabase.storage.from(bucket).upload(
      key,
      createReadStream(filePath),
      {
        contentType,
        upsert: true,
      }
    );
    if (!error) {
      return;
    }
    streamUploadError = error;
  } catch (error) {
    streamUploadError = error;
  }

  const message =
    streamUploadError instanceof Error
      ? streamUploadError.message
      : typeof streamUploadError?.message === "string"
        ? streamUploadError.message
        : "";
  const canRetryWithBuffer =
    message.length === 0 ||
    /duplex|stream|readable|body|unsupported/i.test(message);
  if (!canRetryWithBuffer) {
    throw streamUploadError;
  }

  // Fallback for runtimes/adapters that don't accept Node streams for uploads.
  const fileBuffer = await fs.readFile(filePath);
  const { error: bufferUploadError } = await supabase.storage
    .from(bucket)
    .upload(key, fileBuffer, {
      contentType,
      upsert: true,
    });
  if (bufferUploadError) {
    throw bufferUploadError;
  }
};

const enqueueExportJob = (payload) => {
  const jobId = uuidv4().slice(0, 12);
  const now = new Date().toISOString();
  const job = {
    id: jobId,
    status: "queued",
    stage: "Queued",
    progress: 0,
    createdAt: now,
    updatedAt: now,
    payload,
    framesRendered: 0,
    framesTotal: 0,
    downloadUrl: null,
    error: null,
  };
  exportJobs.set(jobId, job);
  exportQueue.push(jobId);
  processExportQueue();
  return job;
};

const buildAtempoFilters = (speed) => {
  const filters = [];
  let remaining = speed;
  while (remaining > 2.0) {
    filters.push("atempo=2.0");
    remaining /= 2.0;
  }
  while (remaining > 0 && remaining < 0.5) {
    filters.push("atempo=0.5");
    remaining /= 0.5;
  }
  if (remaining > 0 && Math.abs(remaining - 1) > 0.001) {
    filters.push(`atempo=${remaining.toFixed(3)}`);
  }
  return filters;
};

const buildAudioMix = async ({ jobId, state, duration }) => {
  const snapshot = state?.snapshot;
  if (!snapshot?.timeline || !snapshot?.assets) {
    return null;
  }
  const assetsById = new Map(snapshot.assets.map((asset) => [asset.id, asset]));
  const clipSettings = snapshot.clipSettings ?? {};
  const audioSources = snapshot.timeline
    .map((clip) => {
      const asset = assetsById.get(clip.assetId);
      if (!asset) {
        return null;
      }
      if (asset.kind !== "audio" && asset.kind !== "video") {
        return null;
      }
      if (!asset.url) {
        return null;
      }
      if (!Number.isFinite(clip.duration) || clip.duration <= 0) {
        return null;
      }
      const settings = clipSettings[clip.id] || {};
      const muted = settings.muted === true;
      const volume = typeof settings.volume === "number" ? settings.volume : 100;
      if (muted || volume <= 0) {
        return null;
      }
      const speed = typeof settings.speed === "number" && settings.speed > 0 ? settings.speed : 1;
      const fadeEnabled = settings.fadeEnabled === true;
      const fadeIn = typeof settings.fadeIn === "number" ? settings.fadeIn : 0;
      const fadeOut = typeof settings.fadeOut === "number" ? settings.fadeOut : 0;
      return {
        url: asset.url,
        startTime: clip.startTime ?? 0,
        startOffset: clip.startOffset ?? 0,
        duration: clip.duration ?? 0,
        speed,
        volume,
        fadeEnabled,
        fadeIn,
        fadeOut,
      };
    })
    .filter(Boolean);

  if (!audioSources.length) {
    return null;
  }

  const audioPath = path.join(exportTempDir, `${jobId}_audio.wav`);
  const filterParts = [];
  audioSources.forEach((source, index) => {
    const inputLabel = `[${index}:a]`;
    const trimmedDuration = Math.max(0, source.duration * source.speed);
    let filter = `${inputLabel}atrim=start=${source.startOffset}:duration=${trimmedDuration},asetpts=PTS-STARTPTS`;
    const tempoFilters = buildAtempoFilters(source.speed);
    if (tempoFilters.length) {
      filter += `,${tempoFilters.join(",")}`;
    }
    const volume = Math.max(0, source.volume / 100);
    if (Math.abs(volume - 1) > 0.001) {
      filter += `,volume=${volume.toFixed(3)}`;
    }
    if (source.fadeEnabled) {
      if (source.fadeIn > 0) {
        filter += `,afade=t=in:st=0:d=${source.fadeIn}`;
      }
      if (source.fadeOut > 0) {
        const fadeOutStart = Math.max(0, source.duration - source.fadeOut);
        if (fadeOutStart >= 0) {
          filter += `,afade=t=out:st=${fadeOutStart}:d=${source.fadeOut}`;
        }
      }
    }
    const delayMs = Math.max(0, Math.round(source.startTime * 1000));
    if (delayMs > 0) {
      filter += `,adelay=${delayMs}|${delayMs}`;
    }
    filter += `[a${index}]`;
    filterParts.push(filter);
  });
  const mixInputs = audioSources.map((_, index) => `[a${index}]`).join("");
  const mix = `${mixInputs}amix=inputs=${audioSources.length}:normalize=0[aout]`;
  const filterComplex = [...filterParts, mix].join(";");

  await new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-hide_banner", "-loglevel", "error",
      "-y",
      ...audioSources.flatMap((source) => ["-i", source.url]),
      "-filter_complex", filterComplex,
      "-map", "[aout]",
      "-t", String(duration),
      "-ac", "2",
      "-ar", "48000",
      "-c:a", "pcm_s16le",
      audioPath,
    ]);
    let stderr = "";
    ffmpeg.stderr.on("data", (data) => (stderr += data.toString()));
    ffmpeg.on("close", (code, signal) => {
      if (code === 0) return resolve();
      const reason = signal ? `signal ${signal}` : `code ${code}`;
      reject(new Error(`Audio mix failed (${reason}): ${stderr.slice(-500)}`));
    });
    ffmpeg.on("error", (err) =>
      reject(new Error(`Audio mix spawn error: ${err.message}`))
    );
  });

  return audioPath;
};

const runEditorExportJob = async (job) => {
  const payload = job.payload || {};
  const state = payload.state;
  const output = payload.output || {};
  const fps = toPositiveInt(payload.fps, EXPORT_FPS_DEFAULT);
  const duration = Number(payload.duration) || 0;
  const renderUrl = payload.renderUrl || EXPORT_RENDER_URL;
  const fonts = Array.isArray(payload.fonts) ? payload.fonts : [];
  let browser = null;
  let browserDisconnectHandler = null;
  let context = null;
  let page = null;
  let rendererClosed = false;
  let rendererCloseReason = "";

  if (!state || !output?.width || !output?.height || duration <= 0) {
    throw new Error("Invalid export payload.");
  }

  const width = toEven(output.width);
  const height = toEven(output.height);
  const preview = payload.preview || {};
  const previewWidth = toEven(toPositiveInt(preview.width, width));
  const previewHeight = toEven(toPositiveInt(preview.height, height));
  const scaleX = previewWidth > 0 ? width / previewWidth : 1;
  const scaleY = previewHeight > 0 ? height / previewHeight : 1;
  const canDeviceScale =
    scaleX >= 1 &&
    scaleY >= 1 &&
    Number.isFinite(scaleX) &&
    Number.isFinite(scaleY) &&
    Math.abs(scaleX - scaleY) <= 0.02;
  const renderScaleMode =
    EXPORT_RENDER_MODE === "device" && canDeviceScale ? "device" : "css";
  const viewportWidth = renderScaleMode === "device" ? previewWidth : width;
  const viewportHeight = renderScaleMode === "device" ? previewHeight : height;
  const deviceScaleFactor = renderScaleMode === "device" ? scaleX : 1;
  const framesTotal = Math.max(1, Math.ceil(duration * fps));
  const exportStart = Date.now();
  let lastProgressLog = 0;

  const withTimeout = async (promise, ms, label) => {
    let timeoutId;
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error(`${label} timed out after ${ms}ms`));
          }, ms);
        }),
      ]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  };

  const maybeLogProgress = (framesRendered) => {
    const now = Date.now();
    if (now - lastProgressLog < EXPORT_PROGRESS_LOG_MS) {
      return;
    }
    lastProgressLog = now;
    const percent = ((framesRendered / framesTotal) * 100).toFixed(1);
    console.log(
      `[export] ${job.id} ${framesRendered}/${framesTotal} (${percent}%) elapsed=${Math.round((now - exportStart) / 1000)}s`
    );
  };

  updateExportJob(job.id, {
    status: "loading",
    stage: "Preparing render",
    progress: 0.03,
    framesTotal,
    framesRendered: 0,
  });

  let videoPath = null;
  let finalPath = null;
  let audioPath = null;
  try {
    browser = await getOrCreateSharedExportBrowser();
    browserDisconnectHandler = () => {
      rendererClosed = true;
      rendererCloseReason = "browser disconnected";
      console.error("[export][browser] disconnected");
    };
    browser.on("disconnected", browserDisconnectHandler);

    context = await browser.newContext({
      viewport: { width: viewportWidth, height: viewportHeight },
      deviceScaleFactor,
    });
    page = await context.newPage();
    page.setDefaultTimeout(120000);
    page.setDefaultNavigationTimeout(120000);
    page.on("console", (msg) => {
      const text = msg.text();
      if (text?.includes("Download the React DevTools")) {
        return;
      }
      console.log(`[export][console] ${msg.type()}: ${text}`);
    });
    page.on("pageerror", (err) => {
      console.error("[export][pageerror]", err);
    });
    page.on("requestfailed", (request) => {
      console.error("[export][requestfailed]", request.url(), request.failure()?.errorText);
    });
    page.on("response", (response) => {
      const status = response.status();
      if (status >= 400) {
        console.error("[export][response]", status, response.url());
      }
    });
    page.on("crash", () => {
      rendererClosed = true;
      rendererCloseReason = "page crashed";
      console.error("[export][page] crashed");
    });
    page.on("close", () => {
      rendererClosed = true;
      rendererCloseReason = "page closed";
      console.error("[export][page] closed");
    });

    const previewPayload =
      previewWidth && previewHeight
        ? { width: previewWidth, height: previewHeight }
        : null;
    await page.addInitScript((payload) => {
      window.__EDITOR_EXPORT__ = payload;
    }, {
      state,
      output: { width, height },
      preview: previewPayload,
      renderScaleMode,
      fps,
      duration,
      fonts,
    });

    updateExportJob(job.id, {
      stage: "Booting renderer",
      progress: 0.05,
    });

    const renderParams = new URLSearchParams({ export: "1" });
    if (EXPORT_RENDER_SECRET) {
      renderParams.set("renderKey", EXPORT_RENDER_SECRET);
    }
    const renderTarget = `${renderUrl}/editor/advanced?${renderParams.toString()}`;
    console.log("[export] goto", renderTarget);
    let response = null;
    try {
      response = await page.goto(renderTarget, {
        waitUntil: "domcontentloaded",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const hints = [];
      if (/localhost|127\.0\.0\.1/.test(renderUrl)) {
        hints.push(
          "renderUrl points to localhost; the worker must run on the same machine (or use EDITOR_RENDER_URL / a tunnel like ngrok)."
        );
      }
      throw new Error(
        `page.goto failed: ${message}${hints.length ? ` (${hints.join(" ")})` : ""}`
      );
    }
    if (response) {
      console.log("[export] goto status", response.status(), response.url());
    }
    await withTimeout(
      page.waitForFunction(
        () => window.__EDITOR_EXPORT_API__ && typeof window.__EDITOR_EXPORT_API__.waitForReady === "function",
        { timeout: 120000 }
      ),
      120000,
      "waitForExportApi"
    );
    await withTimeout(
      page.evaluate(() => window.__EDITOR_EXPORT_API__.waitForReady()),
      120000,
      "waitForReady"
    );

    const stageHandle = await page.$("[data-export-stage]");
    if (!stageHandle) {
      throw new Error("Export stage not found.");
    }

    updateExportJob(job.id, {
      status: "rendering",
      stage: "Rendering frames",
      progress: 0.05,
    });

    videoPath = path.join(exportTempDir, `${job.id}_video.mp4`);
    const screenshotOptions =
      EXPORT_FRAME_FORMAT === "jpeg"
        ? { type: "jpeg", quality: EXPORT_JPEG_QUALITY }
        : { type: "png" };
    const needsScaleFilter =
      renderScaleMode === "device" ||
      viewportWidth !== width ||
      viewportHeight !== height;
    const ffmpegArgs = [
      "-hide_banner", "-loglevel", "error",
      "-y",
      "-f", "image2pipe",
      "-vcodec", EXPORT_FRAME_CODEC,
      "-r", String(fps),
      "-i", "pipe:0",
      "-an",
    ];
    if (needsScaleFilter) {
      ffmpegArgs.push("-vf", `scale=${width}:${height}:flags=${EXPORT_SCALE_FLAGS}`);
    }
    ffmpegArgs.push(
      "-c:v", "libx264",
      "-preset", EXPORT_VIDEO_PRESET,
      "-crf", String(EXPORT_VIDEO_CRF),
      "-pix_fmt", "yuv420p",
      "-profile:v", "high",
      "-threads", String(EXPORT_FFMPEG_THREADS),
      "-movflags", "+faststart"
    );
    if (EXPORT_VIDEO_TUNE) {
      ffmpegArgs.push("-tune", EXPORT_VIDEO_TUNE);
    }
    ffmpegArgs.push(videoPath);
    const ffmpeg = spawn("ffmpeg", ffmpegArgs);
    let ffmpegStderr = "";
    let ffmpegExitCode = null;
    let ffmpegExitSignal = null;
    let ffmpegSpawnError = null;
    const appendFfmpegStderr = (chunk) => {
      const text = chunk.toString();
      ffmpegStderr = `${ffmpegStderr}${text}`.slice(-4000);
    };
    ffmpeg.stderr.on("data", appendFfmpegStderr);
    ffmpeg.on("exit", (code, signal) => {
      ffmpegExitCode = code;
      ffmpegExitSignal = signal;
    });
    ffmpeg.on("error", (err) => {
      ffmpegSpawnError = err;
    });
    ffmpeg.stdin.on("error", (err) => {
      ffmpegSpawnError = err;
    });

    const writeFrame = (buffer) =>
      new Promise((resolve, reject) => {
        if (ffmpegExitCode !== null) {
          const tail = ffmpegStderr ? `: ${ffmpegStderr.slice(-500)}` : "";
          reject(
            new Error(
              `FFmpeg exited early with code ${ffmpegExitCode}${tail}`
            )
          );
          return;
        }
        if (ffmpegExitSignal) {
          reject(new Error(`FFmpeg exited early with signal ${ffmpegExitSignal}`));
          return;
        }
        if (ffmpegSpawnError) {
          reject(new Error(`FFmpeg error: ${ffmpegSpawnError.message}`));
          return;
        }
        const canWrite = ffmpeg.stdin.write(buffer);
        if (canWrite) {
          resolve();
        } else {
          ffmpeg.stdin.once("drain", resolve);
        }
      });

    try {
      for (let i = 0; i < framesTotal; i += 1) {
        if (rendererClosed || page.isClosed()) {
          throw new Error(`Renderer unavailable (${rendererCloseReason || "page closed"})`);
        }
        const time = i / fps;
        await withTimeout(
          page.evaluate((value) => window.__EDITOR_EXPORT_API__.setTime(value), time),
          EXPORT_FRAME_TIMEOUT_MS,
          `setTime frame ${i + 1}`
        );
        if (rendererClosed || page.isClosed()) {
          throw new Error(`Renderer unavailable (${rendererCloseReason || "page closed"})`);
        }
        const buffer = await withTimeout(
          stageHandle.screenshot({
            ...screenshotOptions,
          }),
          EXPORT_FRAME_TIMEOUT_MS,
          `screenshot frame ${i + 1}`
        );
        if (!buffer || buffer.length < 100) {
          throw new Error(`Empty frame buffer at frame ${i + 1}`);
        }
        await withTimeout(
          writeFrame(buffer),
          EXPORT_FRAME_TIMEOUT_MS,
          `encode frame ${i + 1}`
        );
        const framesRendered = i + 1;
        updateExportJob(job.id, {
          framesRendered,
          progress: 0.05 + (framesRendered / framesTotal) * 0.85,
        });
        maybeLogProgress(framesRendered);
      }
    } catch (error) {
      try {
        ffmpeg.stdin.end();
      } catch {}
      try {
        ffmpeg.kill("SIGKILL");
      } catch {}
      throw error;
    }

    ffmpeg.stdin.end();
    await new Promise((resolve, reject) => {
      ffmpeg.on("close", (code, signal) => {
        if (code === 0) return resolve();
        const reason = signal ? `signal ${signal}` : `code ${code}`;
        const tail = ffmpegStderr ? `: ${ffmpegStderr.slice(-500)}` : "";
        reject(new Error(`FFmpeg encode failed (${reason})${tail}`));
      });
    });

    updateExportJob(job.id, {
      status: "encoding",
      stage: "Finalizing video",
      progress: 0.93,
    });

    audioPath = await buildAudioMix({ jobId: job.id, state, duration });
    finalPath = videoPath;

    if (audioPath) {
      const muxPath = path.join(exportTempDir, `${job.id}_final.mp4`);
      updateExportJob(job.id, {
        stage: "Muxing audio",
        progress: 0.95,
      });
      await new Promise((resolve, reject) => {
        const mux = spawn("ffmpeg", [
          "-hide_banner", "-loglevel", "error",
          "-y",
          "-i", videoPath,
          "-i", audioPath,
          "-c:v", "copy",
          "-c:a", "aac",
          "-b:a", EXPORT_AUDIO_BITRATE,
          "-shortest",
          "-movflags", "+faststart",
          muxPath,
        ]);
        let stderr = "";
        mux.stderr.on("data", (data) => (stderr += data.toString()));
        mux.on("close", (code, signal) => {
          if (code === 0) return resolve();
          const reason = signal ? `signal ${signal}` : `code ${code}`;
          reject(new Error(`Audio mux failed (${reason}): ${stderr.slice(-500)}`));
        });
        mux.on("error", (err) =>
          reject(new Error(`FFmpeg mux spawn error: ${err.message}`))
        );
      });
      finalPath = muxPath;
    }

    updateExportJob(job.id, {
      status: "uploading",
      stage: "Preparing download",
      progress: 0.97,
    });

    const exportKey = `exports/${job.id}/export.mp4`;
    await uploadPathToStorage({
      bucket: EXPORT_BUCKET,
      key: exportKey,
      filePath: finalPath,
      contentType: "video/mp4",
    });
    const { data: urlData } = await supabase.storage
      .from(EXPORT_BUCKET)
      .createSignedUrl(exportKey, 60 * 60 * 24);

    updateExportJob(job.id, {
      status: "complete",
      stage: "Ready",
      progress: 1,
      downloadUrl: urlData?.signedUrl ?? null,
    });
  } finally {
    if (browser && browserDisconnectHandler) {
      browser.off("disconnected", browserDisconnectHandler);
    }
    if (page) {
      await page.close().catch(() => {});
    }
    if (context) {
      await context.close().catch(() => {});
    }
    await Promise.all([
      videoPath ? fs.unlink(videoPath).catch(() => {}) : Promise.resolve(),
      audioPath ? fs.unlink(audioPath).catch(() => {}) : Promise.resolve(),
      finalPath && finalPath !== videoPath
        ? fs.unlink(finalPath).catch(() => {})
        : Promise.resolve(),
    ]);
  }
};

const processExportQueue = () => {
  if (exportQueueRunning) {
    return;
  }
  exportQueueRunning = true;
  try {
    while (activeExports < MAX_EXPORT_CONCURRENCY) {
      const nextId = exportQueue.shift();
      if (!nextId) {
        break;
      }
      const job = exportJobs.get(nextId);
      if (!job) {
        continue;
      }
      activeExports += 1;
      runEditorExportJob(job)
        .catch((error) => {
          const message =
            error instanceof Error ? error.message : "Export failed.";
          updateExportJob(job.id, {
            status: "error",
            stage: "Export failed",
            error: message,
          });
        })
        .finally(() => {
          activeExports = Math.max(0, activeExports - 1);
          processExportQueue();
        });
    }
  } finally {
    exportQueueRunning = false;
  }
};

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    exports: {
      active: activeExports,
      queued: exportQueue.length,
      maxConcurrency: MAX_EXPORT_CONCURRENCY,
      ffmpegThreadsPerExport: EXPORT_FFMPEG_THREADS,
    },
    transcription: {
      active: activeTranscribes,
      queued: transcribeQueue.length,
      maxConcurrency: MAX_TRANSCRIBE_CONCURRENCY,
      openJobs: transcribeJobs.size,
    },
  });
});

// Upload video and get session
app.post("/upload", authMiddleware, upload.single("video"), async (req, res) => {
  try {
    const sessionId = uuidv4().slice(0, 8);
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "No video file provided" });
    }

    // Get video metadata with ffprobe
    const metadata = await getVideoMetadata(file.path);

    // Upload to Supabase Storage
    const videoKey = `sessions/${sessionId}/input.mp4`;
    const fileBuffer = await fs.readFile(file.path);
    
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(videoKey, fileBuffer, {
        contentType: "video/mp4",
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // Clean up temp file
    await fs.unlink(file.path).catch(() => {});

    res.json({
      sessionId,
      videoKey,
      metadata: {
        duration: metadata.duration,
        width: metadata.width,
        height: metadata.height,
        size: file.size,
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Download from YouTube URL
app.post("/youtube", authMiddleware, async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "No URL provided" });
    }

    const sessionId = uuidv4().slice(0, 8);
    const outputPath = path.join(TEMP_DIR, `${sessionId}_input.mp4`);

    // Download with yt-dlp
    await new Promise((resolve, reject) => {
      const ytdlp = spawn("yt-dlp", [
        "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "-o", outputPath,
        "--merge-output-format", "mp4",
        "--no-playlist",
        url,
      ]);

      let stderr = "";
      ytdlp.stderr.on("data", (data) => (stderr += data.toString()));
      ytdlp.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`yt-dlp failed: ${stderr}`));
      });
      ytdlp.on("error", reject);
    });

    // Get metadata
    const metadata = await getVideoMetadata(outputPath);
    const stats = await fs.stat(outputPath);

    // Upload to Supabase Storage
    const videoKey = `sessions/${sessionId}/input.mp4`;
    const fileBuffer = await fs.readFile(outputPath);
    
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(videoKey, fileBuffer, {
        contentType: "video/mp4",
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // Clean up
    await fs.unlink(outputPath).catch(() => {});

    res.json({
      sessionId,
      videoKey,
      metadata: {
        duration: metadata.duration,
        width: metadata.width,
        height: metadata.height,
        size: stats.size,
      },
    });
  } catch (error) {
    console.error("YouTube download error:", error);
    res.status(500).json({ error: error.message });
  }
});

const MAX_TRANSCRIBE_CONCURRENCY = toPositiveInt(
  process.env.AUTOCLIP_TRANSCRIBE_CONCURRENCY,
  1
);
const TRANSCRIBE_JOB_RETENTION_MS = toPositiveInt(
  process.env.AUTOCLIP_TRANSCRIBE_JOB_RETENTION_MS,
  60 * 60 * 1000
);
const TRANSCRIBE_OPENAI_TIMEOUT_MS = toPositiveInt(
  process.env.AUTOCLIP_TRANSCRIBE_OPENAI_TIMEOUT_MS,
  120000
);
const TRANSCRIBE_OPENAI_MAX_ATTEMPTS = toPositiveInt(
  process.env.AUTOCLIP_TRANSCRIBE_OPENAI_MAX_ATTEMPTS,
  2
);

const transcribeQueue = [];
const transcribeJobs = new Map();
const transcribeJobBySession = new Map();
let activeTranscribes = 0;
let transcribeQueueRunning = false;

const updateTranscribeJob = (jobId, patch) => {
  const existing = transcribeJobs.get(jobId);
  if (!existing) {
    return null;
  }
  const next = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  transcribeJobs.set(jobId, next);
  return next;
};

const toTranscribeJobPayload = (job, includeResult = false) => ({
  jobId: job.id,
  sessionId: job.sessionId,
  status: job.status,
  stage: job.stage,
  progress: job.progress,
  totalChunks: job.totalChunks,
  completedChunks: job.completedChunks,
  error: job.error || null,
  ...(includeResult && job.result ? { result: job.result } : {}),
});

const wait = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const isRetryableTranscribeError = (error) => {
  const status = Number(error?.status);
  if (Number.isFinite(status) && (status === 429 || status >= 500)) {
    return true;
  }
  const message =
    error instanceof Error
      ? error.message
      : typeof error?.message === "string"
        ? error.message
        : "";
  return /timeout|timed out|temporar|rate limit|network|503|502/i.test(message);
};

const transcribeChunkWithRetry = async (audioFile, requestedLanguage) => {
  let lastError = null;
  for (let attempt = 1; attempt <= TRANSCRIBE_OPENAI_MAX_ATTEMPTS; attempt += 1) {
    try {
      const transcription = await Promise.race([
        openai.audio.transcriptions.create({
          file: audioFile,
          model: "whisper-1",
          language: requestedLanguage,
          response_format: "verbose_json",
          timestamp_granularities: ["word", "segment"],
        }),
        new Promise((_, reject) => {
          setTimeout(() => {
            reject(
              new Error(
                `OpenAI transcription timed out after ${Math.round(
                  TRANSCRIBE_OPENAI_TIMEOUT_MS / 1000
                )}s`
              )
            );
          }, TRANSCRIBE_OPENAI_TIMEOUT_MS);
        }),
      ]);
      return transcription;
    } catch (error) {
      lastError = error;
      if (
        attempt >= TRANSCRIBE_OPENAI_MAX_ATTEMPTS ||
        !isRetryableTranscribeError(error)
      ) {
        throw error;
      }
      await wait(attempt === 1 ? 900 : 1500);
    }
  }
  throw lastError || new Error("OpenAI transcription failed.");
};

const isUnsupportedChunkDecodeError = (error) => {
  const status = Number(error?.status);
  const message =
    error instanceof Error
      ? error.message
      : typeof error?.message === "string"
        ? error.message
        : "";
  if (status === 400 && /audio file could not be decoded|format is not supported/i.test(message)) {
    return true;
  }
  return /audio file could not be decoded|format is not supported/i.test(message);
};

const transcodeChunkToWav = async (inputPath) => {
  const outputPath = path.join(
    path.dirname(inputPath),
    `${path.basename(inputPath, path.extname(inputPath))}_clean.wav`
  );
  const compactFfmpegMessage = (value) => {
    const normalized = String(value ?? "")
      .replace(/\s+/g, " ")
      .trim();
    if (!normalized) {
      return "No ffmpeg stderr output.";
    }
    return normalized.length > 600
      ? `${normalized.slice(0, 600)}...`
      : normalized;
  };
  const runPass = async (args, label) => {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", args);
      let stderr = "";
      ffmpeg.stderr.on("data", (data) => (stderr += data.toString()));
      ffmpeg.on("close", (code) =>
        resolve({
          code: Number.isFinite(code) ? code : -1,
          stderr,
          label,
        })
      );
      ffmpeg.on("error", (err) =>
        reject(
          new Error(
            `Chunk WAV fallback ffmpeg spawn error (${label}): ${err.message}`
          )
        )
      );
    });
  };
  const hasUsableOutput = async () => {
    const stats = await fs.stat(outputPath).catch(() => null);
    return Boolean(stats && stats.size > 4096);
  };
  const buildCommonArgs = () => [
    "-hide_banner",
    "-loglevel",
    "error",
    "-fflags",
    "+discardcorrupt",
    "-err_detect",
    "ignore_err",
    "-ignore_unknown",
    "-y",
    "-i",
    inputPath,
    "-vn",
    "-sn",
    "-dn",
  ];
  const passConfigs = [
    {
      label: "map-channel",
      args: [
        ...buildCommonArgs(),
        "-map_channel",
        "0.0.0",
        "-ar",
        "16000",
        "-c:a",
        "pcm_s16le",
        "-f",
        "wav",
        outputPath,
      ],
    },
    {
      label: "pan-first-channel",
      args: [
        ...buildCommonArgs(),
        "-map",
        "0:a:0?",
        "-af",
        "pan=mono|c0=c0,aresample=16000:async=1:first_pts=0",
        "-c:a",
        "pcm_s16le",
        "-f",
        "wav",
        outputPath,
      ],
    },
    {
      label: "mono-downmix",
      args: [
        ...buildCommonArgs(),
        "-map",
        "0:a:0?",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-c:a",
        "pcm_s16le",
        "-f",
        "wav",
        outputPath,
      ],
    },
  ];

  const passErrors = [];
  for (const pass of passConfigs) {
    await fs.unlink(outputPath).catch(() => {});
    let passResult;
    try {
      passResult = await runPass(pass.args, pass.label);
    } catch (error) {
      passErrors.push(
        error instanceof Error ? error.message : String(error)
      );
      continue;
    }

    const usableOutput = await hasUsableOutput();
    if (usableOutput && passResult.code === 0) {
      return outputPath;
    }
    if (usableOutput) {
      console.warn(
        `[transcribe] chunk WAV fallback ${pass.label} exited with code ${passResult.code}; using partial WAV output. ${compactFfmpegMessage(
          passResult.stderr
        )}`
      );
      return outputPath;
    }

    passErrors.push(
      `${pass.label}: ${compactFfmpegMessage(passResult.stderr)}`
    );
  }

  throw new Error(
    `Chunk WAV fallback transcode failed: ${passErrors.slice(0, 3).join(" | ")}`
  );
};

const runTranscriptionPipeline = async ({
  sessionId,
  videoKey,
  language = "en",
  onProgress,
}) => {
  const cleanupTargets = [];
  const progress = (patch) => {
    if (typeof onProgress === "function") {
      onProgress(patch);
    }
  };

  try {
    progress({ stage: "Downloading source video", progress: 5 });
    const videoPath = path.join(TEMP_DIR, `${sessionId}_video.mp4`);
    const audioChunkDir = path.join(TEMP_DIR, `${sessionId}_audio_chunks`);
    cleanupTargets.push(videoPath, audioChunkDir);

    const { data: videoData, error: downloadError } = await supabase.storage
      .from(BUCKET)
      .download(videoKey);

    if (downloadError) throw downloadError;
    await fs.writeFile(videoPath, Buffer.from(await videoData.arrayBuffer()));

    progress({ stage: "Extracting audio chunks", progress: 15 });
    await fs.mkdir(audioChunkDir, { recursive: true });
    const sourceMetadata = await getVideoMetadata(videoPath).catch(() => null);
    const audioStreamCandidates = Array.isArray(sourceMetadata?.audioStreamIndices)
      ? sourceMetadata.audioStreamIndices.filter((index) =>
          Number.isFinite(index)
        )
      : [];
    if (
      !audioStreamCandidates.length &&
      sourceMetadata &&
      Number.isFinite(sourceMetadata.audioStreamIndex)
    ) {
      audioStreamCandidates.push(sourceMetadata.audioStreamIndex);
    }
    if (!audioStreamCandidates.length) {
      audioStreamCandidates.push(null);
    }

    const compactFfmpegMessage = (value) => {
      const normalized = String(value ?? "")
        .replace(/\s+/g, " ")
        .trim();
      if (!normalized) {
        return "No ffmpeg stderr output.";
      }
      return normalized.length > 1200
        ? `${normalized.slice(0, 1200)}...`
        : normalized;
    };
    const resetChunkDir = async () => {
      await fs.rm(audioChunkDir, { recursive: true, force: true }).catch(() => {});
      await fs.mkdir(audioChunkDir, { recursive: true });
    };
    const listChunkFiles = async () =>
      (await fs.readdir(audioChunkDir))
        .filter((name) => /^chunk_\d+\.(mp3|m4a)$/i.test(name))
        .sort()
        .map((name) => path.join(audioChunkDir, name));
    const runChunkingPass = async (args, label) => {
      return new Promise((resolve, reject) => {
        const ffmpeg = spawn("ffmpeg", args);
        let stderr = "";
        ffmpeg.stderr.on("data", (data) => (stderr += data.toString()));
        ffmpeg.on("close", (code) =>
          resolve({
            code: Number.isFinite(code) ? code : -1,
            stderr,
          })
        );
        ffmpeg.on("error", (err) =>
          reject(new Error(`FFmpeg spawn error (${label}): ${err.message}`))
        );
      });
    };

    const buildDecodeChunkingArgs = (audioStreamIndex) => [
      "-hide_banner",
      "-loglevel",
      "error",
      "-fflags",
      "+discardcorrupt",
      "-err_detect",
      "ignore_err",
      "-ignore_unknown",
      "-y",
      "-i",
      videoPath,
      ...(audioStreamIndex != null
        ? ["-map", `0:${audioStreamIndex}`]
        : ["-map", "0:a:0?"]),
      "-vn",
      "-sn",
      "-dn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-c:a",
      "libmp3lame",
      "-b:a",
      TRANSCRIBE_AUDIO_BITRATE,
      "-f",
      "segment",
      "-segment_time",
      String(TRANSCRIBE_CHUNK_SECONDS),
      "-reset_timestamps",
      "1",
      path.join(audioChunkDir, "chunk_%03d.mp3"),
    ];

    const buildCopyChunkingArgs = (audioStreamIndex) => [
      "-hide_banner",
      "-loglevel",
      "error",
      "-fflags",
      "+discardcorrupt",
      "-err_detect",
      "ignore_err",
      "-ignore_unknown",
      "-y",
      "-i",
      videoPath,
      ...(audioStreamIndex != null
        ? ["-map", `0:${audioStreamIndex}`]
        : ["-map", "0:a:0?"]),
      "-vn",
      "-sn",
      "-dn",
      "-c:a",
      "copy",
      "-f",
      "segment",
      "-segment_time",
      String(TRANSCRIBE_CHUNK_SECONDS),
      "-segment_format",
      "mp4",
      "-reset_timestamps",
      "1",
      path.join(audioChunkDir, "chunk_%03d.m4a"),
    ];

    const extractionPlans = [
      ...audioStreamCandidates.map((index) => ({
        label:
          index == null ? "decode-first-audio" : `decode-stream-${String(index)}`,
        args: buildDecodeChunkingArgs(index),
      })),
      {
        label: "decode-pan-fallback",
        args: [
          "-hide_banner",
          "-loglevel",
          "error",
          "-fflags",
          "+discardcorrupt",
          "-err_detect",
          "ignore_err",
          "-ignore_unknown",
          "-y",
          "-i",
          videoPath,
          "-map",
          "0:a:0?",
          "-vn",
          "-sn",
          "-dn",
          "-af",
          "pan=mono|c0=c0,aresample=16000:async=1:first_pts=0",
          "-c:a",
          "libmp3lame",
          "-b:a",
          TRANSCRIBE_AUDIO_BITRATE,
          "-f",
          "segment",
          "-segment_time",
          String(TRANSCRIBE_CHUNK_SECONDS),
          "-reset_timestamps",
          "1",
          path.join(audioChunkDir, "chunk_%03d.mp3"),
        ],
      },
      ...audioStreamCandidates.map((index) => ({
        label:
          index == null ? "copy-first-audio" : `copy-stream-${String(index)}`,
        args: buildCopyChunkingArgs(index),
      })),
    ];

    const extractionErrors = [];
    let chunkFiles = [];
    const chunkDurationByPath = new Map();
    const sourceDurationSeconds =
      sourceMetadata &&
      Number.isFinite(sourceMetadata.duration) &&
      sourceMetadata.duration > 0
        ? sourceMetadata.duration
        : null;
    const computeChunkDurationTotal = async (files) => {
      let totalDuration = 0;
      for (const filePath of files) {
        const existing = chunkDurationByPath.get(filePath);
        if (Number.isFinite(existing) && existing > 0) {
          totalDuration += existing;
          continue;
        }
        const metadata = await getVideoMetadata(filePath).catch(() => null);
        const duration =
          metadata &&
          Number.isFinite(metadata.duration) &&
          metadata.duration > 0
            ? metadata.duration
            : TRANSCRIBE_CHUNK_SECONDS;
        chunkDurationByPath.set(filePath, duration);
        totalDuration += duration;
      }
      return totalDuration;
    };
    const isBetterExtractionCandidate = (next, current) => {
      if (!current) {
        return true;
      }
      const nextCoverage =
        Number.isFinite(next.coverage) && next.coverage != null ? next.coverage : -1;
      const currentCoverage =
        Number.isFinite(current.coverage) && current.coverage != null
          ? current.coverage
          : -1;
      if (nextCoverage > currentCoverage + 0.03) {
        return true;
      }
      if (currentCoverage > nextCoverage + 0.03) {
        return false;
      }
      if (next.code === 0 && current.code !== 0) {
        return true;
      }
      if (next.code !== 0 && current.code === 0) {
        return false;
      }
      if (next.totalDuration > current.totalDuration + 1) {
        return true;
      }
      if (current.totalDuration > next.totalDuration + 1) {
        return false;
      }
      return next.totalBytes > current.totalBytes;
    };
    let bestExtractionCandidate = null;

    for (const plan of extractionPlans) {
      await resetChunkDir();
      let passResult;
      try {
        passResult = await runChunkingPass(plan.args, plan.label);
      } catch (error) {
        extractionErrors.push(
          `${plan.label}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        continue;
      }

      const createdChunks = await listChunkFiles();
      if (!createdChunks.length) {
        extractionErrors.push(
          `${plan.label}: no chunks produced${
            passResult.code === 0
              ? ""
              : ` (${compactFfmpegMessage(passResult.stderr)})`
          }`
        );
        continue;
      }

      const chunkSizes = await Promise.all(
        createdChunks.map((filePath) =>
          fs
            .stat(filePath)
            .then((stats) => stats.size)
            .catch(() => 0)
        )
      );
      const totalBytes = chunkSizes.reduce((sum, size) => sum + size, 0);
      if (totalBytes < 4096) {
        extractionErrors.push(
          `${plan.label}: produced only ${totalBytes} bytes of audio output.`
        );
        continue;
      }

      const totalDuration = await computeChunkDurationTotal(createdChunks);
      const coverage =
        sourceDurationSeconds && sourceDurationSeconds > 0
          ? Math.min(1, totalDuration / sourceDurationSeconds)
          : null;
      const candidate = {
        label: plan.label,
        code: passResult.code,
        stderr: passResult.stderr,
        chunks: createdChunks,
        totalBytes,
        totalDuration,
        coverage,
      };
      if (isBetterExtractionCandidate(candidate, bestExtractionCandidate)) {
        bestExtractionCandidate = candidate;
      }

      const coverageLabel =
        coverage == null ? "unknown" : `${Math.round(coverage * 100)}%`;
      if (passResult.code !== 0) {
        extractionErrors.push(
          `${plan.label}: exited with code ${passResult.code} (coverage ${coverageLabel})`
        );
      }

      if (
        passResult.code === 0 &&
        (coverage == null || coverage >= 0.85)
      ) {
        break;
      }
    }

    if (bestExtractionCandidate?.chunks?.length) {
      chunkFiles = bestExtractionCandidate.chunks;
      if (bestExtractionCandidate.code !== 0) {
        const coverageLabel =
          bestExtractionCandidate.coverage == null
            ? "unknown"
            : `${Math.round(bestExtractionCandidate.coverage * 100)}%`;
        console.warn(
          `[transcribe] ${bestExtractionCandidate.label} exited with code ${bestExtractionCandidate.code}; using partial audio chunks (coverage ${coverageLabel}). ${compactFfmpegMessage(
            bestExtractionCandidate.stderr
          )}`
        );
      }
      if (
        sourceDurationSeconds &&
        sourceDurationSeconds >= 480 &&
        Number.isFinite(bestExtractionCandidate.coverage) &&
        bestExtractionCandidate.coverage < 0.7
      ) {
        throw new Error(
          `Audio extraction coverage is too low (${Math.round(
            bestExtractionCandidate.coverage * 100
          )}% of ${Math.round(
            sourceDurationSeconds
          )}s). Source audio appears heavily corrupted.`
        );
      }
    }

    if (!chunkFiles.length) {
      const detail =
        extractionErrors.length > 0
          ? ` ${extractionErrors.slice(0, 4).join(" | ")}`
          : "";
      throw new Error(
        `No audio chunks were created for transcription.${detail}`
      );
    }

    const requestedLanguage =
      typeof language === "string" && language.trim().length > 0
        ? language
        : undefined;
    const totalChunks = chunkFiles.length;
    progress({
      stage: `Transcribing audio chunks (0/${totalChunks})`,
      progress: 20,
      totalChunks,
      completedChunks: 0,
    });

    const allSegments = [];
    const allWords = [];
    let fullText = "";
    let detectedLanguage = null;
    let offsetSeconds = 0;
    let successfulChunks = 0;
    let failedChunks = 0;
    const skippedChunkErrors = [];

    for (let index = 0; index < chunkFiles.length; index += 1) {
      const chunkPath = chunkFiles[index];
      const chunkMetadata =
        chunkDurationByPath.has(chunkPath)
          ? null
          : await getVideoMetadata(chunkPath).catch(() => null);
      const knownChunkDuration = chunkDurationByPath.get(chunkPath);
      const chunkDuration =
        Number.isFinite(knownChunkDuration) && knownChunkDuration > 0
          ? knownChunkDuration
          : chunkMetadata &&
              Number.isFinite(chunkMetadata.duration) &&
              chunkMetadata.duration > 0
            ? chunkMetadata.duration
            : TRANSCRIBE_CHUNK_SECONDS;
      const audioBuffer = await fs.readFile(chunkPath);
      const chunkExt = path.extname(chunkPath).toLowerCase();
      const chunkMimeType =
        chunkExt === ".m4a" || chunkExt === ".mp4" ? "audio/mp4" : "audio/mpeg";
      const audioFile = new File([audioBuffer], path.basename(chunkPath), {
        type: chunkMimeType,
      });

      let transcription;
      let lastChunkError = null;
      try {
        transcription = await transcribeChunkWithRetry(audioFile, requestedLanguage);
      } catch (error) {
        lastChunkError = error;
        if (isUnsupportedChunkDecodeError(error)) {
          let fallbackChunkPath = null;
          try {
            fallbackChunkPath = await transcodeChunkToWav(chunkPath);
            const fallbackBuffer = await fs.readFile(fallbackChunkPath);
            const fallbackFile = new File(
              [fallbackBuffer],
              path.basename(fallbackChunkPath),
              { type: "audio/wav" }
            );
            transcription = await transcribeChunkWithRetry(
              fallbackFile,
              requestedLanguage
            );
          } catch (fallbackError) {
            lastChunkError = fallbackError;
          } finally {
            if (fallbackChunkPath) {
              await fs.unlink(fallbackChunkPath).catch(() => {});
            }
          }
        }
      }

      if (!transcription) {
        failedChunks += 1;
        const message =
          lastChunkError instanceof Error
            ? lastChunkError.message
            : "Chunk transcription failed.";
        skippedChunkErrors.push(`chunk ${index + 1}: ${message}`);
        console.warn(
          `[transcribe] skipping chunk ${index + 1}/${totalChunks}: ${message}`
        );
        offsetSeconds += chunkDuration;
        await fs.unlink(chunkPath).catch(() => {});
        const completedChunks = index + 1;
        progress({
          stage: `Transcribing audio chunks (${completedChunks}/${totalChunks}, skipped ${failedChunks})`,
          progress: Math.min(
            95,
            20 + Math.round((completedChunks / totalChunks) * 70)
          ),
          totalChunks,
          completedChunks,
        });
        continue;
      }
      successfulChunks += 1;

      if (!detectedLanguage && transcription.language) {
        detectedLanguage = transcription.language;
      }

      const chunkSegments = (transcription.segments || []).map((segment) => ({
        ...segment,
        start: Number(segment.start) + offsetSeconds,
        end: Number(segment.end) + offsetSeconds,
      }));
      const chunkWords = (transcription.words || []).map((word) => ({
        ...word,
        start: Number(word.start) + offsetSeconds,
        end: Number(word.end) + offsetSeconds,
      }));

      allSegments.push(...chunkSegments);
      allWords.push(...chunkWords);

      const snippet = String(transcription.text ?? "").trim();
      if (snippet) {
        fullText = fullText ? `${fullText} ${snippet}` : snippet;
      }

      offsetSeconds += chunkDuration;

      await fs.unlink(chunkPath).catch(() => {});

      const completedChunks = index + 1;
      progress({
        stage:
          failedChunks > 0
            ? `Transcribing audio chunks (${completedChunks}/${totalChunks}, skipped ${failedChunks})`
            : `Transcribing audio chunks (${completedChunks}/${totalChunks})`,
        progress: Math.min(
          95,
          20 + Math.round((completedChunks / totalChunks) * 70)
        ),
        totalChunks,
        completedChunks,
      });
    }

    if (successfulChunks === 0) {
      const detail =
        skippedChunkErrors.length > 0
          ? ` ${skippedChunkErrors[0]}`
          : " Audio stream appears unreadable.";
      throw new Error(`Unable to transcribe any audio chunks.${detail}`);
    }

    progress({
      stage: "Finalizing transcript",
      progress: 99,
      totalChunks,
      completedChunks: totalChunks,
    });

    return {
      segments: allSegments,
      words: allWords,
      text: fullText,
      language: detectedLanguage,
    };
  } finally {
    await Promise.all(
      cleanupTargets.map(async (target) => {
        if (!target) {
          return;
        }
        await fs.rm(target, { recursive: true, force: true }).catch(() => {});
      })
    );
  }
};

const processTranscribeQueue = () => {
  if (transcribeQueueRunning) {
    return;
  }
  transcribeQueueRunning = true;
  try {
    while (activeTranscribes < MAX_TRANSCRIBE_CONCURRENCY) {
      const nextId = transcribeQueue.shift();
      if (!nextId) {
        break;
      }
      const job = transcribeJobs.get(nextId);
      if (!job || job.status !== "queued") {
        continue;
      }
      activeTranscribes += 1;
      updateTranscribeJob(job.id, {
        status: "processing",
        stage: "Starting transcription",
        progress: Math.max(job.progress || 0, 1),
      });
      runTranscriptionPipeline({
        sessionId: job.sessionId,
        videoKey: job.videoKey,
        language: job.language,
        onProgress: (patch) => {
          updateTranscribeJob(job.id, patch);
        },
      })
        .then((result) => {
          updateTranscribeJob(job.id, {
            status: "complete",
            stage: "Transcription complete",
            progress: 100,
            result,
            error: null,
            completedAt: new Date().toISOString(),
          });
        })
        .catch((error) => {
          const message =
            error instanceof Error ? error.message : "Transcription failed.";
          console.error("Transcribe job error:", job.id, message);
          updateTranscribeJob(job.id, {
            status: "error",
            stage: "Transcription failed",
            error: message,
            completedAt: new Date().toISOString(),
          });
        })
        .finally(() => {
          activeTranscribes = Math.max(0, activeTranscribes - 1);
          processTranscribeQueue();
        });
    }
  } finally {
    transcribeQueueRunning = false;
  }
};

const enqueueTranscribeJob = ({ sessionId, videoKey, language }) => {
  const existingJobId = transcribeJobBySession.get(sessionId);
  if (existingJobId) {
    const existing = transcribeJobs.get(existingJobId);
    if (
      existing &&
      (existing.status === "queued" || existing.status === "processing")
    ) {
      return existing;
    }
    if (
      existing &&
      existing.status === "complete" &&
      existing.videoKey === videoKey &&
      existing.language === language
    ) {
      return existing;
    }
  }

  const jobId = uuidv4().slice(0, 12);
  const now = new Date().toISOString();
  const job = {
    id: jobId,
    sessionId,
    videoKey,
    language,
    status: "queued",
    stage: "Queued",
    progress: 0,
    totalChunks: 0,
    completedChunks: 0,
    result: null,
    error: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };
  transcribeJobs.set(jobId, job);
  transcribeJobBySession.set(sessionId, jobId);
  transcribeQueue.push(jobId);
  processTranscribeQueue();

  setTimeout(() => {
    const latestJobId = transcribeJobBySession.get(sessionId);
    if (latestJobId === jobId) {
      transcribeJobBySession.delete(sessionId);
    }
    transcribeJobs.delete(jobId);
  }, TRANSCRIBE_JOB_RETENTION_MS);

  return job;
};

app.post("/transcribe/queue", authMiddleware, async (req, res) => {
  try {
    const { sessionId, videoKey, language = "en" } = req.body || {};
    if (!sessionId || typeof sessionId !== "string") {
      return res.status(400).json({ error: "Missing sessionId" });
    }
    if (!videoKey || typeof videoKey !== "string") {
      return res.status(400).json({ error: "Missing videoKey" });
    }
    const job = enqueueTranscribeJob({
      sessionId,
      videoKey,
      language: typeof language === "string" ? language : "en",
    });
    const includeResult = job.status === "complete";
    const statusCode = includeResult ? 200 : 202;
    return res
      .status(statusCode)
      .json(toTranscribeJobPayload(job, includeResult));
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to queue transcription.";
    return res.status(500).json({ error: message });
  }
});

app.get("/transcribe/status/:sessionId", authMiddleware, (req, res) => {
  const sessionId = req.params.sessionId;
  if (!sessionId) {
    return res.status(400).json({ error: "Missing sessionId" });
  }
  const jobId = transcribeJobBySession.get(sessionId);
  if (!jobId) {
    return res.status(404).json({ error: "Transcription job not found." });
  }
  const job = transcribeJobs.get(jobId);
  if (!job) {
    transcribeJobBySession.delete(sessionId);
    return res.status(404).json({ error: "Transcription job not found." });
  }
  const includeResult = job.status === "complete";
  const statusCode =
    job.status === "complete" || job.status === "error" ? 200 : 202;
  return res
    .status(statusCode)
    .json(toTranscribeJobPayload(job, includeResult));
});

// Transcribe video synchronously (legacy endpoint).
app.post("/transcribe", authMiddleware, async (req, res) => {
  try {
    const { sessionId, videoKey, language = "en" } = req.body || {};
    if (!sessionId || !videoKey) {
      return res.status(400).json({ error: "Missing sessionId or videoKey" });
    }
    const result = await runTranscriptionPipeline({
      sessionId,
      videoKey,
      language,
    });
    return res.json(result);
  } catch (error) {
    console.error("Transcribe error:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Transcription failed.",
    });
  }
});

// Render clips
app.post("/render", authMiddleware, async (req, res) => {
  const { sessionId, videoKey, clips, quality = "high", cropMode = "auto" } =
    req.body;

  if (!clips?.length) {
    return res.status(400).json({ error: "No clips provided" });
  }
  if (!videoKey) {
    return res.status(400).json({ error: "Missing videoKey" });
  }
  if (activeRenders >= MAX_RENDER_CONCURRENCY) {
    return res.status(429).json({ error: "Render busy. Try again soon." });
  }

  const normalizedClips = clips.map((clip, index) => ({
    index,
    start: Number(clip?.start),
    end: Number(clip?.end),
    highlightIndex: Number(clip?.highlightIndex),
  }));
  const invalidClip = normalizedClips.find(
    (clip) =>
      !Number.isFinite(clip.start) ||
      !Number.isFinite(clip.end) ||
      clip.end <= clip.start
  );
  if (invalidClip) {
    return res.status(400).json({
      error: `Invalid clip range at index ${invalidClip.index}.`,
    });
  }

  activeRenders += 1;
  try {
    // Download video from Supabase
    const videoPath = path.join(TEMP_DIR, `${sessionId}_video.mp4`);
    
    const { data: videoData, error: downloadError } = await supabase.storage
      .from(BUCKET)
      .download(videoKey);

    if (downloadError) throw downloadError;

    await fs.writeFile(videoPath, Buffer.from(await videoData.arrayBuffer()));
    const sourceMetadata = await getVideoMetadata(videoPath).catch(() => null);
    const sourceFps =
      sourceMetadata &&
      Number.isFinite(sourceMetadata.frameRate) &&
      sourceMetadata.frameRate > 0
        ? sourceMetadata.frameRate
        : MAX_RENDER_FPS;
    const renderFps = Math.max(
      24,
      Math.min(MAX_RENDER_FPS, Math.round(sourceFps))
    );
    const qualityMode =
      quality === "medium" || quality === "low" ? quality : "high";
    const renderHeight =
      qualityMode === "high"
        ? Math.max(RENDER_HEIGHT, 1920)
        : qualityMode === "medium"
          ? Math.max(RENDER_HEIGHT, 1600)
          : RENDER_HEIGHT;
    const renderWidth = toEven(Math.round(renderHeight * 9 / 16));

    const outputs = [];

    for (let i = 0; i < normalizedClips.length; i++) {
      const clip = normalizedClips[i];
      const clipFilename = `clip_${i}_${Date.now()}.mp4`;
      const clipPath = path.join(TEMP_DIR, `${sessionId}_clip_${i}.mp4`);
      const outputPath = path.join(TEMP_DIR, clipFilename);

      // Step 1: Extract clip segment and re-encode to H.264 (OpenCV can't read AV1)
      await new Promise((resolve, reject) => {
        const clipDuration = clip.end - clip.start;
        const ffmpeg = spawn("ffmpeg", [
          "-hide_banner", "-loglevel", "error",
          "-y",
          "-ss", String(clip.start),
          "-i", videoPath,
          "-t", String(clipDuration),
          "-map", "0:v:0",
          "-map", "0:a:0?",
          "-r", String(renderFps),
          "-c:v", "libx264",
          "-preset", RENDER_PRESET,
          "-crf", "18",
          "-threads", String(FFMPEG_THREADS),
          "-c:a", "aac",
          "-b:a", "128k",
          "-reset_timestamps", "1",
          "-avoid_negative_ts", "make_zero",
          clipPath,
        ]);
        let stderr = "";
        ffmpeg.stderr.on("data", (data) => (stderr += data.toString()));
        ffmpeg.on("close", (code, signal) => {
          if (code === 0) return resolve();
          const reason = signal ? `signal ${signal}` : `code ${code}`;
          reject(new Error(`Clip extraction failed (${reason}): ${stderr.slice(-500)}`));
        });
        ffmpeg.on("error", (err) =>
          reject(new Error(`FFmpeg spawn error: ${err.message}`))
        );
      });

      // Step 2: Crop with Python face detection (mediapipe)
      // Python now outputs proper H.264 with correct timestamps via FFmpeg pipe
      const croppedVideoOnly = path.join(TEMP_DIR, `${sessionId}_cropped_${i}.mp4`);
      await new Promise((resolve, reject) => {
        console.log(`Running Python crop: mode=${cropMode}, input=${clipPath}, output=${croppedVideoOnly}`);
        const python = spawn("python3", [
          "/app/scripts/crop.py",
          "--input", clipPath,
          "--output", croppedVideoOnly,
          "--mode", cropMode,
        ]);
        let stderr = "";
        let stdout = "";
        python.stdout.on("data", (data) => (stdout += data.toString()));
        python.stderr.on("data", (data) => (stderr += data.toString()));
        python.on("close", (code) => {
          if (code === 0) {
            console.log("Python crop succeeded");
            resolve();
          } else {
            console.error("Python crop failed:", stderr);
            reject(new Error(`Face detection failed: ${stderr.slice(-500)}`));
          }
        });
        python.on("error", (err) => reject(new Error(`Python spawn error: ${err.message}`)));
      });

      // Step 3: Scale to 1080x1920 and merge with audio from original clip
      const crf = qualityMode === "high" ? "18" : qualityMode === "medium" ? "22" : "27";
      const audioBitrate =
        qualityMode === "high" ? "192k" : qualityMode === "medium" ? "160k" : "128k";
      
      await new Promise((resolve, reject) => {
        const ffmpeg = spawn("ffmpeg", [
          "-hide_banner", "-loglevel", "error",
          "-y",
          "-fflags", "+genpts",
          "-i", croppedVideoOnly,    // Cropped video from Python
          "-fflags", "+genpts",
          "-i", clipPath,             // Original clip (for audio)
          "-map", "0:v:0",            // Take video from first input
          "-map", "1:a:0?",           // Take audio from second input (optional)
          "-filter_threads", String(FFMPEG_THREADS),
          "-vf", `scale=${renderWidth}:${renderHeight}:flags=${SCALE_FLAGS}`,
          "-r", String(renderFps),
          "-c:v", "libx264",
          "-preset", RENDER_PRESET,
          "-crf", crf,
          "-threads", String(FFMPEG_THREADS),
          "-c:a", "aac",
          "-b:a", audioBitrate,
          "-shortest",
          "-movflags", "+faststart",
          "-avoid_negative_ts", "make_zero",
          outputPath,
        ]);

        let stderr = "";
        ffmpeg.stderr.on("data", (data) => (stderr += data.toString()));
        ffmpeg.on("close", (code, signal) => {
          if (code === 0) return resolve();
          const reason = signal ? `signal ${signal}` : `code ${code}`;
          reject(new Error(`FFmpeg encode failed (${reason}): ${stderr.slice(-1000)}`));
        });
        ffmpeg.on("error", (err) => reject(new Error(`FFmpeg spawn error: ${err.message}`)));
      });

      // Clean up cropped video
      await fs.unlink(croppedVideoOnly).catch(() => {});

      // Clean up intermediate files
      await fs.unlink(clipPath).catch(() => {});

      // Upload rendered clip to Supabase
      const clipKey = `sessions/${sessionId}/clips/${clipFilename}`;
      const clipBuffer = await fs.readFile(outputPath);
      
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(clipKey, clipBuffer, {
          contentType: "video/mp4",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Generate signed download URL (24 hours)
      const { data: urlData } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(clipKey, 60 * 60 * 24);

      outputs.push({
        index: i,
        clipKey,
        downloadUrl: urlData?.signedUrl,
        filename: clipFilename,
      });

      // Clean up temp file
      await fs.unlink(outputPath).catch(() => {});
    }

    // Clean up source video
    await fs.unlink(videoPath).catch(() => {});

    res.json({ outputs });
  } catch (error) {
    console.error("Render error:", error);
    res.status(500).json({ error: error.message });
  } finally {
    activeRenders = Math.max(0, activeRenders - 1);
  }
});

// Editor export (DOM render + FFmpeg)
app.post("/editor-export/start", authMiddleware, async (req, res) => {
  try {
    const payload = req.body || {};
    if (!payload.state || !payload.output || !payload.duration) {
      return res.status(400).json({ error: "Missing export payload." });
    }
    const job = enqueueExportJob(payload);
    const queueIndex = exportQueue.indexOf(job.id);
    res.json({
      jobId: job.id,
      status: job.status,
      stage: job.stage,
      progress: job.progress,
      queuePosition: queueIndex >= 0 ? queueIndex + 1 : null,
      activeExports,
      maxConcurrency: MAX_EXPORT_CONCURRENCY,
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to queue export." });
  }
});

app.get("/editor-export/status/:jobId", authMiddleware, (req, res) => {
  const jobId = req.params.jobId;
  const job = exportJobs.get(jobId);
  if (!job) {
    return res.status(404).json({ error: "Export job not found." });
  }
  const queueIndex = exportQueue.indexOf(jobId);
  res.json({
    jobId: job.id,
    status: job.status,
    stage: job.stage,
    progress: job.progress,
    framesRendered: job.framesRendered,
    framesTotal: job.framesTotal,
    downloadUrl: job.downloadUrl,
    error: job.error,
    queuePosition: queueIndex >= 0 ? queueIndex + 1 : null,
    activeExports,
    maxConcurrency: MAX_EXPORT_CONCURRENCY,
  });
});

// Generate preview clip
app.post("/preview", authMiddleware, async (req, res) => {
  try {
    const { sessionId, videoKey, start, end } = req.body;

    // Download video from Supabase
    const videoPath = path.join(TEMP_DIR, `${sessionId}_preview_src.mp4`);
    const previewPath = path.join(TEMP_DIR, `${sessionId}_preview.mp4`);

    const { data: videoData, error: downloadError } = await supabase.storage
      .from(BUCKET)
      .download(videoKey);

    if (downloadError) throw downloadError;

    await fs.writeFile(videoPath, Buffer.from(await videoData.arrayBuffer()));

    // Generate preview with FFmpeg (lower quality for speed)
    await new Promise((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", [
        "-hide_banner", "-loglevel", "error",
        "-y",
        "-ss", String(start),
        "-i", videoPath,
        "-t", String(Math.min(end - start, 60)), // Max 60s preview
        "-map", "0:v:0",
        "-map", "0:a?",
        "-vf", "scale=540:-2:flags=fast_bilinear",
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-crf", "28",
        "-pix_fmt", "yuv420p",
        "-threads", String(FFMPEG_THREADS),
        "-c:a", "aac",
        "-b:a", "96k",
        "-movflags", "+faststart",
        previewPath,
      ]);
      let stderr = "";
      ffmpeg.stderr.on("data", (data) => (stderr += data.toString()));
      ffmpeg.on("close", (code, signal) => {
        if (code === 0) return resolve();
        const reason = signal ? `signal ${signal}` : `code ${code}`;
        reject(new Error(`Preview generation failed (${reason}): ${stderr}`));
      });
      ffmpeg.on("error", (err) => reject(new Error(`FFmpeg spawn error: ${err.message}`)));
    });

    // Upload preview to Supabase
    const previewKey = `sessions/${sessionId}/preview_${start}_${end}.mp4`;
    const previewBuffer = await fs.readFile(previewPath);
    
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(previewKey, previewBuffer, {
        contentType: "video/mp4",
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // Generate signed URL (1 hour)
    const { data: urlData } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(previewKey, 60 * 60);

    // Clean up
    await Promise.all([
      fs.unlink(videoPath).catch(() => {}),
      fs.unlink(previewPath).catch(() => {}),
    ]);

    res.json({ previewUrl: urlData?.signedUrl, previewKey });
  } catch (error) {
    console.error("Preview error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get signed download URL
app.post("/download-url", authMiddleware, async (req, res) => {
  try {
    const { key } = req.body;
    const { data } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(key, 60 * 60 * 24);
    res.json({ url: data?.signedUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cleanup session files
app.post("/cleanup", authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    // List all files in session folder
    const { data: files } = await supabase.storage
      .from(BUCKET)
      .list(`sessions/${sessionId}`, { limit: 100 });

    if (files?.length) {
      const paths = files.map((f) => `sessions/${sessionId}/${f.name}`);
      await supabase.storage.from(BUCKET).remove(paths);
    }

    // Also clean clips subfolder
    const { data: clips } = await supabase.storage
      .from(BUCKET)
      .list(`sessions/${sessionId}/clips`, { limit: 100 });

    if (clips?.length) {
      const clipPaths = clips.map((f) => `sessions/${sessionId}/clips/${f.name}`);
      await supabase.storage.from(BUCKET).remove(clipPaths);
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get video metadata for already-uploaded file
app.post("/metadata", authMiddleware, async (req, res) => {
  try {
    const { sessionId, videoKey } = req.body;
    
    if (!videoKey) {
      return res.status(400).json({ error: "Missing videoKey" });
    }

    // Download video from Supabase
    const videoPath = path.join(TEMP_DIR, `${sessionId}_metadata.mp4`);
    
    const { data: videoData, error: downloadError } = await supabase.storage
      .from(BUCKET)
      .download(videoKey);

    if (downloadError) throw downloadError;

    await fs.writeFile(videoPath, Buffer.from(await videoData.arrayBuffer()));

    // Get metadata
    const metadata = await getVideoMetadata(videoPath);

    // Clean up
    await fs.unlink(videoPath).catch(() => {});

    res.json({ metadata });
  } catch (error) {
    console.error("Metadata error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Helper: Get video metadata with ffprobe
async function getVideoMetadata(filePath) {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn("ffprobe", [
      "-v", "quiet",
      "-print_format", "json",
      "-show_format",
      "-show_streams",
      filePath,
    ]);

    let stdout = "";
    ffprobe.stdout.on("data", (data) => (stdout += data.toString()));
    ffprobe.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error("ffprobe failed"));
      }
      try {
        const data = JSON.parse(stdout);
        const videoStream = data.streams?.find((s) => s.codec_type === "video");
        const parseFrameRate = (value) => {
          if (!value) {
            return null;
          }
          const raw = String(value).trim();
          if (!raw) {
            return null;
          }
          if (raw.includes("/")) {
            const [numRaw, denRaw] = raw.split("/");
            const numerator = Number(numRaw);
            const denominator = Number(denRaw);
            if (
              Number.isFinite(numerator) &&
              Number.isFinite(denominator) &&
              denominator > 0
            ) {
              const fps = numerator / denominator;
              return Number.isFinite(fps) && fps > 0 ? fps : null;
            }
            return null;
          }
          const fps = Number(raw);
          return Number.isFinite(fps) && fps > 0 ? fps : null;
        };
        const frameRate =
          parseFrameRate(videoStream?.avg_frame_rate) ??
          parseFrameRate(videoStream?.r_frame_rate);
        const audioStreams = Array.isArray(data.streams)
          ? data.streams.filter((s) => s.codec_type === "audio")
          : [];
        const audioStream = audioStreams[0];
        const audioStreamIndices = audioStreams
          .map((stream) =>
            typeof stream?.index === "number" && Number.isFinite(stream.index)
              ? stream.index
              : null
          )
          .filter((index) => index != null);
        resolve({
          duration: parseFloat(data.format?.duration || "0"),
          frameRate,
          width: videoStream?.width || null,
          height: videoStream?.height || null,
          audioStreamIndices,
          audioStreamIndex:
            typeof audioStream?.index === "number" &&
            Number.isFinite(audioStream.index)
              ? audioStream.index
              : null,
        });
      } catch (e) {
        reject(e);
      }
    });
    ffprobe.on("error", (err) => reject(new Error(`ffprobe spawn error: ${err.message}`)));
  });
}

app.listen(PORT, () => {
  console.log(`AutoClip Worker running on port ${PORT}`);
  console.log(
    `[worker] export concurrency=${MAX_EXPORT_CONCURRENCY} (auto=${AUTO_EXPORT_CONCURRENCY}, cpuBound=${cpuBoundExportConcurrency}, memoryBound=${memoryBoundExportConcurrency}, totalMemoryMb=${TOTAL_MEMORY_MB})`
  );
  console.log(
    `[worker] editor export ffmpeg threads per job=${EXPORT_FFMPEG_THREADS} (cpuCount=${CPU_COUNT})`
  );
  console.log(
    `[worker] transcription concurrency=${MAX_TRANSCRIBE_CONCURRENCY} chunkSeconds=${TRANSCRIBE_CHUNK_SECONDS} chunkBitrate=${TRANSCRIBE_AUDIO_BITRATE}`
  );
  console.log(
    `[worker] editor export quality preset=${EXPORT_VIDEO_PRESET} crf=${EXPORT_VIDEO_CRF} audioBitrate=${EXPORT_AUDIO_BITRATE} frameFormat=${EXPORT_FRAME_FORMAT}`
  );
});
