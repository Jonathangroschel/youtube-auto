import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server-client";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("id");
  const dispositionParam = searchParams.get("disposition");
  if (!projectId) {
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data: project, error } = await supabaseServer
    .from("projects")
    .select("id,output_bucket,output_path,user_id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (error || !project?.output_bucket || !project?.output_path) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const { data, error: downloadError } = await supabaseServer.storage
    .from(project.output_bucket)
    .download(project.output_path);
  if (downloadError || !data) {
    return NextResponse.json(
      { error: "Project file not found." },
      { status: 404 }
    );
  }

  const disposition =
    dispositionParam === "inline" ? "inline" : "attachment";
  const filename =
    project.output_path.split("/").pop() ?? "project.mp4";
  const contentType = data.type || "video/mp4";
  const buffer = await data.arrayBuffer();

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `${disposition}; filename="${filename}"`,
    },
  });
}
