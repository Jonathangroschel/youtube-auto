import { NextResponse } from "next/server";
import { getSession, saveSession, updateSessionStatus } from "@/lib/autoclip/session-store";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes for video upload/download

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
  const contentType = request.headers.get("content-type") ?? "";
  const isMultipart = contentType.includes("multipart/form-data");
  let sessionId: string | null = null;
  let url: string | null = null;
  let file: File | null = null;

  if (isMultipart) {
    const form = await request.formData();
    sessionId = typeof form.get("sessionId") === "string" ? String(form.get("sessionId")) : null;
    url = typeof form.get("url") === "string" ? String(form.get("url")) : null;
    const incomingFile = form.get("file");
    if (incomingFile instanceof File) {
      file = incomingFile;
    }
  } else {
    const body = await request.json().catch(() => ({}));
    sessionId = typeof body?.sessionId === "string" ? body.sessionId : null;
    url = typeof body?.url === "string" ? body.url : null;
  }

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId." }, { status: 400 });
  }

  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  if (!url && !file) {
    return NextResponse.json({ error: "Missing url or file input." }, { status: 400 });
  }

  try {
    let workerResponse: Response;
    let sourceType: "youtube" | "file" = "file";
    let title: string | undefined;

    if (url) {
      // YouTube URL - call worker's youtube endpoint
      sourceType = "youtube";
      workerResponse = await workerFetch("/youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
    } else if (file) {
      // File upload - call worker's upload endpoint
      const formData = new FormData();
      formData.append("video", file);
      workerResponse = await workerFetch("/upload", {
        method: "POST",
        body: formData,
      });
      title = file.name?.replace(/\.[^.]+$/, "");
    } else {
      return NextResponse.json({ error: "No input provided." }, { status: 400 });
    }

    if (!workerResponse.ok) {
      const errorData = await workerResponse.json().catch(() => ({}));
      throw new Error(errorData.error || "Worker request failed");
    }

    const workerData = await workerResponse.json();
    
    // Update session with worker response
    session.input = {
      sourceType,
      sourceUrl: url ?? undefined,
      videoKey: workerData.videoKey,
      title: title ?? workerData.title,
      originalFilename: file?.name,
      durationSeconds: workerData.metadata?.duration ?? null,
      width: workerData.metadata?.width ?? null,
      height: workerData.metadata?.height ?? null,
      sizeBytes: workerData.metadata?.size ?? null,
    };

    // Store worker session ID for later use
    session.workerSessionId = workerData.sessionId;

    await updateSessionStatus(session, "input_ready", "Input prepared via worker.");
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
