import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MODEL_ENDPOINT = "https://fal.run/fal-ai/veo3.1/fast";
const ALLOWED_ASPECT_RATIOS = new Set(["16:9", "9:16"]);
const ALLOWED_DURATIONS = new Set(["4s", "6s", "8s"]);
const RESOLUTION = "720p";

type IncomingPayload = {
  prompt?: string;
  aspectRatio?: string;
  duration?: number | string;
  generateAudio?: boolean;
};

const normalizeDuration = (value?: number | string) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${Math.round(value)}s`;
  }
  if (typeof value === "string") {
    return value.trim();
  }
  return "";
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

  const prompt = typeof payload.prompt === "string" ? payload.prompt.trim() : "";
  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
  }

  const aspectRatio =
    typeof payload.aspectRatio === "string" &&
    ALLOWED_ASPECT_RATIOS.has(payload.aspectRatio)
      ? payload.aspectRatio
      : "16:9";

  const durationRaw = normalizeDuration(payload.duration);
  const duration = ALLOWED_DURATIONS.has(durationRaw) ? durationRaw : "8s";

  const generateAudio =
    typeof payload.generateAudio === "boolean" ? payload.generateAudio : true;

  const response = await fetch(MODEL_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      prompt,
      aspect_ratio: aspectRatio,
      duration,
      resolution: RESOLUTION,
      generate_audio: generateAudio,
      auto_fix: true,
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    return NextResponse.json(
      { error: message || "Video generation failed." },
      { status: response.status }
    );
  }

  const data = await response.json();
  return NextResponse.json(data);
}
