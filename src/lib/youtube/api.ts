const DATA_API_BASE = "https://www.googleapis.com/youtube/v3";
const ANALYTICS_API_BASE = "https://youtubeanalytics.googleapis.com/v2";

type Thumbnail = {
  url: string;
  width?: number;
  height?: number;
};

export type YoutubeChannel = {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  keywords?: string;
  longUploadsStatus?: string;
  uploadsPlaylistId?: string;
  customUrl?: string;
  country?: string;
  thumbnails: Thumbnail[];
};

export type YoutubePlaylistItem = {
  videoId: string;
  publishedAt: string;
  title: string;
  description: string;
};

export type YoutubeVideo = {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  categoryId?: string;
  tags?: string[];
  topicCategories?: string[];
  topicIds?: string[];
  durationSeconds: number;
  thumbnails: Thumbnail[];
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  width?: number;
  height?: number;
};

export type AnalyticsMetrics = {
  views?: number;
  averageViewDuration?: number;
  averageViewPercentage?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  subscribersGained?: number;
  impressions?: number;
  impressionsClickThroughRate?: number;
  engagedViews?: number;
};

export type AnalyticsBreakdown = {
  values: Record<string, number>;
  total: number;
};

const fetchJson = async <T>(
  url: string,
  accessToken: string,
  init?: RequestInit
): Promise<T> => {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`YouTube API error: ${response.status} ${errorText}`);
  }

  return (await response.json()) as T;
};

const normalizeThumbnails = (
  thumbnails?: Record<string, Thumbnail>
): Thumbnail[] => {
  if (!thumbnails) {
    return [];
  }
  return Object.values(thumbnails).filter((thumb) => !!thumb?.url);
};

const parseDurationSeconds = (duration: string | undefined): number => {
  if (!duration) {
    return 0;
  }
  const match = duration.match(
    /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/
  );
  if (!match) {
    return 0;
  }
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  return hours * 3600 + minutes * 60 + seconds;
};

export const fetchChannels = async (
  accessToken: string,
  channelId?: string
): Promise<YoutubeChannel[]> => {
  const params = new URLSearchParams({
    part: "snippet,brandingSettings,contentDetails,status",
    maxResults: "50",
  });

  if (channelId) {
    params.set("id", channelId);
  } else {
    params.set("mine", "true");
  }

  const data = await fetchJson<{
    items?: Array<{
      id: string;
      snippet?: {
        title?: string;
        description?: string;
        publishedAt?: string;
        thumbnails?: Record<string, Thumbnail>;
        customUrl?: string;
        country?: string;
      };
      brandingSettings?: {
        channel?: {
          keywords?: string;
        };
      };
      contentDetails?: {
        relatedPlaylists?: {
          uploads?: string;
        };
      };
      status?: {
        longUploadsStatus?: string;
      };
    }>;
  }>(`${DATA_API_BASE}/channels?${params.toString()}`, accessToken);

  return (
    data.items?.map((item) => ({
      id: item.id,
      title: item.snippet?.title ?? "",
      description: item.snippet?.description ?? "",
      publishedAt: item.snippet?.publishedAt ?? "",
      keywords: item.brandingSettings?.channel?.keywords,
      longUploadsStatus: item.status?.longUploadsStatus,
      uploadsPlaylistId: item.contentDetails?.relatedPlaylists?.uploads,
      customUrl: item.snippet?.customUrl,
      country: item.snippet?.country,
      thumbnails: normalizeThumbnails(item.snippet?.thumbnails),
    })) ?? []
  );
};

export const fetchPlaylistItems = async (
  accessToken: string,
  playlistId: string,
  maxResults = 50
): Promise<YoutubePlaylistItem[]> => {
  const params = new URLSearchParams({
    part: "snippet,contentDetails",
    playlistId,
    maxResults: String(maxResults),
  });

  const data = await fetchJson<{
    items?: Array<{
      snippet?: {
        title?: string;
        description?: string;
      };
      contentDetails?: {
        videoId?: string;
        videoPublishedAt?: string;
      };
    }>;
  }>(`${DATA_API_BASE}/playlistItems?${params.toString()}`, accessToken);

  return (
    data.items
      ?.map((item) => ({
        videoId: item.contentDetails?.videoId ?? "",
        publishedAt: item.contentDetails?.videoPublishedAt ?? "",
        title: item.snippet?.title ?? "",
        description: item.snippet?.description ?? "",
      }))
      .filter((item) => item.videoId && item.publishedAt) ?? []
  );
};

export const fetchVideos = async (
  accessToken: string,
  videoIds: string[]
): Promise<YoutubeVideo[]> => {
  if (videoIds.length === 0) {
    return [];
  }

  const params = new URLSearchParams({
    part: "snippet,contentDetails,statistics,fileDetails,topicDetails",
    id: videoIds.join(","),
  });

  const data = await fetchJson<{
    items?: Array<{
      id: string;
      snippet?: {
        title?: string;
        description?: string;
        publishedAt?: string;
        categoryId?: string;
        thumbnails?: Record<string, Thumbnail>;
        tags?: string[];
      };
      contentDetails?: {
        duration?: string;
      };
      statistics?: {
        viewCount?: string;
        likeCount?: string;
        commentCount?: string;
      };
      topicDetails?: {
        topicCategories?: string[];
        topicIds?: string[];
      };
      fileDetails?: {
        videoStreams?: Array<{
          widthPixels?: number;
          heightPixels?: number;
        }>;
      };
    }>;
  }>(`${DATA_API_BASE}/videos?${params.toString()}`, accessToken);

  return (
    data.items?.map((item) => {
      const stream = item.fileDetails?.videoStreams?.[0];
      return {
        id: item.id,
        title: item.snippet?.title ?? "",
        description: item.snippet?.description ?? "",
        publishedAt: item.snippet?.publishedAt ?? "",
        categoryId: item.snippet?.categoryId,
        tags: item.snippet?.tags ?? [],
        topicCategories: item.topicDetails?.topicCategories ?? [],
        topicIds: item.topicDetails?.topicIds ?? [],
        durationSeconds: parseDurationSeconds(item.contentDetails?.duration),
        thumbnails: normalizeThumbnails(item.snippet?.thumbnails),
        viewCount: item.statistics?.viewCount
          ? Number(item.statistics.viewCount)
          : undefined,
        likeCount: item.statistics?.likeCount
          ? Number(item.statistics.likeCount)
          : undefined,
        commentCount: item.statistics?.commentCount
          ? Number(item.statistics.commentCount)
          : undefined,
        width: stream?.widthPixels,
        height: stream?.heightPixels,
      };
    }) ?? []
  );
};

const toDateString = (value: string | Date): string => {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
};

const buildAnalyticsUrl = (
  accessToken: string,
  params: URLSearchParams
): string => {
  return `${ANALYTICS_API_BASE}/reports?${params.toString()}`;
};

const parseAnalyticsRows = (
  data: {
    columnHeaders?: Array<{ name: string }>;
    rows?: Array<(string | number)[]>;
  }
): Map<string, AnalyticsMetrics> => {
  const headers = data.columnHeaders?.map((header) => header.name) ?? [];
  const rows = data.rows ?? [];
  const metricsMap = new Map<string, AnalyticsMetrics>();

  for (const row of rows) {
    const videoId = String(row[0] ?? "");
    if (!videoId) {
      continue;
    }
    const metrics: AnalyticsMetrics = metricsMap.get(videoId) ?? {};
    headers.slice(1).forEach((name, index) => {
      const rawValue = row[index + 1];
      const value = rawValue === null || rawValue === undefined ? undefined : Number(rawValue);
      if (Number.isNaN(value)) {
        return;
      }
      switch (name) {
        case "views":
          metrics.views = value;
          break;
        case "averageViewDuration":
          metrics.averageViewDuration = value;
          break;
        case "averageViewPercentage":
          metrics.averageViewPercentage = value;
          break;
        case "likes":
          metrics.likes = value;
          break;
        case "comments":
          metrics.comments = value;
          break;
        case "shares":
          metrics.shares = value;
          break;
        case "subscribersGained":
          metrics.subscribersGained = value;
          break;
        case "impressions":
          metrics.impressions = value;
          break;
        case "impressionsClickThroughRate":
        case "impressionsCtr":
          metrics.impressionsClickThroughRate = value;
          break;
        case "engagedViews":
          metrics.engagedViews = value;
          break;
        default:
          break;
      }
    });

    metricsMap.set(videoId, metrics);
  }

  return metricsMap;
};

const parseBreakdownRows = (
  data: {
    columnHeaders?: Array<{ name: string }>;
    rows?: Array<(string | number)[]>;
  },
  metricName: string
): AnalyticsBreakdown | null => {
  const headers = data.columnHeaders?.map((header) => header.name) ?? [];
  const metricIndex = headers.indexOf(metricName);
  if (metricIndex < 1) {
    return null;
  }

  const rows = data.rows ?? [];
  const values: Record<string, number> = {};
  let total = 0;

  for (const row of rows) {
    const key = String(row[0] ?? "");
    if (!key) {
      continue;
    }
    const rawValue = row[metricIndex];
    const value = rawValue === null || rawValue === undefined ? undefined : Number(rawValue);
    if (value === undefined || Number.isNaN(value)) {
      continue;
    }
    values[key] = (values[key] ?? 0) + value;
    total += value;
  }

  return { values, total };
};

const fetchAnalyticsReport = async (
  accessToken: string,
  params: URLSearchParams
): Promise<Map<string, AnalyticsMetrics> | null> => {
  const url = buildAnalyticsUrl(accessToken, params);
  try {
    const data = await fetchJson<{
      columnHeaders?: Array<{ name: string }>;
      rows?: Array<(string | number)[]>;
    }>(url, accessToken);
    return parseAnalyticsRows(data);
  } catch {
    return null;
  }
};

export const fetchAnalyticsBreakdown = async ({
  accessToken,
  dimension,
  startDate,
  endDate,
  metrics = ["views"],
  filters,
}: {
  accessToken: string;
  dimension: string;
  startDate: string | Date;
  endDate: string | Date;
  metrics?: string[];
  filters?: string;
}): Promise<AnalyticsBreakdown | null> => {
  const params = new URLSearchParams({
    ids: "channel==MINE",
    dimensions: dimension,
    startDate: toDateString(startDate),
    endDate: toDateString(endDate),
    metrics: metrics.join(","),
  });

  if (filters) {
    params.set("filters", filters);
  }

  const url = buildAnalyticsUrl(accessToken, params);
  try {
    const data = await fetchJson<{
      columnHeaders?: Array<{ name: string }>;
      rows?: Array<(string | number)[]>;
    }>(url, accessToken);
    return parseBreakdownRows(data, metrics[0] ?? "views");
  } catch {
    return null;
  }
};

export const fetchShortsFeedMetrics = async ({
  accessToken,
  videoIds,
  startDate,
  endDate,
}: {
  accessToken: string;
  videoIds: string[];
  startDate: string;
  endDate: string;
}): Promise<Map<string, AnalyticsMetrics>> => {
  const metricsMap = new Map<string, AnalyticsMetrics>();
  if (videoIds.length === 0) {
    return metricsMap;
  }

  const filterValue = `video==${videoIds.join(",")};creatorContentType==SHORTS;insightTrafficSourceType==SHORTS`;
  const params = new URLSearchParams({
    ids: "channel==MINE",
    dimensions: "video",
    startDate: toDateString(startDate),
    endDate: toDateString(endDate),
    filters: filterValue,
    metrics: "views,engagedViews",
  });

  const data = await fetchAnalyticsReport(accessToken, params);
  if (!data) {
    return metricsMap;
  }
  data.forEach((value, key) => {
    metricsMap.set(key, { ...value });
  });

  return metricsMap;
};

export const fetchAnalyticsMetrics = async ({
  accessToken,
  videoIds,
  startDate,
  endDate,
}: {
  accessToken: string;
  videoIds: string[];
  startDate: string;
  endDate: string;
}): Promise<Map<string, AnalyticsMetrics>> => {
  const metricsMap = new Map<string, AnalyticsMetrics>();
  if (videoIds.length === 0) {
    return metricsMap;
  }

  const filterValue = `video==${videoIds.join(",")}`;
  const baseParams = new URLSearchParams({
    ids: "channel==MINE",
    dimensions: "video",
    startDate: toDateString(startDate),
    endDate: toDateString(endDate),
    filters: filterValue,
  });

  const primaryParams = new URLSearchParams(baseParams);
  primaryParams.set(
    "metrics",
    [
      "views",
      "averageViewDuration",
      "averageViewPercentage",
      "likes",
      "comments",
      "shares",
      "subscribersGained",
    ].join(",")
  );

  const primaryData = await fetchAnalyticsReport(accessToken, primaryParams);
  if (primaryData) {
    primaryData.forEach((value, key) => {
      metricsMap.set(key, { ...value });
    });
  }

  const secondaryMetricsOptions = [
    ["impressions", "impressionsClickThroughRate", "engagedViews"],
    ["impressions", "impressionsCtr", "engagedViews"],
    ["impressions", "engagedViews"],
    ["engagedViews"],
  ];

  for (const metrics of secondaryMetricsOptions) {
    const secondaryParams = new URLSearchParams(baseParams);
    secondaryParams.set("metrics", metrics.join(","));
    const secondaryData = await fetchAnalyticsReport(accessToken, secondaryParams);
    if (!secondaryData) {
      continue;
    }
    secondaryData.forEach((value, key) => {
      const existing = metricsMap.get(key) ?? {};
      metricsMap.set(key, { ...existing, ...value });
    });
    break;
  }

  return metricsMap;
};

export type ChannelMetrics = {
  views: number;
  viewers: number;
  shares: number;
};

/**
 * Fetch channel-level metrics for share rate and views per viewer calculations
 * Note: 'shares' and 'viewers' metrics may not be available for all channels
 * or may require sufficient data volume to return non-zero values.
 */
export const fetchChannelMetrics = async ({
  accessToken,
  startDate,
  endDate,
}: {
  accessToken: string;
  startDate: string;
  endDate: string;
}): Promise<ChannelMetrics> => {
  // First try to get all metrics together
  const params = new URLSearchParams({
    ids: "channel==MINE",
    startDate: toDateString(startDate),
    endDate: toDateString(endDate),
    metrics: "views,shares",
  });

  const url = buildAnalyticsUrl(accessToken, params);
  let views = 0;
  let shares = 0;
  let viewers = 0;

  try {
    const data = await fetchJson<{
      columnHeaders?: Array<{ name: string }>;
      rows?: Array<(string | number)[]>;
    }>(url, accessToken);

    const headers = data.columnHeaders?.map((header) => header.name) ?? [];
    const row = data.rows?.[0] ?? [];

    const viewsIndex = headers.indexOf("views");
    const sharesIndex = headers.indexOf("shares");

    views = viewsIndex >= 0 ? Number(row[viewsIndex] ?? 0) : 0;
    shares = sharesIndex >= 0 ? Number(row[sharesIndex] ?? 0) : 0;

    console.log("[fetchChannelMetrics] views/shares response:", { headers, row, views, shares });
  } catch (error) {
    console.error("[fetchChannelMetrics] Error fetching views/shares:", error);
  }

  // Fetch 'viewers' (unique viewers) separately as it may have different availability
  // This metric counts unique viewers and may have privacy thresholds
  try {
    const viewersParams = new URLSearchParams({
      ids: "channel==MINE",
      startDate: toDateString(startDate),
      endDate: toDateString(endDate),
      metrics: "viewers",
    });

    const viewersUrl = buildAnalyticsUrl(accessToken, viewersParams);
    const viewersData = await fetchJson<{
      columnHeaders?: Array<{ name: string }>;
      rows?: Array<(string | number)[]>;
    }>(viewersUrl, accessToken);

    const viewersHeaders = viewersData.columnHeaders?.map((header) => header.name) ?? [];
    const viewersRow = viewersData.rows?.[0] ?? [];
    const viewersIndex = viewersHeaders.indexOf("viewers");

    viewers = viewersIndex >= 0 ? Number(viewersRow[viewersIndex] ?? 0) : 0;

    console.log("[fetchChannelMetrics] viewers response:", { viewersHeaders, viewersRow, viewers });
  } catch (error) {
    // 'viewers' metric may not be available for all channels
    console.warn("[fetchChannelMetrics] Could not fetch viewers metric (may not be available):", error);
  }

  console.log("[fetchChannelMetrics] Final metrics:", { views, viewers, shares });

  return { views, viewers, shares };
};
