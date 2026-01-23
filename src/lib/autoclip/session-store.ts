import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import {
  AutoClipOptions,
  AutoClipSession,
  AutoClipStatus,
} from "@/lib/autoclip/types";
import { ensureDir, getSessionDir, nowIso, writeJson, readJson } from "@/lib/autoclip/utils";

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

const sessionFilePath = (sessionId: string) =>
  path.join(getSessionDir(sessionId), "session.json");

export const createSession = async (
  options?: Partial<AutoClipOptions>
): Promise<AutoClipSession> => {
  const id = crypto.randomUUID().slice(0, 8);
  const tempDir = getSessionDir(id);
  await ensureDir(tempDir);
  const now = nowIso();
  const session: AutoClipSession = {
    id,
    status: "created",
    createdAt: now,
    updatedAt: now,
    tempDir,
    options: { ...defaultOptions, ...options },
    logs: [],
  };
  memoryStore.set(id, session);
  await writeJson(sessionFilePath(id), session);
  return session;
};

export const getSession = async (
  sessionId: string
): Promise<AutoClipSession | null> => {
  const cached = memoryStore.get(sessionId);
  if (cached) {
    return cached;
  }
  const loaded = await readJson<AutoClipSession>(sessionFilePath(sessionId));
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
  await writeJson(sessionFilePath(session.id), session);
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
  try {
    await fs.rm(getSessionDir(sessionId), { recursive: true, force: true });
  } catch {
    // Ignore cleanup failures.
  }
};
