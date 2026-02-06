import { spawn } from "child_process";
import { createReadStream, promises as fs } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const MIN_AUDIO_BYTES = 4096;

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

const serializeLogFields = (fields) => {
  const out = {};
  Object.entries(fields || {}).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }
    out[key] = value;
  });
  return out;
};

const logTranscribe = (level, event, fields = {}) => {
  const payload = {
    ts: nowIso(),
    event,
    ...serializeLogFields(fields),
  };
  const line = `[transcribe] ${JSON.stringify(payload)}`;
  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.log(line);
};

const safeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

const resolveTranscriptEndSeconds = (transcription) => {
  let maxEnd = 0;
  normalizeSegments(transcription?.segments).forEach((segment) => {
    maxEnd = Math.max(maxEnd, segment.end);
  });
  normalizeWords(transcription?.words).forEach((word) => {
    maxEnd = Math.max(maxEnd, word.end);
  });
  return maxEnd;
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

const getFileSizeBytes = async (filePath) => {
  const stats = await fs.stat(filePath).catch(() => null);
  if (!stats || !Number.isFinite(stats.size)) {
    return null;
  }
  return Number(stats.size);
};

const checkOpenAIConnectivity = async ({
  openai,
  openaiFallback,
  openaiTransportName,
  openaiFallbackTransportName,
  openaiTimeoutMs,
  openaiConnectionMaxAttempts,
  openaiConnectionBackoffMs,
  openaiConnectionMaxBackoffMs,
}) => {
  const maxAttempts = Math.max(1, Math.min(3, openaiConnectionMaxAttempts));
  const timeoutMs = Math.max(5000, Math.min(20000, openaiTimeoutMs));
  const primaryLabel = String(openaiTransportName || "primary");
  const fallbackLabel = String(openaiFallbackTransportName || "fallback");

  const runConnectivityCheck = async (client, label) => {
    let lastError = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const controller = new AbortController();
        const timeoutHandle = setTimeout(() => {
          controller.abort();
        }, timeoutMs);
        try {
          await client.models.list({ signal: controller.signal });
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
      `OpenAI connectivity check failed (${label}): ${formatErrorDetail(lastError)}`
    );
  };

  try {
    await runConnectivityCheck(openai, primaryLabel);
    return;
  } catch (primaryError) {
    if (!openaiFallback) {
      throw primaryError;
    }
    console.warn(
      `[transcribe] OpenAI connectivity failed on ${primaryLabel}; retrying on ${fallbackLabel}. ${formatErrorDetail(
        primaryError
      )}`
    );
    await runConnectivityCheck(openaiFallback, fallbackLabel);
  }
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
    .filter((name) =>
      new RegExp(`^${prefix}_\\d+\\.(mp3|mp4|m4a|wav|webm|ogg|aac)$`, "i").test(
        name
      )
    )
    .sort()
    .map((name) => path.join(directory, name));
};

const MIN_LONG_VIDEO_AUDIO_COVERAGE_RATIO = 0.5;
const MIN_LONG_VIDEO_SECONDS = 180;
const MIN_TRANSCRIPT_COVERAGE_RATIO = 0.9;
const MAX_TRANSCRIPT_COVERAGE_GAP_SECONDS = 45;

const resolveAllowedCoverageGapSeconds = (expectedDurationSec, maxGapSec) =>
  Math.max(8, Math.min(maxGapSec, expectedDurationSec * 0.08));

const chooseBestExtraction = (next, current, sourceDurationSec = null) => {
  if (!current) {
    return true;
  }

  const hasSourceDuration =
    Number.isFinite(sourceDurationSec) && sourceDurationSec != null && sourceDurationSec > 0;
  const nextCoverage = hasSourceDuration
    ? safeNumber(next.duration, 0) / safeNumber(sourceDurationSec, 1)
    : null;
  const currentCoverage = hasSourceDuration
    ? safeNumber(current.duration, 0) / safeNumber(sourceDurationSec, 1)
    : null;

  if (
    hasSourceDuration &&
    Number.isFinite(nextCoverage) &&
    Number.isFinite(currentCoverage)
  ) {
    if (nextCoverage > currentCoverage + 0.1) {
      return true;
    }
    if (currentCoverage > nextCoverage + 0.1) {
      return false;
    }
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
  logContext,
}) => {
  const baseLogContext = serializeLogFields(logContext || {});
  const sourceDurationSec = await getDurationSeconds(videoPath);
  logTranscribe("info", "audio_extraction_start", {
    ...baseLogContext,
    sourceDurationSec:
      Number.isFinite(sourceDurationSec) && sourceDurationSec != null
        ? Number(sourceDurationSec.toFixed(3))
        : null,
  });

  const streamIndices = await getAudioStreamIndices(videoPath);
  const mapSpecs = [
    "0:a:0?",
    ...streamIndices.map((index) => `0:${index}`),
  ].filter((value, index, all) => all.indexOf(value) === index);

  let best = null;
  const tempOutputs = [];

  for (const mapSpec of mapSpecs) {
    const safeName = String(mapSpec).replace(/[^a-zA-Z0-9]+/g, "_");
    const candidatePath = path.join(outputDir, `audio_${safeName}.mp3`);
    tempOutputs.push(candidatePath);
    await fs.unlink(candidatePath).catch(() => {});

    const result = await runFfmpeg(
      [
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
        "libmp3lame",
        "-b:a",
        audioBitrate,
        candidatePath,
      ],
      `extract-${safeName}`
    );

    const stats = await fs.stat(candidatePath).catch(() => null);
    if (!stats || stats.size <= MIN_AUDIO_BYTES) {
      continue;
    }

    const duration = await getDurationSeconds(candidatePath);
    const candidate = {
      path: candidatePath,
      mapSpec,
      code: result.code,
      stderr: result.stderr,
      decodeWarnings: countDecodeWarnings(result.stderr),
      size: stats.size,
      duration,
    };
    const coverageRatio =
      Number.isFinite(sourceDurationSec) &&
      sourceDurationSec != null &&
      sourceDurationSec > 0 &&
      Number.isFinite(duration) &&
      duration != null &&
      duration > 0
        ? Number((duration / sourceDurationSec).toFixed(4))
        : null;
    logTranscribe("info", "audio_extraction_candidate", {
      ...baseLogContext,
      mapSpec,
      ffmpegExitCode: result.code,
      decodeWarnings: candidate.decodeWarnings,
      candidateBytes: stats.size,
      candidateDurationSec:
        Number.isFinite(duration) && duration != null
          ? Number(duration.toFixed(3))
          : null,
      coverageRatio,
    });

    if (chooseBestExtraction(candidate, best, sourceDurationSec)) {
      best = candidate;
    }
  }

  if (!best) {
    throw new Error("Audio extraction produced no usable output.");
  }

  if (best.code !== 0) {
    logTranscribe("warn", "audio_extraction_selected_partial", {
      ...baseLogContext,
      selectedMapSpec: best.mapSpec,
      ffmpegExitCode: best.code,
      decodeWarnings: best.decodeWarnings || 0,
      stderrSummary: compactMessage(best.stderr),
    });
  }

  const selectedCoverageRatio =
    Number.isFinite(sourceDurationSec) &&
    sourceDurationSec != null &&
    sourceDurationSec > 0 &&
    Number.isFinite(best.duration) &&
    best.duration != null &&
    best.duration > 0
      ? Number((best.duration / sourceDurationSec).toFixed(4))
      : null;
  logTranscribe("info", "audio_extraction_selected", {
    ...baseLogContext,
    selectedMapSpec: best.mapSpec,
    selectedDurationSec:
      Number.isFinite(best.duration) && best.duration != null
        ? Number(best.duration.toFixed(3))
        : null,
    selectedBytes: best.size,
    decodeWarnings: best.decodeWarnings || 0,
    selectedCoverageRatio,
  });

  if (
    Number.isFinite(sourceDurationSec) &&
    sourceDurationSec != null &&
    sourceDurationSec >= MIN_LONG_VIDEO_SECONDS &&
    Number.isFinite(best.duration) &&
    best.duration != null &&
    best.duration < sourceDurationSec * MIN_LONG_VIDEO_AUDIO_COVERAGE_RATIO
  ) {
    const message = `Extracted audio duration (${best.duration.toFixed(
      2
    )}s) is too short for source video (${sourceDurationSec.toFixed(
      2
    )}s).`;
    logTranscribe("error", "audio_extraction_rejected_short", {
      ...baseLogContext,
      selectedMapSpec: best.mapSpec,
      selectedDurationSec: Number(best.duration.toFixed(3)),
      sourceDurationSec: Number(sourceDurationSec.toFixed(3)),
      selectedCoverageRatio,
      reason: message,
    });
    throw new Error(message);
  }

  const normalizedPath = path.join(outputDir, "audio_clean.mp3");
  await fs.copyFile(best.path, normalizedPath);

  for (const filePath of tempOutputs) {
    await fs.unlink(filePath).catch(() => {});
  }

  return normalizedPath;
};

const splitNormalizedAudio = async ({
  inputPath,
  outputDir,
  chunkSeconds,
  audioBitrate,
}) => {
  await fs.rm(outputDir, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(outputDir, { recursive: true });

  const outputPattern = path.join(outputDir, "segment_%04d.mp3");

  const result = await runFfmpeg(
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      inputPath,
      "-map",
      "0:a:0?",
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
      audioBitrate,
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

const splitSourceAudioWithCopy = async ({
  videoPath,
  outputDir,
  chunkSeconds,
  logContext,
}) => {
  await fs.rm(outputDir, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(outputDir, { recursive: true });

  const outputPattern = path.join(outputDir, "segment_%04d.mp4");
  const result = await runFfmpeg(
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      videoPath,
      "-map",
      "0:a:0?",
      "-vn",
      "-sn",
      "-dn",
      "-c:a",
      "copy",
      "-f",
      "segment",
      "-segment_time",
      String(chunkSeconds),
      "-reset_timestamps",
      "1",
      outputPattern,
    ],
    "segment-audio-copy"
  );

  const files = await listSegmentFiles(outputDir, "segment");
  if (files.length === 0) {
    throw new Error(
      `Audio copy segmentation failed. ${compactMessage(result.stderr)}`
    );
  }

  const totalSegmentBytes = (
    await Promise.all(files.map((filePath) => getFileSizeBytes(filePath)))
  ).reduce((sum, value) => sum + (Number.isFinite(value) ? Number(value) : 0), 0);
  logTranscribe("warn", "audio_copy_segmented", {
    ...serializeLogFields(logContext || {}),
    ffmpegExitCode: result.code,
    totalSegments: files.length,
    totalSegmentBytes,
    stderrSummary:
      result.code !== 0 ? compactMessage(result.stderr) : null,
  });

  return files;
};

const transcribeFileWithRetry = async ({
  openai,
  openaiFallback,
  openaiTransportName,
  openaiFallbackTransportName,
  filePath,
  requestedLanguage,
  openaiTimeoutMs,
  openaiMaxAttempts,
  openaiConnectionMaxAttempts,
  openaiConnectionBackoffMs,
  openaiConnectionMaxBackoffMs,
  logContext,
}) => {
  const hardMaxAttempts = Math.max(openaiMaxAttempts, openaiConnectionMaxAttempts);
  const primaryTransportLabel = String(openaiTransportName || "primary");
  const fallbackTransportLabel = String(openaiFallbackTransportName || "fallback");
  let useFallbackTransport = false;
  let lastError = null;
  const baseLogContext = serializeLogFields(logContext || {});
  const fileBytes = await getFileSizeBytes(filePath);

  logTranscribe("info", "openai_segment_start", {
    ...baseLogContext,
    fileName: path.basename(filePath),
    fileBytes,
    timeoutMs: openaiTimeoutMs,
    attemptLimit: hardMaxAttempts,
    requestedLanguage: requestedLanguage || "auto",
    primaryTransport: primaryTransportLabel,
    fallbackTransport: openaiFallback ? fallbackTransportLabel : null,
  });

  for (let attempt = 1; attempt <= hardMaxAttempts; attempt += 1) {
    const activeOpenAI =
      useFallbackTransport && openaiFallback ? openaiFallback : openai;
    const activeTransportLabel =
      useFallbackTransport && openaiFallback
        ? fallbackTransportLabel
        : primaryTransportLabel;
    const attemptStartedAt = Date.now();

    logTranscribe("info", "openai_attempt_start", {
      ...baseLogContext,
      attempt,
      maxAttempts: hardMaxAttempts,
      transport: activeTransportLabel,
      fileBytes,
    });

    try {
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => {
        controller.abort();
      }, openaiTimeoutMs);

      try {
        const transcription = await activeOpenAI.audio.transcriptions.create(
          {
            file: createReadStream(filePath),
            model: "whisper-1",
            language: requestedLanguage,
            response_format: "verbose_json",
            timestamp_granularities: ["word", "segment"],
          },
          { signal: controller.signal }
        );

        const segmentsCount = normalizeSegments(transcription?.segments).length;
        const wordsCount = normalizeWords(transcription?.words).length;
        const textChars =
          typeof transcription?.text === "string"
            ? transcription.text.trim().length
            : 0;
        logTranscribe("info", "openai_attempt_success", {
          ...baseLogContext,
          attempt,
          maxAttempts: hardMaxAttempts,
          transport: activeTransportLabel,
          durationMs: Date.now() - attemptStartedAt,
          segmentsCount,
          wordsCount,
          textChars,
        });
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
      const detail = formatErrorDetail(error);
      const durationMs = Date.now() - attemptStartedAt;

      if (connectionError && openaiFallback) {
        useFallbackTransport = !useFallbackTransport;
        logTranscribe("warn", "openai_transport_switch", {
          ...baseLogContext,
          attempt,
          fromTransport: activeTransportLabel,
          toTransport: useFallbackTransport
            ? fallbackTransportLabel
            : primaryTransportLabel,
          reason: detail,
        });
      }

      if (!retryable || attempt >= maxAttemptsForError) {
        logTranscribe("error", "openai_attempt_failed_terminal", {
          ...baseLogContext,
          attempt,
          maxAttempts: maxAttemptsForError,
          transport: activeTransportLabel,
          durationMs,
          retryable,
          connectionError,
          error: detail,
        });
        throw error;
      }

      let delayMs = attempt === 1 ? 1000 : 1800;
      if (connectionError) {
        delayMs = Math.min(
          openaiConnectionMaxBackoffMs,
          openaiConnectionBackoffMs * Math.pow(2, Math.max(0, attempt - 1))
        );
        delayMs += Math.floor(Math.random() * 1200);
      }

      logTranscribe("warn", "openai_attempt_failed_retry", {
        ...baseLogContext,
        attempt,
        maxAttempts: maxAttemptsForError,
        transport: activeTransportLabel,
        durationMs,
        retryable,
        connectionError,
        retryDelayMs: delayMs,
        error: detail,
      });

      await wait(delayMs);
    }
  }

  logTranscribe("error", "openai_segment_failed_exhausted", {
    ...baseLogContext,
    error: formatErrorDetail(lastError),
  });
  throw lastError || new Error("OpenAI transcription failed.");
};

const transcribeSegment = async ({
  openai,
  openaiFallback,
  openaiTransportName,
  openaiFallbackTransportName,
  segmentPath,
  requestedLanguage,
  openaiTimeoutMs,
  openaiMaxAttempts,
  openaiConnectionMaxAttempts,
  openaiConnectionBackoffMs,
  openaiConnectionMaxBackoffMs,
  logContext,
}) => {
  const transcription = await transcribeFileWithRetry({
    openai,
    openaiFallback,
    openaiTransportName,
    openaiFallbackTransportName,
    filePath: segmentPath,
    requestedLanguage,
    openaiTimeoutMs,
    openaiMaxAttempts,
    openaiConnectionMaxAttempts,
    openaiConnectionBackoffMs,
    openaiConnectionMaxBackoffMs,
    logContext,
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

  return async ({
    jobId,
    sessionId,
    videoKey,
    language,
    onProgress,
    correlationId = null,
  }) => {
    const pipelineStartedAt = Date.now();
    const requestedLanguage =
      typeof language === "string" && language.trim().length > 0
        ? language.trim()
        : undefined;
    const logBase = {
      jobId: jobId || null,
      sessionId,
      videoKey,
      correlationId: correlationId || null,
    };

    const runDir = path.join(config.tempDir, `${sessionId}_tx_${Date.now()}`);
    const videoPath = path.join(runDir, "input.mp4");
    const segmentsDir = path.join(runDir, "segments");
    let totalSegments = 0;
    let successfulSegments = 0;
    const skippedErrors = [];

    await fs.rm(runDir, { recursive: true, force: true }).catch(() => {});
    await fs.mkdir(runDir, { recursive: true });
    logTranscribe("info", "pipeline_started", {
      ...logBase,
      runDir,
      requestedLanguage: requestedLanguage || "auto",
      chunkSeconds: config.chunkSeconds,
      audioBitrate: config.audioBitrate,
      allowPartialTranscription: config.allowPartialTranscription,
      openaiTimeoutMs: config.openaiTimeoutMs,
      openaiMaxAttempts: config.openaiMaxAttempts,
      openaiConnectionMaxAttempts: config.openaiConnectionMaxAttempts,
    });

    try {
      progress(onProgress, {
        stage: "Checking OpenAI connectivity",
        progress: 2,
      });
      await checkOpenAIConnectivity({
        openai: config.openai,
        openaiFallback: config.openaiFallback,
        openaiTransportName: config.openaiTransportName,
        openaiFallbackTransportName: config.openaiFallbackTransportName,
        openaiTimeoutMs: config.openaiTimeoutMs,
        openaiConnectionMaxAttempts: config.openaiConnectionMaxAttempts,
        openaiConnectionBackoffMs: config.openaiConnectionBackoffMs,
        openaiConnectionMaxBackoffMs: config.openaiConnectionMaxBackoffMs,
      });
      logTranscribe("info", "openai_connectivity_ok", logBase);

      progress(onProgress, { stage: "Downloading source video", progress: 5 });

      const { data: videoData, error: downloadError } = await config.supabase.storage
        .from(config.bucket)
        .download(videoKey);
      if (downloadError) {
        throw downloadError;
      }
      const sourceBuffer = Buffer.from(await videoData.arrayBuffer());
      await fs.writeFile(videoPath, sourceBuffer);
      const sourceDurationSec = await getDurationSeconds(videoPath);
      logTranscribe("info", "source_downloaded", {
        ...logBase,
        sourceBytes: sourceBuffer.length,
        sourceDurationSec:
          Number.isFinite(sourceDurationSec) && sourceDurationSec != null
            ? Number(sourceDurationSec.toFixed(3))
            : null,
      });

      let normalizedDurationSec = null;
      let segmentFiles = [];
      let segmentSource = "normalized";

      progress(onProgress, { stage: "Normalizing audio", progress: 15 });
      try {
        const normalizedAudioPath = await extractNormalizedAudio({
          videoPath,
          outputDir: runDir,
          audioBitrate: config.audioBitrate,
          logContext: logBase,
        });
        const normalizedAudioBytes = await getFileSizeBytes(normalizedAudioPath);
        normalizedDurationSec = await getDurationSeconds(normalizedAudioPath);
        logTranscribe("info", "audio_normalized", {
          ...logBase,
          normalizedAudioBytes,
          normalizedDurationSec:
            Number.isFinite(normalizedDurationSec) && normalizedDurationSec != null
              ? Number(normalizedDurationSec.toFixed(3))
              : null,
        });

        progress(onProgress, { stage: "Segmenting audio", progress: 22 });
        segmentFiles = await splitNormalizedAudio({
          inputPath: normalizedAudioPath,
          outputDir: segmentsDir,
          chunkSeconds: config.chunkSeconds,
          audioBitrate: config.audioBitrate,
        });
      } catch (error) {
        segmentSource = "source_copy";
        logTranscribe("warn", "audio_segmentation_fallback_copy", {
          ...logBase,
          reason: formatErrorDetail(error),
          chunkSeconds: config.chunkSeconds,
        });
        progress(onProgress, {
          stage: "Segmenting source audio (fallback)",
          progress: 22,
        });
        segmentFiles = await splitSourceAudioWithCopy({
          videoPath,
          outputDir: segmentsDir,
          chunkSeconds: config.chunkSeconds,
          logContext: logBase,
        });
      }

      if (segmentFiles.length === 0) {
        throw new Error("No audio segments were created for transcription.");
      }

      totalSegments = segmentFiles.length;
      logTranscribe("info", "audio_segmented", {
        ...logBase,
        totalSegments,
        segmentSource,
        normalizedDurationSec:
          Number.isFinite(normalizedDurationSec) && normalizedDurationSec != null
            ? Number(normalizedDurationSec.toFixed(3))
            : null,
      });
      progress(onProgress, {
        stage: `Transcribing audio segments (0/${totalSegments})`,
        progress: 24,
        totalChunks: totalSegments,
        completedChunks: 0,
      });

      const slices = [];
      let offsetSeconds = 0;

      for (let index = 0; index < segmentFiles.length; index += 1) {
        const segmentPath = segmentFiles[index];
        const segmentIndex = index + 1;
        const segmentDuration =
          (await getDurationSeconds(segmentPath)) ?? config.chunkSeconds;
        const segmentBytes = await getFileSizeBytes(segmentPath);
        const segmentStartedAt = Date.now();
        logTranscribe("info", "segment_transcribe_start", {
          ...logBase,
          segmentIndex,
          totalSegments,
          segmentBytes,
          segmentDurationSec: Number(segmentDuration.toFixed(3)),
          offsetSec: Number(offsetSeconds.toFixed(3)),
        });

        try {
          const transcription = await transcribeSegment({
            openai: config.openai,
            openaiFallback: config.openaiFallback,
            openaiTransportName: config.openaiTransportName,
            openaiFallbackTransportName: config.openaiFallbackTransportName,
            segmentPath,
            requestedLanguage,
            openaiTimeoutMs: config.openaiTimeoutMs,
            openaiMaxAttempts: config.openaiMaxAttempts,
            openaiConnectionMaxAttempts: config.openaiConnectionMaxAttempts,
            openaiConnectionBackoffMs: config.openaiConnectionBackoffMs,
            openaiConnectionMaxBackoffMs: config.openaiConnectionMaxBackoffMs,
            logContext: {
              ...logBase,
              segmentIndex,
              totalSegments,
              segmentBytes,
            },
          });

          const slice = buildOffsetTranscription(transcription, offsetSeconds);
          slices.push(slice);
          successfulSegments += 1;
          logTranscribe("info", "segment_transcribe_success", {
            ...logBase,
            segmentIndex,
            totalSegments,
            durationMs: Date.now() - segmentStartedAt,
            sliceSegments: Array.isArray(slice.segments) ? slice.segments.length : 0,
            sliceWords: Array.isArray(slice.words) ? slice.words.length : 0,
            sliceTextChars: typeof slice.text === "string" ? slice.text.length : 0,
          });
        } catch (error) {
          const message = formatErrorDetail(error);
          logTranscribe("warn", "segment_transcribe_error", {
            ...logBase,
            segmentIndex,
            totalSegments,
            durationMs: Date.now() - segmentStartedAt,
            isConnectionError: isOpenAIConnectionError(error),
            isChunkTooLarge: isChunkTooLargeError(error),
            error: message,
          });

          if (isChunkTooLargeError(error)) {
            throw new Error(
              `Chunk ${segmentIndex} exceeded OpenAI size limit. Reduce AUTOCLIP_TRANSCRIBE_CHUNK_SECONDS.`
            );
          }

          if (!config.allowPartialTranscription) {
            logTranscribe("error", "pipeline_abort_partial_disabled", {
              ...logBase,
              segmentIndex,
              totalSegments,
              error: message,
            });
            throw error;
          }

          // Fail fast on OpenAI outages so queue-level retry can restart cleanly.
          if (isOpenAIConnectionError(error) && successfulSegments === 0) {
            logTranscribe("error", "pipeline_abort_first_segment_connection_failure", {
              ...logBase,
              segmentIndex,
              totalSegments,
              error: message,
            });
            throw error;
          }

          skippedErrors.push(`segment ${segmentIndex}: ${message}`);
          logTranscribe("warn", "segment_skipped", {
            ...logBase,
            segmentIndex,
            totalSegments,
            skippedCount: skippedErrors.length,
            error: message,
          });
        }

        offsetSeconds += segmentDuration;
        const completedSegments = segmentIndex;
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

      const merged = mergeTranscriptionSlices(slices);
      const transcriptEndSec = resolveTranscriptEndSeconds(merged);
      const expectedDurationSec =
        Number.isFinite(sourceDurationSec) && sourceDurationSec != null
          ? sourceDurationSec
          : Number.isFinite(normalizedDurationSec) && normalizedDurationSec != null
            ? normalizedDurationSec
            : null;
      if (
        !config.allowPartialTranscription &&
        expectedDurationSec &&
        expectedDurationSec > 0
      ) {
        const coverageRatio = transcriptEndSec / expectedDurationSec;
        const missingSeconds = Math.max(0, expectedDurationSec - transcriptEndSec);
        const allowedGapSeconds = resolveAllowedCoverageGapSeconds(
          expectedDurationSec,
          config.maxTranscriptCoverageGapSeconds
        );
        if (
          coverageRatio < config.minTranscriptCoverageRatio &&
          missingSeconds > allowedGapSeconds
        ) {
          const message = `Transcript coverage too low (${transcriptEndSec.toFixed(
            2
          )}s of ${expectedDurationSec.toFixed(
            2
          )}s, coverage ${(coverageRatio * 100).toFixed(1)}%).`;
          logTranscribe("error", "pipeline_coverage_failed", {
            ...logBase,
            expectedDurationSec: Number(expectedDurationSec.toFixed(3)),
            transcriptEndSec: Number(transcriptEndSec.toFixed(3)),
            coverageRatio: Number(coverageRatio.toFixed(4)),
            missingSeconds: Number(missingSeconds.toFixed(3)),
            allowedGapSeconds: Number(allowedGapSeconds.toFixed(3)),
            minCoverageRatio: config.minTranscriptCoverageRatio,
            reason: message,
          });
          throw new Error(message);
        }
      }
      logTranscribe("info", "pipeline_complete", {
        ...logBase,
        durationMs: Date.now() - pipelineStartedAt,
        totalSegments,
        successfulSegments,
        skippedSegments: skippedErrors.length,
        segmentSource,
        expectedDurationSec:
          expectedDurationSec && Number.isFinite(expectedDurationSec)
            ? Number(expectedDurationSec.toFixed(3))
            : null,
        coverageRatio:
          totalSegments > 0
            ? Number((successfulSegments / totalSegments).toFixed(3))
            : 0,
        mergedSegments: normalizeSegments(merged.segments).length,
        mergedWords: normalizeWords(merged.words).length,
        mergedTextChars:
          typeof merged.text === "string" ? merged.text.length : 0,
        transcriptEndSec: Number(transcriptEndSec.toFixed(3)),
      });
      return merged;
    } catch (error) {
      logTranscribe("error", "pipeline_failed", {
        ...logBase,
        durationMs: Date.now() - pipelineStartedAt,
        totalSegments,
        successfulSegments,
        skippedSegments: skippedErrors.length,
        error: formatErrorDetail(error),
      });
      throw error;
    } finally {
      await fs.rm(runDir, { recursive: true, force: true }).catch(() => {});
      logTranscribe("info", "pipeline_cleanup", {
        ...logBase,
        runDir,
      });
    }
  };
};

export const createTranscriptionManager = ({
  tempDir,
  supabase,
  bucket,
  openai,
  openaiFallback,
  openaiTransportName,
  openaiFallbackTransportName,
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
  allowPartialTranscription,
  minTranscriptCoverageRatio,
  maxTranscriptCoverageGapSeconds,
}) => {
  const config = {
    tempDir,
    supabase,
    bucket,
    openai,
    openaiFallback,
    openaiTransportName:
      typeof openaiTransportName === "string" && openaiTransportName.trim()
        ? openaiTransportName.trim()
        : "primary",
    openaiFallbackTransportName:
      typeof openaiFallbackTransportName === "string" &&
      openaiFallbackTransportName.trim()
        ? openaiFallbackTransportName.trim()
        : "fallback",
    maxConcurrency: Math.max(1, Number(maxConcurrency) || 1),
    chunkSeconds: Math.max(45, Number(chunkSeconds) || 180),
    audioBitrate:
      typeof audioBitrate === "string" && audioBitrate.trim()
        ? audioBitrate.trim()
        : "64k",
    uploadFallbackBitrate:
      typeof uploadFallbackBitrate === "string" && uploadFallbackBitrate.trim()
        ? uploadFallbackBitrate.trim()
        : "32k",
    uploadSegmentSeconds: Math.max(45, Number(uploadSegmentSeconds) || 120),
    openaiTimeoutMs: Math.max(30000, Number(openaiTimeoutMs) || 300000),
    openaiMaxAttempts: Math.max(1, Number(openaiMaxAttempts) || 3),
    openaiConnectionMaxAttempts: Math.max(
      1,
      Math.min(8, Number(openaiConnectionMaxAttempts) || 5)
    ),
    openaiConnectionBackoffMs: Math.max(500, Number(openaiConnectionBackoffMs) || 3000),
    openaiConnectionMaxBackoffMs: Math.max(
      2000,
      Math.min(45000, Number(openaiConnectionMaxBackoffMs) || 45000)
    ),
    jobRetentionMs: Math.max(60000, Number(jobRetentionMs) || 60 * 60 * 1000),
    transientJobRetryLimit: Math.max(0, Number(transientJobRetryLimit) || 3),
    transientJobRetryDelayMs: Math.max(1000, Number(transientJobRetryDelayMs) || 15000),
    allowPartialTranscription:
      typeof allowPartialTranscription === "boolean"
        ? allowPartialTranscription
        : false,
    minTranscriptCoverageRatio: Math.max(
      0.5,
      Math.min(
        1,
        Number.isFinite(Number(minTranscriptCoverageRatio))
          ? Number(minTranscriptCoverageRatio)
          : MIN_TRANSCRIPT_COVERAGE_RATIO
      )
    ),
    maxTranscriptCoverageGapSeconds: Math.max(
      8,
      Number(maxTranscriptCoverageGapSeconds) ||
        MAX_TRANSCRIPT_COVERAGE_GAP_SECONDS
    ),
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
    correlationId: job.correlationId || null,
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
        logTranscribe("info", "job_started", {
          jobId: job.id,
          sessionId: job.sessionId,
          correlationId: job.correlationId || null,
          queueDepth: queue.length,
          activeCount,
          retryCount: Number.isFinite(job.retryCount) ? job.retryCount : 0,
        });

        runPipeline({
          jobId: job.id,
          sessionId: job.sessionId,
          videoKey: job.videoKey,
          language: job.language,
          correlationId: job.correlationId || null,
          onProgress: (patch) => {
            updateJob(job.id, patch);
            if (patch && typeof patch.stage === "string") {
              logTranscribe("info", "job_progress", {
                jobId: job.id,
                sessionId: job.sessionId,
                correlationId: job.correlationId || null,
                stage: patch.stage,
                progress:
                  typeof patch.progress === "number" ? patch.progress : null,
                totalChunks:
                  typeof patch.totalChunks === "number"
                    ? patch.totalChunks
                    : null,
                completedChunks:
                  typeof patch.completedChunks === "number"
                    ? patch.completedChunks
                    : null,
              });
            }
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
            const completed = jobs.get(job.id) || job;
            logTranscribe("info", "job_completed", {
              jobId: completed.id,
              sessionId: completed.sessionId,
              correlationId: completed.correlationId || null,
              retryCount:
                Number.isFinite(completed.retryCount)
                  ? completed.retryCount
                  : 0,
              totalChunks:
                Number.isFinite(completed.totalChunks)
                  ? completed.totalChunks
                  : 0,
              completedChunks:
                Number.isFinite(completed.completedChunks)
                  ? completed.completedChunks
                  : 0,
              resultSegments: normalizeSegments(result?.segments).length,
              resultWords: normalizeWords(result?.words).length,
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

              logTranscribe("warn", "job_retry_scheduled", {
                jobId: latestJob.id,
                sessionId: latestJob.sessionId,
                correlationId: latestJob.correlationId || null,
                retryAttempt: nextRetry,
                retryLimit: config.transientJobRetryLimit,
                retryDelayMs,
                reason: message,
              });

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

            logTranscribe("error", "job_failed", {
              jobId: latestJob.id,
              sessionId: latestJob.sessionId,
              correlationId: latestJob.correlationId || null,
              retryCount,
              reason: message,
            });
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
            logTranscribe("info", "job_slot_released", {
              jobId: job.id,
              sessionId: job.sessionId,
              correlationId: job.correlationId || null,
              queueDepth: queue.length,
              activeCount,
            });
            processQueue();
          });
      }
    } finally {
      queueRunning = false;
    }
  };

  const enqueueTranscribeJob = ({
    sessionId,
    videoKey,
    language = "en",
    correlationId = null,
  }) => {
    const normalizedLanguage =
      typeof language === "string" && language.trim().length > 0
        ? language.trim()
        : "en";
    const normalizedCorrelationId =
      typeof correlationId === "string" && correlationId.trim().length > 0
        ? correlationId.trim().slice(0, 120)
        : null;

    const existingId = jobBySession.get(sessionId);
    if (existingId) {
      const existing = jobs.get(existingId);
      if (existing && (existing.status === "queued" || existing.status === "processing")) {
        logTranscribe("info", "job_reused_inflight", {
          jobId: existing.id,
          sessionId,
          correlationId: existing.correlationId || normalizedCorrelationId,
          status: existing.status,
        });
        return existing;
      }
      if (
        existing &&
        existing.status === "complete" &&
        existing.videoKey === videoKey &&
        existing.language === normalizedLanguage
      ) {
        logTranscribe("info", "job_reused_complete", {
          jobId: existing.id,
          sessionId,
          correlationId: existing.correlationId || normalizedCorrelationId,
          status: existing.status,
        });
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
      correlationId: normalizedCorrelationId,
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
    logTranscribe("info", "job_queued", {
      jobId: id,
      sessionId,
      correlationId: normalizedCorrelationId,
      queueDepth: queue.length,
      maxConcurrency: config.maxConcurrency,
      language: normalizedLanguage,
    });
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

  const runLegacyTranscription = async ({
    sessionId,
    videoKey,
    language = "en",
    correlationId = null,
  }) =>
    runPipeline({
      jobId: `legacy-${sessionId}`,
      sessionId,
      videoKey,
      language,
      correlationId,
      onProgress: null,
    });

  const getStats = () => ({
    active: activeCount,
    queued: queue.length,
    maxConcurrency: config.maxConcurrency,
    openJobs: jobs.size,
  });

  const getConfig = () => ({
    openaiTransportName: config.openaiTransportName,
    openaiFallbackTransportName: config.openaiFallbackTransportName,
    chunkSeconds: config.chunkSeconds,
    audioBitrate: config.audioBitrate,
    openaiTimeoutMs: config.openaiTimeoutMs,
    openaiMaxAttempts: config.openaiMaxAttempts,
    openaiConnectionMaxAttempts: config.openaiConnectionMaxAttempts,
    allowPartialTranscription: config.allowPartialTranscription,
    minTranscriptCoverageRatio: config.minTranscriptCoverageRatio,
    maxTranscriptCoverageGapSeconds: config.maxTranscriptCoverageGapSeconds,
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
