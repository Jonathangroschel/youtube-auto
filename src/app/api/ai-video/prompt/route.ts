import { NextResponse } from "next/server";

export const runtime = "nodejs";

type IncomingPayload = {
  prompt?: string;
};

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing OPENAI_API_KEY." },
      { status: 500 }
    );
  }

  let payload: IncomingPayload = {};
  let prompt = "";
  try {
    const raw = await request.text();
    if (raw) {
      try {
        payload = JSON.parse(raw) as IncomingPayload;
      } catch {
        prompt = raw;
      }
    }
  } catch {
    payload = {};
  }

  if (!prompt) {
    prompt = typeof payload.prompt === "string" ? payload.prompt.trim() : "";
  }
  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
  }

  const model = process.env.AI_VIDEO_PROMPT_MODEL || "gpt-4o-mini";
  const systemPrompt = [
    "You are an expert at crafting video generation prompts.",
    "Expand the user's idea with clear subject, setting, action, camera framing,",
    "camera motion, lighting, mood, texture, and style cues.",
    "Add concise motion verbs and timing beats when useful.",
    "Keep it short, vivid, and production-ready.",
    "Do not include quotation marks or any extra commentary.",
    "Return only the improved prompt.",
  ].join(" ");

  const maxTokenConfig = { max_output_tokens: 512 };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      ...maxTokenConfig,
      text: { format: { type: "text" } },
      instructions: systemPrompt,
      input: prompt,
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
      { error: message || "Prompt enhancement failed." },
      { status: response.status }
    );
  }

  const data = await response.json();
  const extractOutputText = (payload: any) => {
    if (typeof payload?.output_text === "string") {
      return payload.output_text.trim();
    }
    const outputItems = Array.isArray(payload?.output) ? payload.output : [];
    const parts: string[] = [];
    outputItems.forEach((item: any) => {
      if (typeof item?.text === "string") {
        parts.push(item.text);
      }
      if (item?.type !== "message" || !Array.isArray(item.content)) {
        return;
      }
      item.content.forEach((part: any) => {
        if (typeof part?.text === "string") {
          parts.push(part.text);
        }
      });
    });
    return parts.join("").trim();
  };
  const improved = extractOutputText(data);

  if (!improved) {
    const debugPayload = data?.output ?? data;
    const debugText = JSON.stringify(debugPayload, null, 2).slice(0, 2000);
    return NextResponse.json(
      {
        error: `Prompt enhancement returned empty response. Output: ${debugText}`,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ prompt: improved });
}
