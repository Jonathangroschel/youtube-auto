import path from "path";
import { promises as fs } from "fs";
import { runFfmpeg, runFfprobe, runCommand } from "@/lib/autoclip/ffmpeg";
import { formatSeconds } from "@/lib/autoclip/utils";
import type { TranscriptSegment } from "@/lib/autoclip/types";

const pythonBin = process.env.AUTOCLIP_PYTHON_BIN || "python3";

const writeSrtFile = async (
  segments: TranscriptSegment[],
  startOffset: number,
  endOffset: number,
  outputPath: string
) => {
  const lines: string[] = [];
  let index = 1;
  segments.forEach((segment) => {
    if (segment.end <= startOffset || segment.start >= endOffset) {
      return;
    }
    const clippedStart = Math.max(segment.start, startOffset);
    const clippedEnd = Math.min(segment.end, endOffset);
    const start = formatSeconds(clippedStart - startOffset);
    const end = formatSeconds(clippedEnd - startOffset);
    lines.push(String(index));
    lines.push(`${start} --> ${end}`);
    lines.push(segment.text);
    lines.push("");
    index += 1;
  });
  await fs.writeFile(outputPath, lines.join("\n"), "utf8");
};

const escapeFilterPath = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'");

export const clipVideo = async (
  inputPath: string,
  outputPath: string,
  start: number,
  end: number
) => {
  await runFfmpeg([
    "-y",
    "-ss",
    String(start),
    "-to",
    String(end),
    "-i",
    inputPath,
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-c:a",
    "aac",
    "-movflags",
    "+faststart",
    outputPath,
  ]);
};

export const cropVideo = async (
  inputPath: string,
  outputPath: string,
  mode: "auto" | "face" | "screen"
) => {
  const cropProvider = process.env.AUTOCLIP_CROP_PROVIDER || "python";
  if (cropProvider === "python") {
    try {
      const scriptPath = path.join(process.cwd(), "scripts/autoclip/crop.py");
      await runCommand(pythonBin, [
        scriptPath,
        "--input",
        inputPath,
        "--output",
        outputPath,
        "--mode",
        mode,
      ]);
      return;
    } catch (error) {
      console.warn("Python crop failed, falling back to ffmpeg.");
    }
  }

  const probe = await runFfprobe(inputPath);
  const width = probe.streams?.[0]?.width ?? 1080;
  const height = probe.streams?.[0]?.height ?? 1920;
  const targetWidth = Math.floor(height * 9 / 16);
  const cropX = Math.max(0, Math.floor((width - targetWidth) / 2));
  await runFfmpeg([
    "-y",
    "-i",
    inputPath,
    "-vf",
    `crop=${targetWidth}:${height}:${cropX}:0`,
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-c:a",
    "aac",
    "-movflags",
    "+faststart",
    outputPath,
  ]);
};

export const mergeAudio = async (
  videoPath: string,
  audioSourcePath: string,
  outputPath: string
) => {
  await runFfmpeg([
    "-y",
    "-i",
    videoPath,
    "-i",
    audioSourcePath,
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-shortest",
    outputPath,
  ]);
};

export const scaleVideo = async (
  inputPath: string,
  outputPath: string,
  quality: "auto" | "1080" | "720" | "480"
) => {
  if (quality === "auto") {
    await fs.copyFile(inputPath, outputPath);
    return;
  }
  const sizeMap: Record<"1080" | "720" | "480", string> = {
    "1080": "1080:1920",
    "720": "720:1280",
    "480": "480:854",
  };
  await runFfmpeg([
    "-y",
    "-i",
    inputPath,
    "-vf",
    `scale=${sizeMap[quality]}`,
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-c:a",
    "aac",
    "-movflags",
    "+faststart",
    outputPath,
  ]);
};

export const burnSubtitles = async (
  inputPath: string,
  outputPath: string,
  srtPath: string,
  fontName: string,
  fontPath?: string | null
) => {
  const fontsDir = fontPath ? path.dirname(fontPath) : "";
  const forceStyle = [
    `FontName=${fontName}`,
    "FontSize=44",
    "PrimaryColour=&H00FFFFFF",
    "OutlineColour=&H00000000",
    "Outline=2",
    "Shadow=1",
  ].join(",");
  const fontsDirSegment = fontsDir
    ? `:fontsdir='${escapeFilterPath(fontsDir)}'`
    : "";
  const filter = `subtitles='${escapeFilterPath(
    srtPath
  )}'${fontsDirSegment}:force_style='${forceStyle}'`;
  await runFfmpeg([
    "-y",
    "-i",
    inputPath,
    "-vf",
    filter,
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-c:a",
    "aac",
    "-movflags",
    "+faststart",
    outputPath,
  ]);
};

export const prepareSubtitles = async (
  segments: TranscriptSegment[],
  start: number,
  end: number,
  outputPath: string
) => {
  await writeSrtFile(segments, start, end, outputPath);
};

export const renderClipWithSubtitles = async ({
  inputPath,
  outputDir,
  start,
  end,
  mode,
  quality,
  subtitlesEnabled,
  fontName,
  fontPath,
  segments,
}: {
  inputPath: string;
  outputDir: string;
  start: number;
  end: number;
  mode: "auto" | "face" | "screen";
  quality: "auto" | "1080" | "720" | "480";
  subtitlesEnabled: boolean;
  fontName: string;
  fontPath?: string | null;
  segments: TranscriptSegment[];
}) => {
  const clipPath = path.join(outputDir, "clip.mp4");
  const croppedPath = path.join(outputDir, "cropped.mp4");
  const croppedWithAudio = path.join(outputDir, "cropped_with_audio.mp4");
  const scaledPath = path.join(outputDir, "scaled.mp4");
  const srtPath = path.join(outputDir, "subtitles.srt");
  const subtitledPath = path.join(outputDir, "subtitled.mp4");

  await clipVideo(inputPath, clipPath, start, end);
  await cropVideo(clipPath, croppedPath, mode);
  await mergeAudio(croppedPath, clipPath, croppedWithAudio);
  await scaleVideo(croppedWithAudio, scaledPath, quality);

  if (!subtitlesEnabled) {
    return { filePath: scaledPath };
  }

  await prepareSubtitles(segments, start, end, srtPath);
  await burnSubtitles(scaledPath, subtitledPath, srtPath, fontName, fontPath);
  return { filePath: subtitledPath };
};
