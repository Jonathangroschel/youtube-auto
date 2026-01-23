import { promises as fs } from "fs";
import os from "os";
import path from "path";

export const nowIso = () => new Date().toISOString();

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

export const ensureDir = async (dir: string) => {
  await fs.mkdir(dir, { recursive: true });
};

export const readJson = async <T>(filePath: string): Promise<T | null> => {
  try {
    const data = await fs.readFile(filePath, "utf8");
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
};

export const writeJson = async (filePath: string, data: unknown) => {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
};

export const getAutoclipRoot = () => path.join(os.tmpdir(), "autoclip");

export const getSessionDir = (sessionId: string) =>
  path.join(getAutoclipRoot(), sessionId);

export const safeParseJson = <T>(value: string): T | null => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

export const clampNumber = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const formatSeconds = (seconds: number) => {
  const clamped = Math.max(0, seconds);
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const secs = Math.floor(clamped % 60);
  const millis = Math.floor((clamped - Math.floor(clamped)) * 1000);
  const pad = (val: number, size = 2) => String(val).padStart(size, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)},${pad(millis, 3)}`;
};

export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));
