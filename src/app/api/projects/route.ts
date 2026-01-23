import { NextResponse } from "next/server";
import { getSession } from "@/lib/autoclip/session-store";
import {
  addProjectFromClip,
  listProjects,
  toProjectSummary,
} from "@/lib/projects/library";

export const runtime = "nodejs";

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

export async function GET() {
  const projects = await listProjects();
  return NextResponse.json({
    projects: projects.map(toProjectSummary),
  });
}

export async function POST(request: Request) {
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

  const highlight = output.highlightIndex !== undefined ? session.highlights?.[output.highlightIndex] : undefined;
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

  const project = await addProjectFromClip({
    title: resolvedTitle || "Untitled Clip",
    sourcePath: output.filePath,
    filename: output.filename,
    sourceSessionId: sessionId,
    outputIndex: clipIndex,
  });

  return NextResponse.json(
    { project: toProjectSummary(project) },
    { status: 201 }
  );
}
