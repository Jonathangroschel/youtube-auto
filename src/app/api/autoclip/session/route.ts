import { NextResponse } from "next/server";
import { createSession } from "@/lib/autoclip/session-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  const session = await createSession(payload?.options);
  return NextResponse.json(session);
}
