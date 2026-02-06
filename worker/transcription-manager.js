import { spawn } from "child_process";
import { createReadStream, promises as fs } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const MIN_AUDIO_BYTES = 4096;
const MAX_TRANSCRIBE_UPLOAD_BYTES = 24 * 1024 * 1024;

const wait = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const nowIso = () => new Date().toISOString();

const compactMessage = (value, limit = 300) => {
  const normalized = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) {
    return "No stderr output.";
  }
  return normalized.length > limit
    ? `${normalized.slice(0, limit)}...`
    : normalized;
};

const summarizeDecodeWarnings = (stderr) => {
  const message = String(stderr ?? "");
  const tokens = [
    "Reserved bit set",
    "invalid band type",
    "Invalid data found",
    "Not yet implemented in FFmpeg",
    "Prediction is not allowed",
    "channel element",
  ];
  return tokens.filter((token) => message.includes(token)).join(", ");
};

const countDecodeWarnings = (value) => {
  const message = String(value ?? "");
  const matches = message.match(
    /Invalid data found|Reserved bit set|invalid band type|Prediction is not allowed|channel element .*not allocated|Not yet implemented in FFmpeg/gi
  );
  return Array.isArray(matches) ? matches.length : 0;
};

const formatErrorDetail = (error) => {
  const parts = [];
  const message =
    error instanceof Error
      ? error.message
      : typeof error?.message === "string"
        ? error.message
        : String(error ?? "");
  if (message) {
    parts.push(message);
  }

  const status = Number(error?.status);
  if (Number.isFinite(status)) {
    parts.push(`status=${status}`);
  }

  const code =
    error?.code ||
    error?.cause?.code ||
    error?.cause?.cause?.code ||
    null;
  if (typeof code === "string" && code.trim()) {
    parts.push(`code=${code.trim()}`);
  }

  const causeMessage =
    typeof error?.cause?.message === "string"
      ? error.cause.message
      : typeof error?.cause?.cause?.message === "string"
        ? error.cause.cause.message
        : "";
  if (causeMessage && !parts.join(" ").includes(causeMessage)) {
    parts.push(`cause=${causeMessage}`);
  }

  const out = parts.join(" | ").trim();
  return out || "Unknown error";
};

const safeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const contentTypeForAudioFile = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".wav") {
    return "audio/wav";
  }
  if (ext === ".m4a") {
    return "audio/mp4";
  }
  if (ext === ".mp4") {
    return "audio/mp4";
  }
  if (ext === ".webm") {
    return "audio/webm";
  }
  if (ext === ".ogg") {
    return "audio/ogg";
  }
  return "audio/mpeg";
};

const normalizeSegments = (segments) =>
  (Array.isArray(segments) ? segments : [])
    .map((segment) => ({
      start: safeNumber(segment?.start, NaN),
      end: safeNumber(segment?.end, NaN),
      text: String(segment?.text ?? "").trim(),
    }))
    .filter(
      (segment) =>
        Number.isFinite(segment.start) &&
        Number.isFinite(segment.end) &&
        segment.end > segment.start &&
        segment.text.length > 0
    );

const normalizeWords = (words) =>
  (Array.isArray(words) ? words : [])
    .map((word) => ({
      start: safeNumber(word?.start, NaN),
      end: safeNumber(word?.end, NaN),
      word: String(word?.word ?? word?.text ?? "").trim(),
    }))
    .filter(
      (word) =>
        Number.isFinite(word.start) &&
        Number.isFinite(word.end) &&
        word.end > word.start &&
        word.word.length > 0
    );

const hasTranscriptionContent = (transcription) => {
  const hasSegments = normalizeSegments(transcription?.segments).length > 0;
  const hasWords = normalizeWords(transcription?.words).length > 0;
  const hasText =
    typeof transcription?.text === "string" &&
    transcription.text.trim().length > 0;
  return hasSegments || hasWords || hasText;
};

const buildOffsetTranscription = (transcription, offsetSeconds) => {
  const segments = normalizeSegments(transcription?.segments).map((segment) => ({
    ...segment,
    start: segment.start + offsetSeconds,
    end: segment.end + offsetSeconds,
  }));
  const words = normalizeWords(transcription?.words).map((word) => ({
    ...word,
    start: word.start + offsetSeconds,
    end: word.end + offsetSeconds,
  }));
  const text = typeof transcription?.text === "string" ? transcription.text.trim() : "";
  const language =
    typeof transcription?.language === "string" && transcription.language.trim()
      ? transcription.language.trim()
      : null;

  return {
    segments,
    words,
    text,
    language,
  };
};

const mergeTranscriptionSlices = (slices) => {
  const segments = [];
  const words = [];
  let text = "";
  let language = null;

  for (const slice of slices) {
    if (!slice) {
      continue;
    }
    if (Array.isArray(slice.segments) && slice.segments.length > 0) {
      segments.push(...slice.segments);
    }
    if (Array.isArray(slice.words) && slice.words.length > 0) {
      words.push(...slice.words);
    }
    const snippet = typeof slice.text === "string" ? slice.text.trim() : "";
    if (snippet) {
      text = text ? `${text} ${snippet}` : snippet;
    }
    if (!language && typeof slice.language === "string" && slice.language.trim()) {
      language = slice.language.trim();
    }
  }

  return {
    segments,
    words,
    text,
    language,
  };
};

const isRetryableOpenAIError = (error) => {
  const status = Number(error?.status);
  if (Number.isFinite(status) && (status === 408 || status === 429 || status >= 500)) {
    return true;
  }
  const message =
    error instanceof Error
      ? error.message
      : typeof error?.message === "string"
        ? error.message
        : "";
  return /timeout|timed out|temporar|rate limit|network|connection|socket|econn|503|502|504/i.test(
    message
  );
};

const isOpenAIConnectionError = (error) => {
  const status = Number(error?.status);
  if (Number.isFinite(status) && (status === 408 || status === 429 || status >= 500)) {
    return true;
  }
  const message =
    error instanceof Error
      ? error.message
      : typeof error?.message === "string"
        ? error.message
        : "";
  return /connection error|api connection|network|fetch failed|socket|econn|enotfound|eai_again|dns|timeout|timed out|etimedout|unreachable|connection reset/i.test(
    message
  );
};

const isChunkTooLargeError = (error) => {
  const status = Number(error?.status);
  if (status === 413) {
    return true;
  }
  const message =
    error instanceof Error
      ? error.message
      : typeof error?.message === "string"
        ? error.message
        : "";
  return /413|maximum content size limit|content size limit|entity too large|chunk is too large/i.test(
    message
  );
};

const runProcess = async (command, args, label) =>
  new Promise((resolve, reject) => {
    const proc = spawn(command, args);
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      resolve({
        label,
        code: Number.isFinite(code) ? code : -1,
        stdout,
        stderr,
      });
    });

    proc.on("error", (error) => {
      reject(new Error(`${command} spawn error (${label}): ${error.message}`));
    });
  });

const runFfmpeg = (args, label) => runProcess("ffmpeg", args, label);

const checkOpenAIConnectivity = async ({
  openai,
  openaiTimeoutMs,
  openaiConnectionMaxAttempts,
  openaiConnectionBackoffMs,
  openaiConnectionMaxBackoffMs,
}) => {
  const maxAttempts = Math.max(1, Math.min(3, openaiConnectionMaxAttempts));
  const timeoutMs = Math.max(5000, Math.min(20000, openaiTimeoutMs));
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => {
        controller.abort();
      }, timeoutMs);
      try {
        await openai.models.list({ signal: controller.signal });
      } finally {
        clearTimeout(timeoutHandle);
      }
      return;
    } catch (error) {
      lastError = error;
      if (!isOpenAIConnectionError(error) || attempt >= maxAttempts) {
        break;
      }

      const delayMs = Math.min(
        openaiConnectionMaxBackoffMs,
        openaiConnectionBackoffMs * Math.pow(2, Math.max(0, attempt - 1))
      );
      await wait(delayMs);
    }
  }

  throw new Error(
    `OpenAI connectivity check failed: ${formatErrorDetail(lastError)}`
  );
};

const getAudioStreamIndices = async (filePath) => {
  const result = await runProcess(
    "ffprobe",
    [
      "-v",
      "quiet",
      "-print_format",
      "json",
      "-show_streams",
      filePath,
    ],
    "ffprobe-streams"
  ).catch(() => null);

  if (!result || result.code !== 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(result.stdout);
    const streams = Array.isArray(parsed?.streams)
      ? parsed.streams.filter((stream) => stream?.codec_type === "audio")
      : [];
    return [...new Set(
      streams
        .map((stream) => (Number.isFinite(stream?.index) ? Number(stream.index) : null))
        .filter((value) => value != null)
    )].sort((a, b) => a - b);
  } catch {
    return [];
  }
};

const getDurationSeconds = async (filePath) => {
  const result = await runProcess(
    "ffprobe",
    [
      "-v",
      "quiet",
      "-print_format",
      "json",
      "-show_format",
      filePath,
    ],
    "ffprobe-duration"
  ).catch(() => null);

  if (!result || result.code !== 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(result.stdout);
    const duration = Number(parsed?.format?.duration);
    return Number.isFinite(duration) && duration > 0 ? duration : null;
  } catch {
    return null;
  }
};

const listSegmentFiles = async (directory, prefix) => {
  const names = await fs.readdir(directory).catch(() => []);
  return names
    .filter((name) => new RegExp(`^${prefix}_\\d+\\.mp3$`, "i").test(name))
    .sort()
    .map((name) => path.join(directory, name));
};

const chooseBestExtraction = (next, current) => {
  if (!current) {
    return true;
  }

  const nextOk = next.code === 0;
  const currentOk = current.code === 0;
  if (nextOk && !currentOk) {
    return true;
  }
  if (!nextOk && currentOk) {
    return false;
  }

  const nextWarnings = Number.isFinite(next.decodeWarnings)
    ? next.decodeWarnings
    : 0;
  const currentWarnings = Number.isFinite(current.decodeWarnings)
    ? current.decodeWarnings
    : 0;
  if (nextWarnings + 5 < currentWarnings) {
    return true;
  }
  if (currentWarnings + 5 < nextWarnings) {
    return false;
  }

  const nextDuration = Number.isFinite(next.duration) ? next.duration : -1;
  const currentDuration = Number.isFinite(current.duration) ? current.duration : -1;
  if (nextDuration > currentDuration + 1) {
    return true;
  }
  if (currentDuration > nextDuration + 1) {
    return false;
  }

  return next.size > current.size;
};

const extractNormalizedAudio = async ({
  videoPath,
  outputDir,
  audioBitrate,
}) => {
  const streamIndices = await getAudioStreamIndices(videoPath);
  const mapSpecs = [
    "0:a:0?",
    ...streamIndices.map((index) => `0:${index}`),
  ].filter((value, index, all) => all.indexOf(value) === index);

  let best = null;
  const tempOutputs = [];

  // -------------------------------------------------------------------
  // PASS 1 — Decode each candidate audio stream to raw PCM WAV.
  //
  // Decoding to PCM is the most error-tolerant output format: even when
  // the source AAC/Opus/Vorbis stream contains corrupt frames, the PCM
  // samples that *were* successfully decoded are written unchanged.
  // Going directly to MP3 in a single pass means the LAME encoder sees
  // garbage when the decoder emits warnings, producing audible glitches.
  // -------------------------------------------------------------------
  for (const mapSpec of mapSpecs) {
    const safeName = String(mapSpec).replace(/[^a-zA-Z0-9]+/g, "_");
    const wavPath = path.join(outputDir, `audio_${safeName}.wav`);
    tempOutputs.push(wavPath);
    await fs.unlink(wavPath).catch(() => {});

    const result = await runFfmpeg(
      [
        "-hide_banner",
        "-loglevel",
        "warning",
        "-fflags",
        "+discardcorrupt+genpts",
        "-err_detect",
        "ignore_err",
        "-max_error_rate",
        "1.0",
        "-analyzeduration",
        "20000000",
        "-probesize",
        "20000000",
        "-ignore_unknown",
        "-y",
        "-i",
        videoPath,
        "-map",
        mapSpec,
        "-vn",
        "-sn",
        "-dn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-af",
        "aresample=16000:async=1:first_pts=0",
        "-c:a",
        "pcm_s16le",
        "-f",
        "wav",
        wavPath,
      ],
      `extract-wav-${safeName}`
    );

    const stats = await fs.stat(wavPath).catch(() => null);
    if (!stats || stats.size <= MIN_AUDIO_BYTES) {
      continue;
    }

    const duration = await getDurationSeconds(wavPath);
    const candidate = {
      path: wavPath,
      mapSpec,
      code: result.code,
      stderr: result.stderr,
      decodeWarnings: countDecodeWarnings(result.stderr),
      size: stats.size,
      duration,
    };

    if (chooseBestExtraction(candidate, best)) {
      best = candidate;
    }
  }

  if (!best) {
    throw new Error("Audio extraction produced no usable output.");
  }

  if (best.code !== 0 || best.decodeWarnings > 0) {
    const warningSummary = summarizeDecodeWarnings(best.stderr);
    console.log(
      `[transcribe] decoded stream ${best.mapSpec} to WAV (exit ${best.code}, decodeWarnings=${best.decodeWarnings || 0})${warningSummary ? `; warningTypes=${warningSummary}` : ""}. Proceeding with clean PCM output.`
    );
  }

  // -------------------------------------------------------------------
  // PASS 2 — Encode the clean PCM WAV to MP3.
  //
  // Because the WAV already contains clean 16 kHz mono PCM, the LAME
  // encoder receives a perfect input and produces a valid MP3 with no
  // chance of inheriting decode-time corruption from the source.
  // -------------------------------------------------------------------
  const normalizedPath = path.join(outputDir, "audio_clean.mp3");
  const encodeResult = await runFfmpeg(
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      best.path,
      "-c:a",
      "libmp3lame",
      "-b:a",
      audioBitrate,
      normalizedPath,
    ],
    "encode-wav-to-mp3"
  );

  if (encodeResult.code !== 0) {
    const encodeStats = await fs.stat(normalizedPath).catch(() => null);
    if (!encodeStats || encodeStats.size <= MIN_AUDIO_BYTES) {
      throw new Error(
        `MP3 encoding from clean WAV failed: ${compactMessage(encodeResult.stderr)}`
      );
    }
    console.warn(
      `[transcribe] MP3 encode exited with code ${encodeResult.code} but produced output; continuing. ${compactMessage(encodeResult.stderr)}`
    );
  }

  // Clean up all intermediate WAV files.
  for (const filePath of tempOutputs) {
    await fs.unlink(filePath).catch(() => {});
  }

  return normalizedPath;
};

const splitNormalizedAudio = async ({
  inputPath,
  outputDir,
  chunkSeconds,
}) => {
  await fs.rm(outputDir, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(outputDir, { recursive: true });

  const outputPattern = path.join(outputDir, "segment_%04d.mp3");

  // The input is already a clean 16 kHz mono MP3 from the extraction
  // pass, so we can split with `-c copy` — no re-encoding needed.  This
  // is significantly faster and avoids any generation-loss artefacts.
  const result = await runFfmpeg(
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      inputPath,
      "-c",
      "copy",
      "-f",
      "segment",
      "-segment_time",
      String(chunkSeconds),
      "-reset_timestamps",
      "1",
      outputPattern,
    ],
    "segment-audio"
  );

  const files = await listSegmentFiles(outputDir, "segment");
  if (files.length === 0) {
    throw new Error(`Audio segmentation failed. ${compactMessage(result.stderr)}`);
  }

  if (result.code !== 0) {
    console.warn(
      `[transcribe] segmentation exited with code ${result.code}; using partial output. ${compactMessage(
        result.stderr
      )}`
    );
  }

  return files;
};

const transcribeFileWithRetry = async ({
  openai,
  filePath,
  requestedLanguage,
  openaiTimeoutMs,
  openaiMaxAttempts,
  openaiConnectionMaxAttempts,
  openaiConnectionBackoffMs,
  openaiConnectionMaxBackoffMs,
}) => {
  const stats = await fs.stat(filePath).catch(() => null);
  if (!stats || stats.size <= MIN_AUDIO_BYTES) {
    throw new Error(`Transcription input missing or too small: ${filePath}`);
  }
  if (stats.size > MAX_TRANSCRIBE_UPLOAD_BYTES) {
    throw new Error(
      `Chunk exceeds upload limit (${stats.size} bytes > ${MAX_TRANSCRIBE_UPLOAD_BYTES}). Reduce AUTOCLIP_TRANSCRIBE_CHUNK_SECONDS.`
    );
  }

  const hardMaxAttempts = Math.max(openaiMaxAttempts, openaiConnectionMaxAttempts);
  let lastError = null;

  for (let attempt = 1; attempt <= hardMaxAttempts; attempt += 1) {
    try {
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => {
        controller.abort();
      }, openaiTimeoutMs);

      try {
        // Use createReadStream exactly as the official OpenAI docs recommend.
        // This streams file data progressively through the TCP socket instead
        // of buffering it all in memory and writing it in one shot.  The
        // continuous data flow keeps the connection active and avoids proxy
        // idle-timeout resets (the root cause of the ECONNRESET on Railway).
        const transcription = await openai.audio.transcriptions.create(
          {
            file: createReadStream(filePath),
            model: "whisper-1",
            language: requestedLanguage,
            response_format: "verbose_json",
            timestamp_granularities: ["word", "segment"],
          },
          { signal: controller.signal }
        );

        return transcription;
      } catch (error) {
        if (
          error?.name === "AbortError" ||
          /abort|aborted/i.test(
            error instanceof Error ? error.message : String(error)
          )
        ) {
          throw new Error(
            `OpenAI transcription timed out after ${Math.max(
              1,
              Math.round(openaiTimeoutMs / 1000)
            )}s`
          );
        }
        throw error;
      } finally {
        clearTimeout(timeoutHandle);
      }
    } catch (error) {
      lastError = error;
      const retryable = isRetryableOpenAIError(error);
      const connectionError = isOpenAIConnectionError(error);
      const maxAttemptsForError = connectionError
        ? Math.max(openaiMaxAttempts, openaiConnectionMaxAttempts)
        : openaiMaxAttempts;

      if (!retryable || attempt >= maxAttemptsForError) {
        throw error;
      }

      // ---------------------------------------------------------------
      // Exponential back-off with jitter for ALL retryable errors.
      //
      // For connection errors (ECONNRESET, ETIMEDOUT, etc.) we use the
      // dedicated connection backoff config.  For other retryable errors
      // (429, 5xx) we start at 2 s and cap at 15 s.  Jitter is ±50 %
      // of the base delay to avoid thundering-herd retries when many
      // segments hit the same window.
      // ---------------------------------------------------------------
      const baseDelay = connectionError ? openaiConnectionBackoffMs : 2000;
      const maxDelay = connectionError ? openaiConnectionMaxBackoffMs : 15000;
      const exponential = baseDelay * Math.pow(2, attempt - 1);
      const jitter = Math.floor(Math.random() * baseDelay) - Math.floor(baseDelay / 2);
      const delayMs = Math.max(1000, Math.min(maxDelay, exponential + jitter));

      const detail = formatErrorDetail(error);
      console.warn(
        `[transcribe] OpenAI attempt ${attempt}/${maxAttemptsForError} failed (${connectionError ? "connection" : "retryable"}): ${detail}. Retrying in ${Math.max(
          1,
          Math.round(delayMs / 1000)
        )}s.`
      );

      await wait(delayMs);
    }
  }

  throw lastError || new Error("OpenAI transcription failed.");
};

const transcribeSegment = async ({
  openai,
  segmentPath,
  requestedLanguage,
  openaiTimeoutMs,
  openaiMaxAttempts,
  openaiConnectionMaxAttempts,
  openaiConnectionBackoffMs,
  openaiConnectionMaxBackoffMs,
}) => {
  const transcription = await transcribeFileWithRetry({
    openai,
    filePath: segmentPath,
    requestedLanguage,
    openaiTimeoutMs,
    openaiMaxAttempts,
    openaiConnectionMaxAttempts,
    openaiConnectionBackoffMs,
    openaiConnectionMaxBackoffMs,
  });

  if (!hasTranscriptionContent(transcription)) {
    throw new Error("OpenAI returned no usable transcript text.");
  }

  return transcription;
};

const buildTranscriptionPipeline = (config) => {
  const progress = (onProgress, patch) => {
    if (typeof onProgress === "function") {
      onProgress(patch);
    }
  };

  return async ({ sessionId, videoKey, language, onProgress }) => {
    const requestedLanguage =
      typeof language === "string" && language.trim().length > 0
        ? language.trim()
        : undefined;

    const runDir = path.join(config.tempDir, `${sessionId}_tx_${Date.now()}`);
    const videoPath = path.join(runDir, "input.mp4");
    const segmentsDir = path.join(runDir, "segments");

    await fs.rm(runDir, { recursive: true, force: true }).catch(() => {});
    await fs.mkdir(runDir, { recursive: true });

    try {
      progress(onProgress, {
        stage: "Checking OpenAI connectivity",
        progress: 2,
      });
      await checkOpenAIConnectivity({
        openai: config.openai,
        openaiTimeoutMs: config.openaiTimeoutMs,
        openaiConnectionMaxAttempts: config.openaiConnectionMaxAttempts,
        openaiConnectionBackoffMs: config.openaiConnectionBackoffMs,
        openaiConnectionMaxBackoffMs: config.openaiConnectionMaxBackoffMs,
      });

      progress(onProgress, { stage: "Downloading source video", progress: 5 });

      const { data: videoData, error: downloadError } = await config.supabase.storage
        .from(config.bucket)
        .download(videoKey);
      if (downloadError) {
        throw downloadError;
      }
      await fs.writeFile(videoPath, Buffer.from(await videoData.arrayBuffer()));

      progress(onProgress, { stage: "Normalizing audio", progress: 15 });
      const normalizedAudioPath = await extractNormalizedAudio({
        videoPath,
        outputDir: runDir,
        audioBitrate: config.audioBitrate,
      });

      progress(onProgress, { stage: "Segmenting audio", progress: 22 });
      const segmentFiles = await splitNormalizedAudio({
        inputPath: normalizedAudioPath,
        outputDir: segmentsDir,
        chunkSeconds: config.chunkSeconds,
      });

      if (segmentFiles.length === 0) {
        throw new Error("No audio segments were created for transcription.");
      }

      const totalSegments = segmentFiles.length;
      progress(onProgress, {
        stage: `Transcribing audio segments (0/${totalSegments})`,
        progress: 24,
        totalChunks: totalSegments,
        completedChunks: 0,
      });

      const slices = [];
      const skippedErrors = [];
      let successfulSegments = 0;
      let offsetSeconds = 0;
      let consecutiveConnectionErrors = 0;

      for (let index = 0; index < segmentFiles.length; index += 1) {
        const segmentPath = segmentFiles[index];
        const segmentDuration =
          (await getDurationSeconds(segmentPath)) ?? config.chunkSeconds;

        try {
          const transcription = await transcribeSegment({
            openai: config.openai,
            segmentPath,
            requestedLanguage,
            openaiTimeoutMs: config.openaiTimeoutMs,
            openaiMaxAttempts: config.openaiMaxAttempts,
            openaiConnectionMaxAttempts: config.openaiConnectionMaxAttempts,
            openaiConnectionBackoffMs: config.openaiConnectionBackoffMs,
            openaiConnectionMaxBackoffMs: config.openaiConnectionMaxBackoffMs,
          });

          slices.push(buildOffsetTranscription(transcription, offsetSeconds));
          successfulSegments += 1;
          consecutiveConnectionErrors = 0;
        } catch (error) {
          const message = formatErrorDetail(error);

          // Fail fast on OpenAI outages so queue-level retry can restart cleanly.
          if (isOpenAIConnectionError(error)) {
            consecutiveConnectionErrors += 1;
          } else {
            consecutiveConnectionErrors = 0;
          }
          // Each segment already retries up to openaiConnectionMaxAttempts
          // times internally, so if we still land here it's a sustained
          // outage.  Abort after 3 consecutive segment-level failures (or
          // immediately if we haven't had a single success yet).
          if (
            isOpenAIConnectionError(error) &&
            (successfulSegments === 0 || consecutiveConnectionErrors >= 3)
          ) {
            throw error;
          }

          if (isChunkTooLargeError(error)) {
            throw new Error(
              `Chunk ${index + 1} exceeded OpenAI size limit. Reduce AUTOCLIP_TRANSCRIBE_CHUNK_SECONDS.`
            );
          }

          skippedErrors.push(`segment ${index + 1}: ${message}`);
          console.warn(
            `[transcribe] skipping segment ${index + 1}/${totalSegments}: ${message}`
          );
        }

        offsetSeconds += segmentDuration;
        const completedSegments = index + 1;
        progress(onProgress, {
          stage:
            skippedErrors.length > 0
              ? `Transcribing audio segments (${completedSegments}/${totalSegments}, skipped ${skippedErrors.length})`
              : `Transcribing audio segments (${completedSegments}/${totalSegments})`,
          progress: Math.min(95, 24 + Math.round((completedSegments / totalSegments) * 70)),
          totalChunks: totalSegments,
          completedChunks: completedSegments,
        });
      }

      if (successfulSegments === 0) {
        const detail = skippedErrors.length > 0 ? ` ${skippedErrors[0]}` : "";
        throw new Error(`Unable to transcribe any audio segments.${detail}`);
      }

      progress(onProgress, {
        stage: "Finalizing transcript",
        progress: 99,
        totalChunks: totalSegments,
        completedChunks: totalSegments,
      });

      return mergeTranscriptionSlices(slices);
    } finally {
      await fs.rm(runDir, { recursive: true, force: true }).catch(() => {});
    }
  };
};

export const createTranscriptionManager = ({
  tempDir,
  supabase,
  bucket,
  openai,
  maxConcurrency,
  chunkSeconds,
  audioBitrate,
  uploadFallbackBitrate,
  uploadSegmentSeconds,
  openaiTimeoutMs,
  openaiMaxAttempts,
  openaiConnectionMaxAttempts,
  openaiConnectionBackoffMs,
  openaiConnectionMaxBackoffMs,
  jobRetentionMs,
  transientJobRetryLimit,
  transientJobRetryDelayMs,
}) => {
  const config = {
    tempDir,
    supabase,
    bucket,
    openai,
    maxConcurrency: Math.max(1, Number(maxConcurrency) || 1),
    // 60 s chunks at 32 kbps ≈ 240 KB per upload.  Small payloads complete
    // fast enough that Railway's proxy can't reset the connection mid-transfer.
    chunkSeconds: Math.max(30, Math.min(180, Number(chunkSeconds) || 60)),
    audioBitrate:
      typeof audioBitrate === "string" && audioBitrate.trim()
        ? audioBitrate.trim()
        : "32k",
    uploadFallbackBitrate:
      typeof uploadFallbackBitrate === "string" && uploadFallbackBitrate.trim()
        ? uploadFallbackBitrate.trim()
        : "32k",
    uploadSegmentSeconds: Math.max(45, Number(uploadSegmentSeconds) || 120),
    openaiTimeoutMs: Math.max(30000, Number(openaiTimeoutMs) || 300000),
    // Raised from 2 → 3 for regular retryable errors (429 / 5xx).
    openaiMaxAttempts: Math.max(1, Math.min(5, Number(openaiMaxAttempts) || 3)),
    // Raised from 3 → 5 for connection-level errors (ECONNRESET, etc.).
    openaiConnectionMaxAttempts: Math.max(
      1,
      Math.min(8, Number(openaiConnectionMaxAttempts) || 5)
    ),
    openaiConnectionBackoffMs: Math.max(500, Number(openaiConnectionBackoffMs) || 3000),
    // Raised ceiling from 15 s → 30 s so exponential backoff has room.
    openaiConnectionMaxBackoffMs: Math.max(
      2000,
      Math.min(60000, Number(openaiConnectionMaxBackoffMs) || 30000)
    ),
    jobRetentionMs: Math.max(60000, Number(jobRetentionMs) || 60 * 60 * 1000),
    // Raised from 2 → 3 for queue-level transient retries.
    transientJobRetryLimit: Math.max(0, Math.min(5, Number(transientJobRetryLimit) || 3)),
    transientJobRetryDelayMs: Math.max(1000, Number(transientJobRetryDelayMs) || 15000),
  };

  const runPipeline = buildTranscriptionPipeline(config);

  const queue = [];
  const jobs = new Map();
  const jobBySession = new Map();
  const cleanupTimers = new Map();
  let activeCount = 0;
  let queueRunning = false;

  const clearCleanupTimer = (jobId) => {
    const existing = cleanupTimers.get(jobId);
    if (!existing) {
      return;
    }
    clearTimeout(existing);
    cleanupTimers.delete(jobId);
  };

  const scheduleCleanup = (jobId) => {
    clearCleanupTimer(jobId);
    const timer = setTimeout(() => {
      const latest = jobs.get(jobId);
      if (!latest) {
        cleanupTimers.delete(jobId);
        return;
      }
      const latestId = jobBySession.get(latest.sessionId);
      if (latestId === jobId) {
        jobBySession.delete(latest.sessionId);
      }
      jobs.delete(jobId);
      cleanupTimers.delete(jobId);
    }, config.jobRetentionMs);
    cleanupTimers.set(jobId, timer);
  };

  const updateJob = (jobId, patch) => {
    const existing = jobs.get(jobId);
    if (!existing) {
      return null;
    }
    const next = {
      ...existing,
      ...patch,
      updatedAt: nowIso(),
    };
    jobs.set(jobId, next);
    return next;
  };

  const toJobPayload = (job, includeResult = false) => ({
    jobId: job.id,
    sessionId: job.sessionId,
    status: job.status,
    stage: job.stage,
    progress: job.progress,
    totalChunks: job.totalChunks,
    completedChunks: job.completedChunks,
    retryCount: Number.isFinite(job.retryCount) ? job.retryCount : 0,
    error: job.error || null,
    ...(includeResult && job.result ? { result: job.result } : {}),
  });

  const processQueue = () => {
    if (queueRunning) {
      return;
    }
    queueRunning = true;

    try {
      while (activeCount < config.maxConcurrency) {
        const nextId = queue.shift();
        if (!nextId) {
          break;
        }

        const job = jobs.get(nextId);
        if (!job || job.status !== "queued") {
          continue;
        }

        activeCount += 1;
        updateJob(job.id, {
          status: "processing",
          stage: "Starting transcription",
          progress: Math.max(job.progress || 0, 1),
        });

        runPipeline({
          sessionId: job.sessionId,
          videoKey: job.videoKey,
          language: job.language,
          onProgress: (patch) => {
            updateJob(job.id, patch);
          },
        })
          .then((result) => {
            updateJob(job.id, {
              status: "complete",
              stage: "Transcription complete",
              progress: 100,
              result,
              error: null,
              completedAt: nowIso(),
            });
            scheduleCleanup(job.id);
          })
          .catch((error) => {
            const message = formatErrorDetail(error);
            const latestJob = jobs.get(job.id) || job;
            const retryCount = Number.isFinite(latestJob.retryCount)
              ? latestJob.retryCount
              : 0;

            if (
              isOpenAIConnectionError(error) &&
              retryCount < config.transientJobRetryLimit
            ) {
              const nextRetry = retryCount + 1;
              const retryDelayMs = Math.min(
                180000,
                config.transientJobRetryDelayMs * Math.pow(2, nextRetry - 1)
              );

              console.warn(
                `[transcribe] transient OpenAI connection failure for job ${job.id}; scheduling retry ${nextRetry}/${config.transientJobRetryLimit} in ${Math.max(
                  1,
                  Math.round(retryDelayMs / 1000)
                )}s. ${message}`
              );

              updateJob(job.id, {
                status: "queued",
                stage: `Retrying transcription after network issue (${nextRetry}/${config.transientJobRetryLimit})`,
                progress: Math.max(latestJob.progress || 0, 5),
                error: null,
                retryCount: nextRetry,
                completedAt: null,
              });

              setTimeout(() => {
                const latest = jobs.get(job.id);
                if (!latest || latest.status !== "queued") {
                  return;
                }
                queue.push(job.id);
                processQueue();
              }, retryDelayMs);

              return;
            }

            console.error("Transcribe job error:", job.id, message);
            updateJob(job.id, {
              status: "error",
              stage: "Transcription failed",
              error: message,
              completedAt: nowIso(),
            });
            scheduleCleanup(job.id);
          })
          .finally(() => {
            activeCount = Math.max(0, activeCount - 1);
            processQueue();
          });
      }
    } finally {
      queueRunning = false;
    }
  };

  const enqueueTranscribeJob = ({ sessionId, videoKey, language = "en" }) => {
    const normalizedLanguage =
      typeof language === "string" && language.trim().length > 0
        ? language.trim()
        : "en";

    const existingId = jobBySession.get(sessionId);
    if (existingId) {
      const existing = jobs.get(existingId);
      if (existing && (existing.status === "queued" || existing.status === "processing")) {
        return existing;
      }
      if (
        existing &&
        existing.status === "complete" &&
        existing.videoKey === videoKey &&
        existing.language === normalizedLanguage
      ) {
        return existing;
      }
    }

    const id = uuidv4().slice(0, 12);
    const now = nowIso();
    const job = {
      id,
      sessionId,
      videoKey,
      language: normalizedLanguage,
      status: "queued",
      stage: "Queued",
      progress: 0,
      totalChunks: 0,
      completedChunks: 0,
      retryCount: 0,
      result: null,
      error: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    };

    jobs.set(id, job);
    jobBySession.set(sessionId, id);
    queue.push(id);
    processQueue();

    return job;
  };

  const getJobBySession = (sessionId) => {
    const id = jobBySession.get(sessionId);
    if (!id) {
      return null;
    }

    const job = jobs.get(id);
    if (!job) {
      jobBySession.delete(sessionId);
      return null;
    }

    return job;
  };

  const runLegacyTranscription = async ({ sessionId, videoKey, language = "en" }) =>
    runPipeline({
      sessionId,
      videoKey,
      language,
      onProgress: null,
    });

  const getStats = () => ({
    active: activeCount,
    queued: queue.length,
    maxConcurrency: config.maxConcurrency,
    openJobs: jobs.size,
  });

  const getConfig = () => ({
    chunkSeconds: config.chunkSeconds,
    audioBitrate: config.audioBitrate,
    openaiTimeoutMs: config.openaiTimeoutMs,
    openaiMaxAttempts: config.openaiMaxAttempts,
    openaiConnectionMaxAttempts: config.openaiConnectionMaxAttempts,
    uploadSegmentSeconds: config.uploadSegmentSeconds,
  });

  return {
    enqueueTranscribeJob,
    getJobBySession,
    toJobPayload,
    runLegacyTranscription,
    getStats,
    getConfig,
  };
};
