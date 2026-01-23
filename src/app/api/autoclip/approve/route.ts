import { NextResponse } from "next/server";
import { getSession, saveSession, updateSessionStatus } from "@/lib/autoclip/session-store";
import { selectHighlight } from "@/lib/autoclip/highlight";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : null;
  const action = typeof body?.action === "string" ? body.action : "approve";
  const index = Number(body?.index);
  const hasIndex = Number.isFinite(index) && index >= 0;

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId." }, { status: 400 });
  }

  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  if (action === "regenerate") {
    if (!session.transcript?.segments?.length) {
      return NextResponse.json({ error: "Transcript unavailable." }, { status: 400 });
    }
    if (!session.highlights?.length) {
      return NextResponse.json({ error: "Highlights unavailable." }, { status: 400 });
    }
    try {
      if (hasIndex) {
        if (!session.highlights[index]) {
          return NextResponse.json({ error: "Highlight not found." }, { status: 404 });
        }
        const excludeRanges = session.highlights
          .map((highlight, highlightIndex) => ({
            highlight,
            highlightIndex,
          }))
          .filter((item) => item.highlightIndex !== index)
          .map((item) => ({
            start: item.highlight.start,
            end: item.highlight.end,
          }));
        const replacements = await selectHighlight(session.transcript.segments, {
          durationSeconds: session.input?.durationSeconds ?? null,
          language: session.transcript.language ?? null,
          maxHighlights: 1,
          excludeRanges,
        });
        const nextHighlight = replacements[0];
        if (!nextHighlight) {
          throw new Error("Unable to regenerate highlight.");
        }
        session.highlights = [...session.highlights];
        session.highlights[index] = nextHighlight;
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
        await updateSessionStatus(session, "awaiting_approval", "Highlight regenerated.");
        await saveSession(session);
        return NextResponse.json({
          highlight: nextHighlight,
          index,
          approvedIndexes: session.approvedHighlightIndexes ?? [],
          removedIndexes: session.removedHighlightIndexes ?? [],
        });
      }

      const highlights = await selectHighlight(session.transcript.segments, {
        durationSeconds: session.input?.durationSeconds ?? null,
        language: session.transcript.language ?? null,
      });
      session.highlights = highlights;
      session.approvedHighlightIndexes = [];
      session.removedHighlightIndexes = [];
      await updateSessionStatus(session, "awaiting_approval", "Highlights regenerated.");
      await saveSession(session);
      return NextResponse.json({
        highlights,
        approvedIndexes: session.approvedHighlightIndexes,
        removedIndexes: session.removedHighlightIndexes,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Regenerate failed.";
      session.status = "error";
      session.error = message;
      await saveSession(session);
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  if (action === "reject") {
    if (!hasIndex) {
      return NextResponse.json({ error: "Missing highlight index." }, { status: 400 });
    }
    if (session.approvedHighlightIndexes?.length) {
      session.approvedHighlightIndexes = session.approvedHighlightIndexes.filter(
        (approvedIndex) => approvedIndex !== index
      );
      await saveSession(session);
    }
    return NextResponse.json({
      status: "rejected",
      approvedIndexes: session.approvedHighlightIndexes ?? [],
      removedIndexes: session.removedHighlightIndexes ?? [],
    });
  }

  if (action === "remove") {
    if (!hasIndex) {
      return NextResponse.json({ error: "Missing highlight index." }, { status: 400 });
    }
    if (!session.highlights?.length || !session.highlights[index]) {
      return NextResponse.json({ error: "Highlight not found." }, { status: 404 });
    }
    const removed = new Set(session.removedHighlightIndexes ?? []);
    removed.add(index);
    session.removedHighlightIndexes = Array.from(removed).sort((a, b) => a - b);
    if (session.approvedHighlightIndexes?.length) {
      session.approvedHighlightIndexes = session.approvedHighlightIndexes.filter(
        (approvedIndex) => approvedIndex !== index
      );
    }
    await updateSessionStatus(session, "awaiting_approval", "Highlight removed.");
    await saveSession(session);
    return NextResponse.json({
      status: "removed",
      approvedIndexes: session.approvedHighlightIndexes ?? [],
      removedIndexes: session.removedHighlightIndexes ?? [],
    });
  }

  if (action === "restore") {
    if (!hasIndex) {
      return NextResponse.json({ error: "Missing highlight index." }, { status: 400 });
    }
    if (session.removedHighlightIndexes?.length) {
      session.removedHighlightIndexes = session.removedHighlightIndexes.filter(
        (removedIndex) => removedIndex !== index
      );
    }
    await updateSessionStatus(session, "awaiting_approval", "Highlight restored.");
    await saveSession(session);
    return NextResponse.json({
      status: "restored",
      approvedIndexes: session.approvedHighlightIndexes ?? [],
      removedIndexes: session.removedHighlightIndexes ?? [],
    });
  }

  if (!hasIndex) {
    return NextResponse.json({ error: "Missing highlight index." }, { status: 400 });
  }
  if (!session.highlights?.length || !session.highlights[index]) {
    return NextResponse.json({ error: "Highlight not found." }, { status: 404 });
  }
  const approved = new Set(session.approvedHighlightIndexes ?? []);
  approved.add(index);
  session.approvedHighlightIndexes = Array.from(approved).sort((a, b) => a - b);
  if (session.removedHighlightIndexes?.length) {
    session.removedHighlightIndexes = session.removedHighlightIndexes.filter(
      (removedIndex) => removedIndex !== index
    );
  }
  await updateSessionStatus(session, "approved", "Highlight approved.");
  await saveSession(session);
  return NextResponse.json({
    status: "approved",
    approvedIndexes: session.approvedHighlightIndexes,
    removedIndexes: session.removedHighlightIndexes ?? [],
  });
}
