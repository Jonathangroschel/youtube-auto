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

const shortUserId = (value: string) =>
  value.length > 8 ? `${value.slice(0, 4)}...${value.slice(-4)}` : value;

const importPayloadLog = (...args: unknown[]) => {
  console.info("[import-payload]", ...args);
};

export async function POST(request: Request) {
  const startedAt = Date.now();
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
  importPayloadLog("POST request", {
    userId: shortUserId(user.id),
    type,
    hasPayload: isRecord(body?.payload),
  });
  if (!isImportPayloadType(type)) {
    importPayloadLog("POST invalid type", {
      userId: shortUserId(user.id),
      type,
    });
    return NextResponse.json({ error: "Invalid import type." }, { status: 400 });
  }

  if (!isRecord(body?.payload)) {
    importPayloadLog("POST invalid payload", {
      userId: shortUserId(user.id),
      type,
    });
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
    importPayloadLog("POST upload failed", {
      userId: shortUserId(user.id),
      type,
      payloadId,
      storagePath,
      error: error.message,
    });
    return NextResponse.json(
      { error: "Unable to save import payload." },
      { status: 502 }
    );
  }

  importPayloadLog("POST saved", {
    userId: shortUserId(user.id),
    type,
    payloadId,
    storagePath,
    durationMs: Date.now() - startedAt,
  });
  return NextResponse.json({ id: payloadId });
}

export async function GET(request: Request) {
  const startedAt = Date.now();
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
  importPayloadLog("GET request", {
    userId: shortUserId(user.id),
    type: typeParam,
    payloadId,
  });

  if (!isImportPayloadType(typeParam) || !payloadId) {
    importPayloadLog("GET invalid request", {
      userId: shortUserId(user.id),
      type: typeParam,
      payloadId,
    });
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const storagePath = buildImportPayloadPath(user.id, typeParam, payloadId);
  const { data, error } = await supabaseServer.storage
    .from(IMPORT_PAYLOAD_BUCKET)
    .download(storagePath);

  if (error || !data) {
    importPayloadLog("GET not found", {
      userId: shortUserId(user.id),
      type: typeParam,
      payloadId,
      storagePath,
      error: error?.message ?? "missing data",
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      { error: "Import payload not found." },
      { status: 404 }
    );
  }

  try {
    const raw = await data.text();
    const payload = JSON.parse(raw);
    if (!isRecord(payload)) {
      importPayloadLog("GET invalid JSON payload", {
        userId: shortUserId(user.id),
        type: typeParam,
        payloadId,
        storagePath,
      });
      return NextResponse.json(
        { error: "Invalid import payload." },
        { status: 400 }
      );
    }
    importPayloadLog("GET success", {
      userId: shortUserId(user.id),
      type: typeParam,
      payloadId,
      storagePath,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json({ payload });
  } catch {
    importPayloadLog("GET parse failed", {
      userId: shortUserId(user.id),
      type: typeParam,
      payloadId,
      storagePath,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      { error: "Unable to parse import payload." },
      { status: 400 }
    );
  }
}
