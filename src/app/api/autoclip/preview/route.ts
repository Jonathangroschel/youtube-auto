import { NextResponse } from "next/server";
import { getSession, saveSession } from "@/lib/autoclip/session-store";
import { clampNumber } from "@/lib/autoclip/utils";

export const runtime = "nodejs";
export const maxDuration = 60;

const WORKER_URL = process.env.AUTOCLIP_WORKER_URL || "http://localhost:3001";
const WORKER_SECRET = process.env.AUTOCLIP_WORKER_SECRET || "dev-secret";

const parseNumber = (value: string | null) => {
  if (value == null) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId." }, { status: 400 });
  }

  const session = await getSession(sessionId);
  if (!session?.input?.videoKey || !session.workerSessionId) {
    return NextResponse.json(
      { error: "Session not ready for preview." },
      { status: 404 }
    );
  }

  const requestedStart = parseNumber(searchParams.get("start"));
  const requestedEnd = parseNumber(searchParams.get("end"));
  const fallbackHighlight = session.highlights?.[0] ?? null;
  const fallbackStart = fallbackHighlight?.start ?? null;
  const fallbackEnd = fallbackHighlight?.end ?? null;
  const rawStart = requestedStart ?? fallbackStart;
  const rawEnd = requestedEnd ?? fallbackEnd;

  if (rawStart == null || rawEnd == null || rawEnd <= rawStart) {
    return NextResponse.json(
      { error: "Invalid preview range." },
      { status: 400 }
    );
  }

  const minGap = 1;
  const duration =
    typeof session.input.durationSeconds === "number"
      ? session.input.durationSeconds
      : null;
  let start = Math.max(0, rawStart);
  let end = Math.max(rawEnd, start + minGap);
  if (duration && Number.isFinite(duration)) {
    const maxStart = Math.max(0, duration - minGap);
    start = clampNumber(start, 0, maxStart);
    end = clampNumber(end, start + minGap, duration);
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return NextResponse.json(
      { error: "Invalid preview range." },
      { status: 400 }
    );
  }

  try {
    // Check if we have a cached preview for this range
    if (
      session.preview?.publicUrl &&
      session.preview.start === start &&
      session.preview.end === end
    ) {
      return NextResponse.redirect(session.preview.publicUrl);
    }

    // Call worker to generate preview
    const response = await fetch(`${WORKER_URL}/preview`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${WORKER_SECRET}`,
      },
      body: JSON.stringify({
        sessionId: session.workerSessionId,
        videoKey: session.input.videoKey,
        start,
        end,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Preview generation failed");
    }

    const workerData = await response.json();

    // Cache the preview info
    session.preview = {
      filePath: workerData.previewKey,
      filename: `preview_${Math.round(start * 1000)}_${Math.round(end * 1000)}.mp4`,
      start,
      end,
      publicUrl: workerData.previewUrl,
    };
    await saveSession(session);

    // Redirect to the preview URL
    return NextResponse.redirect(workerData.previewUrl);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Preview failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
