import { NextResponse } from "next/server";
import {
  getSession,
  saveSession,
  updateSessionStatus,
} from "@/lib/autoclip/session-store";

export const runtime = "nodejs";

const WORKER_URL = process.env.AUTOCLIP_WORKER_URL || "http://localhost:3001";
const WORKER_SECRET = process.env.AUTOCLIP_WORKER_SECRET || "dev-secret";
const WORKER_REQUEST_TIMEOUT_MS = 25_000;

type WorkerWord = {
  start: number;
  end: number;
  word?: string;
  text?: string;
};

type WorkerSegment = {
  start: number;
  end: number;
  text: string;
};

type WorkerTranscriptionResult = {
  segments?: WorkerSegment[];
  words?: WorkerWord[];
  text?: string;
  language?: string | null;
};

type WorkerTranscribeStatusPayload = {
  jobId?: string;
  sessionId?: string;
  status?: "queued" | "processing" | "complete" | "error";
  stage?: string;
  progress?: number;
  totalChunks?: number;
  completedChunks?: number;
  error?: string | null;
  result?: WorkerTranscriptionResult;
};

async function workerFetch(endpoint: string, options: RequestInit = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    WORKER_REQUEST_TIMEOUT_MS
  );
  try {
    return await fetch(`${WORKER_URL}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${WORKER_SECRET}`,
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
}

const resolveTranscriptSegments = (
  workerResult: WorkerTranscriptionResult,
  fallbackDurationSeconds: number
) => {
  let segments = Array.isArray(workerResult.segments)
    ? workerResult.segments
    : [];
  const words = Array.isArray(workerResult.words) ? workerResult.words : [];

  if (!segments.length && words.length) {
    const generated: WorkerSegment[] = [];
    const firstStart = Number(words[0]?.start);
    let current = {
      start: Number.isFinite(firstStart) ? firstStart : 0,
      end: Number.isFinite(firstStart) ? firstStart : 0,
      text: "",
    };
    words.forEach((word) => {
      const start = Number(word.start);
      const end = Number(word.end);
      const token = String(word.word ?? word.text ?? "").trim();
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || !token) {
        return;
      }
      current.text += current.text ? ` ${token}` : token;
      current.end = end;
      if (end - current.start >= 10) {
        generated.push({ ...current });
        current = { start: end, end, text: "" };
      }
    });
    if (current.text) {
      generated.push(current);
    }
    segments = generated;
  }

  if (!segments.length && typeof workerResult.text === "string" && workerResult.text.trim()) {
    segments = [
      {
        start: 0,
        end: Math.max(0, fallbackDurationSeconds),
        text: workerResult.text.trim(),
      },
    ];
  }

  return segments
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
    .sort((a, b) => a.start - b.start || a.end - b.end);
};

const applyWorkerTranscriptToSession = async (
  session: Awaited<ReturnType<typeof getSession>>,
  workerResult: WorkerTranscriptionResult
) => {
  if (!session) {
    throw new Error("Session not found.");
  }
  const fallbackDurationSeconds = session.input?.durationSeconds ?? 0;
  const segments = resolveTranscriptSegments(workerResult, fallbackDurationSeconds);
  if (!segments.length) {
    throw new Error("Transcription returned no usable segments.");
  }
  session.transcript = {
    language:
      typeof workerResult.language === "string" ? workerResult.language : null,
    segments,
    raw: workerResult,
  };
  session.error = null;
  await updateSessionStatus(session, "transcribed", "Transcription complete via worker.");
  return session.transcript;
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : null;
  const language =
    typeof body?.language === "string" && body.language.trim().length > 0
      ? body.language.trim()
      : "en";

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId." }, { status: 400 });
  }

  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: "Session not found. Make sure you uploaded a video first." },
      { status: 404 }
    );
  }
  if (!session.input?.videoKey) {
    return NextResponse.json(
      {
        error: "Video not uploaded yet. Session exists but no videoKey.",
        debug: { hasInput: !!session.input, status: session.status },
      },
      { status: 404 }
    );
  }
  if (!session.workerSessionId) {
    return NextResponse.json(
      {
        error: "Worker session not initialized.",
        debug: { hasInput: !!session.input, videoKey: session.input?.videoKey },
      },
      { status: 404 }
    );
  }

  if (session.transcript?.segments?.length) {
    return NextResponse.json({
      status: "complete",
      transcript: session.transcript,
    });
  }

  try {
    const workerRequestBody = JSON.stringify({
      sessionId: session.workerSessionId,
      videoKey: session.input.videoKey,
      language,
    });

    const response = await workerFetch("/transcribe/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: workerRequestBody,
    });

    const workerPayload =
      (await response.json().catch(() => ({}))) as WorkerTranscribeStatusPayload;

    // Backward-compatible fallback for workers that only expose `/transcribe`.
    if (response.status === 404) {
      const legacyResponse = await workerFetch("/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: workerRequestBody,
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
      const transcript = await applyWorkerTranscriptToSession(session, legacyPayload);
      return NextResponse.json({ status: "complete", transcript });
    }

    if (response.status === 401) {
      throw new Error(
        "Worker authentication failed (check AUTOCLIP_WORKER_SECRET / WORKER_SECRET)."
      );
    }

    if (!response.ok) {
      const message =
        typeof workerPayload.error === "string" && workerPayload.error
          ? workerPayload.error
          : `Failed to queue transcription (${response.status}).`;
      throw new Error(message);
    }

    if (workerPayload.status === "complete" && workerPayload.result) {
      const transcript = await applyWorkerTranscriptToSession(
        session,
        workerPayload.result
      );
      return NextResponse.json({ status: "complete", transcript });
    }

    session.error = null;
    if (session.status !== "transcribing") {
      await updateSessionStatus(
        session,
        "transcribing",
        "Transcription queued with worker."
      );
    } else {
      await saveSession(session);
    }

    return NextResponse.json(
      {
        status: workerPayload.status ?? "queued",
        jobId: workerPayload.jobId ?? null,
        stage: workerPayload.stage ?? "Queued",
        progress:
          typeof workerPayload.progress === "number"
            ? workerPayload.progress
            : 0,
        totalChunks:
          typeof workerPayload.totalChunks === "number"
            ? workerPayload.totalChunks
            : null,
        completedChunks:
          typeof workerPayload.completedChunks === "number"
            ? workerPayload.completedChunks
            : null,
      },
      { status: 202 }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Transcription failed. Verify AUTOCLIP_WORKER_URL is reachable.";
    session.status = "error";
    session.error = message;
    await saveSession(session);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId." }, { status: 400 });
  }

  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }
  if (!session.workerSessionId) {
    return NextResponse.json(
      { error: "Worker session not initialized." },
      { status: 404 }
    );
  }

  if (session.transcript?.segments?.length) {
    return NextResponse.json({
      status: "complete",
      transcript: session.transcript,
    });
  }

  try {
    const response = await workerFetch(
      `/transcribe/status/${encodeURIComponent(session.workerSessionId)}`
    );
    const workerPayload =
      (await response.json().catch(() => ({}))) as WorkerTranscribeStatusPayload;

    if (response.status === 404) {
      return NextResponse.json(
        { error: "Transcription job not found. Please retry transcription." },
        { status: 404 }
      );
    }

    if (!response.ok) {
      throw new Error(workerPayload.error || "Unable to fetch transcription status.");
    }

    if (workerPayload.status === "complete" && workerPayload.result) {
      const transcript = await applyWorkerTranscriptToSession(
        session,
        workerPayload.result
      );
      return NextResponse.json({ status: "complete", transcript });
    }

    if (workerPayload.status === "error") {
      const message =
        workerPayload.error || "Worker transcription failed. Please retry.";
      session.status = "error";
      session.error = message;
      await saveSession(session);
      return NextResponse.json({ error: message }, { status: 502 });
    }

    return NextResponse.json(
      {
        status: workerPayload.status ?? "processing",
        stage: workerPayload.stage ?? "Transcribing",
        progress:
          typeof workerPayload.progress === "number"
            ? workerPayload.progress
            : 0,
        totalChunks:
          typeof workerPayload.totalChunks === "number"
            ? workerPayload.totalChunks
            : null,
        completedChunks:
          typeof workerPayload.completedChunks === "number"
            ? workerPayload.completedChunks
            : null,
      },
      { status: 202 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to fetch transcription status.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
