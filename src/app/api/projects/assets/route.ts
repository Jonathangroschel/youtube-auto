import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server-client";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

const normalizeIds = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(
    new Set(
      value
        .filter((item) => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const projectId =
    typeof body?.projectId === "string" ? body.projectId.trim() : "";
  const assetIds = normalizeIds(body?.assetIds);
  const role = typeof body?.role === "string" ? body.role : "source";

  if (!projectId || assetIds.length === 0) {
    return NextResponse.json(
      { error: "Missing projectId or assetIds." },
      { status: 400 }
    );
  }

  const supabase = await createServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data: project, error: projectError } = await supabaseServer
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const { data: assetRows, error: assetError } = await supabaseServer
    .from("assets")
    .select("id")
    .eq("user_id", user.id)
    .in("id", assetIds);

  if (assetError) {
    return NextResponse.json(
      { error: "Failed to verify assets." },
      { status: 500 }
    );
  }

  const allowedIds = (assetRows ?? []).map((row) => row.id);
  if (allowedIds.length === 0) {
    return NextResponse.json(
      { error: "No valid assets to link." },
      { status: 400 }
    );
  }

  const payload = allowedIds.map((assetId) => ({
    project_id: projectId,
    asset_id: assetId,
    role,
  }));

  const { error } = await supabaseServer
    .from("project_assets")
    .upsert(payload, { onConflict: "project_id,asset_id" });

  if (error) {
    return NextResponse.json(
      { error: "Failed to link assets." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, assetCount: allowedIds.length });
}
