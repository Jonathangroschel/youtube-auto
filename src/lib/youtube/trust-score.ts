import type { YoutubeChannel, YoutubePlaylistItem, YoutubeVideo } from "@/lib/youtube/api";

type VideoMetrics = YoutubeVideo & {
  views: number;
  likes: number;
  comments: number;
  subscribersGained: number;
  averageViewDuration: number;
  averageViewPercentage?: number;
  impressions?: number;
  impressionsClickThroughRate?: number;
  engagedViews?: number;
};

type ActionItem = {
  title: string;
  detail: string;
  severity: "high" | "medium" | "low";
};

type VideoScoreBreakdown = {
  videoId: string;
  title: string;
  publishedAt: string;
  durationSeconds: number;
  weight: number;
  views: number;
  scores: {
    swipe: number;
    retention: number;
    rewatch: number;
    engagement: number;
    formatting: number;
    total: number;
  };
  metrics: {
    swipeRate?: number;
    swipeSource?: string;
    ctr?: number;
    startRate?: number;
    averageViewDuration: number;
    targetAvd: number;
    loopRatio: number;
  };
};

export type TrustScoreResult = {
  score: number;
  scoreRaw: number;
  accountScore: number;
  performanceScore: number;
  consistencyScore: number;
  nicheScore: number;
  swipeAvg: number | null;
  retentionAvg: number | null;
  windowStart: string;
  windowEnd: string;
  videoCount: number;
  actionItems: ActionItem[];
  components: Record<string, number>;
  videoBreakdown: VideoScoreBreakdown[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const normalizeRate = (value?: number): number | null => {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return null;
  }
  if (value > 1.5) {
    return value / 100;
  }
  return value;
};

const roundToHalf = (value: number): number => {
  return Math.round(value * 2) / 2;
};

const getTargetRatio = (lov: number): number => {
  if (lov <= 7) {
    return 1.43;
  }
  if (lov <= 14) {
    return 1.43 + ((1.16 - 1.43) * (lov - 7)) / (14 - 7);
  }
  if (lov <= 32) {
    return 1.16 + ((1.03 - 1.16) * (lov - 14)) / (32 - 14);
  }
  if (lov <= 40) {
    return 1.03 + ((0.975 - 1.03) * (lov - 32)) / (40 - 32);
  }
  if (lov <= 60) {
    return 0.975 + ((0.783 - 0.975) * (lov - 40)) / (60 - 40);
  }
  return 0.783;
};

const computeRetentionScore = (lov: number, avd: number): { score: number; target: number } => {
  if (lov <= 0 || avd <= 0) {
    return { score: 0, target: 0 };
  }
  const target = roundToHalf(getTargetRatio(lov) * lov);
  if (avd >= target) {
    return { score: 40, target };
  }
  const delta = target - avd;
  if (delta <= 1) {
    return { score: 30, target };
  }
  if (delta <= 2) {
    return { score: 20, target };
  }
  if (delta <= 3) {
    return { score: 10, target };
  }
  if (avd >= lov) {
    return { score: 5, target };
  }
  return { score: 0, target };
};

const computeRewatchScore = (lov: number, avd: number): { score: number; loopRatio: number } => {
  if (lov <= 0 || avd <= 0) {
    return { score: 0, loopRatio: 0 };
  }
  const loopRatio = avd / lov;
  let score = 0;
  if (loopRatio >= 1.25) {
    score = 10;
  } else if (loopRatio >= 1.1) {
    score = 8;
  } else if (loopRatio >= 0.95) {
    score = 5;
  } else if (loopRatio >= 0.85) {
    score = 3;
  }

  if (lov <= 13 && loopRatio < 1.05) {
    score = Math.min(score, 4);
  }

  return { score, loopRatio };
};

const computeEngagementScore = (views: number, likes: number, comments: number, subs: number): number => {
  if (views <= 0) {
    return 0;
  }
  const hitLike = likes >= views / 300;
  const hitComment = comments >= views / 1500;
  const hitSub = subs >= views / 1000;
  const hits = Number(hitLike) + Number(hitComment) + Number(hitSub);
  const total = likes + comments + subs;

  if (hits === 3) {
    return 8;
  }
  if (hits === 2) {
    return 6;
  }
  if (hits === 1) {
    return 3;
  }
  if (total > 0) {
    return 1;
  }
  if (views >= 1000 && total === 0) {
    return 0;
  }
  return 0;
};

const computeSwipeScore = (
  isShort: boolean,
  impressions?: number,
  engagedViews?: number,
  ctr?: number
): { score: number; rate: number | null; source: string } => {
  let rate: number | null = null;
  let source = "none";
  if (isShort) {
    if (impressions && impressions > 0 && engagedViews !== undefined) {
      rate = clamp(engagedViews / impressions, 0, 1);
      source = "start_rate";
    }
  } else {
    rate = normalizeRate(ctr);
    if (rate !== null) {
      source = "ctr";
    }
  }

  if (rate === null) {
    return { score: 0, rate: null, source };
  }

  if (source === "ctr") {
    if (rate >= 0.09) {
      return { score: 25, rate, source };
    }
    if (rate >= 0.07) {
      return { score: 20, rate, source };
    }
    if (rate >= 0.055) {
      return { score: 15, rate, source };
    }
    if (rate >= 0.04) {
      return { score: 10, rate, source };
    }
    return { score: 0, rate, source };
  }

  if (rate >= 0.811) {
    return { score: 25, rate, source };
  }
  if (rate >= 0.78) {
    return { score: 20, rate, source };
  }
  if (rate >= 0.75) {
    return { score: 15, rate, source };
  }
  if (rate >= 0.73) {
    return { score: 10, rate, source };
  }
  if (rate < 0.72) {
    return { score: 0, rate, source };
  }
  return { score: 0, rate, source };
};

const getBestThumbnail = (thumbnails: YoutubeVideo["thumbnails"]): { width?: number; height?: number } => {
  if (!thumbnails || thumbnails.length === 0) {
    return {};
  }
  const sorted = [...thumbnails].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  return {
    width: sorted[0]?.width,
    height: sorted[0]?.height,
  };
};

const computeFormatScore = (video: YoutubeVideo): { score: number; isVertical: boolean; height?: number } => {
  const width = video.width ?? getBestThumbnail(video.thumbnails).width;
  const height = video.height ?? getBestThumbnail(video.thumbnails).height;
  const aspectRatio = width && height ? height / width : 0;
  const isVertical = aspectRatio >= 1.4;
  const hasResolution = (height ?? 0) >= 1080;
  const formatOk = isVertical && hasResolution;
  const creditsOk = true;
  let score = 0;
  if (formatOk && creditsOk) {
    score = 2;
  } else if (formatOk || creditsOk) {
    score = 1;
  }
  return { score, isVertical, height };
};

const computeWeight = (views: number, publishedAt: string, now: Date): number => {
  const publishedAtMs = new Date(publishedAt).getTime();
  const ageDays = Number.isFinite(publishedAtMs)
    ? Math.max(0, (now.getTime() - publishedAtMs) / DAY_MS)
    : 0;
  const viewWeight = Math.min(1, views / 10000);
  return viewWeight * Math.exp(-ageDays / 14);
};

const stopWords = new Set([
  "a",
  "an",
  "and",
  "the",
  "to",
  "of",
  "in",
  "for",
  "on",
  "with",
  "at",
  "by",
  "from",
  "is",
  "are",
  "was",
  "were",
  "be",
  "this",
  "that",
  "it",
  "as",
  "your",
  "my",
  "our",
  "you",
  "we",
  "i",
  "me",
  "they",
  "their",
  "his",
  "her",
  "about",
  "how",
  "what",
  "why",
  "when",
  "which",
  "new",
  "best",
  "top",
  "vs",
  "vs.",
  "episode",
  "part",
  "shorts",
  "video",
]);

const tokenize = (text: string): string[] => {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !stopWords.has(token));
};

const clusterNiche = (videos: VideoMetrics[]): number => {
  if (videos.length < 6) {
    return 0;
  }

  const clusters: Array<{ tokens: Set<string>; count: number }> = [];
  const threshold = 0.3;

  for (const video of videos) {
    const tokens = new Set(tokenize(video.title));
    if (tokens.size === 0) {
      continue;
    }
    let matched = false;
    for (const cluster of clusters) {
      const intersection = new Set(
        [...tokens].filter((token) => cluster.tokens.has(token))
      );
      const unionSize = new Set([...tokens, ...cluster.tokens]).size;
      const similarity = unionSize === 0 ? 0 : intersection.size / unionSize;
      if (similarity >= threshold) {
        cluster.count += 1;
        cluster.tokens = new Set([...cluster.tokens, ...tokens]);
        matched = true;
        break;
      }
    }
    if (!matched) {
      clusters.push({ tokens, count: 1 });
    }
  }

  if (clusters.length === 0) {
    return 0;
  }
  const maxCluster = Math.max(...clusters.map((cluster) => cluster.count));
  const pTop = maxCluster / videos.length;

  if (pTop >= 0.8) {
    return 3;
  }
  if (pTop >= 0.6) {
    return 2;
  }
  if (pTop >= 0.45) {
    return 1;
  }
  return 0;
};

const computeConsistencyScore = (
  uploads: YoutubePlaylistItem[],
  swipeAvg: number | null,
  retentionAvg: number | null
): number => {
  if (swipeAvg !== null && swipeAvg < 0.72) {
    return 0;
  }
  if (retentionAvg !== null && retentionAvg < 10) {
    return 0;
  }

  const today = new Date();
  const days = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(today.getTime() - (11 - index) * DAY_MS);
    return date.toISOString().slice(0, 10);
  });

  const uploadDates = new Set(
    uploads
      .map((item) => new Date(item.publishedAt).toISOString().slice(0, 10))
      .filter((date) => days.includes(date))
  );

  let daysWithUpload = 0;
  let maxGap = 0;
  let currentGap = 0;

  for (const day of days) {
    if (uploadDates.has(day)) {
      daysWithUpload += 1;
      currentGap = 0;
    } else {
      currentGap += 1;
      maxGap = Math.max(maxGap, currentGap);
    }
  }

  if (daysWithUpload >= 10 && maxGap <= 1) {
    return 6;
  }
  if (daysWithUpload >= 9) {
    return 4;
  }
  if (daysWithUpload >= 7) {
    return 2;
  }
  return 0;
};

const buildActionItems = (scores: Record<string, number>): ActionItem[] => {
  const items: ActionItem[] = [];

  if (scores.channelAge < 1) {
    items.push({
      title: "Warm up the channel",
      detail: "Publish and verify your channel to unlock baseline trust.",
      severity: "high",
    });
  }
  if (scores.featureEligibility < 1) {
    items.push({
      title: "Enable long uploads",
      detail: "Verify your phone and channel to unlock long uploads.",
      severity: "high",
    });
  }
  if (scores.channelTags < 1) {
    items.push({
      title: "Remove channel keywords",
      detail: "Empty channel tags to improve trust foundations.",
      severity: "medium",
    });
  }
  if (scores.channelDescription < 1) {
    items.push({
      title: "Write a fuller channel bio",
      detail: "Add a 20+ character description focused on your niche.",
      severity: "medium",
    });
  }
  if (scores.entertainmentCategory < 1) {
    items.push({
      title: "Stay consistent with Entertainment",
      detail: "Keep 80%+ of recent uploads in category 24.",
      severity: "medium",
    });
  }
  if (scores.enhancements < 1) {
    items.push({
      title: "Upgrade format fidelity",
      detail: "Post vertical 9:16 videos at 1080p or higher.",
      severity: "medium",
    });
  }
  if (scores.swipeScore < 15) {
    items.push({
      title: "Improve start rate",
      detail: "Sharpen the first second hook and thumbnail packaging.",
      severity: "high",
    });
  }
  if (scores.retentionScore < 20) {
    items.push({
      title: "Lift retention",
      detail: "Cut faster and match target average view duration.",
      severity: "high",
    });
  }
  if (scores.rewatchScore < 5) {
    items.push({
      title: "Encourage rewatch loops",
      detail: "Add reset points and cliffhangers for Shorts.",
      severity: "medium",
    });
  }
  if (scores.engagementScore < 6) {
    items.push({
      title: "Boost engagement signals",
      detail: "Ask for likes, comments, and subscriptions on-screen.",
      severity: "medium",
    });
  }
  if (scores.consistencyScore < 4) {
    items.push({
      title: "Ship more consistently",
      detail: "Aim for 9+ upload days in a 12-day window.",
      severity: "medium",
    });
  }
  if (scores.nicheScore < 2) {
    items.push({
      title: "Tighten niche clarity",
      detail: "Focus titles and topics around one clear theme.",
      severity: "low",
    });
  }
  if (scores.formattingScore < 1) {
    items.push({
      title: "Fix format and credits",
      detail: "Use 9:16 framing and credit reused material.",
      severity: "low",
    });
  }

  return items.slice(0, 6);
};

export const calculateTrustScore = ({
  channel,
  videos,
  uploads,
  windowStart,
  windowEnd,
  now,
}: {
  channel: YoutubeChannel;
  videos: VideoMetrics[];
  uploads: YoutubePlaylistItem[];
  windowStart: string;
  windowEnd: string;
  now: Date;
}): TrustScoreResult => {
  const videoScores: VideoScoreBreakdown[] = [];
  const weights: number[] = [];
  const shortsSwipeRates: number[] = [];
  const shortsSwipeWeights: number[] = [];
  const swipeScoreValues: number[] = [];
  const retentionScoreValues: number[] = [];
  const rewatchScoreValues: number[] = [];
  const engagementScoreValues: number[] = [];
  const formattingScoreValues: number[] = [];
  const enhancements: number[] = [];
  const categories = videos.map((video) => video.categoryId).filter(Boolean);

  videos.forEach((video) => {
    const views = video.views ?? 0;
    const weight = computeWeight(views, video.publishedAt, now);
    weights.push(weight);

    const isShort = video.durationSeconds > 0 && video.durationSeconds <= 60;
    const swipe = computeSwipeScore(
      isShort,
      video.impressions,
      video.engagedViews,
      video.impressionsClickThroughRate
    );

    if (swipe.rate !== null) {
      if (swipe.source === "start_rate") {
        shortsSwipeRates.push(swipe.rate);
        shortsSwipeWeights.push(weight);
      }
    }

    const retention = computeRetentionScore(
      video.durationSeconds,
      video.averageViewDuration
    );
    const rewatch = computeRewatchScore(
      video.durationSeconds,
      video.averageViewDuration
    );

    const engagement = computeEngagementScore(
      views,
      video.likes ?? 0,
      video.comments ?? 0,
      video.subscribersGained ?? 0
    );

    const format = computeFormatScore(video);
    enhancements.push(format.isVertical ? (format.height && format.height >= 1080 ? 1 : 0.5) : 0);

    const videoScore =
      swipe.score +
      retention.score +
      rewatch.score +
      engagement +
      format.score;

    swipeScoreValues.push(swipe.score);
    retentionScoreValues.push(retention.score);
    rewatchScoreValues.push(rewatch.score);
    engagementScoreValues.push(engagement);
    formattingScoreValues.push(format.score);

    videoScores.push({
      videoId: video.id,
      title: video.title,
      publishedAt: video.publishedAt,
      durationSeconds: video.durationSeconds,
      weight,
      views,
      scores: {
        swipe: swipe.score,
        retention: retention.score,
        rewatch: rewatch.score,
        engagement,
        formatting: format.score,
        total: videoScore,
      },
      metrics: {
        swipeRate: swipe.rate ?? undefined,
        swipeSource: swipe.source,
        ctr: isShort ? undefined : normalizeRate(video.impressionsClickThroughRate) ?? undefined,
        startRate: isShort && swipe.rate !== null ? swipe.rate : undefined,
        averageViewDuration: video.averageViewDuration,
        targetAvd: retention.target,
        loopRatio: rewatch.loopRatio,
      },
    });
  });

  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  const safeWeight = totalWeight > 0 ? totalWeight : videos.length || 1;
  const weightedAverage = (values: number[]): number => {
    if (values.length === 0) {
      return 0;
    }
    if (totalWeight === 0) {
      return values.reduce((sum, value) => sum + value, 0) / values.length;
    }
    return values.reduce((sum, value, index) => sum + value * (weights[index] ?? 0), 0) / safeWeight;
  };

  const shortsSwipeWeightSum = shortsSwipeWeights.reduce(
    (sum, value) => sum + value,
    0
  );
  const shortsSwipeAvg =
    shortsSwipeRates.length > 0
      ? shortsSwipeWeightSum > 0
        ? shortsSwipeRates.reduce(
            (sum, value, index) =>
              sum + value * (shortsSwipeWeights[index] ?? 0),
            0
          ) / shortsSwipeWeightSum
        : shortsSwipeRates.reduce((sum, value) => sum + value, 0) /
          shortsSwipeRates.length
      : null;
  const retentionAvg =
    retentionScoreValues.length > 0
      ? weightedAverage(retentionScoreValues)
      : null;

  const performanceScore = weightedAverage(
    videoScores.map((entry) => entry.scores.total)
  );

  const publishedAtMs = new Date(channel.publishedAt).getTime();
  const channelAgeDays = Number.isFinite(publishedAtMs)
    ? Math.max(0, (now.getTime() - publishedAtMs) / DAY_MS)
    : 0;
  const channelAgeScore = channelAgeDays >= 1 ? 1 : 0;
  const featureEligibilityMap: Record<string, number> = {
    allowed: 1,
    eligible: 0.66,
    disallowed: 0,
  };
  const featureEligibility =
    featureEligibilityMap[channel.longUploadsStatus ?? ""] ?? 0;
  const channelTags =
    channel.keywords && channel.keywords.trim().length > 0 ? 0 : 1;
  const channelDescription = channel.description?.trim().length >= 20 ? 1 : 0;
  const entertainmentShare =
    categories.length === 0
      ? 0
      : categories.filter((id) => id === "24").length / categories.length;
  const entertainmentCategory = entertainmentShare >= 0.8 ? 1 : 0;
  const enhancementsScore =
    enhancements.length > 0 ? weightedAverage(enhancements) : 0;

  const accountScore =
    channelAgeScore +
    featureEligibility +
    channelTags +
    channelDescription +
    entertainmentCategory +
    enhancementsScore;

  const consistencyScore = computeConsistencyScore(
    uploads,
    shortsSwipeAvg,
    retentionAvg
  );
  const nicheScore = clusterNiche(videos);

  const rawScore = accountScore + performanceScore + consistencyScore + nicheScore;
  const finalScore =
    shortsSwipeAvg !== null && shortsSwipeAvg < 0.72
      ? Math.min(rawScore, 50)
      : rawScore;

  const components = {
    channelAge: channelAgeScore,
    featureEligibility,
    channelTags,
    channelDescription,
    entertainmentCategory,
    enhancements: enhancementsScore,
    swipeScore: weightedAverage(swipeScoreValues),
    retentionScore: weightedAverage(retentionScoreValues),
    rewatchScore: weightedAverage(rewatchScoreValues),
    engagementScore: weightedAverage(engagementScoreValues),
    formattingScore: weightedAverage(formattingScoreValues),
    consistencyScore,
    nicheScore,
  };

  const actionItems = buildActionItems(components);

  return {
    score: Math.round(finalScore),
    scoreRaw: Number(finalScore.toFixed(2)),
    accountScore: Number(accountScore.toFixed(2)),
    performanceScore: Number(performanceScore.toFixed(2)),
    consistencyScore,
    nicheScore,
    swipeAvg: shortsSwipeAvg !== null ? Number(shortsSwipeAvg.toFixed(4)) : null,
    retentionAvg: retentionAvg !== null ? Number(retentionAvg.toFixed(2)) : null,
    windowStart,
    windowEnd,
    videoCount: videos.length,
    actionItems,
    components,
    videoBreakdown: videoScores,
  };
};
