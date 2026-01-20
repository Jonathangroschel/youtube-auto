import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server-client";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { channelId?: string };
  const channelId = body.channelId?.trim();
  if (!channelId) {
    return NextResponse.json({ error: "Missing channelId" }, { status: 400 });
  }

  const { data: channel } = await supabaseServer
    .from("youtube_channels")
    .select("channel_id")
    .eq("user_id", user.id)
    .eq("channel_id", channelId)
    .maybeSingle();

  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  const { error: snapshotsError } = await supabaseServer
    .from("youtube_trust_score_snapshots")
    .delete()
    .eq("user_id", user.id)
    .eq("channel_id", channelId);
  if (snapshotsError) {
    return NextResponse.json(
      { error: "Failed to remove trust score history." },
      { status: 500 }
    );
  }

  const { error: tokensError } = await supabaseServer
    .from("youtube_channel_tokens")
    .delete()
    .eq("user_id", user.id)
    .eq("channel_id", channelId);
  if (tokensError) {
    return NextResponse.json(
      { error: "Failed to revoke channel tokens." },
      { status: 500 }
    );
  }

  const { error: channelError } = await supabaseServer
    .from("youtube_channels")
    .delete()
    .eq("user_id", user.id)
    .eq("channel_id", channelId);
  if (channelError) {
    return NextResponse.json(
      { error: "Failed to disconnect channel." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
