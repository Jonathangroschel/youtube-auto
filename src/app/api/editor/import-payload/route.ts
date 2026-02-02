import crypto from "crypto";
import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server-client";

export const runtime = "nodejs";

const IMPORT_PAYLOAD_BUCKET = "user-assets";
const IMPORT_PAYLOAD_TYPES = new Set(["splitscreen", "reddit-video"] as const);

type ImportPayloadType = "splitscreen" | "reddit-video";

const isImportPayloadType = (value: string): value is ImportPayloadType =>
  IMPORT_PAYLOAD_TYPES.has(value as ImportPayloadType);

const buildImportPayloadPath = (
  userId: string,
  type: ImportPayloadType,
  id: string
) => `${userId}/editor-imports/${type}/${id}.json`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { type?: string; payload?: unknown }
    | null;

  const type = typeof body?.type === "string" ? body.type.trim() : "";
  if (!isImportPayloadType(type)) {
    return NextResponse.json({ error: "Invalid import type." }, { status: 400 });
  }

  if (!isRecord(body?.payload)) {
    return NextResponse.json(
      { error: "Invalid import payload." },
      { status: 400 }
    );
  }

  const payloadId = crypto.randomUUID();
  const storagePath = buildImportPayloadPath(user.id, type, payloadId);
  const encoded = new TextEncoder().encode(JSON.stringify(body.payload));

  const { error } = await supabaseServer.storage
    .from(IMPORT_PAYLOAD_BUCKET)
    .upload(storagePath, encoded, {
      contentType: "application/json",
      upsert: false,
    });

  if (error) {
    return NextResponse.json(
      { error: "Unable to save import payload." },
      { status: 502 }
    );
  }

  return NextResponse.json({ id: payloadId });
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const typeParam = (searchParams.get("type") ?? "").trim();
  const payloadId = (searchParams.get("id") ?? "").trim();

  if (!isImportPayloadType(typeParam) || !payloadId) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const storagePath = buildImportPayloadPath(user.id, typeParam, payloadId);
  const { data, error } = await supabaseServer.storage
    .from(IMPORT_PAYLOAD_BUCKET)
    .download(storagePath);

  if (error || !data) {
    return NextResponse.json(
      { error: "Import payload not found." },
      { status: 404 }
    );
  }

  try {
    const raw = await data.text();
    const payload = JSON.parse(raw);
    if (!isRecord(payload)) {
      return NextResponse.json(
        { error: "Invalid import payload." },
        { status: 400 }
      );
    }
    return NextResponse.json({ payload });
  } catch {
    return NextResponse.json(
      { error: "Unable to parse import payload." },
      { status: 400 }
    );
  } finally {
    await supabaseServer.storage
      .from(IMPORT_PAYLOAD_BUCKET)
      .remove([storagePath])
      .catch(() => undefined);
  }
}
