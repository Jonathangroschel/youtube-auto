import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import { getProjectById } from "@/lib/projects/library";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("id");
  const dispositionParam = searchParams.get("disposition");
  if (!projectId) {
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  }

  const project = await getProjectById(projectId);
  if (!project?.assetPath) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  let buffer: Buffer;
  try {
    buffer = await fs.readFile(project.assetPath);
  } catch {
    return NextResponse.json(
      { error: "Project file not found." },
      { status: 404 }
    );
  }
  const disposition =
    dispositionParam === "inline" ? "inline" : "attachment";
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition": `${disposition}; filename="${project.assetFilename ?? "project.mp4"}"`,
    },
  });
}
