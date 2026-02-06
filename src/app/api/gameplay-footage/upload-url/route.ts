import crypto from "crypto";
import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server-client";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

const GAMEPLAY_BUCKET = "gameplay-footage";
const DEFAULT_FILENAME = "gameplay.mp4";
const MAX_FILENAME_LENGTH = 120;

const ALLOWED_EXTENSIONS = new Set(["mp4", "mov", "m4v", "webm"]);

const extensionFromContentType = (contentType: string) => {
  const lower = contentType.toLowerCase();
  if (lower.includes("quicktime")) {
    return "mov";
  }
  if (lower.includes("webm")) {
    return "webm";
  }
  if (lower.includes("m4v")) {
    return "m4v";
  }
  return "mp4";
};

const sanitizeFilename = (value: string) => {
  const trimmed = value.trim() || DEFAULT_FILENAME;
  const withoutPath = trimmed.split(/[\\/]/).pop() ?? DEFAULT_FILENAME;
  const truncated = withoutPath.slice(0, MAX_FILENAME_LENGTH);
  const normalized = truncated
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || DEFAULT_FILENAME;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const contentType =
    typeof body?.contentType === "string" && body.contentType.trim().length > 0
      ? body.contentType.trim().toLowerCase()
      : "video/mp4";

  const safeFilename = sanitizeFilename(
    typeof body?.filename === "string" ? body.filename : DEFAULT_FILENAME
  );

  const extensionMatch = safeFilename.match(/\.([a-z0-9]+)$/i);
  const rawExtension = extensionMatch?.[1]?.toLowerCase() ?? "";
  const extension = ALLOWED_EXTENSIONS.has(rawExtension)
    ? rawExtension
    : extensionFromContentType(contentType);
  const basename = safeFilename.replace(/\.[a-z0-9]+$/i, "") || "gameplay";
  const normalizedFilename = `${basename}.${extension}`;

  if (!contentType.startsWith("video/")) {
    return NextResponse.json(
      { error: "Only video uploads are supported." },
      { status: 400 }
    );
  }

  const uniquePrefix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const storagePath = `user-uploads/${user.id}/${uniquePrefix}-${normalizedFilename}`;

  const { data, error } = await supabaseServer.storage
    .from(GAMEPLAY_BUCKET)
    .createSignedUploadUrl(storagePath, { upsert: false });

  if (error || !data?.token) {
    return NextResponse.json(
      { error: "Failed to create gameplay upload URL." },
      { status: 502 }
    );
  }

  return NextResponse.json({
    bucket: GAMEPLAY_BUCKET,
    path: storagePath,
    token: data.token,
    signedUrl: data.signedUrl ?? null,
    filename: normalizedFilename,
  });
}
