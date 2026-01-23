import { NextResponse } from "next/server";
import { getSession, saveSession, updateSessionStatus } from "@/lib/autoclip/session-store";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes for YouTube download

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
  const url = typeof body?.url === "string" ? body.url : null;

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId." }, { status: 400 });
  }

  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  // This endpoint now only handles YouTube URLs
  // File uploads should use /api/autoclip/upload-url + direct Supabase upload + /api/autoclip/upload-complete
  if (!url) {
    return NextResponse.json({ 
      error: "Missing URL. For file uploads, use the upload-url endpoint." 
    }, { status: 400 });
  }

  try {
    // YouTube URL - call worker's youtube endpoint
    const workerResponse = await workerFetch("/youtube", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    if (!workerResponse.ok) {
      const errorData = await workerResponse.json().catch(() => ({}));
      throw new Error(errorData.error || "YouTube download failed");
    }

    const workerData = await workerResponse.json();
    
    // Update session with worker response
    session.input = {
      sourceType: "youtube",
      sourceUrl: url,
      videoKey: workerData.videoKey,
      title: workerData.title,
      durationSeconds: workerData.metadata?.duration ?? null,
      width: workerData.metadata?.width ?? null,
      height: workerData.metadata?.height ?? null,
      sizeBytes: workerData.metadata?.size ?? null,
    };

    // Store worker session ID for later use
    session.workerSessionId = workerData.sessionId;

    await updateSessionStatus(session, "input_ready", "YouTube video downloaded.");
    await saveSession(session);

    return NextResponse.json({
      sessionId: session.id,
      input: session.input,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Input failed.";
    session.status = "error";
    session.error = message;
    await saveSession(session);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
