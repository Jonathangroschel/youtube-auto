import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession, saveSession } from "@/lib/autoclip/session-store";
import crypto from "crypto";

export const runtime = "nodejs";

const BUCKET = "autoclip-files";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : null;
  const filename = typeof body?.filename === "string" ? body.filename : "video.mp4";
  const contentType = typeof body?.contentType === "string" ? body.contentType : "video/mp4";

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId." }, { status: 400 });
  }

  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Storage not configured." }, { status: 500 });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Generate a unique worker session ID
    const workerSessionId = crypto.randomUUID().slice(0, 8);
    const videoKey = `sessions/${workerSessionId}/input.mp4`;

    // Create signed upload URL (valid for 1 hour)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.storage as any)
      .from(BUCKET)
      .createSignedUploadUrl(videoKey);

    if (error) {
      throw new Error(error.message || "Failed to create upload URL");
    }

    // Store the worker session ID for later
    session.workerSessionId = workerSessionId;
    session.input = {
      sourceType: "file",
      videoKey,
      originalFilename: filename,
    };
    await saveSession(session);

    return NextResponse.json({
      uploadUrl: data.signedUrl,
      videoKey,
      workerSessionId,
      token: data.token,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get upload URL";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
