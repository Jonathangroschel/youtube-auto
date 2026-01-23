import { NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";
import { getSession, saveSession, updateSessionStatus } from "@/lib/autoclip/session-store";
import { renderClipWithSubtitles } from "@/lib/autoclip/render";
import { slugify } from "@/lib/autoclip/utils";

export const runtime = "nodejs";

const resolveQuality = (
  width?: number | null,
  height?: number | null
): "auto" | "1080" | "720" | "480" => {
  const maxSide = Math.max(width ?? 0, height ?? 0);
  if (maxSide >= 1080) return "1080";
  if (maxSide >= 720) return "720";
  return "480";
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : null;
  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId." }, { status: 400 });
  }

  const session = await getSession(sessionId);
  if (!session?.input?.localPath || !session.highlights?.length || !session.transcript) {
    return NextResponse.json({ error: "Session not ready for render." }, { status: 404 });
  }

  const requestedIndexes = Array.isArray(body?.highlightIndexes)
    ? body.highlightIndexes
    : null;
  const approvedIndexes = session.approvedHighlightIndexes ?? [];
  const indexes = (requestedIndexes ?? approvedIndexes)
    .map((value: unknown) => Number(value))
    .filter((value: number) => Number.isFinite(value) && value >= 0);
  const uniqueIndexes = (Array.from(new Set(indexes)) as number[]).sort((a, b) => a - b);
  if (!uniqueIndexes.length) {
    return NextResponse.json({ error: "No approved highlights to render." }, { status: 400 });
  }
  if (uniqueIndexes.some((index) => !approvedIndexes.includes(index))) {
    return NextResponse.json({ error: "Highlight not approved." }, { status: 400 });
  }

  try {
    await updateSessionStatus(session, "rendering", "Rendering clips.");
    const quality =
      session.options.quality === "auto"
        ? resolveQuality(session.input.width, session.input.height)
        : session.options.quality;

    const title = session.input.title || "output";
    const slug = slugify(title) || "output";
    const outputs = [];
    for (const index of uniqueIndexes) {
      const highlight = session.highlights[index];
      if (!highlight) {
        continue;
      }
      const renderResult = await renderClipWithSubtitles({
        inputPath: session.input.localPath,
        outputDir: session.tempDir,
        start: highlight.start,
        end: highlight.end,
        mode: session.options.cropMode,
        quality,
      subtitlesEnabled: false,
        fontName: session.options.fontName,
        fontPath: session.options.fontPath,
        segments: session.transcript.segments,
      });
      const finalName = `${slug}_${session.id}_short_${index + 1}.mp4`;
      const finalPath = path.join(session.tempDir, finalName);
      await fs.copyFile(renderResult.filePath, finalPath);
      outputs.push({
        filePath: finalPath,
        filename: finalName,
        highlightIndex: index,
      });
    }
    if (!outputs.length) {
      throw new Error("Render produced no outputs.");
    }
    session.outputs = outputs;

    await updateSessionStatus(session, "complete", "Render complete.");
    await saveSession(session);

    const finalPaths = new Set(outputs.map((item) => item.filePath));
    const cleanupTargets = [
      "audio.wav",
      "clip.mp4",
      "cropped.mp4",
      "cropped_with_audio.mp4",
      "scaled.mp4",
      "subtitles.srt",
      "subtitled.mp4",
    ]
      .map((file) => path.join(session.tempDir, file))
      .filter((filePath) => !finalPaths.has(filePath));

    await Promise.all(
      cleanupTargets.map(async (filePath) => {
        try {
          await fs.rm(filePath, { force: true });
        } catch {
          // Ignore cleanup errors.
        }
      })
    );

    return NextResponse.json({ outputs: session.outputs });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Render failed.";
    session.status = "error";
    session.error = message;
    await saveSession(session);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
