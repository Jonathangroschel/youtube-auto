import path from "path";
import { promises as fs } from "fs";
import { runFfmpeg } from "@/lib/autoclip/ffmpeg";
import type { TranscriptBundle } from "@/lib/autoclip/types";

type RawWord = { start: number; end: number; word: string };
type RawSegment = {
  start: number;
  end: number;
  text: string;
  words?: RawWord[];
};

const normalizeWords = (words: RawWord[] | undefined) =>
  (words ?? [])
    .map((word) => ({
      start: Number(word.start),
      end: Number(word.end),
      text: String(word.word ?? "").trim(),
    }))
    .filter(
      (word) =>
        Number.isFinite(word.start) &&
        Number.isFinite(word.end) &&
        word.end > word.start &&
        word.text.length > 0
    )
    .sort((a, b) => a.start - b.start || a.end - b.end);

const normalizeSegments = (segments: RawSegment[]) =>
  segments
    .map((segment) => ({
      start: Number(segment.start),
      end: Number(segment.end),
      text: String(segment.text ?? "").trim(),
      words: normalizeWords(segment.words),
    }))
    .filter(
      (segment) =>
        Number.isFinite(segment.start) &&
        Number.isFinite(segment.end) &&
        segment.end > segment.start &&
        segment.text.length > 0
    )
    .map((segment) => ({
      ...segment,
      words: segment.words.length ? segment.words : undefined,
    }))
    .sort((a, b) => a.start - b.start || a.end - b.end);

export const extractAudio = async (
  inputPath: string,
  outputPath: string
) => {
  await runFfmpeg([
    "-y",
    "-i",
    inputPath,
    "-vn",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-f",
    "wav",
    outputPath,
  ]);
};

const transcribeWithOpenAI = async (
  audioPath: string,
  language?: string | null
): Promise<TranscriptBundle> => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY for transcription.");
  }
  const buffer = await fs.readFile(audioPath);
  const file = new File([buffer], path.basename(audioPath), {
    type: "audio/wav",
  });
  const formData = new FormData();
  formData.append("file", file);
  formData.append("model", "whisper-1");
  formData.append("response_format", "verbose_json");
  formData.append("timestamp_granularities[]", "segment");
  formData.append("timestamp_granularities[]", "word");
  if (language && language !== "auto") {
    formData.append("language", language);
  }

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "OpenAI transcription failed.");
  }
  const data = (await response.json()) as {
    language?: string;
    segments?: RawSegment[];
  };
  const segments = normalizeSegments(data.segments ?? []);
  return { language: data.language ?? null, segments, raw: data };
};

export const transcribeAudio = async (
  audioPath: string,
  language?: string | null
): Promise<TranscriptBundle> => transcribeWithOpenAI(audioPath, language);
