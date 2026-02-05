import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const MAX_REMOTE_FILE_BYTES = 25 * 1024 * 1024; // 25MB safety cap
const OPENAI_TRANSCRIPTION_TIMEOUT_MS = 120_000;
const OPENAI_TRANSCRIPTION_MAX_ATTEMPTS = 2;
const WORKER_REQUEST_TIMEOUT_MS = 25_000;
const WORKER_POLL_INTERVAL_MS = 2_000;
const WORKER_POLL_TIMEOUT_MS = 240_000;
const WORKER_TRANSCRIPTION_BUCKET = "autoclip-files";

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

type WorkerTranscriptionWord = {
  start: number;
  end: number;
  word?: string;
  text?: string;
};

type WorkerTranscriptionSegment = {
  start: number;
  end: number;
  text: string;
};

type WorkerTranscriptionResult = {
  segments?: WorkerTranscriptionSegment[];
  words?: WorkerTranscriptionWord[];
  text?: string;
  language?: string | null;
};

type WorkerTranscribeStatusPayload = {
  status?: "queued" | "processing" | "complete" | "error";
  error?: string | null;
  result?: WorkerTranscriptionResult;
};

type WorkerRuntimeConfig = {
  workerUrl: string;
  workerSecret: string;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
};

const isIpv4Address = (hostname: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);

const isPrivateIpv4 = (hostname: string) => {
  if (!isIpv4Address(hostname)) {
    return false;
  }
  const parts = hostname.split(".").map((part) => Number(part));
  if (parts.some((part) => !Number.isFinite(part) || part < 0 || part > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
};

const assertSafeRemoteUrl = (value: string) => {
  const url = new URL(value);
  if (url.protocol !== "https:") {
    throw new Error("Only https URLs are allowed.");
  }
  const hostname = url.hostname.trim().toLowerCase();
  if (!hostname || hostname === "localhost") {
    throw new Error("Invalid host.");
  }
  if (hostname === "127.0.0.1" || hostname === "::1") {
    throw new Error("Invalid host.");
  }
  if (hostname.includes(":")) {
    // Disallow IPv6 literals (conservative SSRF guard).
    throw new Error("Invalid host.");
  }
  if (isPrivateIpv4(hostname)) {
    throw new Error("Invalid host.");
  }
  return url;
};

const inferFilename = (url: URL, contentType: string) => {
  const fallbackBase = "audio";
  const pathname = url.pathname || "";
  const last = pathname.split("/").filter(Boolean).pop() ?? "";
  const safeLast = last.replace(/[^a-zA-Z0-9._-]/g, "_");
  if (safeLast && safeLast.includes(".")) {
    return safeLast;
  }
  const lowerType = contentType.toLowerCase();
  const ext =
    lowerType.includes("mpeg") || lowerType.includes("mp3")
      ? "mp3"
      : lowerType.includes("wav")
        ? "wav"
        : lowerType.includes("webm")
          ? "webm"
          : lowerType.includes("ogg")
            ? "ogg"
            : lowerType.includes("mp4")
              ? "mp4"
              : "bin";
  return `${safeLast || fallbackBase}.${ext}`;
};

const resolveWorkerRuntimeConfig = (): WorkerRuntimeConfig | null => {
  const workerUrl = (process.env.AUTOCLIP_WORKER_URL ?? "").trim();
  const workerSecret = (
    process.env.AUTOCLIP_WORKER_SECRET ??
    process.env.WORKER_SECRET ??
    ""
  ).trim();
  const supabaseUrl = (
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    ""
  ).trim();
  const supabaseServiceRoleKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    ""
  ).trim();
  if (!workerUrl || !workerSecret || !supabaseUrl || !supabaseServiceRoleKey) {
    return null;
  }
  return {
    workerUrl,
    workerSecret,
    supabaseUrl,
    supabaseServiceRoleKey,
  };
};

const inferWorkerUploadExtension = (
  filename: string | null,
  contentType: string
) => {
  const fromFilename = (filename ?? "")
    .trim()
    .toLowerCase()
    .match(/\.([a-z0-9]{2,5})$/)?.[1];
  if (fromFilename) {
    return fromFilename;
  }
  const lowerType = contentType.toLowerCase();
  if (lowerType.includes("mp4")) return "mp4";
  if (lowerType.includes("quicktime")) return "mov";
  if (lowerType.includes("wav")) return "wav";
  if (lowerType.includes("mpeg") || lowerType.includes("mp3")) return "mp3";
  if (lowerType.includes("webm")) return "webm";
  if (lowerType.includes("ogg")) return "ogg";
  if (lowerType.includes("aac")) return "aac";
  if (lowerType.includes("m4a")) return "m4a";
  return "mp4";
};

const workerFetch = async (
  config: WorkerRuntimeConfig,
  endpoint: string,
  options: RequestInit = {}
) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    WORKER_REQUEST_TIMEOUT_MS
  );
  try {
    return await fetch(`${config.workerUrl}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${config.workerSecret}`,
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Worker request timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

const normalizeWorkerResult = (
  result: WorkerTranscriptionResult
): WorkerTranscriptionResult => {
  const segments = Array.isArray(result.segments)
    ? result.segments
        .map((segment) => ({
          start: Number(segment.start),
          end: Number(segment.end),
          text: String(segment.text ?? "").trim(),
        }))
        .filter(
          (segment) =>
            Number.isFinite(segment.start) &&
            Number.isFinite(segment.end) &&
            segment.end > segment.start &&
            segment.text.length > 0
        )
    : [];
  const words = Array.isArray(result.words)
    ? result.words
        .map((word) => ({
          start: Number(word.start),
          end: Number(word.end),
          word:
            typeof word.word === "string" && word.word.trim().length > 0
              ? word.word
              : undefined,
          text:
            typeof word.text === "string" && word.text.trim().length > 0
              ? word.text
              : undefined,
        }))
        .filter(
          (word) =>
            Number.isFinite(word.start) &&
            Number.isFinite(word.end) &&
            word.end > word.start &&
            Boolean(word.word || word.text)
        )
    : [];
  return {
    ...result,
    segments,
    words,
  };
};

const transcribeViaWorkerFallback = async (params: {
  uploadedFile: Blob | File;
  uploadedFileName: string | null;
  language: string | null;
}) => {
  const config = resolveWorkerRuntimeConfig();
  if (!config) {
    throw new Error(
      "Worker fallback unavailable (missing AUTOCLIP_WORKER_URL/secret or Supabase env)."
    );
  }
  const supabase = createClient(
    config.supabaseUrl,
    config.supabaseServiceRoleKey
  );
  const workerSessionId = crypto.randomUUID().slice(0, 8);
  const fileType = params.uploadedFile.type || "video/mp4";
  const uploadExtension = inferWorkerUploadExtension(
    params.uploadedFileName,
    fileType
  );
  const videoKey = `sessions/${workerSessionId}/input.${uploadExtension}`;
  const language =
    params.language && params.language !== "auto" ? params.language : undefined;
  try {
    const buffer = Buffer.from(await params.uploadedFile.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from(WORKER_TRANSCRIPTION_BUCKET)
      .upload(videoKey, buffer, {
        contentType: fileType || undefined,
        upsert: true,
      });
    if (uploadError) {
      throw new Error(
        uploadError.message || "Failed to upload source media for worker fallback."
      );
    }

    const queueBody = JSON.stringify({
      sessionId: workerSessionId,
      videoKey,
      language,
    });

    const queueResponse = await workerFetch(config, "/transcribe/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: queueBody,
    });
    const queuePayload =
      (await queueResponse.json().catch(() => ({}))) as WorkerTranscribeStatusPayload;

    // Backward compatibility for workers that only expose /transcribe.
    if (queueResponse.status === 404) {
      const legacyResponse = await workerFetch(config, "/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: queueBody,
      });
      const legacyPayload =
        (await legacyResponse.json().catch(() => ({}))) as WorkerTranscriptionResult & {
          error?: string;
        };
      if (!legacyResponse.ok) {
        const message =
          typeof legacyPayload?.error === "string" && legacyPayload.error
            ? legacyPayload.error
            : `Worker transcription failed (${legacyResponse.status}).`;
        throw new Error(message);
      }
      return normalizeWorkerResult(legacyPayload);
    }

    if (queueResponse.status === 401) {
      throw new Error(
        "Worker authentication failed (check AUTOCLIP_WORKER_SECRET / WORKER_SECRET)."
      );
    }
    if (!queueResponse.ok) {
      const message =
        typeof queuePayload.error === "string" && queuePayload.error
          ? queuePayload.error
          : `Failed to queue transcription (${queueResponse.status}).`;
      throw new Error(message);
    }

    if (queuePayload.status === "complete" && queuePayload.result) {
      return normalizeWorkerResult(queuePayload.result);
    }

    const deadline = Date.now() + WORKER_POLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await wait(WORKER_POLL_INTERVAL_MS);
      const statusResponse = await workerFetch(
        config,
        `/transcribe/status/${encodeURIComponent(workerSessionId)}`
      );
      const statusPayload =
        (await statusResponse.json().catch(() => ({}))) as WorkerTranscribeStatusPayload;
      if (statusResponse.status === 404) {
        continue;
      }
      if (!statusResponse.ok) {
        const message =
          typeof statusPayload.error === "string" && statusPayload.error
            ? statusPayload.error
            : `Unable to fetch worker transcription status (${statusResponse.status}).`;
        throw new Error(message);
      }
      if (statusPayload.status === "complete" && statusPayload.result) {
        return normalizeWorkerResult(statusPayload.result);
      }
      if (statusPayload.status === "error") {
        throw new Error(statusPayload.error || "Worker transcription failed.");
      }
    }
    throw new Error(
      `Worker transcription timed out after ${Math.round(
        WORKER_POLL_TIMEOUT_MS / 1000
      )}s.`
    );
  } finally {
    await supabase.storage
      .from(WORKER_TRANSCRIPTION_BUCKET)
      .remove([videoKey])
      .catch(() => undefined);
  }
};

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing OPENAI_API_KEY." },
      { status: 500 }
    );
  }

  const incoming = await request.formData();
  const file = incoming.get("file");
  const remoteUrlValue = incoming.get("url");
  const remoteUrl =
    typeof remoteUrlValue === "string" && remoteUrlValue.trim().length > 0
      ? remoteUrlValue.trim()
      : null;

  const model = String(
    incoming.get("model") ?? "gpt-4o-transcribe-diarize"
  );
  const language = incoming.get("language");
  const languageValue =
    typeof language === "string" && language.trim().length > 0
      ? language.trim()
      : null;
  const prompt = incoming.get("prompt");
  const chunkingStrategy = incoming.get("chunking_strategy");
  const rawResponseFormat = incoming.get("response_format");
  const responseFormat =
    typeof rawResponseFormat === "string" && rawResponseFormat.length > 0
      ? rawResponseFormat
      : model.includes("diarize")
        ? "diarized_json"
        : "json";
  const timestampGranularities = incoming.getAll("timestamp_granularities[]");

  let uploadedFile: File | Blob;
  let uploadedFileName: string | null = null;
  if (file instanceof File) {
    uploadedFile = file;
  } else if (remoteUrl) {
    let parsedUrl: URL;
    try {
      parsedUrl = assertSafeRemoteUrl(remoteUrl);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Invalid transcription URL.",
        },
        { status: 400 }
      );
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    let response: Response;
    try {
      response = await fetch(parsedUrl.toString(), {
        method: "GET",
        signal: controller.signal,
      });
    } catch {
      clearTimeout(timeoutId);
      return NextResponse.json(
        { error: "Failed to fetch transcription URL." },
        { status: 400 }
      );
    } finally {
      clearTimeout(timeoutId);
    }
    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch transcription URL." },
        { status: 400 }
      );
    }
    const contentLengthHeader = response.headers.get("content-length");
    const contentLength = contentLengthHeader ? Number(contentLengthHeader) : null;
    if (
      contentLength != null &&
      Number.isFinite(contentLength) &&
      contentLength > MAX_REMOTE_FILE_BYTES
    ) {
      return NextResponse.json(
        { error: "Remote file is too large to transcribe." },
        { status: 413 }
      );
    }
    const contentType = response.headers.get("content-type") ?? "";
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_REMOTE_FILE_BYTES) {
      return NextResponse.json(
        { error: "Remote file is too large to transcribe." },
        { status: 413 }
      );
    }
    const blob = new Blob([buffer], {
      type: typeof contentType === "string" && contentType ? contentType : undefined,
    });
    uploadedFile = blob;
    uploadedFileName = inferFilename(parsedUrl, contentType);
  } else {
    return NextResponse.json({ error: "Missing audio file." }, { status: 400 });
  }
  const resolvedChunkingStrategy =
    typeof chunkingStrategy === "string" && chunkingStrategy.length > 0
      ? chunkingStrategy
      : model.includes("diarize")
        ? "auto"
        : null;
  const buildOpenAiPayload = (options: {
    model: string;
    responseFormat: string;
    chunkingStrategy: string | null;
  }) => {
    const payload = new FormData();
    if (uploadedFileName) {
      payload.append("file", uploadedFile, uploadedFileName);
    } else {
      payload.append("file", uploadedFile);
    }
    payload.append("model", options.model);
    if (languageValue) {
      payload.append("language", languageValue);
    }
    if (typeof prompt === "string" && prompt.length > 0) {
      payload.append("prompt", prompt);
    }
    if (options.chunkingStrategy) {
      payload.append("chunking_strategy", options.chunkingStrategy);
    }
    if (options.responseFormat) {
      payload.append("response_format", options.responseFormat);
    }
    timestampGranularities.forEach((value) => {
      if (typeof value === "string" && value.length > 0) {
        payload.append("timestamp_granularities[]", value);
      }
    });
    return payload;
  };

  const runTranscription = async (payload: FormData) => {
    let lastError: Error | null = null;
    for (
      let attempt = 1;
      attempt <= OPENAI_TRANSCRIPTION_MAX_ATTEMPTS;
      attempt += 1
    ) {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        OPENAI_TRANSCRIPTION_TIMEOUT_MS
      );
      try {
        const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          body: payload,
          signal: controller.signal,
        });
        if (
          response.ok ||
          attempt >= OPENAI_TRANSCRIPTION_MAX_ATTEMPTS ||
          (response.status !== 429 && response.status < 500)
        ) {
          return response;
        }
      } catch (error) {
        const isAbort = error instanceof DOMException && error.name === "AbortError";
        const normalized = new Error(
          isAbort
            ? "OpenAI transcription request timed out."
            : error instanceof Error
              ? error.message
              : "OpenAI transcription request failed."
        );
        lastError = normalized;
        const isRetryable = isAbort || error instanceof TypeError;
        if (attempt >= OPENAI_TRANSCRIPTION_MAX_ATTEMPTS || !isRetryable) {
          throw normalized;
        }
      } finally {
        clearTimeout(timeoutId);
      }
      await wait(attempt === 1 ? 900 : 1500);
    }
    throw lastError ?? new Error("OpenAI transcription request failed.");
  };

  let response: Response | null = null;
  let directErrorMessage: string | null = null;
  let directErrorStatus: number | null = null;

  try {
    response = await runTranscription(
      buildOpenAiPayload({
        model,
        responseFormat,
        chunkingStrategy: resolvedChunkingStrategy,
      })
    );
  } catch (error) {
    directErrorMessage =
      error instanceof Error
        ? error.message
        : "OpenAI transcription request failed.";
  }

  if (response && !response.ok && model !== "whisper-1") {
    try {
      response = await runTranscription(
        buildOpenAiPayload({
          model: "whisper-1",
          responseFormat: "verbose_json",
          chunkingStrategy: null,
        })
      );
    } catch (error) {
      if (!directErrorMessage) {
        directErrorMessage =
          error instanceof Error
            ? error.message
            : "OpenAI transcription request failed.";
      }
    }
  }

  if (response?.ok) {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const data = await response.json();
      return NextResponse.json(data);
    }
    const text = await response.text();
    return NextResponse.json({ text });
  }

  if (response && !response.ok) {
    directErrorStatus = response.status;
    directErrorMessage = await response.text();
  }

  const workerConfig = resolveWorkerRuntimeConfig();
  if (workerConfig) {
    try {
      const workerData = await transcribeViaWorkerFallback({
        uploadedFile,
        uploadedFileName,
        language: languageValue,
      });
      return NextResponse.json(workerData);
    } catch (workerError) {
      const workerMessage =
        workerError instanceof Error
          ? workerError.message
          : "Worker fallback transcription failed.";
      const message = directErrorMessage
        ? `${directErrorMessage} Worker fallback failed: ${workerMessage}`
        : workerMessage;
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  return NextResponse.json(
    { error: directErrorMessage || "OpenAI transcription failed." },
    { status: directErrorStatus ?? 504 }
  );
}
