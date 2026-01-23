import { NextResponse } from "next/server";
import { getSession, saveSession, updateSessionStatus } from "@/lib/autoclip/session-store";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes for rendering

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
  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId." }, { status: 400 });
  }

  const session = await getSession(sessionId);
  if (!session?.input?.videoKey || !session.workerSessionId || !session.highlights?.length || !session.transcript) {
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
    await updateSessionStatus(session, "rendering", "Rendering clips via worker.");

    // Prepare clips for worker
    const clips = uniqueIndexes.map((index) => {
      const highlight = session.highlights![index];
      return {
        start: highlight.start,
        end: highlight.end,
        highlightIndex: index,
      };
    });

    // Map quality setting
    const qualityMap: Record<string, "high" | "medium" | "low"> = {
      "1080": "high",
      "720": "medium",
      "480": "low",
      auto: "high",
    };
    const quality = qualityMap[session.options.quality] || "high";

    // Call worker's render endpoint
    const response = await workerFetch("/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.workerSessionId,
        videoKey: session.input.videoKey,
        clips,
        quality,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Render failed");
    }

    const workerData = await response.json();

    // Convert worker response to our output format
    session.outputs = workerData.outputs.map((output: {
      index: number;
      clipKey: string;
      downloadUrl: string;
      filename: string;
    }) => ({
      filePath: output.clipKey,
      filename: output.filename,
      highlightIndex: uniqueIndexes[output.index],
      publicUrl: output.downloadUrl,
    }));

    await updateSessionStatus(session, "complete", "Render complete.");
    await saveSession(session);

    return NextResponse.json({ outputs: session.outputs });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Render failed.";
    session.status = "error";
    session.error = message;
    await saveSession(session);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
