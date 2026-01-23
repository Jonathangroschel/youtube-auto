import { NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";
import { clipVideo } from "@/lib/autoclip/render";
import { getSession, saveSession } from "@/lib/autoclip/session-store";
import { clampNumber } from "@/lib/autoclip/utils";

export const runtime = "nodejs";

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
  if (!session?.input?.localPath) {
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

  const startMs = Math.round(start * 1000);
  const endMs = Math.round(end * 1000);
  const previewFilename = `preview_${startMs}_${endMs}.mp4`;
  const previewPath = path.join(session.tempDir, previewFilename);

  try {
    if (
      session.preview?.filePath &&
      session.preview.filePath !== previewPath
    ) {
      await fs.rm(session.preview.filePath, { force: true });
    }
  } catch {
    // Ignore cleanup failures.
  }

  const hasPreview = await fs
    .stat(previewPath)
    .then(() => true)
    .catch(() => false);

  try {
    if (!hasPreview) {
      await clipVideo(session.input.localPath, previewPath, start, end);
    }
    session.preview = {
      filePath: previewPath,
      filename: previewFilename,
      start,
      end,
    };
    await saveSession(session);
    const buffer = await fs.readFile(previewPath);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `inline; filename="${previewFilename}"`,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Preview failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
