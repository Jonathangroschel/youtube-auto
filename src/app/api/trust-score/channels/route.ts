import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server-client";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: channels } = await supabaseServer
    .from("youtube_channels")
    .select(
      "channel_id, channel_title, channel_handle, channel_thumbnail_url, last_analyzed_at, last_score, published_at"
    )
    .eq("user_id", user.id)
    .order("last_connected_at", { ascending: false });

  if (!channels || channels.length === 0) {
    return NextResponse.json({ channels: [] });
  }

  const channelIds = channels.map((channel) => channel.channel_id);
  const { data: snapshots } = await supabaseServer
    .from("youtube_trust_score_snapshots")
    .select("channel_id, score, created_at, components")
    .in("channel_id", channelIds)
    .order("created_at", { ascending: false });

  type SnapshotRow = {
    channel_id: string;
    score: number | null;
    created_at: string | null;
    components: Record<string, number> | null;
  };

  const latestByChannel = new Map<string, SnapshotRow>();
  (snapshots ?? []).forEach((snapshot) => {
    if (!latestByChannel.has(snapshot.channel_id)) {
      latestByChannel.set(snapshot.channel_id, snapshot as SnapshotRow);
    }
  });

  return NextResponse.json({
    channels: channels.map((channel) => {
      const latest = latestByChannel.get(channel.channel_id);
      return {
        id: channel.channel_id,
        title: channel.channel_title,
        handle: channel.channel_handle,
        thumbnailUrl: channel.channel_thumbnail_url,
        lastAnalyzedAt: channel.last_analyzed_at,
        lastScore: channel.last_score ?? latest?.score ?? null,
        lastScoreAt: latest?.created_at ?? channel.last_analyzed_at ?? null,
        components: latest?.components ?? null,
        publishedAt: channel.published_at,
      };
    }),
  });
}
