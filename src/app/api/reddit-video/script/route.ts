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

type GeneratedScriptPayload = {
  postTitle: string;
  script: string;
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

const sanitizeGeneratedLine = (value: string) =>
  value
    .replace(/[—–]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

const sanitizeGeneratedScript = (value: string) =>
  value
    .replace(/[—–]/g, "-")
    .replace(/\r/g, "")
    .trim();

const unwrapJsonBlock = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed.startsWith("```")) {
    return trimmed;
  }
  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
};

const extractLikelyJsonObject = (value: string) => {
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return "";
  }
  return value.slice(start, end + 1).trim();
};

const decodeLooseJsonEscapes = (value: string) =>
  value
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, "\"")
    .replace(/\\\\/g, "\\");

const extractLooseJsonStringField = (
  source: string,
  field: "postTitle" | "script"
) => {
  const keyToken = `"${field}"`;
  const keyIndex = source.indexOf(keyToken);
  if (keyIndex === -1) {
    return "";
  }
  const colonIndex = source.indexOf(":", keyIndex + keyToken.length);
  if (colonIndex === -1) {
    return "";
  }
  const afterColon = source.slice(colonIndex + 1).trimStart();
  if (!afterColon.startsWith("\"")) {
    return "";
  }
  let escaped = false;
  let value = "";
  for (let index = 1; index < afterColon.length; index += 1) {
    const char = afterColon[index]!;
    if (escaped) {
      value += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      value += char;
      escaped = true;
      continue;
    }
    if (char === "\"") {
      return value;
    }
    value += char;
  }
  return "";
};

const parseGeneratedScriptPayload = (
  value: string,
  fallbackTopic: string
): GeneratedScriptPayload | null => {
  try {
    const parsed = JSON.parse(value);
    if (!isRecord(parsed)) {
      return null;
    }
    const parsedTitle =
      typeof parsed.postTitle === "string"
        ? sanitizeGeneratedLine(parsed.postTitle)
        : "";
    const parsedScriptRaw =
      typeof parsed.script === "string" ? parsed.script : "";
    if (!parsedScriptRaw) {
      return null;
    }
    const nestedScriptCandidate = extractLooseJsonStringField(
      parsedScriptRaw,
      "script"
    );
    const parsedScript = nestedScriptCandidate
      ? decodeLooseJsonEscapes(nestedScriptCandidate)
      : parsedScriptRaw;
    const normalizedScript = sanitizeGeneratedScript(parsedScript);
    if (!normalizedScript) {
      return null;
    }
    return {
      postTitle: parsedTitle || sanitizeGeneratedLine(fallbackTopic),
      script: normalizedScript,
    };
  } catch {
    return null;
  }
};

const extractGeneratedScriptPayload = (
  rawText: string,
  fallbackTopic: string
): GeneratedScriptPayload | null => {
  const normalized = unwrapJsonBlock(rawText);
  if (!normalized) {
    return null;
  }

  const parsedDirect = parseGeneratedScriptPayload(normalized, fallbackTopic);
  if (parsedDirect) {
    return parsedDirect;
  }

  const objectCandidate = extractLikelyJsonObject(normalized);
  if (objectCandidate && objectCandidate !== normalized) {
    const parsedFromObject = parseGeneratedScriptPayload(
      objectCandidate,
      fallbackTopic
    );
    if (parsedFromObject) {
      return parsedFromObject;
    }
  }

  const looseScript = sanitizeGeneratedScript(
    decodeLooseJsonEscapes(extractLooseJsonStringField(normalized, "script"))
  );
  if (looseScript) {
    const looseTitle = sanitizeGeneratedLine(
      decodeLooseJsonEscapes(extractLooseJsonStringField(normalized, "postTitle"))
    );
    return {
      postTitle: looseTitle || sanitizeGeneratedLine(fallbackTopic),
      script: looseScript,
    };
  }

  const fallbackScript = sanitizeGeneratedScript(normalized);
  if (!fallbackScript) {
    return null;
  }
  return {
    postTitle: sanitizeGeneratedLine(fallbackTopic),
    script: fallbackScript,
  };
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
    "You are an expert script writer for Reddit story videos designed to go viral on social media.",
    "Write like a real human in a conversational voice using plain English.",
    "Sound natural, specific, and emotionally engaging, never robotic or generic.",
    "Focus on curiosity and retention with a strong open loop and escalating details.",
    "Keep pacing tight with short punchy lines and varied sentence length.",
    "Avoid filler, clichés, AI-sounding phrases, headings, bullet lists, emojis, and hashtags.",
    "Do not use em dashes. Use commas, periods, or parentheses instead.",
    "If CTA is provided, keep it subtle and under one short sentence.",
    "Return ONLY valid JSON with this exact shape: {\"postTitle\":\"...\",\"script\":\"...\"}",
    "postTitle should be concise, curiosity-driven, and sound like a human wrote it.",
    "script should be voiceover-friendly and easy to read aloud.",
  ].join("\n");

  const userPrompt = [
    `Topic: ${topic}`,
    tone ? `Tone: ${tone}` : null,
    hook ? `Opening hook (use verbatim or improve): ${hook}` : null,
    cta ? `Ending CTA (keep short, natural): ${cta}` : null,
    `Target length: ${target}`,
    "",
    "Constraints:",
    "- Make the first 1-2 sentences extremely scroll-stopping.",
    "- Use a clear arc: hook -> setup -> escalation -> payoff/twist.",
    "- Reveal information progressively to sustain curiosity.",
    "- Use specific concrete details over vague language.",
    "- End with a satisfying takeaway or twist (unless the topic truly doesn't allow it).",
    "- Keep it voiceover-friendly and easy to read aloud.",
    "- Write in plain English.",
    "- Do not use em dashes.",
    "- Return valid JSON with postTitle and script.",
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
  const rawOutput = extractOutputText(data);
  const generated = extractGeneratedScriptPayload(rawOutput, topic);

  if (!generated?.script) {
    const debugPayload = data?.output ?? data;
    const debugText = JSON.stringify(debugPayload, null, 2).slice(0, 2000);
    return NextResponse.json(
      { error: `Script generation returned empty response. Output: ${debugText}` },
      { status: 502 }
    );
  }

  return NextResponse.json({
    postTitle: generated.postTitle,
    script: generated.script,
  });
}
