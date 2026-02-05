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

const compactFfmpegMessage = (value, limit = 900) => {
  const normalized = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) {
    return "No ffmpeg stderr output.";
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

const safeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const hasTranscriptionContent = (transcription) => {
  const hasSegmentContent = Array.isArray(transcription?.segments)
    ? transcription.segments.some((segment) => {
        const start = Number(segment?.start);
        const end = Number(segment?.end);
        const text = String(segment?.text ?? "").trim();
        return (
          Number.isFinite(start) &&
          Number.isFinite(end) &&
          end > start &&
          text.length > 0
        );
      })
    : false;
  const hasWordContent = Array.isArray(transcription?.words)
    ? transcription.words.some((word) => {
        const start = Number(word?.start);
        const end = Number(word?.end);
        const text = String(word?.word ?? word?.text ?? "").trim();
        return (
          Number.isFinite(start) &&
          Number.isFinite(end) &&
          end > start &&
          text.length > 0
        );
      })
    : false;
  const hasTextContent =
    typeof transcription?.text === "string" &&
    transcription.text.trim().length > 0;
  return hasSegmentContent || hasWordContent || hasTextContent;
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

const isChunkTranscribeTimeoutError = (error) => {
  const status = Number(error?.status);
  if (status === 408 || status === 504) {
    return true;
  }
  const message =
    error instanceof Error
      ? error.message
      : typeof error?.message === "string"
        ? error.message
        : "";
  return /timeout|timed out|etimedout|deadline exceeded|request timeout/i.test(
    message
  );
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

const runFfmpeg = async (args, label) =>
  new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", args);
    let stderr = "";
    ffmpeg.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    ffmpeg.on("close", (code) => {
      resolve({
        label,
        code: Number.isFinite(code) ? code : -1,
        stderr,
      });
    });
    ffmpeg.on("error", (error) => {
      reject(new Error(`ffmpeg spawn error (${label}): ${error.message}`));
    });
  });

const getDurationSeconds = async (filePath) =>
  new Promise((resolve) => {
    const ffprobe = spawn("ffprobe", [
      "-v",
      "quiet",
      "-print_format",
      "json",
      "-show_format",
      filePath,
    ]);
    let stdout = "";
    ffprobe.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    ffprobe.on("close", (code) => {
      if (code !== 0) {
        resolve(null);
        return;
      }
      try {
        const parsed = JSON.parse(stdout);
        const duration = Number(parsed?.format?.duration);
        resolve(Number.isFinite(duration) && duration > 0 ? duration : null);
      } catch {
        resolve(null);
      }
    });
    ffprobe.on("error", () => resolve(null));
  });

const getAudioStreamIndices = async (filePath) =>
  new Promise((resolve) => {
    const ffprobe = spawn("ffprobe", [
      "-v",
      "quiet",
      "-print_format",
      "json",
      "-show_streams",
      filePath,
    ]);
    let stdout = "";
    ffprobe.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    ffprobe.on("close", (code) => {
      if (code !== 0) {
        resolve([null]);
        return;
      }
      try {
        const parsed = JSON.parse(stdout);
        const audioStreams = Array.isArray(parsed?.streams)
          ? parsed.streams.filter((stream) => stream?.codec_type === "audio")
          : [];
        const indices = audioStreams
          .map((stream) =>
            Number.isFinite(stream?.index) ? Number(stream.index) : null
          )
          .filter((value) => value != null);
        const normalized = [...new Set(indices)].sort((a, b) => a - b);
        resolve(normalized);
      } catch {
        resolve([]);
      }
    });
    ffprobe.on("error", () => resolve([]));
  });

const listSegmentFiles = async (directory, prefix) => {
  const names = await fs.readdir(directory).catch(() => []);
  return names
    .filter((name) => new RegExp(`^${prefix}_\\d+\\.mp3$`, "i").test(name))
    .sort()
    .map((name) => path.join(directory, name));
};

const pickBestAudioCandidate = (next, current) => {
  if (!current) {
    return true;
  }
  if (next.code === 0 && current.code !== 0) {
    return true;
  }
  if (next.code !== 0 && current.code === 0) {
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
  const nextWarnings = Number(next.decodeWarnings) || 0;
  const currentWarnings = Number(current.decodeWarnings) || 0;
  if (nextWarnings < currentWarnings) {
    return true;
  }
  if (currentWarnings < nextWarnings) {
    return false;
  }
  const nextIsPrimary = next.streamIndex == null;
  const currentIsPrimary = current.streamIndex == null;
  if (nextIsPrimary && !currentIsPrimary) {
    return true;
  }
  if (!nextIsPrimary && currentIsPrimary) {
    return false;
  }
  return next.size > current.size;
};

const extractCleanAudio = async ({
  videoPath,
  outputDir,
  audioBitrate,
  requestedStreamIndices,
}) => {
  const streamIndices =
    [
      null,
      ...[
        ...new Set(
          (Array.isArray(requestedStreamIndices) ? requestedStreamIndices : [])
            .map((value) => (Number.isFinite(value) ? Number(value) : null))
            .filter((value) => value != null)
        ),
      ],
    ];
  const profiles = [
    {
      label: "mono",
      audioFilter: "aresample=16000:async=1:first_pts=0",
    },
    {
      label: "pan-first-channel",
      audioFilter: "pan=mono|c0=c0,aresample=16000:async=1:first_pts=0",
    },
  ];

  let bestCandidate = null;
  const generatedPaths = [];

  for (const streamIndex of streamIndices) {
    for (const profile of profiles) {
      const candidateName =
        streamIndex == null
          ? `audio_${profile.label}.mp3`
          : `audio_stream_${String(streamIndex)}_${profile.label}.mp3`;
      const candidatePath = path.join(outputDir, candidateName);
      generatedPaths.push(candidatePath);
      await fs.unlink(candidatePath).catch(() => {});

      const args = [
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
        ...(streamIndex != null ? ["-map", `0:${streamIndex}`] : ["-map", "0:a:0?"]),
        "-vn",
        "-sn",
        "-dn",
        "-af",
        profile.audioFilter,
        "-ac",
        "1",
        "-ar",
        "16000",
        "-c:a",
        "libmp3lame",
        "-b:a",
        audioBitrate,
        candidatePath,
      ];

      const result = await runFfmpeg(args, `extract-${profile.label}`);
      const stats = await fs.stat(candidatePath).catch(() => null);
      if (!stats || stats.size <= MIN_AUDIO_BYTES) {
        continue;
      }
      const duration = await getDurationSeconds(candidatePath);
      const candidate = {
        path: candidatePath,
        profile: profile.label,
        streamIndex,
        code: result.code,
        stderr: result.stderr,
        decodeWarnings: countDecodeWarnings(result.stderr),
        size: stats.size,
        duration,
      };
      if (pickBestAudioCandidate(candidate, bestCandidate)) {
        bestCandidate = candidate;
      }
    }
  }

  if (!bestCandidate) {
    throw new Error("Audio extraction produced no usable output.");
  }

  for (const filePath of generatedPaths) {
    if (filePath !== bestCandidate.path) {
      await fs.unlink(filePath).catch(() => {});
    }
  }

  if (bestCandidate.code !== 0) {
    console.warn(
      `[transcribe] selected ${bestCandidate.profile} extraction with partial output (exit ${bestCandidate.code}). ${compactFfmpegMessage(
        bestCandidate.stderr
      )}`
    );
  }

  return bestCandidate;
};

const splitAudioToSegments = async ({
  inputPath,
  outputDir,
  segmentSeconds,
  audioBitrate,
  prefix = "segment",
}) => {
  await fs.rm(outputDir, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(outputDir, { recursive: true });

  const outputPattern = path.join(outputDir, `${prefix}_%04d.mp3`);

  const copyResult = await runFfmpeg(
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      inputPath,
      "-vn",
      "-sn",
      "-dn",
      "-c:a",
      "copy",
      "-f",
      "segment",
      "-segment_time",
      String(segmentSeconds),
      "-reset_timestamps",
      "1",
      outputPattern,
    ],
    `${prefix}-split-copy`
  );

  let files = await listSegmentFiles(outputDir, prefix);
  if (files.length > 0) {
    return { files, result: copyResult };
  }

  const encodeResult = await runFfmpeg(
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
      String(segmentSeconds),
      "-reset_timestamps",
      "1",
      outputPattern,
    ],
    `${prefix}-split-encode`
  );

  files = await listSegmentFiles(outputDir, prefix);
  if (files.length === 0) {
    throw new Error(
      `Audio segmentation failed. ${compactFfmpegMessage(copyResult.stderr)} | ${compactFfmpegMessage(
        encodeResult.stderr
      )}`
    );
  }

  return { files, result: encodeResult };
};

const transcodeSegmentToWav = async ({ segmentPath, outputPath }) => {
  await fs.unlink(outputPath).catch(() => {});
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
      segmentPath,
      "-map",
      "0:a:0?",
      "-vn",
      "-sn",
      "-dn",
      "-af",
      "pan=mono|c0=c0,aresample=16000:async=1:first_pts=0",
      "-c:a",
      "pcm_s16le",
      outputPath,
    ],
    "segment-decode-fallback"
  );

  const stats = await fs.stat(outputPath).catch(() => null);
  if (!stats || stats.size <= MIN_AUDIO_BYTES) {
    throw new Error(
      `Segment decode fallback produced no usable audio. ${compactFfmpegMessage(result.stderr)}`
    );
  }

  if (result.code !== 0) {
    console.warn(
      `[transcribe] segment decode fallback exited with code ${result.code}; using partial output. ${compactFfmpegMessage(
        result.stderr
      )}`
    );
  }

  return outputPath;
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
      ? transcription.language
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
      language = slice.language;
    }
  }

  return {
    segments,
    words,
    text,
    language,
  };
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
  const hardMaxAttempts = Math.max(openaiMaxAttempts, openaiConnectionMaxAttempts);
  let lastError = null;

  for (let attempt = 1; attempt <= hardMaxAttempts; attempt += 1) {
    try {
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => {
        controller.abort();
      }, openaiTimeoutMs);
      try {
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

      let delayMs = attempt === 1 ? 1000 : 1800;
      if (connectionError) {
        delayMs = Math.min(
          openaiConnectionMaxBackoffMs,
          openaiConnectionBackoffMs * Math.pow(2, Math.max(0, attempt - 1))
        );
        delayMs += Math.floor(Math.random() * 1200);
      }

      const detail = error instanceof Error ? error.message : String(error);
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

const transcribeSegmentWithFallback = async ({
  openai,
  segmentPath,
  segmentDuration,
  requestedLanguage,
  tmpDir,
  uploadSegmentSeconds,
  audioBitrate,
  openaiTimeoutMs,
  openaiMaxAttempts,
  openaiConnectionMaxAttempts,
  openaiConnectionBackoffMs,
  openaiConnectionMaxBackoffMs,
}) => {
  let lastError = null;

  const runTranscribe = async (filePath) =>
    transcribeFileWithRetry({
      openai,
      filePath,
      requestedLanguage,
      openaiTimeoutMs,
      openaiMaxAttempts,
      openaiConnectionMaxAttempts,
      openaiConnectionBackoffMs,
      openaiConnectionMaxBackoffMs,
    });

  try {
    const direct = await runTranscribe(segmentPath);
    if (hasTranscriptionContent(direct)) {
      return direct;
    }
    lastError = new Error("Segment transcription returned no usable text.");
  } catch (error) {
    lastError = error;
  }

  if (isUnsupportedChunkDecodeError(lastError)) {
    const wavPath = path.join(
      tmpDir,
      `${path.basename(segmentPath, path.extname(segmentPath))}_decode_fallback.wav`
    );
    try {
      await transcodeSegmentToWav({
        segmentPath,
        outputPath: wavPath,
      });
      const fallback = await runTranscribe(wavPath);
      if (hasTranscriptionContent(fallback)) {
        return fallback;
      }
      lastError = new Error("Decode fallback returned no usable text.");
    } catch (error) {
      lastError = error;
    } finally {
      await fs.unlink(wavPath).catch(() => {});
    }
  }

  if (
    isChunkTooLargeError(lastError) ||
    isChunkTranscribeTimeoutError(lastError)
  ) {
    const splitDir = path.join(
      tmpDir,
      `${path.basename(segmentPath, path.extname(segmentPath))}_retry_split`
    );
    const targetSeconds = Math.max(
      45,
      Math.min(
        uploadSegmentSeconds,
        Number.isFinite(segmentDuration) && segmentDuration > 0
          ? Math.max(45, Math.floor(segmentDuration / 2))
          : uploadSegmentSeconds
      )
    );

    try {
      const { files } = await splitAudioToSegments({
        inputPath: segmentPath,
        outputDir: splitDir,
        segmentSeconds: targetSeconds,
        audioBitrate,
        prefix: "part",
      });

      const slices = [];
      let localOffset = 0;
      let successfulParts = 0;
      const partErrors = [];

      for (let index = 0; index < files.length; index += 1) {
        const partPath = files[index];
        const partDuration =
          (await getDurationSeconds(partPath)) ?? Math.max(30, targetSeconds);
        try {
          const partResult = await runTranscribe(partPath);
          if (!hasTranscriptionContent(partResult)) {
            partErrors.push(`part ${index + 1}: no usable text`);
            console.warn(
              `[transcribe] skipping segmented upload part ${index + 1}/${files.length}: no usable text.`
            );
            localOffset += partDuration;
            continue;
          }
          slices.push(buildOffsetTranscription(partResult, localOffset));
          successfulParts += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          partErrors.push(`part ${index + 1}: ${message}`);
          console.warn(
            `[transcribe] skipping segmented upload part ${index + 1}/${files.length}: ${message}`
          );
        }
        localOffset += partDuration;
      }

      if (successfulParts > 0) {
        return mergeTranscriptionSlices(slices);
      }

      const detail =
        partErrors.length > 0 ? ` ${partErrors[0]}` : " No segment could be transcribed.";
      throw new Error(`Segmented upload transcription failed.${detail}`);
    } catch (error) {
      lastError = error;
    } finally {
      await fs.rm(splitDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  throw lastError || new Error("Segment transcription failed.");
};

const buildTranscriptionPipeline = (config) => {
  const progress = (onProgress, patch) => {
    if (typeof onProgress === "function") {
      onProgress(patch);
    }
  };

  return async ({ sessionId, videoKey, language, onProgress }) => {
    const requestedLanguage =
      typeof language === "string" && language.trim().length > 0 ? language : undefined;

    const runDir = path.join(config.tempDir, `${sessionId}_tx_${Date.now()}`);
    const videoPath = path.join(runDir, "input.mp4");
    const audioPath = path.join(runDir, "audio_clean.mp3");
    const segmentsDir = path.join(runDir, "segments");

    await fs.rm(runDir, { recursive: true, force: true }).catch(() => {});
    await fs.mkdir(runDir, { recursive: true });

    try {
      progress(onProgress, { stage: "Downloading source video", progress: 5 });
      const { data: videoData, error: downloadError } = await config.supabase.storage
        .from(config.bucket)
        .download(videoKey);
      if (downloadError) {
        throw downloadError;
      }
      await fs.writeFile(videoPath, Buffer.from(await videoData.arrayBuffer()));

      progress(onProgress, { stage: "Extracting clean audio", progress: 15 });
      const streamIndices = await getAudioStreamIndices(videoPath);
      const extracted = await extractCleanAudio({
        videoPath,
        outputDir: runDir,
        audioBitrate: config.audioBitrate,
        requestedStreamIndices: streamIndices,
      });
      await fs.copyFile(extracted.path, audioPath);

      progress(onProgress, { stage: "Segmenting audio", progress: 20 });
      const { files: segmentFiles } = await splitAudioToSegments({
        inputPath: audioPath,
        outputDir: segmentsDir,
        segmentSeconds: config.chunkSeconds,
        audioBitrate: config.audioBitrate,
        prefix: "segment",
      });

      if (!segmentFiles.length) {
        throw new Error("No audio segments were created for transcription.");
      }

      const totalSegments = segmentFiles.length;
      progress(onProgress, {
        stage: `Transcribing audio segments (0/${totalSegments})`,
        progress: 22,
        totalChunks: totalSegments,
        completedChunks: 0,
      });

      const slices = [];
      const skippedErrors = [];
      let successfulSegments = 0;
      let offsetSeconds = 0;

      for (let index = 0; index < segmentFiles.length; index += 1) {
        const segmentPath = segmentFiles[index];
        const segmentDuration =
          (await getDurationSeconds(segmentPath)) ?? config.chunkSeconds;

        try {
          const transcription = await transcribeSegmentWithFallback({
            openai: config.openai,
            segmentPath,
            segmentDuration,
            requestedLanguage,
            tmpDir: runDir,
            uploadSegmentSeconds: config.uploadSegmentSeconds,
            audioBitrate: config.uploadFallbackBitrate,
            openaiTimeoutMs: config.openaiTimeoutMs,
            openaiMaxAttempts: config.openaiMaxAttempts,
            openaiConnectionMaxAttempts: config.openaiConnectionMaxAttempts,
            openaiConnectionBackoffMs: config.openaiConnectionBackoffMs,
            openaiConnectionMaxBackoffMs: config.openaiConnectionMaxBackoffMs,
          });

          if (!hasTranscriptionContent(transcription)) {
            skippedErrors.push(`segment ${index + 1}: no usable text`);
            console.warn(
              `[transcribe] skipping segment ${index + 1}/${totalSegments}: no usable text.`
            );
          } else {
            slices.push(buildOffsetTranscription(transcription, offsetSeconds));
            successfulSegments += 1;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          skippedErrors.push(`segment ${index + 1}: ${message}`);
          console.warn(
            `[transcribe] skipping segment ${index + 1}/${totalSegments}: ${message}`
          );
          if (isOpenAIConnectionError(error) && successfulSegments === 0) {
            throw error;
          }
        }

        offsetSeconds += segmentDuration;
        const completedSegments = index + 1;
        progress(onProgress, {
          stage:
            skippedErrors.length > 0
              ? `Transcribing audio segments (${completedSegments}/${totalSegments}, skipped ${skippedErrors.length})`
              : `Transcribing audio segments (${completedSegments}/${totalSegments})`,
          progress: Math.min(95, 22 + Math.round((completedSegments / totalSegments) * 70)),
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
    chunkSeconds: Math.max(45, Number(chunkSeconds) || 180),
    audioBitrate: typeof audioBitrate === "string" && audioBitrate.trim() ? audioBitrate : "64k",
    uploadFallbackBitrate:
      typeof uploadFallbackBitrate === "string" && uploadFallbackBitrate.trim()
        ? uploadFallbackBitrate
        : "32k",
    uploadSegmentSeconds: Math.max(45, Number(uploadSegmentSeconds) || 120),
    openaiTimeoutMs: Math.max(30000, Number(openaiTimeoutMs) || 300000),
    openaiMaxAttempts: Math.max(1, Number(openaiMaxAttempts) || 3),
    openaiConnectionMaxAttempts: Math.max(
      1,
      Number(openaiConnectionMaxAttempts) || 8
    ),
    openaiConnectionBackoffMs: Math.max(500, Number(openaiConnectionBackoffMs) || 3000),
    openaiConnectionMaxBackoffMs: Math.max(
      2000,
      Number(openaiConnectionMaxBackoffMs) || 45000
    ),
    jobRetentionMs: Math.max(60000, Number(jobRetentionMs) || 60 * 60 * 1000),
    transientJobRetryLimit: Math.max(0, Number(transientJobRetryLimit) || 3),
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
    if (existing) {
      clearTimeout(existing);
      cleanupTimers.delete(jobId);
    }
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
            const message =
              error instanceof Error ? error.message : "Transcription failed.";
            const latestJob = jobs.get(job.id) || job;
            const isTransientConnectionFailure = isOpenAIConnectionError(error);
            const retryCount = Number.isFinite(latestJob.retryCount)
              ? latestJob.retryCount
              : 0;

            if (
              isTransientConnectionFailure &&
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
