import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MODEL_ENDPOINT = "https://fal.run/fal-ai/imagen4/preview/fast";
const ALLOWED_ASPECT_RATIOS = new Set([
  "21:9",
  "16:9",
  "4:3",
  "3:2",
  "1:1",
  "2:3",
  "3:4",
  "9:16",
  "9:21",
]);

type IncomingPayload = {
  prompt?: string;
  aspectRatio?: string;
};

export async function POST(request: Request) {
  const apiKey = process.env.FAL_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing FAL_KEY." },
      { status: 500 }
    );
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
      : "1:1";

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
      num_images: 1,
      output_format: "png",
      enable_safety_checker: true,
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    return NextResponse.json(
      { error: message || "Image generation failed." },
      { status: response.status }
    );
  }

  const data = await response.json();
  return NextResponse.json(data);
}
