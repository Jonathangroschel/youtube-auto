import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import {
  AutoClipOptions,
  AutoClipSession,
  AutoClipStatus,
} from "@/lib/autoclip/types";

// In-memory cache for fast reads (survives within single serverless invocation)
const memoryStore = new Map<string, AutoClipSession>();

const defaultOptions: AutoClipOptions = {
  autoApprove: false,
  approvalTimeoutMs: 15_000,
  quality: "auto",
  subtitlesEnabled: false,
  fontName: "Franklin Gothic",
  fontPath: null,
  cropMode: "auto",
};

const nowIso = () => new Date().toISOString();

// Supabase client - lazy init
let supabase: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && key) {
      supabase = createClient(url, key);
    }
  }
  return supabase;
}

// Store session in Supabase
async function persistSession(session: AutoClipSession): Promise<void> {
  const db = getSupabase();
  if (!db) {
    console.warn("Supabase not configured - session will only be in memory");
    return;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (db as any).from("autoclip_sessions").upsert({
      id: session.id,
      data: session,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      console.error("Supabase upsert error:", error);
    }
  } catch (error) {
    console.error("Failed to persist session to Supabase:", error);
  }
}

// Load session from Supabase
async function loadSession(sessionId: string): Promise<AutoClipSession | null> {
  const db = getSupabase();
  if (!db) return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (db as any)
      .from("autoclip_sessions")
      .select("data")
      .eq("id", sessionId)
      .single();

    if (error || !data) return null;
    return data.data as AutoClipSession;
  } catch {
    return null;
  }
}

export const createSession = async (
  options?: Partial<AutoClipOptions>
): Promise<AutoClipSession> => {
  const id = crypto.randomUUID().slice(0, 8);
  const now = nowIso();
  const session: AutoClipSession = {
    id,
    status: "created",
    createdAt: now,
    updatedAt: now,
    tempDir: `/tmp/autoclip/${id}`, // Virtual path, not used on Vercel
    options: { ...defaultOptions, ...options },
    logs: [],
  };
  memoryStore.set(id, session);
  await persistSession(session);
  return session;
};

export const getSession = async (
  sessionId: string
): Promise<AutoClipSession | null> => {
  // Check memory cache first
  const cached = memoryStore.get(sessionId);
  if (cached) {
    return cached;
  }

  // Try to load from Supabase
  const loaded = await loadSession(sessionId);
  if (loaded) {
    memoryStore.set(sessionId, loaded);
    return loaded;
  }

  return null;
};

export const saveSession = async (
  session: AutoClipSession
): Promise<void> => {
  session.updatedAt = nowIso();
  memoryStore.set(session.id, session);
  await persistSession(session);
};

export const updateSessionStatus = async (
  session: AutoClipSession,
  status: AutoClipStatus,
  message?: string
) => {
  session.status = status;
  if (message) {
    session.logs.push(`${nowIso()} ${message}`);
  }
  await saveSession(session);
};

export const deleteSession = async (sessionId: string) => {
  memoryStore.delete(sessionId);
  
  const db = getSupabase();
  if (db) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any).from("autoclip_sessions").delete().eq("id", sessionId);
    } catch {
      // Ignore deletion errors
    }
  }
};
