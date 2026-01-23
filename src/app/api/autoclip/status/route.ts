import { NextResponse } from "next/server";
import { getSession } from "@/lib/autoclip/session-store";

export const runtime = "nodejs";

const resolveBaseUrl = (request: Request) => {
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  return host ? `${proto}://${host}` : "";
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId." }, { status: 400 });
  }

  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  const baseUrl = resolveBaseUrl(request);
  const downloadUrl =
    session.outputs?.length && baseUrl
      ? `${baseUrl}/api/autoclip/download?sessionId=${session.id}`
      : null;

  return NextResponse.json({ ...session, downloadUrl });
}
