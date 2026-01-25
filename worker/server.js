import express from "express";
import cors from "cors";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

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

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));

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
