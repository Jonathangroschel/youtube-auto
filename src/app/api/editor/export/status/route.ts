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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId." }, { status: 400 });
  }

  const supabase = await createServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const response = await workerFetch(`/editor-export/status/${jobId}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 404) {
      const exportKey = `exports/${jobId}/export.mp4`;
      const { data: signedData, error: signedError } =
        await supabaseServer.storage
          .from(EXPORT_BUCKET)
          .createSignedUrl(exportKey, EXPORT_SIGN_TTL);
      if (!signedError && signedData?.signedUrl) {
        return NextResponse.json({
          status: "complete",
          stage: "Export ready",
          progress: 1,
          downloadUrl: signedData.signedUrl,
        });
      }
      return NextResponse.json({
        status: "queued",
        stage: "Waiting for export worker",
        progress: 0,
      });
    }
    return NextResponse.json(
      { error: payload?.error || "Export not found." },
      { status: response.status }
    );
  }

  return NextResponse.json(payload);
}
