import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession, saveSession, updateSessionStatus } from "@/lib/autoclip/session-store";

export const runtime = "nodejs";

const WORKER_URL = process.env.AUTOCLIP_WORKER_URL || "http://localhost:3001";
const WORKER_SECRET = process.env.AUTOCLIP_WORKER_SECRET || "dev-secret";
const BUCKET = "autoclip-files";
const UPLOAD_VERIFY_MAX_ATTEMPTS = 8;
const UPLOAD_VERIFY_RETRY_MS = 350;

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : null;
  const requestedVideoKey =
    typeof body?.videoKey === "string" && body.videoKey.trim().length > 0
      ? body.videoKey.trim()
      : null;
  const requestedWorkerSessionId =
    typeof body?.workerSessionId === "string" && body.workerSessionId.trim().length > 0
      ? body.workerSessionId.trim()
      : null;
  const requestedSizeBytes =
    typeof body?.sizeBytes === "number" && Number.isFinite(body.sizeBytes) && body.sizeBytes > 0
      ? body.sizeBytes
      : null;

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId." }, { status: 400 });
  }

  const session = await getSession(sessionId);
  const sessionVideoKey = session?.input?.videoKey ?? null;
  const sessionWorkerSessionId = session?.workerSessionId ?? null;
  const videoKey = requestedVideoKey ?? sessionVideoKey;
  const workerSessionId = requestedWorkerSessionId ?? sessionWorkerSessionId;
  if (!session || !videoKey || !workerSessionId) {
    return NextResponse.json({ error: "Session not ready." }, { status: 404 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Storage not configured." }, { status: 500 });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Persist latest upload identifiers from client payload when provided.
    session.workerSessionId = workerSessionId;
    session.input = {
      ...session.input,
      sourceType: "file",
      videoKey,
      originalSizeBytes:
        typeof session.input?.originalSizeBytes === "number" && session.input.originalSizeBytes > 0
          ? session.input.originalSizeBytes
          : requestedSizeBytes,
    };
    await saveSession(session);

    // Verify the exact uploaded object path. Storage indexing can be slightly delayed.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let fileInfo: any = null;
    let verifyErrorMessage = "";
    for (let attempt = 1; attempt <= UPLOAD_VERIFY_MAX_ATTEMPTS; attempt += 1) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.storage as any).from(BUCKET).info(videoKey);
      if (!error && data) {
        fileInfo = data;
        break;
      }
      verifyErrorMessage =
        error?.message || "file not found in storage";
      if (attempt < UPLOAD_VERIFY_MAX_ATTEMPTS) {
        await wait(UPLOAD_VERIFY_RETRY_MS * attempt);
      }
    }

    if (!fileInfo) {
      throw new Error(
        `Upload verification failed - file not found in storage (${verifyErrorMessage})`
      );
    }

    // Try to get video metadata from the worker
    let metadata = { duration: null, width: null, height: null };
    try {
      const response = await fetch(`${WORKER_URL}/metadata`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${WORKER_SECRET}`,
        },
        body: JSON.stringify({
          sessionId: workerSessionId,
          videoKey,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        metadata = data.metadata || metadata;
      }
    } catch {
      // Metadata fetch is optional, continue without it
    }

    // Update session with file info
    const sizeBytesFromInfo =
      typeof fileInfo?.size === "number" && Number.isFinite(fileInfo.size) && fileInfo.size > 0
        ? fileInfo.size
        : null;
    const metadataSizeCandidate =
      typeof fileInfo?.metadata?.size === "number"
        ? fileInfo.metadata.size
        : typeof fileInfo?.metadata?.contentLength === "number"
          ? fileInfo.metadata.contentLength
          : typeof fileInfo?.metadata?.content_length === "number"
            ? fileInfo.metadata.content_length
            : null;
    const resolvedSizeBytes =
      sizeBytesFromInfo ??
      (metadataSizeCandidate && metadataSizeCandidate > 0 ? metadataSizeCandidate : null) ??
      requestedSizeBytes ??
      (typeof session.input?.originalSizeBytes === "number" && session.input.originalSizeBytes > 0
        ? session.input.originalSizeBytes
        : null);

    session.input = {
      ...session.input,
      videoKey,
      sizeBytes: resolvedSizeBytes,
      durationSeconds: metadata.duration,
      width: metadata.width,
      height: metadata.height,
    };

    await updateSessionStatus(session, "input_ready", "Upload complete.");
    await saveSession(session);

    return NextResponse.json({
      sessionId: session.id,
      input: session.input,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload verification failed";
    session.status = "error";
    session.error = message;
    await saveSession(session);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
