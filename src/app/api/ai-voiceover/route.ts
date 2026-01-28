import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MODEL_ENDPOINT = "https://fal.run/fal-ai/elevenlabs/tts/eleven-v3";

type IncomingPayload = {
  text?: string;
  voice?: string;
};

export async function POST(request: Request) {
  const apiKey = process.env.FAL_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing FAL_KEY." }, { status: 500 });
  }

  let payload: IncomingPayload = {};
  try {
    payload = (await request.json()) as IncomingPayload;
  } catch {
    payload = {};
  }

  const text = typeof payload.text === "string" ? payload.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "Text is required." }, { status: 400 });
  }

  const voice = typeof payload.voice === "string" ? payload.voice.trim() : "";
  const body: Record<string, unknown> = {
    text,
  };
  if (voice) {
    body.voice = voice;
  }

  const response = await fetch(MODEL_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const message = await response.text();
    return NextResponse.json(
      { error: message || "Voiceover generation failed." },
      { status: response.status }
    );
  }

  const data = await response.json();
  return NextResponse.json(data);
}
