import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@/lib/supabase/server-client";
import { supabaseServer } from "@/lib/supabase/server";
import { getSession } from "@/lib/autoclip/session-store";

export const runtime = "nodejs";

const OUTPUT_BUCKET = "project-exports";
const WORKER_URL = process.env.AUTOCLIP_WORKER_URL || "http://localhost:3001";
const WORKER_SECRET = process.env.AUTOCLIP_WORKER_SECRET || "dev-secret";

const parseClipIndex = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const trimTitle = (value: string) => value.slice(0, 80).trim();

const sanitizeFilename = (value: string) => {
  const trimmed = value.trim() || "clip";
  const sanitized = trimmed.replace(/[^a-zA-Z0-9._-]/g, "_");
  const collapsed = sanitized.replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  return collapsed || "clip";
};

const buildStoragePath = (userId: string, projectId: string, filename: string) =>
  `${userId}/projects/${projectId}/renders/${sanitizeFilename(filename)}`;

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

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data, error } = await supabaseServer
    .from("projects")
    .select("id,title,created_at,preview_bucket,preview_path,kind")
    .eq("user_id", user.id)
    .in("kind", ["clip", "editor"])
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Unable to load projects." },
      { status: 500 }
    );
  }

  const previewsByKey = new Map<string, string>();
  const previewRows =
    data?.filter((row) => row.preview_bucket && row.preview_path) ?? [];
  if (previewRows.length) {
    await Promise.all(
      previewRows.map(async (row) => {
        const { data: signedData } = await supabaseServer.storage
          .from(row.preview_bucket)
          .createSignedUrl(row.preview_path, 60 * 60);
        if (signedData?.signedUrl) {
          previewsByKey.set(`${row.preview_bucket}:${row.preview_path}`, signedData.signedUrl);
        }
      })
    );
  }

  return NextResponse.json({
    projects: (data ?? []).map((project) => {
      const kind = project.kind === "editor" ? "editor" : "clip";
      const previewKey =
        kind === "clip" && project.preview_bucket && project.preview_path
          ? `${project.preview_bucket}:${project.preview_path}`
          : null;
      return {
        id: project.id,
        title: project.title,
        type: kind === "editor" ? "EDITOR" : "VIDEO",
        kind,
        createdAt: project.created_at,
        previewImage: previewKey ? previewsByKey.get(previewKey) ?? null : null,
      };
    }),
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : null;
  const clipIndex = parseClipIndex(body?.clipIndex);
  const title =
    typeof body?.title === "string" && body.title.trim().length > 0
      ? trimTitle(body.title)
      : "";
  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId." }, { status: 400 });
  }
  if (clipIndex == null) {
    return NextResponse.json({ error: "Missing clipIndex." }, { status: 400 });
  }

  const session = await getSession(sessionId);
  const output = session?.outputs?.[clipIndex];
  if (!session || !output?.filePath) {
    return NextResponse.json({ error: "Clip not found." }, { status: 404 });
  }

  const highlight =
    output.highlightIndex !== undefined
      ? session.highlights?.[output.highlightIndex]
      : undefined;
  const highlightTitle =
    typeof highlight?.title === "string" ? highlight.title.trim() : "";
  const highlightSnippet =
    typeof highlight?.content === "string"
      ? highlight.content.split(/[.!?]/)[0]?.trim() ?? ""
      : "";
  const filenameBase = output.filename?.replace(/\.[^/.]+$/, "") ?? "";
  const resolvedTitle = trimTitle(
    title ||
      highlightTitle ||
      highlightSnippet ||
      filenameBase ||
      `Clip ${clipIndex + 1}`
  );

  const downloadUrl =
    output.publicUrl ||
    (output.filePath ? await getSignedUrl(output.filePath) : null);
  if (!downloadUrl) {
    return NextResponse.json(
      { error: "Download URL not available." },
      { status: 404 }
    );
  }

  const response = await fetch(downloadUrl);
  if (!response.ok) {
    return NextResponse.json(
      { error: "Failed to download clip." },
      { status: 502 }
    );
  }
  const buffer = await response.arrayBuffer();
  if (!buffer.byteLength) {
    return NextResponse.json(
      { error: "Downloaded clip is empty." },
      { status: 502 }
    );
  }

  const contentType =
    response.headers.get("content-type") ?? "video/mp4";
  const filename =
    output.filename && output.filename.trim().length > 0
      ? output.filename
      : `${sanitizeFilename(resolvedTitle || "clip")}.mp4`;

  const projectId = crypto.randomUUID();
  const assetId = crypto.randomUUID();
  const storagePath = buildStoragePath(user.id, projectId, filename);

  const { error: uploadError } = await supabaseServer.storage
    .from(OUTPUT_BUCKET)
    .upload(storagePath, buffer, {
      contentType,
      upsert: true,
    });
  if (uploadError) {
    return NextResponse.json(
      { error: "Failed to upload clip to storage." },
      { status: 502 }
    );
  }

  const durationSeconds =
    highlight && highlight.end > highlight.start
      ? highlight.end - highlight.start
      : null;

  const { error: projectError } = await supabaseServer.from("projects").insert({
    id: projectId,
    user_id: user.id,
    title: resolvedTitle || "Untitled Clip",
    kind: "clip",
    status: "rendered",
    project_state: {
      sourceSessionId: sessionId,
      outputIndex: clipIndex,
    },
    output_bucket: OUTPUT_BUCKET,
    output_path: storagePath,
  });

  if (projectError) {
    return NextResponse.json(
      { error: "Failed to save project." },
      { status: 502 }
    );
  }

  const { error: assetError } = await supabaseServer.from("assets").insert({
    id: assetId,
    user_id: user.id,
    name: resolvedTitle || filename,
    kind: "video",
    source: "autoclip",
    storage_bucket: OUTPUT_BUCKET,
    storage_path: storagePath,
    external_url: null,
    mime_type: contentType,
    size_bytes: buffer.byteLength,
    duration_seconds: durationSeconds,
  });

  if (!assetError) {
    await supabaseServer.from("project_assets").upsert(
      {
        project_id: projectId,
        asset_id: assetId,
        role: "output",
      },
      { onConflict: "project_id,asset_id" }
    );
  }

  return NextResponse.json(
    {
      project: {
        id: projectId,
        title: resolvedTitle || "Untitled Clip",
        type: "VIDEO",
        kind: "clip",
        createdAt: new Date().toISOString(),
        previewImage: null,
      },
    },
    { status: 201 }
  );
}
