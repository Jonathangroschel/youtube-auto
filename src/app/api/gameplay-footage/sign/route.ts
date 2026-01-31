import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server-client";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

const GAMEPLAY_BUCKET = "gameplay-footage";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24;

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const path = (searchParams.get("path") ?? "").replace(/^\/+/, "");
  if (!path) {
    return NextResponse.json({ error: "Missing path." }, { status: 400 });
  }

  const { data, error } = await supabaseServer.storage
    .from(GAMEPLAY_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: "Failed to sign gameplay URL." },
      { status: 502 }
    );
  }

  return NextResponse.json({ url: data.signedUrl });
}
