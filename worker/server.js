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
        url,
      ]);

      let stderr = "";
      ytdlp.stderr.on("data", (data) => (stderr += data.toString()));
      ytdlp.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`yt-dlp failed: ${stderr}`));
      });
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
  try {
    const { sessionId, videoKey, language = "en" } = req.body;

    // Download video from Supabase
    const videoPath = path.join(TEMP_DIR, `${sessionId}_video.mp4`);
    const audioPath = path.join(TEMP_DIR, `${sessionId}_audio.mp3`);

    const { data: videoData, error: downloadError } = await supabase.storage
      .from(BUCKET)
      .download(videoKey);

    if (downloadError) throw downloadError;

    await fs.writeFile(videoPath, Buffer.from(await videoData.arrayBuffer()));

    // Extract audio with FFmpeg
    await new Promise((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", [
        "-y", "-i", videoPath,
        "-vn", "-acodec", "libmp3lame", "-q:a", "4",
        audioPath,
      ]);
      ffmpeg.on("close", (code) =>
        code === 0 ? resolve() : reject(new Error("FFmpeg audio extraction failed"))
      );
    });

    // Transcribe with OpenAI Whisper
    const audioBuffer = await fs.readFile(audioPath);
    const audioFile = new File([audioBuffer], "audio.mp3", { type: "audio/mpeg" });
    
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language,
      response_format: "verbose_json",
      timestamp_granularities: ["word", "segment"],
    });

    // Clean up
    await Promise.all([
      fs.unlink(videoPath).catch(() => {}),
      fs.unlink(audioPath).catch(() => {}),
    ]);

    res.json({
      segments: transcription.segments || [],
      words: transcription.words || [],
      text: transcription.text,
      language: transcription.language,
    });
  } catch (error) {
    console.error("Transcribe error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Render clips
app.post("/render", authMiddleware, async (req, res) => {
  try {
    const { sessionId, videoKey, clips, quality = "high" } = req.body;

    if (!clips?.length) {
      return res.status(400).json({ error: "No clips provided" });
    }

    // Download video from Supabase
    const videoPath = path.join(TEMP_DIR, `${sessionId}_video.mp4`);
    
    const { data: videoData, error: downloadError } = await supabase.storage
      .from(BUCKET)
      .download(videoKey);

    if (downloadError) throw downloadError;

    await fs.writeFile(videoPath, Buffer.from(await videoData.arrayBuffer()));

    const outputs = [];

    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      const outputFilename = `clip_${i}_${Date.now()}.mp4`;
      const outputPath = path.join(TEMP_DIR, outputFilename);

      // Render with FFmpeg (vertical 9:16 crop)
      const crf = quality === "high" ? "18" : quality === "medium" ? "23" : "28";
      
      await new Promise((resolve, reject) => {
        const ffmpeg = spawn("ffmpeg", [
          "-y",
          "-ss", String(clip.start),
          "-i", videoPath,
          "-t", String(clip.end - clip.start),
          "-vf", "crop=ih*9/16:ih,scale=1080:1920",
          "-c:v", "libx264",
          "-preset", "fast",
          "-crf", crf,
          "-c:a", "aac",
          "-b:a", "128k",
          outputPath,
        ]);

        let stderr = "";
        ffmpeg.stderr.on("data", (data) => (stderr += data.toString()));
        ffmpeg.on("close", (code) => {
          if (code === 0) resolve();
          else reject(new Error(`FFmpeg render failed: ${stderr}`));
        });
      });

      // Upload rendered clip to Supabase
      const clipKey = `sessions/${sessionId}/clips/${outputFilename}`;
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
        filename: outputFilename,
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
        "-y",
        "-ss", String(start),
        "-i", videoPath,
        "-t", String(Math.min(end - start, 60)), // Max 60s preview
        "-vf", "scale=540:-2",
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-crf", "28",
        "-c:a", "aac",
        "-b:a", "96k",
        previewPath,
      ]);
      ffmpeg.on("close", (code) =>
        code === 0 ? resolve() : reject(new Error("Preview generation failed"))
      );
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
  });
}

app.listen(PORT, () => {
  console.log(`AutoClip Worker running on port ${PORT}`);
});
