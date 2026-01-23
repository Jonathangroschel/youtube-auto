import { NextResponse } from "next/server";
import { getSession } from "@/lib/autoclip/session-store";

export const runtime = "nodejs";

const WORKER_URL = process.env.AUTOCLIP_WORKER_URL || "http://localhost:3001";
const WORKER_SECRET = process.env.AUTOCLIP_WORKER_SECRET || "dev-secret";

async function getSignedUrl(key: string): Promise<string | null> {
  try {
    const response = await fetch(`${WORKER_URL}/download-url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${WORKER_SECRET}`,
      },
      body: JSON.stringify({ key }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.url || null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");
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

  // For multiple clips, return JSON with all download URLs
  if (clipIndexes.length > 1) {
    const urls = await Promise.all(
      Array.from(new Set(clipIndexes)).map(async (index) => {
        const output = outputs[index];
        if (!output) return null;
        
        // If we have a publicUrl (signed URL), use it directly
        // Otherwise, get a fresh signed URL from the worker
        const url = output.publicUrl || (output.filePath ? await getSignedUrl(output.filePath) : null);
        return url ? { index, filename: output.filename, url } : null;
      })
    );

    const available = urls.filter(Boolean);
    if (!available.length) {
      return NextResponse.json({ error: "Outputs not found." }, { status: 404 });
    }

    return NextResponse.json({ downloads: available });
  }

  // Single clip - redirect to signed URL
  const resolvedIndex =
    clipIndexes.length === 1 ? clipIndexes[0] : clipIndex;
  const output =
    resolvedIndex != null && Number.isFinite(resolvedIndex)
      ? outputs[resolvedIndex]
      : outputs[0];

  if (!output) {
    return NextResponse.json({ error: "Output not found." }, { status: 404 });
  }

  // Get signed URL - either from stored publicUrl or fetch fresh one
  const downloadUrl = output.publicUrl || (output.filePath ? await getSignedUrl(output.filePath) : null);

  if (!downloadUrl) {
    return NextResponse.json({ error: "Download URL not available." }, { status: 404 });
  }

  // Redirect to the signed URL
  return NextResponse.redirect(downloadUrl);
}
