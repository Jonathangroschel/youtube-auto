import express from "express";
import cors from "cors";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { chromium } from "playwright";

const app = express();
const PORT = process.env.PORT || 3001;
const WORKER_SECRET = process.env.WORKER_SECRET || "dev-secret";
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

const MAX_RENDER_CONCURRENCY = toPositiveInt(
  process.env.AUTOCLIP_RENDER_CONCURRENCY,
  1
);
const FFMPEG_THREADS = toPositiveInt(process.env.AUTOCLIP_FFMPEG_THREADS, 1);
const MAX_RENDER_FPS = toPositiveInt(process.env.AUTOCLIP_MAX_RENDER_FPS, 30);
const MAX_RENDER_HEIGHT = toPositiveInt(
  process.env.AUTOCLIP_MAX_RENDER_HEIGHT,
  1280
);
const TRANSCRIBE_CHUNK_SECONDS = toPositiveInt(
  process.env.AUTOCLIP_TRANSCRIBE_CHUNK_SECONDS,
  600
);
const TRANSCRIBE_AUDIO_BITRATE =
  process.env.AUTOCLIP_TRANSCRIBE_BITRATE || "64k";
const RENDER_PRESET = process.env.AUTOCLIP_FFMPEG_PRESET || "veryfast";
const SCALE_FLAGS = process.env.AUTOCLIP_SCALE_FLAGS || "fast_bilinear";
const RENDER_HEIGHT = toEven(MAX_RENDER_HEIGHT);
const RENDER_WIDTH = toEven(Math.round(RENDER_HEIGHT * 9 / 16));

let activeRenders = 0;
let activeExports = 0;

const EXPORT_RENDER_URL =
  process.env.EDITOR_RENDER_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const EXPORT_RENDER_SECRET =
  process.env.EDITOR_RENDER_SECRET || WORKER_SECRET;
const EXPORT_BUCKET = process.env.EDITOR_EXPORT_BUCKET || BUCKET;
const EXPORT_FPS_DEFAULT = toPositiveInt(process.env.EDITOR_EXPORT_FPS, 30);
const EXPORT_JPEG_QUALITY = toPositiveInt(process.env.EDITOR_EXPORT_JPEG_QUALITY, 90);
const MAX_EXPORT_CONCURRENCY = toPositiveInt(
  process.env.EDITOR_EXPORT_CONCURRENCY,
  1
);

const exportQueue = [];
const exportJobs = new Map();

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
  processExportQueue().catch(() => {});
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
  let context = null;
  let page = null;

  if (!state || !output?.width || !output?.height || duration <= 0) {
    throw new Error("Invalid export payload.");
  }

  const width = toEven(output.width);
  const height = toEven(output.height);
  const framesTotal = Math.max(1, Math.ceil(duration * fps));

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
    browser = await chromium.launch({
      args: ["--disable-dev-shm-usage", "--no-sandbox"],
    });

    context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 1,
    });
    page = await context.newPage();

    await page.addInitScript((payload) => {
      window.__EDITOR_EXPORT__ = payload;
    }, {
      state,
      output: { width, height },
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
    await page.goto(`${renderUrl}/editor/advanced?${renderParams.toString()}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForFunction(
      () => window.__EDITOR_EXPORT_API__ && typeof window.__EDITOR_EXPORT_API__.waitForReady === "function",
      { timeout: 120000 }
    );
    await page.evaluate(() => window.__EDITOR_EXPORT_API__.waitForReady());

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
    const ffmpeg = spawn("ffmpeg", [
      "-hide_banner", "-loglevel", "error",
      "-y",
      "-f", "image2pipe",
      "-vcodec", "mjpeg",
      "-r", String(fps),
      "-i", "pipe:0",
      "-an",
      "-c:v", "libx264",
      "-preset", RENDER_PRESET,
      "-crf", "18",
      "-pix_fmt", "yuv420p",
      "-threads", String(FFMPEG_THREADS),
      "-movflags", "+faststart",
      videoPath,
    ]);

    const writeFrame = (buffer) =>
      new Promise((resolve) => {
        const canWrite = ffmpeg.stdin.write(buffer);
        if (canWrite) {
          resolve();
        } else {
          ffmpeg.stdin.once("drain", resolve);
        }
      });

    for (let i = 0; i < framesTotal; i += 1) {
      const time = i / fps;
      await page.evaluate((value) => window.__EDITOR_EXPORT_API__.setTime(value), time);
      const buffer = await stageHandle.screenshot({
        type: "jpeg",
        quality: EXPORT_JPEG_QUALITY,
      });
      await writeFrame(buffer);
      const framesRendered = i + 1;
      updateExportJob(job.id, {
        framesRendered,
        progress: 0.05 + (framesRendered / framesTotal) * 0.85,
      });
    }

    ffmpeg.stdin.end();
    await new Promise((resolve, reject) => {
      let stderr = "";
      ffmpeg.stderr.on("data", (data) => (stderr += data.toString()));
      ffmpeg.on("close", (code, signal) => {
        if (code === 0) return resolve();
        const reason = signal ? `signal ${signal}` : `code ${code}`;
        reject(new Error(`FFmpeg encode failed (${reason}): ${stderr.slice(-500)}`));
      });
      ffmpeg.on("error", (err) => reject(new Error(`FFmpeg spawn error: ${err.message}`)));
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
          "-b:a", "192k",
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
    const buffer = await fs.readFile(finalPath);
    const { error: uploadError } = await supabase.storage
      .from(EXPORT_BUCKET)
      .upload(exportKey, buffer, {
        contentType: "video/mp4",
        upsert: true,
      });
    if (uploadError) {
      throw uploadError;
    }
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
    if (page) {
      await page.close().catch(() => {});
    }
    if (context) {
      await context.close().catch(() => {});
    }
    if (browser) {
      await browser.close().catch(() => {});
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

const processExportQueue = async () => {
  if (activeExports >= MAX_EXPORT_CONCURRENCY) {
    return;
  }
  const nextId = exportQueue.shift();
  if (!nextId) {
    return;
  }
  const job = exportJobs.get(nextId);
  if (!job) {
    processExportQueue().catch(() => {});
    return;
  }
  activeExports += 1;
  try {
    await runEditorExportJob(job);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Export failed.";
    updateExportJob(job.id, {
      status: "error",
      stage: "Export failed",
      error: message,
    });
  } finally {
    activeExports = Math.max(0, activeExports - 1);
    processExportQueue().catch(() => {});
  }
};

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
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

// Transcribe video
app.post("/transcribe", authMiddleware, async (req, res) => {
  const cleanupTargets = [];
  try {
    const { sessionId, videoKey, language = "en" } = req.body;

    // Download video from Supabase
    const videoPath = path.join(TEMP_DIR, `${sessionId}_video.mp4`);
    const audioChunkDir = path.join(TEMP_DIR, `${sessionId}_audio_chunks`);
    cleanupTargets.push(videoPath, audioChunkDir);

    const { data: videoData, error: downloadError } = await supabase.storage
      .from(BUCKET)
      .download(videoKey);

    if (downloadError) throw downloadError;

    await fs.writeFile(videoPath, Buffer.from(await videoData.arrayBuffer()));

    // Extract audio into chunks to stay under Whisper limits.
    await fs.mkdir(audioChunkDir, { recursive: true });
    const chunkPattern = path.join(audioChunkDir, "chunk_%03d.mp3");
    await new Promise((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", [
        "-hide_banner", "-loglevel", "error",
        "-y", "-i", videoPath,
        "-vn", "-ac", "1", "-ar", "16000",
        "-b:a", TRANSCRIBE_AUDIO_BITRATE,
        "-f", "segment",
        "-segment_time", String(TRANSCRIBE_CHUNK_SECONDS),
        "-reset_timestamps", "1",
        chunkPattern,
      ]);
      let stderr = "";
      ffmpeg.stderr.on("data", (data) => (stderr += data.toString()));
      ffmpeg.on("close", (code) =>
        code === 0
          ? resolve()
          : reject(new Error(`FFmpeg audio chunking failed: ${stderr}`))
      );
      ffmpeg.on("error", (err) => reject(new Error(`FFmpeg spawn error: ${err.message}`)));
    });

    const chunkFiles = (await fs.readdir(audioChunkDir))
      .filter((name) => name.endsWith(".mp3"))
      .sort()
      .map((name) => path.join(audioChunkDir, name));
    if (!chunkFiles.length) {
      throw new Error("No audio chunks were created for transcription.");
    }

    const requestedLanguage =
      typeof language === "string" && language.trim().length > 0
        ? language
        : undefined;
    const allSegments = [];
    const allWords = [];
    let fullText = "";
    let detectedLanguage = null;
    let offsetSeconds = 0;

    for (const chunkPath of chunkFiles) {
      const audioBuffer = await fs.readFile(chunkPath);
      const audioFile = new File([audioBuffer], path.basename(chunkPath), {
        type: "audio/mpeg",
      });

      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: "whisper-1",
        language: requestedLanguage,
        response_format: "verbose_json",
        timestamp_granularities: ["word", "segment"],
      });

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

      const chunkMetadata = await getVideoMetadata(chunkPath).catch(() => null);
      const chunkDuration =
        chunkMetadata &&
        Number.isFinite(chunkMetadata.duration) &&
        chunkMetadata.duration > 0
          ? chunkMetadata.duration
          : TRANSCRIBE_CHUNK_SECONDS;
      offsetSeconds += chunkDuration;

      await fs.unlink(chunkPath).catch(() => {});
    }

    res.json({
      segments: allSegments,
      words: allWords,
      text: fullText,
      language: detectedLanguage,
    });
  } catch (error) {
    console.error("Transcribe error:", error);
    res.status(500).json({ error: error.message });
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
          "-r", String(MAX_RENDER_FPS),
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
      const crf = quality === "high" ? "23" : quality === "medium" ? "26" : "30";
      
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
          "-vf", `scale=${RENDER_WIDTH}:${RENDER_HEIGHT}:flags=${SCALE_FLAGS}`,
          "-r", String(MAX_RENDER_FPS),
          "-c:v", "libx264",
          "-preset", RENDER_PRESET,
          "-crf", crf,
          "-threads", String(FFMPEG_THREADS),
          "-c:a", "aac",
          "-b:a", "128k",
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
    res.json({
      jobId: job.id,
      status: job.status,
      stage: job.stage,
      progress: job.progress,
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
  res.json({
    jobId: job.id,
    status: job.status,
    stage: job.stage,
    progress: job.progress,
    framesRendered: job.framesRendered,
    framesTotal: job.framesTotal,
    downloadUrl: job.downloadUrl,
    error: job.error,
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
        "-vf", "scale=540:-2",
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-crf", "28",
        "-threads", String(FFMPEG_THREADS),
        "-c:a", "aac",
        "-b:a", "96k",
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
        resolve({
          duration: parseFloat(data.format?.duration || "0"),
          width: videoStream?.width || null,
          height: videoStream?.height || null,
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
});
