import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession, saveSession, updateSessionStatus } from "@/lib/autoclip/session-store";

export const runtime = "nodejs";

const WORKER_URL = process.env.AUTOCLIP_WORKER_URL || "http://localhost:3001";
const WORKER_SECRET = process.env.AUTOCLIP_WORKER_SECRET || "dev-secret";
const BUCKET = "autoclip-files";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : null;

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId." }, { status: 400 });
  }

  const session = await getSession(sessionId);
  if (!session || !session.input?.videoKey || !session.workerSessionId) {
    return NextResponse.json({ error: "Session not ready." }, { status: 404 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Storage not configured." }, { status: 500 });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get file info from Supabase to verify upload and get metadata
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: fileData, error: fileError } = await (supabase.storage as any)
      .from(BUCKET)
      .list(`sessions/${session.workerSessionId}`, { limit: 1 });

    if (fileError || !fileData?.length) {
      throw new Error("Upload verification failed - file not found in storage");
    }

    const file = fileData[0];
    
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
          sessionId: session.workerSessionId,
          videoKey: session.input.videoKey,
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
    session.input = {
      ...session.input,
      sizeBytes: file.metadata?.size || null,
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
