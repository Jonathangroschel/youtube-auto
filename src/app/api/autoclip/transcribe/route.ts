import { NextResponse } from "next/server";
import { getSession, saveSession, updateSessionStatus } from "@/lib/autoclip/session-store";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes for transcription

const WORKER_URL = process.env.AUTOCLIP_WORKER_URL || "http://localhost:3001";
const WORKER_SECRET = process.env.AUTOCLIP_WORKER_SECRET || "dev-secret";

async function workerFetch(endpoint: string, options: RequestInit = {}) {
  return fetch(`${WORKER_URL}${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${WORKER_SECRET}`,
    },
  });
}

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
    return NextResponse.json({ error: "Session not found. Make sure you uploaded a video first." }, { status: 404 });
  }
  if (!session.input?.videoKey) {
    return NextResponse.json({ 
      error: "Video not uploaded yet. Session exists but no videoKey.", 
      debug: { hasInput: !!session.input, status: session.status }
    }, { status: 404 });
  }
  if (!session.workerSessionId) {
    return NextResponse.json({ 
      error: "Worker session not initialized.", 
      debug: { hasInput: !!session.input, videoKey: session.input?.videoKey }
    }, { status: 404 });
  }

  try {
    // Call worker's transcribe endpoint
    const response = await workerFetch("/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.workerSessionId,
        videoKey: session.input.videoKey,
        language,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Transcription failed");
    }

    const workerData = await response.json();

    // Convert worker response to our transcript format
    session.transcript = {
      language: workerData.language,
      segments: workerData.segments.map((seg: { start: number; end: number; text: string }) => ({
        start: seg.start,
        end: seg.end,
        text: seg.text,
      })),
      raw: workerData,
    };

    await updateSessionStatus(session, "transcribed", "Transcription complete via worker.");
    await saveSession(session);

    return NextResponse.json({ transcript: session.transcript });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transcription failed.";
    session.status = "error";
    session.error = message;
    await saveSession(session);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
