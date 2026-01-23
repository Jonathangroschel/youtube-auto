import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import { Readable } from "stream";
import * as yazl from "yazl";
import { getSession } from "@/lib/autoclip/session-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");
  const dispositionParam = searchParams.get("disposition");
  const clipIndexParam = searchParams.get("clipIndex");
  const clipIndexesParam = searchParams.get("clipIndexes");
  const clipIndex = clipIndexParam != null ? Number(clipIndexParam) : null;
  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId." }, { status: 400 });
  }

  const session = await getSession(sessionId);
  const outputs = session?.outputs ?? [];
  const clipIndexes =
    typeof clipIndexesParam === "string" && clipIndexesParam.trim().length > 0
      ? clipIndexesParam
          .split(",")
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value) && value >= 0)
      : [];

  if (clipIndexes.length > 1) {
    const selections = await Promise.all(
      Array.from(new Set(clipIndexes)).map(async (index) => {
        const output = outputs[index];
        if (!output?.filePath) {
          return null;
        }
        try {
          await fs.stat(output.filePath);
          return { output, index };
        } catch {
          return null;
        }
      })
    );
    const available = selections.filter(
      (entry): entry is { output: (typeof outputs)[number]; index: number } =>
        Boolean(entry)
    );
    if (!available.length) {
      return NextResponse.json({ error: "Outputs not found." }, { status: 404 });
    }

    const zipfile = new yazl.ZipFile();
    const usedNames = new Set<string>();
    available.forEach(({ output, index }) => {
      const baseName =
        output.filename?.trim().length && output.filename
          ? output.filename
          : `autoclip_${index + 1}.mp4`;
      let name = baseName;
      let counter = 2;
      while (usedNames.has(name)) {
        const extIndex = baseName.lastIndexOf(".");
        const ext = extIndex >= 0 ? baseName.slice(extIndex) : "";
        const stem = extIndex >= 0 ? baseName.slice(0, extIndex) : baseName;
        name = `${stem}_${counter}${ext}`;
        counter += 1;
      }
      usedNames.add(name);
      zipfile.addFile(output.filePath, name);
    });
    zipfile.end();

    const stream = Readable.toWeb(zipfile.outputStream) as ReadableStream;
    return new NextResponse(stream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="autoclip_${sessionId}_clips.zip"`,
      },
    });
  }

  const resolvedIndex =
    clipIndexes.length === 1 ? clipIndexes[0] : clipIndex;
  const output =
    resolvedIndex != null && Number.isFinite(resolvedIndex)
      ? outputs[resolvedIndex]
      : outputs[0];
  const outputPath = output?.filePath;
  if (!outputPath) {
    return NextResponse.json({ error: "Output not found." }, { status: 404 });
  }

  const buffer = await fs.readFile(outputPath);
  const disposition =
    dispositionParam === "inline" ? "inline" : "attachment";
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition": `${disposition}; filename="${output?.filename ?? "autoclip.mp4"}"`,
    },
  });
}
