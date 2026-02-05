import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MODEL_ENDPOINT = "https://fal.run/fal-ai/elevenlabs/tts/eleven-v3";
const VOICEOVER_TIMEOUT_MS = 90_000;
const VOICEOVER_MAX_ATTEMPTS = 2;

const isRetryableStatus = (status: number) =>
  status === 408 || status === 429 || status >= 500;

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

  let response: Response | null = null;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= VOICEOVER_MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), VOICEOVER_TIMEOUT_MS);
    try {
      response = await fetch(MODEL_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Key ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      const isAbort = error instanceof DOMException && error.name === "AbortError";
      const message = isAbort
        ? "Voiceover provider timed out."
        : error instanceof Error
          ? error.message
          : "Voiceover provider request failed.";
      lastError = new Error(message);
      if (attempt >= VOICEOVER_MAX_ATTEMPTS || !isAbort) {
        break;
      }
      await new Promise<void>((resolve) => {
        setTimeout(resolve, attempt === 1 ? 900 : 1600);
      });
      continue;
    } finally {
      clearTimeout(timeoutId);
    }

    if (response.ok) {
      break;
    }
    if (
      attempt >= VOICEOVER_MAX_ATTEMPTS ||
      !isRetryableStatus(response.status)
    ) {
      break;
    }
    await new Promise<void>((resolve) => {
      setTimeout(resolve, attempt === 1 ? 900 : 1600);
    });
  }

  if (!response) {
    return NextResponse.json(
      { error: lastError?.message || "Voiceover generation failed." },
      { status: 504 }
    );
  }

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
