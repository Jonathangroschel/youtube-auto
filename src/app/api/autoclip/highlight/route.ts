import { NextResponse } from "next/server";
import { getSession, saveSession, updateSessionStatus } from "@/lib/autoclip/session-store";
import { selectHighlight, updateHighlightWithRange } from "@/lib/autoclip/highlight";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : null;
  const action = typeof body?.action === "string" ? body.action : "select";
  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId." }, { status: 400 });
  }

  const session = await getSession(sessionId);
  if (!session?.transcript?.segments?.length) {
    return NextResponse.json({ error: "Transcript unavailable." }, { status: 404 });
  }

  if (action === "update") {
    const index = Number(body?.index);
    if (!Number.isFinite(index) || index < 0) {
      return NextResponse.json({ error: "Missing highlight index." }, { status: 400 });
    }
    const start = Number(body?.start);
    const end = Number(body?.end);
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      return NextResponse.json({ error: "Invalid highlight range." }, { status: 400 });
    }
    if (!session.highlights?.length || !session.highlights[index]) {
      return NextResponse.json({ error: "Highlight not found." }, { status: 404 });
    }
    const title = typeof body?.title === "string" ? body.title : undefined;
    const highlight = updateHighlightWithRange(
      session.transcript.segments,
      start,
      end,
      title,
      session.input?.durationSeconds ?? null
    );
    session.highlights = [...session.highlights];
    session.highlights[index] = highlight;
    if (session.approvedHighlightIndexes?.length) {
      session.approvedHighlightIndexes = session.approvedHighlightIndexes.filter(
        (approvedIndex) => approvedIndex !== index
      );
    }
    if (session.removedHighlightIndexes?.length) {
      session.removedHighlightIndexes = session.removedHighlightIndexes.filter(
        (removedIndex) => removedIndex !== index
      );
    }
    await updateSessionStatus(session, "awaiting_approval", "Highlight updated.");
    await saveSession(session);
    return NextResponse.json({ highlight, index });
  }

  try {
    const highlights = await selectHighlight(session.transcript.segments, {
      instructions: typeof body?.instructions === "string" ? body.instructions : undefined,
      description: typeof body?.description === "string" ? body.description : undefined,
      language: session.transcript.language ?? null,
      durationSeconds: session.input?.durationSeconds ?? null,
    });
    session.highlights = highlights;
    session.approvedHighlightIndexes = [];
    session.removedHighlightIndexes = [];
    await updateSessionStatus(session, "awaiting_approval", "Highlight ready.");
    await saveSession(session);
    return NextResponse.json({ highlights });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Highlight failed.";
    session.status = "error";
    session.error = message;
    await saveSession(session);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
