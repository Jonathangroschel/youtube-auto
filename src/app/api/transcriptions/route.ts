import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_REMOTE_FILE_BYTES = 25 * 1024 * 1024; // 25MB safety cap

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
    } catch (error) {
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
    if (typeof language === "string" && language.length > 0) {
      payload.append("language", language);
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

  const runTranscription = async (payload: FormData) =>
    fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: payload,
    });

  let response = await runTranscription(
    buildOpenAiPayload({
      model,
      responseFormat,
      chunkingStrategy: resolvedChunkingStrategy,
    })
  );
  if (!response.ok && model !== "whisper-1") {
    response = await runTranscription(
      buildOpenAiPayload({
        model: "whisper-1",
        responseFormat: "verbose_json",
        chunkingStrategy: null,
      })
    );
  }

  if (!response.ok) {
    const message = await response.text();
    return NextResponse.json(
      { error: message || "OpenAI transcription failed." },
      { status: response.status }
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const data = await response.json();
    return NextResponse.json(data);
  }

  const text = await response.text();
  return NextResponse.json({ text });
}
