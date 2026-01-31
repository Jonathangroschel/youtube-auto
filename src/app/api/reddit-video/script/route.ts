import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server-client";

export const runtime = "nodejs";

type IncomingPayload = {
  topic?: string;
  tone?: string;
  length?: "short" | "medium" | "long";
  hook?: string;
  cta?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const extractOutputText = (payload: unknown) => {
  if (!isRecord(payload)) {
    return "";
  }
  const outputText = payload.output_text;
  if (typeof outputText === "string") {
    return outputText.trim();
  }

  const outputItems = Array.isArray(payload.output) ? payload.output : [];
  const parts: string[] = [];
  outputItems.forEach((item) => {
    if (!isRecord(item)) {
      return;
    }
    const itemText = item.text;
    if (typeof itemText === "string") {
      parts.push(itemText);
    }
    if (item.type !== "message") {
      return;
    }
    const content = item.content;
    if (!Array.isArray(content)) {
      return;
    }
    content.forEach((part) => {
      if (!isRecord(part)) {
        return;
      }
      const text = part.text;
      if (typeof text === "string") {
        parts.push(text);
      }
    });
  });
  return parts.join("").trim();
};

const lengthTargets: Record<NonNullable<IncomingPayload["length"]>, string> = {
  short: "150-220 words",
  medium: "260-420 words",
  long: "450-650 words",
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing OPENAI_API_KEY." },
      { status: 500 }
    );
  }

  let payload: IncomingPayload = {};
  try {
    payload = (await request.json()) as IncomingPayload;
  } catch {
    payload = {};
  }

  const topic = typeof payload.topic === "string" ? payload.topic.trim() : "";
  if (!topic) {
    return NextResponse.json({ error: "Topic is required." }, { status: 400 });
  }

  const tone = typeof payload.tone === "string" ? payload.tone.trim() : "";
  const hook = typeof payload.hook === "string" ? payload.hook.trim() : "";
  const cta = typeof payload.cta === "string" ? payload.cta.trim() : "";
  const length =
    payload.length === "short" || payload.length === "medium" || payload.length === "long"
      ? payload.length
      : "medium";

  const model = process.env.REDDIT_VIDEO_SCRIPT_MODEL ?? "gpt-5-nano";
  const target = lengthTargets[length];

  const systemPrompt = [
    "You write scripts for short-form 'Reddit story' videos (voiceover + subtitles over gameplay).",
    "Write in a natural, spoken, highly engaging style with tight pacing.",
    "Use short sentences. Vary sentence length. Keep momentum. Avoid filler.",
    "No headings, no bullet lists, no stage directions, no emojis.",
    "No 'like and subscribe' cliché. Keep a subtle, modern CTA if provided.",
    "Return ONLY the script text.",
  ].join(" ");

  const userPrompt = [
    `Topic: ${topic}`,
    tone ? `Tone: ${tone}` : null,
    hook ? `Opening hook (use verbatim or improve): ${hook}` : null,
    cta ? `Ending CTA (keep short, natural): ${cta}` : null,
    `Target length: ${target}`,
    "",
    "Constraints:",
    "- Make the first 1-2 sentences extremely scroll-stopping.",
    "- Build curiosity, then reveal details in escalating beats.",
    "- End with a satisfying twist or takeaway (unless the topic doesn't allow it).",
  ]
    .filter(Boolean)
    .join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_output_tokens: 800,
      reasoning: { effort: "low" },
      text: { format: { type: "text" } },
      instructions: systemPrompt,
      input: userPrompt,
    }),
  });

  if (!response.ok) {
    let message = "";
    try {
      const errorPayload = await response.json();
      message =
        typeof errorPayload?.error?.message === "string"
          ? errorPayload.error.message
          : "";
    } catch {
      message = await response.text();
    }
    return NextResponse.json(
      { error: message || "Script generation failed." },
      { status: response.status }
    );
  }

  const data = await response.json();
  const script = extractOutputText(data);

  if (!script) {
    const debugPayload = data?.output ?? data;
    const debugText = JSON.stringify(debugPayload, null, 2).slice(0, 2000);
    return NextResponse.json(
      { error: `Script generation returned empty response. Output: ${debugText}` },
      { status: 502 }
    );
  }

  return NextResponse.json({ script });
}
