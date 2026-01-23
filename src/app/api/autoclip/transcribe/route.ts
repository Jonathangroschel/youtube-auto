import { NextResponse } from "next/server";
import path from "path";
import { getSession, saveSession, updateSessionStatus } from "@/lib/autoclip/session-store";
import { extractAudio, transcribeAudio } from "@/lib/autoclip/transcribe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : null;
  const language =
    typeof body?.language === "string" && body.language.trim().length > 0
      ? body.language.trim()
      : null;
  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId." }, { status: 400 });
  }

  const session = await getSession(sessionId);
  if (!session || !session.input?.localPath) {
    return NextResponse.json({ error: "Session not ready for transcription." }, { status: 404 });
  }

  try {
    const audioPath = path.join(session.tempDir, "audio.wav");
    await extractAudio(session.input.localPath, audioPath);
    const transcript = await transcribeAudio(audioPath, language);
    session.transcript = transcript;
    await updateSessionStatus(session, "transcribed", "Transcription complete.");
    await saveSession(session);
    return NextResponse.json({ transcript });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transcription failed.";
    session.status = "error";
    session.error = message;
    await saveSession(session);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
