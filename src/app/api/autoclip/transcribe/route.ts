import { NextResponse } from "next/server";
import {
  getSession,
  saveSession,
  updateSessionStatus,
} from "@/lib/autoclip/session-store";

export const runtime = "nodejs";

const WORKER_URL =
  process.env.AUTOCLIP_TRANSCRIBE_WORKER_URL ||
  process.env.AUTOCLIP_WORKER_URL ||
  "http://localhost:3001";
const WORKER_SECRET =
  process.env.AUTOCLIP_TRANSCRIBE_WORKER_SECRET ||
  process.env.AUTOCLIP_WORKER_SECRET ||
  "dev-secret";
const WORKER_REQUEST_TIMEOUT_MS = 25_000;
const MIN_TRANSCRIPT_COVERAGE_RATIO = 0.9;
const MAX_TRANSCRIPT_COVERAGE_GAP_SECONDS = 45;

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
  attemptStats?: {
    totalAttempts?: number;
    connectionRetries?: number;
    lastErrorCode?: string | null;
    lastTransport?: string | null;
  };
  error?: string | null;
  result?: WorkerTranscriptionResult;
};

type WorkerFetchOptions = RequestInit & {
  correlationId?: string | null;
};

const getCorrelationIdFromRequest = (request: Request) => {
  const incoming = request.headers.get("x-correlation-id");
  if (incoming && incoming.trim()) {
    return incoming.trim().slice(0, 120);
  }
  return crypto.randomUUID();
};

async function workerFetch(endpoint: string, options: WorkerFetchOptions = {}) {
  const { correlationId = null, headers, ...requestInit } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    WORKER_REQUEST_TIMEOUT_MS
  );
  try {
    const requestHeaders = new Headers(headers);
    requestHeaders.set("Authorization", `Bearer ${WORKER_SECRET}`);
    if (typeof correlationId === "string" && correlationId.trim()) {
      requestHeaders.set("x-correlation-id", correlationId.trim().slice(0, 120));
    }

    return await fetch(`${WORKER_URL}${endpoint}`, {
      ...requestInit,
      signal: controller.signal,
      headers: requestHeaders,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Worker request timed out.");
    }
    if (error instanceof TypeError) {
      const message = String(error.message ?? "").toLowerCase();
      if (
        /fetch failed|network|econn|socket|enotfound|eai_again|refused|unreachable/i.test(
          message
        )
      ) {
        throw new Error(
          "Unable to reach the transcription worker. Please retry in a moment."
        );
      }
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

const getTranscribeRouteErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) {
    const normalized = error.message.trim();
    if (!normalized) {
      return fallback;
    }
    if (
      /failed to fetch|fetch failed|network|econn|socket|enotfound|eai_again|refused|unreachable/i.test(
        normalized.toLowerCase()
      )
    ) {
      return "Unable to connect to the transcription service. Please try again.";
    }
    return normalized;
  }
  return fallback;
};

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

const resolveTranscriptEndSeconds = (
  segments: Array<{ start: number; end: number }>
) => {
  let maxEnd = 0;
  segments.forEach((segment) => {
    if (Number.isFinite(segment.end)) {
      maxEnd = Math.max(maxEnd, segment.end);
    }
  });
  return maxEnd;
};

const resolveAllowedCoverageGapSeconds = (expectedDurationSeconds: number) =>
  Math.max(
    8,
    Math.min(MAX_TRANSCRIPT_COVERAGE_GAP_SECONDS, expectedDurationSeconds * 0.08)
  );

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
  if (Number.isFinite(fallbackDurationSeconds) && fallbackDurationSeconds > 0) {
    const transcriptEndSeconds = resolveTranscriptEndSeconds(segments);
    const coverageRatio = transcriptEndSeconds / fallbackDurationSeconds;
    const missingSeconds = Math.max(0, fallbackDurationSeconds - transcriptEndSeconds);
    const allowedGapSeconds = resolveAllowedCoverageGapSeconds(fallbackDurationSeconds);
    if (
      coverageRatio < MIN_TRANSCRIPT_COVERAGE_RATIO &&
      missingSeconds > allowedGapSeconds
    ) {
      throw new Error(
        `Transcript coverage too low (${transcriptEndSeconds.toFixed(
          2
        )}s of ${fallbackDurationSeconds.toFixed(2)}s).`
      );
    }
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

const queueWorkerTranscription = async (
  session: Awaited<ReturnType<typeof getSession>>,
  language: string,
  correlationId: string
): Promise<WorkerTranscribeStatusPayload> => {
  if (!session?.workerSessionId || !session.input?.videoKey) {
    throw new Error("Worker session is not ready for transcription.");
  }

  const workerRequestBody = JSON.stringify({
    sessionId: session.workerSessionId,
    videoKey: session.input.videoKey,
    language,
  });

  const response = await workerFetch("/transcribe/queue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: workerRequestBody,
    correlationId,
  });

  const workerPayload =
    (await response.json().catch(() => ({}))) as WorkerTranscribeStatusPayload;

  // Backward-compatible fallback for workers that only expose `/transcribe`.
  if (response.status === 404) {
    const legacyResponse = await workerFetch("/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: workerRequestBody,
      correlationId,
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
    return {
      status: "complete",
      stage: "Transcription complete",
      progress: 100,
      result: legacyPayload,
    };
  }

  if (response.status === 401) {
    throw new Error(
      "Worker authentication failed (check AUTOCLIP_TRANSCRIBE_WORKER_SECRET, AUTOCLIP_WORKER_SECRET, and WORKER_SECRET)."
    );
  }

  if (!response.ok) {
    const message =
      typeof workerPayload.error === "string" && workerPayload.error
        ? workerPayload.error
        : `Failed to queue transcription (${response.status}).`;
    throw new Error(message);
  }

  return workerPayload;
};

export async function POST(request: Request) {
  const correlationId = getCorrelationIdFromRequest(request);
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
    const workerPayload = await queueWorkerTranscription(
      session,
      language,
      correlationId
    );

    if (workerPayload.status === "complete" && workerPayload.result) {
      session.workerTranscribeJobId = null;
      session.workerTranscribeLanguage = language;
      const transcript = await applyWorkerTranscriptToSession(
        session,
        workerPayload.result
      );
      return NextResponse.json({ status: "complete", transcript });
    }

    session.workerTranscribeLanguage = language;
    session.workerTranscribeJobId =
      typeof workerPayload.jobId === "string" && workerPayload.jobId.trim().length > 0
        ? workerPayload.jobId.trim()
        : session.workerTranscribeJobId ?? null;
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
        attemptStats: workerPayload.attemptStats ?? null,
      },
      { status: 202 }
    );
  } catch (error) {
    const message = getTranscribeRouteErrorMessage(
      error,
      "Transcription failed. Verify AUTOCLIP_TRANSCRIBE_WORKER_URL (or AUTOCLIP_WORKER_URL) is reachable."
    );
    session.status = "error";
    session.error = message;
    await saveSession(session);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const correlationId = getCorrelationIdFromRequest(request);
  const sessionId = searchParams.get("sessionId");
  const allowRecoveryOnMissingJob = searchParams.get("recover") === "1";

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
      `/transcribe/status/${encodeURIComponent(session.workerSessionId)}`,
      { correlationId }
    );
    const workerPayload =
      (await response.json().catch(() => ({}))) as WorkerTranscribeStatusPayload;

    if (response.status === 404) {
      const hasInFlightTranscription = session.status === "transcribing";
      if (!allowRecoveryOnMissingJob) {
        return NextResponse.json({
          status: "idle",
          stage: "Transcription not started",
          progress: 0,
          totalChunks: null,
          completedChunks: null,
          attemptStats: null,
        });
      }
      if (!hasInFlightTranscription) {
        return NextResponse.json(
          { error: "Transcription is not currently in progress." },
          { status: 409 }
        );
      }

      const requeueLanguage =
        typeof session.workerTranscribeLanguage === "string" &&
        session.workerTranscribeLanguage.trim().length > 0
          ? session.workerTranscribeLanguage.trim()
          : "en";
      const requeuedPayload = await queueWorkerTranscription(
        session,
        requeueLanguage,
        correlationId
      );
      if (requeuedPayload.status === "complete" && requeuedPayload.result) {
        session.workerTranscribeJobId = null;
        session.workerTranscribeLanguage = requeueLanguage;
        const transcript = await applyWorkerTranscriptToSession(
          session,
          requeuedPayload.result
        );
        return NextResponse.json({ status: "complete", transcript });
      }
      session.workerTranscribeLanguage = requeueLanguage;
      if (
        typeof requeuedPayload.jobId === "string" &&
        requeuedPayload.jobId.trim().length > 0
      ) {
        session.workerTranscribeJobId = requeuedPayload.jobId.trim();
      }
      session.error = null;
      if (session.status !== "transcribing") {
        await updateSessionStatus(
          session,
          "transcribing",
          "Transcription job re-queued after worker restart."
        );
      } else {
        await saveSession(session);
      }
      return NextResponse.json(
        {
          status: requeuedPayload.status ?? "queued",
          stage: requeuedPayload.stage ?? "Queued after worker restart",
          progress:
            typeof requeuedPayload.progress === "number"
              ? requeuedPayload.progress
              : 0,
          totalChunks:
            typeof requeuedPayload.totalChunks === "number"
              ? requeuedPayload.totalChunks
              : null,
          completedChunks:
            typeof requeuedPayload.completedChunks === "number"
              ? requeuedPayload.completedChunks
              : null,
          attemptStats: requeuedPayload.attemptStats ?? null,
          requeued: true,
        },
        { status: 202 }
      );
    }

    if (!response.ok) {
      throw new Error(workerPayload.error || "Unable to fetch transcription status.");
    }

    if (workerPayload.status === "complete" && workerPayload.result) {
      session.workerTranscribeJobId = null;
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
      session.workerTranscribeJobId = null;
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
        attemptStats: workerPayload.attemptStats ?? null,
      },
      { status: 202 }
    );
  } catch (error) {
    const message = getTranscribeRouteErrorMessage(
      error,
      "Unable to fetch transcription status."
    );
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
