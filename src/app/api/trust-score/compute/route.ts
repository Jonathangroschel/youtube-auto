import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server-client";
import { supabaseServer } from "@/lib/supabase/server";
import {
  fetchAnalyticsMetrics,
  fetchAnalyticsBreakdown,
  fetchChannels,
  fetchPlaylistItems,
  fetchShortsFeedMetrics,
  fetchVideos,
} from "@/lib/youtube/api";
import { refreshAccessToken } from "@/lib/youtube/oauth";
import { calculateTrustScore, type NicheSignals } from "@/lib/youtube/trust-score";

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

const NICHE_WINDOW_DAYS = 7;

const buildNicheWindows = (windowEnd: string) => {
  const end = new Date(windowEnd);
  const currentEnd = end;
  const currentStart = new Date(
    end.getTime() - (NICHE_WINDOW_DAYS - 1) * DAY_MS
  );
  const previousEnd = new Date(currentStart.getTime() - DAY_MS);
  const previousStart = new Date(
    previousEnd.getTime() - (NICHE_WINDOW_DAYS - 1) * DAY_MS
  );

  return { previousStart, previousEnd, currentStart, currentEnd };
};

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

    const nicheWindows = buildNicheWindows(windowEnd);
    const [trafficPrevious, trafficCurrent, audiencePrevious, audienceCurrent] =
      await Promise.all([
        fetchAnalyticsBreakdown({
          accessToken,
          dimension: "insightTrafficSourceType",
          startDate: nicheWindows.previousStart,
          endDate: nicheWindows.previousEnd,
          filters: "creatorContentType==SHORTS",
        }),
        fetchAnalyticsBreakdown({
          accessToken,
          dimension: "insightTrafficSourceType",
          startDate: nicheWindows.currentStart,
          endDate: nicheWindows.currentEnd,
          filters: "creatorContentType==SHORTS",
        }),
        fetchAnalyticsBreakdown({
          accessToken,
          dimension: "country",
          startDate: nicheWindows.previousStart,
          endDate: nicheWindows.previousEnd,
          filters: "creatorContentType==SHORTS",
        }),
        fetchAnalyticsBreakdown({
          accessToken,
          dimension: "country",
          startDate: nicheWindows.currentStart,
          endDate: nicheWindows.currentEnd,
          filters: "creatorContentType==SHORTS",
        }),
      ]);

    const nicheSignals: NicheSignals = {
      placement:
        trafficPrevious && trafficCurrent
          ? { previous: trafficPrevious, current: trafficCurrent }
          : undefined,
      audience:
        audiencePrevious && audienceCurrent
          ? { previous: audiencePrevious, current: audienceCurrent }
          : undefined,
    };

    const mergedVideos = videos.map((video) => {
      const metrics = analyticsMap.get(video.id) ?? {};
      const shortsFeedMetrics = shortsFeedMap.get(video.id) ?? {};
      return {
        ...video,
        views: metrics.views ?? video.viewCount ?? 0,
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
      nicheSignals,
    });

    await supabaseServer.from("youtube_trust_score_snapshots").insert({
      user_id: user.id,
      channel_id: channelId,
      score: result.score,
      score_raw: result.scoreRaw,
      account_score: result.accountScore,
      performance_score: result.performanceScore,
      consistency_score: result.consistencyScore,
      niche_score: result.nicheScore,
      swipe_avg: result.swipeAvg,
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
