import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing OPENAI_API_KEY." },
      { status: 500 }
    );
  }

  const incoming = await request.formData();
  const file = incoming.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing audio file." }, { status: 400 });
  }

  const model = String(
    incoming.get("model") ?? "gpt-4o-transcribe-diarize"
  );
  const language = incoming.get("language");
  const prompt = incoming.get("prompt");
  const chunkingStrategy = incoming.get("chunking_strategy");
  const rawResponseFormat = incoming.get("response_format");
  const responseFormat =
    typeof rawResponseFormat === "string" && rawResponseFormat.length > 0
      ? rawResponseFormat
      : model.includes("diarize")
        ? "diarized_json"
        : "json";
  const timestampGranularities = incoming.getAll("timestamp_granularities[]");

  const payload = new FormData();
  payload.append("file", file);
  payload.append("model", model);
  if (typeof language === "string" && language.length > 0) {
    payload.append("language", language);
  }
  if (typeof prompt === "string" && prompt.length > 0) {
    payload.append("prompt", prompt);
  }
  const resolvedChunkingStrategy =
    typeof chunkingStrategy === "string" && chunkingStrategy.length > 0
      ? chunkingStrategy
      : model.includes("diarize")
        ? "auto"
        : null;
  if (resolvedChunkingStrategy) {
    payload.append("chunking_strategy", resolvedChunkingStrategy);
  }
  if (responseFormat) {
    payload.append("response_format", responseFormat);
  }
  timestampGranularities.forEach((value) => {
    if (typeof value === "string" && value.length > 0) {
      payload.append("timestamp_granularities[]", value);
    }
  });

  const response = await fetch(
    "https://api.openai.com/v1/audio/transcriptions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: payload,
    }
  );

  if (!response.ok) {
    const message = await response.text();
    return NextResponse.json(
      { error: message || "OpenAI transcription failed." },
      { status: response.status }
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const data = await response.json();
    return NextResponse.json(data);
  }

  const text = await response.text();
  return NextResponse.json({ text });
}
