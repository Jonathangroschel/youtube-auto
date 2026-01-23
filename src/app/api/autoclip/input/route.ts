import { NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";
import { getSession, saveSession, updateSessionStatus } from "@/lib/autoclip/session-store";
import { runFfprobe } from "@/lib/autoclip/ffmpeg";
import { slugify } from "@/lib/autoclip/utils";

export const runtime = "nodejs";

const resolveBaseUrl = (request: Request) => {
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  return host ? `${proto}://${host}` : "";
};

const downloadToFile = async (url: string, destPath: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download input: ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(destPath, buffer);
  return buffer.byteLength;
};

const resolveExtension = (filename: string | null) => {
  if (!filename) {
    return ".mp4";
  }
  const ext = path.extname(filename);
  return ext.length > 1 ? ext : ".mp4";
};

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const isMultipart = contentType.includes("multipart/form-data");
  let sessionId: string | null = null;
  let url: string | null = null;
  let file: File | null = null;

  if (isMultipart) {
    const form = await request.formData();
    sessionId = typeof form.get("sessionId") === "string" ? String(form.get("sessionId")) : null;
    url = typeof form.get("url") === "string" ? String(form.get("url")) : null;
    const incomingFile = form.get("file");
    if (incomingFile instanceof File) {
      file = incomingFile;
    }
  } else {
    const body = await request.json().catch(() => ({}));
    sessionId = typeof body?.sessionId === "string" ? body.sessionId : null;
    url = typeof body?.url === "string" ? body.url : null;
  }

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId." }, { status: 400 });
  }

  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  if (!url && !file) {
    return NextResponse.json({ error: "Missing url or file input." }, { status: 400 });
  }

  try {
    let inputPath = path.join(session.tempDir, "input.mp4");
    let title: string | undefined;
    let sizeBytes: number | null = null;
    let sourceType: "youtube" | "file" = "file";

    if (url) {
      sourceType = "youtube";
      const baseUrl = resolveBaseUrl(request);
      if (!baseUrl) {
        throw new Error("Unable to resolve base URL for download.");
      }
      const quality = session.options.quality === "auto" ? "1080" : session.options.quality;
      const downloadResponse = await fetch(`${baseUrl}/api/youtube-download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, format: quality }),
      });
      if (!downloadResponse.ok) {
        const message = await downloadResponse.text();
        throw new Error(message || "YouTube download failed.");
      }
      const downloadData = await downloadResponse.json();
      const assetUrl = String(downloadData.assetUrl || "");
      if (!assetUrl) {
        throw new Error("Missing assetUrl from downloader.");
      }
      title = downloadData.title ? String(downloadData.title) : undefined;
      const ext = resolveExtension(downloadData.filename ?? null);
      inputPath = path.join(session.tempDir, `input${ext}`);
      sizeBytes = await downloadToFile(assetUrl, inputPath);
    } else if (file) {
      const ext = resolveExtension(file.name);
      inputPath = path.join(session.tempDir, `input${ext}`);
      const buffer = Buffer.from(await file.arrayBuffer());
      await fs.writeFile(inputPath, buffer);
      sizeBytes = buffer.byteLength;
      title = file.name ? slugify(file.name.replace(ext, "")) : undefined;
    }

    const probe = await runFfprobe(inputPath).catch(() => null);
    const width = probe?.streams?.[0]?.width ?? null;
    const height = probe?.streams?.[0]?.height ?? null;
    const durationSeconds = probe?.format?.duration
      ? Number(probe.format.duration)
      : null;

    session.input = {
      sourceType,
      sourceUrl: url ?? undefined,
      localPath: inputPath,
      title: title ?? undefined,
      originalFilename: file?.name ?? undefined,
      durationSeconds,
      width,
      height,
      sizeBytes,
    };
    await updateSessionStatus(session, "input_ready", "Input prepared.");
    await saveSession(session);

    return NextResponse.json({
      sessionId: session.id,
      input: session.input,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Input failed.";
    session.status = "error";
    session.error = message;
    await saveSession(session);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
