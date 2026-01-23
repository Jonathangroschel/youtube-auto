import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { runFfmpeg } from "@/lib/autoclip/ffmpeg";
import {
  ensureDir,
  getAutoclipRoot,
  nowIso,
  readJson,
  slugify,
  writeJson,
} from "@/lib/autoclip/utils";
import type { ProjectLibraryItem } from "@/lib/projects/types";

type StoredProjectLibraryItem = ProjectLibraryItem & {
  assetPath: string;
  assetFilename: string;
  sourceSessionId?: string;
  outputIndex?: number;
};

const libraryDir = path.join(getAutoclipRoot(), "project-library");
const assetsDir = path.join(libraryDir, "assets");
const libraryPath = path.join(libraryDir, "library.json");

const readLibrary = async () =>
  (await readJson<StoredProjectLibraryItem[]>(libraryPath)) ?? [];

const writeLibrary = async (items: StoredProjectLibraryItem[]) =>
  writeJson(libraryPath, items);

const createPreviewImage = async (videoPath: string, previewPath: string) => {
  await runFfmpeg([
    "-y",
    "-ss",
    "0",
    "-i",
    videoPath,
    "-frames:v",
    "1",
    "-vf",
    "scale=640:-2",
    "-q:v",
    "2",
    previewPath,
  ]);
};

const buildPreviewDataUrl = async (videoPath: string, id: string) => {
  const previewsDir = path.join(libraryDir, "previews");
  const previewPath = path.join(previewsDir, `${id}.jpg`);
  await ensureDir(previewsDir);
  await createPreviewImage(videoPath, previewPath);
  const buffer = await fs.readFile(previewPath);
  await fs.rm(previewPath, { force: true });
  return `data:image/jpeg;base64,${buffer.toString("base64")}`;
};

export const listProjects = async () => readLibrary();

export const getProjectById = async (projectId: string) => {
  const items = await readLibrary();
  return items.find((item) => item.id === projectId) ?? null;
};

export const addProjectFromClip = async ({
  title,
  sourcePath,
  filename,
  sourceSessionId,
  outputIndex,
}: {
  title: string;
  sourcePath: string;
  filename?: string | null;
  sourceSessionId?: string;
  outputIndex?: number;
}) => {
  const items = await readLibrary();
  const existing =
    sourceSessionId != null && outputIndex != null
      ? items.find(
          (item) =>
            item.sourceSessionId === sourceSessionId &&
            item.outputIndex === outputIndex
        )
      : null;
  if (existing) {
    return existing;
  }

  const id = crypto.randomUUID();
  const safeTitle = title.trim() || "Untitled Clip";
  const baseSlug = slugify(safeTitle) || "clip";
  const extension = filename
    ? path.extname(filename) || ".mp4"
    : path.extname(sourcePath) || ".mp4";
  const storedFilename = `${baseSlug}_${id}${extension}`;
  await ensureDir(assetsDir);
  const storedPath = path.join(assetsDir, storedFilename);
  await fs.copyFile(sourcePath, storedPath);

  let previewImage: string | null = null;
  try {
    previewImage = await buildPreviewDataUrl(storedPath, `${baseSlug}_${id}`);
  } catch {
    previewImage = null;
  }

  const item: StoredProjectLibraryItem = {
    id,
    title: safeTitle,
    type: "VIDEO",
    createdAt: nowIso(),
    previewImage,
    assetPath: storedPath,
    assetFilename: storedFilename,
    sourceSessionId,
    outputIndex,
  };
  await writeLibrary([item, ...items]);
  return item;
};

export const toProjectSummary = (
  item: StoredProjectLibraryItem
): ProjectLibraryItem => ({
  id: item.id,
  title: item.title,
  type: item.type,
  createdAt: item.createdAt,
  previewImage: item.previewImage ?? null,
});
