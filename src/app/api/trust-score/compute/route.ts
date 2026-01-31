import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server-client";
import { supabaseServer } from "@/lib/supabase/server";
import {
  fetchAnalyticsMetrics,
  fetchChannelMetrics,
  fetchChannels,
  fetchPlaylistItems,
  fetchShortsFeedMetrics,
  fetchVideos,
} from "@/lib/youtube/api";
import { refreshAccessToken } from "@/lib/youtube/oauth";
import { calculateTrustScore } from "@/lib/youtube/trust-score";

export const runtime = "nodejs";

const DAY_MS = 24 * 60 * 60 * 1000;

const ensureAccessToken = async ({
  userId,
  channelId,
  tokenRow,
}: {
  userId: string;
  channelId: string;
  tokenRow: {
    access_token: string | null;
    refresh_token: string | null;
    token_expires_at: string | null;
  };
}): Promise<string> => {
  const expiresAt = tokenRow.token_expires_at
    ? new Date(tokenRow.token_expires_at).getTime()
    : 0;
  const now = Date.now();
  if (tokenRow.access_token && expiresAt > now + 60 * 1000) {
    return tokenRow.access_token;
  }
  if (!tokenRow.refresh_token) {
    throw new Error("missing_refresh_token");
  }
  const refreshed = await refreshAccessToken(tokenRow.refresh_token);
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000);

  await supabaseServer
    .from("youtube_channel_tokens")
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token ?? tokenRow.refresh_token,
      token_expires_at: newExpiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("channel_id", channelId);

  return refreshed.access_token;
};

type UploadItem = { videoId: string; publishedAt: string };

const pickWindowVideos = (uploads: UploadItem[]) => {
  const now = new Date();
  const sorted = [...uploads].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
  const recent = sorted.filter(
    (item) => now.getTime() - new Date(item.publishedAt).getTime() <= 28 * DAY_MS
  );
  if (recent.length >= 12) {
    return recent;
  }
  return sorted.slice(0, 12);
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    channelId?: string;
    swipeRate?: number | string | null;
    communityGuidelineStrikes?: 0 | 1 | 2 | "0" | "1" | "2" | "2+" | null;
    copyrightStrike?: boolean | "yes" | "no" | "true" | "false" | "1" | "0" | null;
    contentOriginality?: "mostly_original" | "mix" | "mostly_reused" | null;
  };
  const channelId = body.channelId?.trim();
  if (!channelId) {
    return NextResponse.json({ error: "Missing channelId" }, { status: 400 });
  }

  const parseRate = (value?: number | string | null): number | null => {
    if (value === undefined || value === null) return null;
    const numeric =
      typeof value === "number" ? value : Number.parseFloat(String(value).trim());
    if (!Number.isFinite(numeric)) return null;
    const normalized = numeric > 1.5 ? numeric / 100 : numeric;
    return Math.min(1, Math.max(0, normalized));
  };

  const parseStrikes = (value?: typeof body.communityGuidelineStrikes): 0 | 1 | 2 | null => {
    if (value === undefined || value === null) return null;
    if (typeof value === "number") {
      if (value <= 0) return 0;
      if (value === 1) return 1;
      return 2;
    }
    const raw = String(value).trim();
    if (!raw) return null;
    if (raw.includes("+")) return 2;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) return null;
    if (parsed <= 0) return 0;
    if (parsed === 1) return 1;
    return 2;
  };

  const parseYesNo = (value?: typeof body.copyrightStrike): boolean | null => {
    if (value === undefined || value === null) return null;
    if (typeof value === "boolean") return value;
    const raw = String(value).trim().toLowerCase();
    if (!raw) return null;
    if (["yes", "y", "true", "1"].includes(raw)) return true;
    if (["no", "n", "false", "0"].includes(raw)) return false;
    return null;
  };

  const parseOriginality = (
    value?: typeof body.contentOriginality
  ): "mostly_original" | "mix" | "mostly_reused" | null => {
    if (value === undefined || value === null) return null;
    if (value === "mostly_original" || value === "mix" || value === "mostly_reused") {
      return value;
    }
    return null;
  };

  const overrides = {
    swipeRate: parseRate(body.swipeRate),
    communityGuidelineStrikes: parseStrikes(body.communityGuidelineStrikes),
    copyrightStrike: parseYesNo(body.copyrightStrike),
    contentOriginality: parseOriginality(body.contentOriginality),
  };

  const { data: channel } = await supabaseServer
    .from("youtube_channels")
    .select("*")
    .eq("user_id", user.id)
    .eq("channel_id", channelId)
    .maybeSingle();

  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  const { data: tokenRow } = await supabaseServer
    .from("youtube_channel_tokens")
    .select("access_token, refresh_token, token_expires_at")
    .eq("user_id", user.id)
    .eq("channel_id", channelId)
    .maybeSingle();

  if (!tokenRow) {
    return NextResponse.json(
      { error: "Missing YouTube token", code: "reauth_required" },
      { status: 401 }
    );
  }

  try {
    const accessToken = await ensureAccessToken({
      userId: user.id,
      channelId,
      tokenRow,
    });

    const freshChannel = await fetchChannels(accessToken, channelId);
    const channelInfo = freshChannel[0] ?? {
      id: channel.channel_id,
      title: channel.channel_title ?? "",
      description: channel.channel_description ?? "",
      publishedAt: channel.published_at ? new Date(channel.published_at).toISOString() : "",
      keywords: channel.channel_keywords ?? "",
      longUploadsStatus: channel.long_uploads_status ?? "",
      uploadsPlaylistId: channel.uploads_playlist_id ?? undefined,
      thumbnails: [],
    };

    if (!channelInfo.uploadsPlaylistId) {
      return NextResponse.json(
        { error: "Missing uploads playlist" },
        { status: 400 }
      );
    }

    await supabaseServer
      .from("youtube_channels")
      .update({
        channel_title: channelInfo.title,
        channel_description: channelInfo.description,
        channel_handle: channelInfo.customUrl ?? channel.channel_handle,
        channel_thumbnail_url: channelInfo.thumbnails[0]?.url ?? channel.channel_thumbnail_url,
        channel_keywords: channelInfo.keywords ?? channel.channel_keywords,
        long_uploads_status: channelInfo.longUploadsStatus ?? channel.long_uploads_status,
        country: channelInfo.country ?? channel.country,
        uploads_playlist_id: channelInfo.uploadsPlaylistId,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .eq("channel_id", channelId);

    const uploads = await fetchPlaylistItems(
      accessToken,
      channelInfo.uploadsPlaylistId,
      50
    );
    const windowUploads = pickWindowVideos(uploads);
    if (windowUploads.length === 0) {
      return NextResponse.json(
        { error: "No uploads found to score" },
        { status: 400 }
      );
    }

    const videoIds = windowUploads.map((item) => item.videoId);
    const videos = await fetchVideos(accessToken, videoIds);

    const windowStart = windowUploads
      .map((item) => item.publishedAt)
      .sort()[0];
    const windowEnd = new Date().toISOString();

    const analyticsMap = await fetchAnalyticsMetrics({
      accessToken,
      videoIds,
      startDate: windowStart,
      endDate: windowEnd,
    });

    const shortsFeedMap = await fetchShortsFeedMetrics({
      accessToken,
      videoIds,
      startDate: windowStart,
      endDate: windowEnd,
    });

    // Fetch channel-level metrics for share rate
    const channelMetrics = await fetchChannelMetrics({
      accessToken,
      startDate: windowStart,
      endDate: windowEnd,
    });

    const mergedVideos = videos.map((video) => {
      const metrics = analyticsMap.get(video.id) ?? {};
      const shortsFeedMetrics = shortsFeedMap.get(video.id) ?? {};
      return {
        ...video,
        views: metrics.views ?? video.viewCount ?? 0,
        analyticsViews: metrics.views ?? undefined,
        likes: metrics.likes ?? video.likeCount ?? 0,
        comments: metrics.comments ?? video.commentCount ?? 0,
        subscribersGained: metrics.subscribersGained ?? 0,
        averageViewDuration: metrics.averageViewDuration ?? 0,
        averageViewPercentage: metrics.averageViewPercentage ?? undefined,
        impressions: metrics.impressions ?? undefined,
        impressionsClickThroughRate:
          metrics.impressionsClickThroughRate ?? undefined,
        engagedViews: metrics.engagedViews ?? undefined,
        shortsFeedViews: shortsFeedMetrics.views ?? undefined,
        shortsFeedEngagedViews: shortsFeedMetrics.engagedViews ?? undefined,
      };
    });

    const result = calculateTrustScore({
      channel: channelInfo,
      videos: mergedVideos,
      uploads,
      windowStart,
      windowEnd,
      now: new Date(),
      channelMetrics,
      overrides,
    });

    await supabaseServer.from("youtube_trust_score_snapshots").insert({
      user_id: user.id,
      channel_id: channelId,
      score: result.score,
      score_raw: result.scoreRaw,
      account_score: result.accountScore,
      performance_score: result.performanceScore,
      consistency_score: result.consistencyScore,
      niche_score: 0, // Deprecated - niche scoring removed
      swipe_avg: result.engagedViewAvg, // Hook metric avg (manual swipe or engaged view avg)
      retention_avg: result.retentionAvg,
      window_start: result.windowStart,
      window_end: result.windowEnd,
      video_count: result.videoCount,
      components: result.components,
      video_breakdown: result.videoBreakdown,
      action_items: result.actionItems,
      data_confidence: result.dataConfidence,
      created_at: new Date().toISOString(),
    });

    await supabaseServer
      .from("youtube_channels")
      .update({
        last_analyzed_at: new Date().toISOString(),
        last_score: result.score,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .eq("channel_id", channelId);

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to compute trust score";
    if (message.includes("missing_refresh_token")) {
      return NextResponse.json(
        {
          error: "Reconnect your YouTube channel to refresh access.",
          code: "reauth_required",
        },
        { status: 401 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
