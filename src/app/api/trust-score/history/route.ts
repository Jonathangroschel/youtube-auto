import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server-client";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const channelId = url.searchParams.get("channelId");
  if (!channelId) {
    return NextResponse.json({ error: "Missing channelId" }, { status: 400 });
  }

  const { data: snapshots } = await supabaseServer
    .from("youtube_trust_score_snapshots")
    .select(
      "id, channel_id, score, score_raw, account_score, performance_score, consistency_score, niche_score, swipe_avg, retention_avg, components, action_items, data_confidence, created_at"
    )
    .eq("user_id", user.id)
    .eq("channel_id", channelId)
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json({ snapshots: snapshots ?? [] });
}
