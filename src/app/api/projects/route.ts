import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@/lib/supabase/server-client";
import { supabaseServer } from "@/lib/supabase/server";
import { getSession } from "@/lib/autoclip/session-store";

export const runtime = "nodejs";

const OUTPUT_BUCKET = "project-exports";
const WORKER_URL = process.env.AUTOCLIP_WORKER_URL || "http://localhost:3001";
const WORKER_SECRET = process.env.AUTOCLIP_WORKER_SECRET || "dev-secret";
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const PAGE_SIZE = 24;

const sortOptions = {
  updated: { column: "updated_at", ascending: false },
  created: { column: "created_at", ascending: false },
  title: { column: "title", ascending: true },
} as const;

type ProjectSortKey = keyof typeof sortOptions;

const parseSortKey = (value: string | null): ProjectSortKey =>
  value === "created" || value === "title" ? value : "updated";

const parsePositiveInt = (value: string | null, fallback: number) => {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  const rounded = Math.floor(parsed);
  return rounded > 0 ? rounded : fallback;
};

const getRangeForPage = (page: number, pageSize: number) => {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  return { from, to };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const toFiniteNumber = (value: unknown, fallback = 0) => {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim().length > 0
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
};

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

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const IN_FLIGHT_EXPORT_STATUSES = new Set([
  "starting",
  "queued",
  "loading",
  "rendering",
  "encoding",
  "uploading",
]);

const COMPLETE_EXPORT_STATUSES = new Set([
  "complete",
  "completed",
  "success",
  "succeeded",
  "done",
  "rendered",
]);

const ERROR_EXPORT_STATUSES = new Set([
  "error",
  "failed",
  "failure",
  "cancelled",
  "canceled",
]);

const normalizeExportStatus = (value: string | null) => {
  if (!value) {
    return "idle" as const;
  }
  const normalized = value.toLowerCase();
  if (COMPLETE_EXPORT_STATUSES.has(normalized)) {
    return "complete" as const;
  }
  if (ERROR_EXPORT_STATUSES.has(normalized)) {
    return "error" as const;
  }
  if (IN_FLIGHT_EXPORT_STATUSES.has(normalized)) {
    return normalized;
  }
  if (normalized === "idle") {
    return "idle" as const;
  }
  // Unknown non-terminal statuses should still be treated as in-flight.
  return "rendering" as const;
};

type StorageRef = {
  bucket: string;
  path: string;
};

const buildSignedUrlMap = async (refs: StorageRef[]) => {
  const byBucket = new Map<string, Set<string>>();
  refs.forEach((ref) => {
    if (!ref.bucket || !ref.path) {
      return;
    }
    const set = byBucket.get(ref.bucket) ?? new Set<string>();
    set.add(ref.path);
    byBucket.set(ref.bucket, set);
  });

  const signedUrlMap = new Map<string, string>();
  await Promise.all(
    Array.from(byBucket.entries()).map(async ([bucket, pathsSet]) => {
      const paths = Array.from(pathsSet);
      if (paths.length === 0) {
        return;
      }
      const { data, error } = await supabaseServer.storage
        .from(bucket)
        .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
      if (error || !data) {
        return;
      }
      data.forEach((entry) => {
        if (entry.signedUrl) {
          signedUrlMap.set(`${bucket}:${entry.path}`, entry.signedUrl);
        }
      });
    })
  );

  return signedUrlMap;
};

type EditorPreviewSelection = {
  assetId: string;
  kind: "video" | "image";
  previewTimeSeconds: number | null;
  snapshotUrl: string | null;
};

const deriveEditorPreviewSelection = (
  projectState: unknown
): EditorPreviewSelection | null => {
  if (!isRecord(projectState)) {
    return null;
  }
  const snapshot = isRecord(projectState.snapshot) ? projectState.snapshot : null;
  if (!snapshot) {
    return null;
  }

  const assets = Array.isArray(snapshot.assets) ? snapshot.assets : [];
  const timeline = Array.isArray(snapshot.timeline) ? snapshot.timeline : [];
  const lanes = Array.isArray(snapshot.lanes) ? snapshot.lanes : [];

  const videoLaneIds = new Set(
    lanes
      .filter(isRecord)
      .filter(
        (lane) => lane.type === "video" && typeof lane.id === "string"
      )
      .map((lane) => lane.id as string)
  );

  const previewableAssets = new Map<
    string,
    { kind: "video" | "image"; url: string; duration?: number }
  >();
  assets.forEach((asset) => {
    if (!isRecord(asset) || typeof asset.id !== "string") {
      return;
    }
    const kind = asset.kind === "video" || asset.kind === "image" ? asset.kind : null;
    const url = typeof asset.url === "string" ? asset.url.trim() : "";
    if (!kind || !url) {
      return;
    }
    previewableAssets.set(asset.id, {
      kind,
      url,
      duration:
        typeof asset.duration === "number" && Number.isFinite(asset.duration)
          ? asset.duration
          : undefined,
    });
  });

  if (previewableAssets.size === 0 || videoLaneIds.size === 0) {
    return null;
  }

  const candidateClips = timeline
    .filter(isRecord)
    .filter(
      (clip) =>
        typeof clip.assetId === "string" &&
        typeof clip.laneId === "string" &&
        videoLaneIds.has(clip.laneId)
    )
    .map((clip) => {
      const assetId = clip.assetId as string;
      const asset = previewableAssets.get(assetId);
      if (!asset) {
        return null;
      }
      const startTime = toFiniteNumber(clip.startTime, 0);
      const startOffset = Math.max(0, toFiniteNumber(clip.startOffset, 0));
      const duration = Math.max(0, toFiniteNumber(clip.duration, 0));
      return {
        assetId,
        asset,
        startTime,
        startOffset,
        duration,
      };
    })
    .filter(
      (
        value
      ): value is {
        assetId: string;
        asset: { kind: "video" | "image"; url: string; duration?: number };
        startTime: number;
        startOffset: number;
        duration: number;
      } => value != null
    )
    .sort((a, b) => a.startTime - b.startTime);

  const firstClip = candidateClips[0];
  if (!firstClip) {
    return null;
  }

  const previewTimeSeconds =
    firstClip.asset.kind === "video"
      ? firstClip.startOffset + firstClip.duration * 0.5
      : null;

  return {
    assetId: firstClip.assetId,
    kind: firstClip.asset.kind,
    previewTimeSeconds,
    snapshotUrl: firstClip.asset.url,
  };
};

const resolveRenderStatus = ({
  status,
  exportStatus,
  hasOutput,
}: {
  status: string | null;
  exportStatus: string | null;
  hasOutput: boolean;
}) => {
  const normalizedExportStatus = normalizeExportStatus(exportStatus);
  const exportInFlight =
    normalizedExportStatus !== "idle" &&
    normalizedExportStatus !== "complete" &&
    normalizedExportStatus !== "error";
  if (
    hasOutput &&
    (normalizedExportStatus === "complete" || status === "rendered")
  ) {
    return "complete" as const;
  }
  if (
    normalizedExportStatus === "error" ||
    status === "error" ||
    status === "failed"
  ) {
    return "error" as const;
  }
  if (exportInFlight || status === "rendering") {
    return "rendering" as const;
  }
  if (normalizedExportStatus === "complete") {
    return "complete" as const;
  }
  return "idle" as const;
};

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const requestedPage = parsePositiveInt(searchParams.get("page"), 1);
  const sort = parseSortKey(searchParams.get("sort"));
  const sortConfig = sortOptions[sort];

  const runQuery = async (page: number) => {
    const { from, to } = getRangeForPage(page, PAGE_SIZE);
    let query = supabaseServer
      .from("projects")
      .select(
        "id,title,created_at,updated_at,preview_bucket,preview_path,kind,status,output_bucket,output_path,project_state",
        { count: "exact" }
      )
      .eq("user_id", user.id)
      .in("kind", ["clip", "editor"])
      .order(sortConfig.column, { ascending: sortConfig.ascending });
    if (sortConfig.column !== "updated_at") {
      query = query.order("updated_at", { ascending: false });
    }
    return query.range(from, to);
  };

  let page = requestedPage;
  let { data, error, count } = await runQuery(page);

  if (error) {
    return NextResponse.json(
      { error: "Unable to load projects." },
      { status: 500 }
    );
  }

  const totalCount =
    typeof count === "number" && count >= 0 ? count : (data ?? []).length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE) || 1);

  if (totalCount > 0 && page > totalPages) {
    page = totalPages;
    const rerun = await runQuery(page);
    data = rerun.data;
    error = rerun.error;
    count = rerun.count;
    if (error) {
      return NextResponse.json(
        { error: "Unable to load projects." },
        { status: 500 }
      );
    }
  }

  const rows = data ?? [];

  const previewImageRefs: StorageRef[] = [];
  const outputVideoRefs: StorageRef[] = [];
  const editorSelections = new Map<string, EditorPreviewSelection>();
  const editorPreviewAssetIds = new Set<string>();

  rows.forEach((row) => {
    if (row.preview_bucket && row.preview_path) {
      previewImageRefs.push({ bucket: row.preview_bucket, path: row.preview_path });
    }
    if (row.kind === "clip" && row.output_bucket && row.output_path) {
      outputVideoRefs.push({ bucket: row.output_bucket, path: row.output_path });
    }
    if (row.kind === "editor") {
      const selection = deriveEditorPreviewSelection(row.project_state);
      if (selection) {
        editorSelections.set(row.id, selection);
        editorPreviewAssetIds.add(selection.assetId);
      }
    }
  });

  type AssetRow = {
    id: string;
    kind: string | null;
    storage_bucket: string | null;
    storage_path: string | null;
    external_url: string | null;
  };

  const assetIds = Array.from(editorPreviewAssetIds);
  let assetRows: AssetRow[] = [];
  if (assetIds.length > 0) {
    const { data: assetsData } = await supabaseServer
      .from("assets")
      .select("id,kind,storage_bucket,storage_path,external_url")
      .eq("user_id", user.id)
      .in("id", assetIds);
    assetRows = assetsData ?? [];
  }

  const assetById = new Map(assetRows.map((asset) => [asset.id, asset]));
  const assetStorageRefs: StorageRef[] = assetRows
    .filter((asset) => asset.storage_bucket && asset.storage_path)
    .map((asset) => ({
      bucket: asset.storage_bucket as string,
      path: asset.storage_path as string,
    }));

  const signedUrlMap = await buildSignedUrlMap([
    ...previewImageRefs,
    ...outputVideoRefs,
    ...assetStorageRefs,
  ]);

  const resolveSignedUrl = (bucket: string | null, path: string | null) => {
    if (!bucket || !path) {
      return null;
    }
    return signedUrlMap.get(`${bucket}:${path}`) ?? null;
  };

  return NextResponse.json({
    projects: rows.map((project) => {
      const kind = project.kind === "editor" ? "editor" : "clip";
      const previewImage = resolveSignedUrl(
        project.preview_bucket,
        project.preview_path
      );
      const outputPreviewUrl =
        kind === "clip"
          ? resolveSignedUrl(project.output_bucket, project.output_path)
          : null;
      const editorSelection = editorSelections.get(project.id) ?? null;
      const editorAsset = editorSelection
        ? assetById.get(editorSelection.assetId) ?? null
        : null;
      const editorPreviewUrl = editorSelection
        ? editorAsset?.storage_bucket && editorAsset.storage_path
          ? resolveSignedUrl(editorAsset.storage_bucket, editorAsset.storage_path)
          : editorAsset?.external_url ?? editorSelection.snapshotUrl
        : null;
      const previewSourceUrl =
        editorPreviewUrl ?? outputPreviewUrl ?? previewImage ?? null;
      const previewSourceKind =
        editorSelection?.kind ?? (outputPreviewUrl ? "video" : previewImage ? "image" : null);
      const previewTimeSeconds =
        editorSelection?.previewTimeSeconds ?? (outputPreviewUrl ? 0 : null);
      const status = typeof project.status === "string" ? project.status : null;
      const hasOutput = Boolean(project.output_bucket && project.output_path);
      const projectState = isRecord(project.project_state)
        ? project.project_state
        : null;
      const exportState =
        projectState && isRecord(projectState.export)
          ? projectState.export
          : null;
      const exportStatus =
        exportState && typeof exportState.status === "string"
          ? exportState.status
          : null;
      const renderStatus = resolveRenderStatus({
        status,
        exportStatus,
        hasOutput,
      });
      const renderStage =
        exportState && typeof exportState.stage === "string"
          ? exportState.stage
          : renderStatus === "rendering"
            ? "Rendering"
            : renderStatus === "complete"
              ? "Ready"
              : null;
      const renderProgress =
        exportState && typeof exportState.progress === "number"
          ? clamp(exportState.progress, 0, 1)
          : null;
      const renderJobId =
        exportState && typeof exportState.jobId === "string"
          ? exportState.jobId
          : null;
      const downloadAvailable = hasOutput && renderStatus === "complete";
      return {
        id: project.id,
        title: project.title,
        type: kind === "editor" ? "EDITOR" : "VIDEO",
        kind,
        createdAt: project.created_at,
        updatedAt: project.updated_at ?? project.created_at,
        previewImage,
        previewSourceUrl,
        previewSourceKind,
        previewTimeSeconds,
        status,
        renderStatus,
        renderStage,
        renderProgress,
        renderJobId,
        hasOutput,
        downloadAvailable,
      };
    }),
    pagination: {
      page,
      pageSize: PAGE_SIZE,
      totalCount,
      totalPages,
      sort,
    },
  });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const projectId =
    typeof body?.id === "string" ? body.id.trim() : "";
  const nextTitle =
    typeof body?.title === "string" ? trimTitle(body.title) : "";

  if (!projectId) {
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  }
  if (!nextTitle) {
    return NextResponse.json({ error: "Missing title." }, { status: 400 });
  }

  const { data: project, error: projectError } = await supabaseServer
    .from("projects")
    .select("id,title,project_state")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (projectError) {
    return NextResponse.json(
      { error: "Unable to rename project." },
      { status: 500 }
    );
  }

  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const state = isRecord(project.project_state) ? project.project_state : null;
  const stateProject = state && isRecord(state.project) ? state.project : null;
  const nextProjectState =
    state && stateProject
      ? {
          ...state,
          project: {
            ...stateProject,
            name: nextTitle,
          },
        }
      : state;

  const updatePayload: Record<string, unknown> = {
    title: nextTitle,
    updated_at: new Date().toISOString(),
  };
  if (nextProjectState && nextProjectState !== project.project_state) {
    updatePayload.project_state = nextProjectState;
  }

  const { data: updatedProject, error: updateError } = await supabaseServer
    .from("projects")
    .update(updatePayload)
    .eq("id", projectId)
    .eq("user_id", user.id)
    .select("id,title,updated_at")
    .maybeSingle();

  if (updateError || !updatedProject) {
    return NextResponse.json(
      { error: "Unable to rename project." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    project: {
      id: updatedProject.id,
      title: updatedProject.title,
      updatedAt: updatedProject.updated_at,
    },
  });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const queryId = searchParams.get("id");
  const body = queryId ? null : await request.json().catch(() => ({}));
  const bodyId =
    !queryId && body && typeof body.id === "string" ? body.id : null;
  const projectId = (queryId ?? bodyId ?? "").trim();

  if (!projectId) {
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  }

  const { data: project, error: projectError } = await supabaseServer
    .from("projects")
    .select("id,user_id,preview_bucket,preview_path,output_bucket,output_path")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (projectError) {
    return NextResponse.json(
      { error: "Unable to delete project." },
      { status: 500 }
    );
  }

  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const { error: deleteError } = await supabaseServer
    .from("projects")
    .delete()
    .eq("id", projectId)
    .eq("user_id", user.id);

  if (deleteError) {
    return NextResponse.json(
      { error: "Unable to delete project." },
      { status: 500 }
    );
  }

  // Best-effort cleanup; do not fail the request if these operations error.
  await supabaseServer
    .from("project_assets")
    .delete()
    .eq("project_id", projectId);

  const storageDeletes: Promise<unknown>[] = [];
  if (project.preview_bucket && project.preview_path) {
    storageDeletes.push(
      supabaseServer.storage
        .from(project.preview_bucket)
        .remove([project.preview_path])
    );
  }
  if (project.output_bucket && project.output_path) {
    storageDeletes.push(
      supabaseServer.storage
        .from(project.output_bucket)
        .remove([project.output_path])
    );
  }
  if (storageDeletes.length > 0) {
    await Promise.allSettled(storageDeletes);
  }

  return NextResponse.json({ ok: true });
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
