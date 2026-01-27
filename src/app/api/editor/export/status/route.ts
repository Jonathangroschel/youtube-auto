import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server-client";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

const WORKER_URL = process.env.AUTOCLIP_WORKER_URL || "http://localhost:3001";
const WORKER_SECRET = process.env.AUTOCLIP_WORKER_SECRET || "dev-secret";
const EXPORT_BUCKET = process.env.EDITOR_EXPORT_BUCKET || "editor-exports";
const EXPORT_SIGN_TTL = 60 * 60 * 24;

const workerFetch = (endpoint: string, options: RequestInit = {}) =>
  fetch(`${WORKER_URL}${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${WORKER_SECRET}`,
    },
  });

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

const normalizeExportStatus = (value: string | null | undefined) => {
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

const deriveProjectStatus = ({
  exportStatus,
  hasJobId,
}: {
  exportStatus: string | null | undefined;
  hasJobId: boolean;
}) => {
  if (!hasJobId) {
    return "draft";
  }
  const normalizedStatus = normalizeExportStatus(exportStatus);
  if (normalizedStatus === "complete") return "rendered";
  if (normalizedStatus === "error") return "error";
  return "rendering";
};

type PersistedExportState = {
  jobId: string;
  status: string;
  stage: string;
  progress: number;
  downloadUrl: string | null;
  updatedAt: string;
};

const buildPersistedExportState = ({
  jobId,
  status,
  stage,
  progress,
  downloadUrl,
}: {
  jobId: string;
  status: string;
  stage: string;
  progress: number;
  downloadUrl: string | null;
}): PersistedExportState => ({
  jobId,
  status: normalizeExportStatus(status),
  stage,
  progress: clamp(progress, 0, 1),
  downloadUrl,
  updatedAt: new Date().toISOString(),
});

const exportKeyForJob = (jobId: string) => `exports/${jobId}/export.mp4`;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId." }, { status: 400 });
  }
  const projectIdRaw = searchParams.get("projectId");
  const projectId =
    typeof projectIdRaw === "string" && projectIdRaw.trim().length > 0
      ? projectIdRaw.trim()
      : null;

  const supabase = await createServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const maybeUpdateProject = async (exportState: PersistedExportState) => {
    if (!projectId) {
      return;
    }

    const { data: project } = await supabaseServer
      .from("projects")
      .select("id,user_id,kind,project_state,output_bucket,output_path")
      .eq("id", projectId)
      .maybeSingle();

    if (!project || project.user_id !== user.id || project.kind !== "editor") {
      return;
    }

    const existingState =
      project.project_state && typeof project.project_state === "object"
        ? (project.project_state as Record<string, unknown>)
        : {};
    const existingExport =
      existingState.export && typeof existingState.export === "object"
        ? (existingState.export as Record<string, unknown>)
        : null;

    const existingProgress =
      existingExport && typeof existingExport.progress === "number"
        ? existingExport.progress
        : null;
    const progressChanged =
      existingProgress == null ||
      Math.abs(existingProgress - exportState.progress) >= 0.02;
    const exportChanged =
      !existingExport ||
      existingExport.status !== exportState.status ||
      existingExport.stage !== exportState.stage ||
      existingExport.downloadUrl !== exportState.downloadUrl ||
      progressChanged;

    const exportKey = exportKeyForJob(jobId);
    const needsOutputUpdate =
      exportState.status === "complete" &&
      (!project.output_bucket ||
        !project.output_path ||
        project.output_bucket !== EXPORT_BUCKET ||
        project.output_path !== exportKey);

    if (!exportChanged && !needsOutputUpdate) {
      return;
    }

    const mergedState = {
      ...existingState,
      export: exportState,
    };
    const updates: Record<string, unknown> = {
      status: deriveProjectStatus({
        exportStatus: exportState.status,
        hasJobId: Boolean(exportState.jobId),
      }),
      project_state: mergedState,
    };
    if (exportState.status === "complete") {
      updates.output_bucket = EXPORT_BUCKET;
      updates.output_path = exportKey;
    }

    await supabaseServer
      .from("projects")
      .update(updates)
      .eq("id", projectId)
      .eq("user_id", user.id);
  };

  const response = await workerFetch(`/editor-export/status/${jobId}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 404) {
      const exportKey = exportKeyForJob(jobId);
      const { data: signedData, error: signedError } =
        await supabaseServer.storage
          .from(EXPORT_BUCKET)
          .createSignedUrl(exportKey, EXPORT_SIGN_TTL);
      if (!signedError && signedData?.signedUrl) {
        const responsePayload = {
          status: "complete",
          stage: "Export ready",
          progress: 1,
          downloadUrl: signedData.signedUrl,
        };
        await maybeUpdateProject(
          buildPersistedExportState({
            jobId,
            status: responsePayload.status,
            stage: responsePayload.stage,
            progress: responsePayload.progress,
            downloadUrl: responsePayload.downloadUrl,
          })
        );
        return NextResponse.json(responsePayload);
      }
      const responsePayload = {
        status: "queued",
        stage: "Waiting for export worker",
        progress: 0,
      };
      await maybeUpdateProject(
        buildPersistedExportState({
          jobId,
          status: responsePayload.status,
          stage: responsePayload.stage,
          progress: responsePayload.progress,
          downloadUrl: null,
        })
      );
      return NextResponse.json(responsePayload);
    }
    const errorStage =
      typeof payload?.error === "string" && payload.error.trim().length > 0
        ? payload.error
        : "Export failed";
    await maybeUpdateProject(
      buildPersistedExportState({
        jobId,
        status: "error",
        stage: errorStage,
        progress: 0,
        downloadUrl: null,
      })
    );
    return NextResponse.json(
      { error: payload?.error || "Export not found." },
      { status: response.status }
    );
  }

  const rawStatus =
    typeof payload?.status === "string" ? payload.status : "queued";
  const status = normalizeExportStatus(rawStatus);
  const stage =
    typeof payload?.stage === "string" && payload.stage.trim().length > 0
      ? payload.stage
      : status === "complete"
        ? "Export ready"
        : "Exporting";
  const progress = typeof payload?.progress === "number" ? payload.progress : 0;
  const downloadUrl =
    typeof payload?.downloadUrl === "string" ? payload.downloadUrl : null;

  await maybeUpdateProject(
    buildPersistedExportState({
      jobId,
      status,
      stage,
      progress,
      downloadUrl,
    })
  );

  return NextResponse.json({
    ...payload,
    status,
    stage,
    progress: clamp(progress, 0, 1),
    downloadUrl,
  });
}
