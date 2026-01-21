import type { YoutubeChannel, YoutubePlaylistItem, YoutubeVideo } from "@/lib/youtube/api";

type VideoMetrics = YoutubeVideo & {
  views: number;
  analyticsViews?: number;
  likes: number;
  comments: number;
  subscribersGained: number;
  averageViewDuration: number;
  averageViewPercentage?: number;
  impressions?: number;
  impressionsClickThroughRate?: number;
  engagedViews?: number;
  shortsFeedViews?: number;
  shortsFeedEngagedViews?: number;
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
  flags: {
    hasAnalyticsData: boolean;
    hasSwipeData: boolean;
    lowConfidence: boolean;
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
  dataConfidence: "high" | "medium" | "low" | "insufficient";
};

type NicheDistribution = {
  values: Record<string, number>;
  total: number;
};

export type NicheSignals = {
  placement?: {
    previous: NicheDistribution;
    current: NicheDistribution;
  };
  audience?: {
    previous: NicheDistribution;
    current: NicheDistribution;
  };
};

const DAY_MS = 24 * 60 * 60 * 1000;

// Minimum thresholds for reliable scoring
const MIN_VIEWS_FOR_VIDEO_SCORE = 100;
const MIN_VIDEOS_WITH_ANALYTICS = 3;
const MIN_VIDEOS_FOR_PERFORMANCE = 5;
const MIN_NICHE_VIDEOS = 6;
const MIN_NICHE_DISTRIBUTION_VIEWS = 100;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const normalizeRate = (value?: number): number | null => {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return null;
  }
  // YouTube Analytics returns CTR as percentage (e.g., 5.0 = 5%)
  if (value > 1.5) {
    return value / 100;
  }
  return value;
};

const roundToHalf = (value: number): number => {
  return Math.round(value * 2) / 2;
};

/**
 * Target AVD ratio based on video length (LOV)
 * These ratios reflect YouTube's expectations for Shorts retention
 * Shorter videos MUST loop to perform well
 */
const getTargetRatio = (lov: number): number => {
  if (lov <= 7) {
    return 1.43; // 7s video needs 10s AVD (1.43x watch)
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
  // Long-form: lower expectations but still need good retention
  if (lov <= 180) {
    return 0.783 + ((0.5 - 0.783) * (lov - 60)) / (180 - 60);
  }
  return 0.4; // 3+ min videos: 40% retention is solid
};

/**
 * Retention scoring - the most important metric for YouTube algorithm
 * Based on how close AVD is to target AVD
 */
const computeRetentionScore = (lov: number, avd: number): { score: number; target: number } => {
  if (lov <= 0) {
    return { score: 0, target: 0 };
  }

  // If no AVD data, return 0 (don't assume anything)
  if (avd <= 0) {
    return { score: 0, target: roundToHalf(getTargetRatio(lov) * lov) };
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

  // If AVD >= LOV but still under target, give partial credit
  // This means viewer watched the whole video but didn't loop enough
  if (avd >= lov) {
    return { score: 5, target };
  }

  // AVD < LOV and delta > 3: viewer dropped off early
  return { score: 0, target };
};

/**
 * Rewatch/Loop scoring - critical for Shorts success
 * Short videos MUST loop to get algorithmic push
 */
const computeRewatchScore = (lov: number, avd: number): { score: number; loopRatio: number } => {
  if (lov <= 0 || avd <= 0) {
    return { score: 0, loopRatio: 0 };
  }

  const loopRatio = avd / lov;
  let score = 0;

  if (loopRatio >= 1.25) {
    score = 10; // Excellent looping
  } else if (loopRatio >= 1.1) {
    score = 8; // Good looping
  } else if (loopRatio >= 0.95) {
    score = 5; // Near full watch
  } else if (loopRatio >= 0.85) {
    score = 3; // Decent watch time
  } else if (loopRatio >= 0.7) {
    score = 1; // Minimal credit for 70%+ watch
  }

  // CRITICAL: Short videos (under 13s) MUST loop to succeed on YouTube
  // If they're not looping, severely penalize
  if (lov <= 13 && loopRatio < 1.05) {
    score = Math.min(score, 2); // Cap at 2 if not looping
  }

  // Videos under 8s with no loop are essentially failures
  if (lov <= 8 && loopRatio < 1.15) {
    score = Math.min(score, 1);
  }

  return { score, loopRatio };
};

/**
 * Engagement scoring - likes, comments, and subscriber gain
 * These are secondary signals but still matter
 */
const computeEngagementScore = (
  views: number,
  likes: number,
  comments: number,
  subs: number
): number => {
  if (views <= 0) {
    return 0;
  }

  // Targets based on YouTube benchmarks
  // These are minimum thresholds for "good" engagement
  const likeTarget = views / 300;      // 0.33% like rate
  const commentTarget = views / 1500;  // 0.067% comment rate
  const subTarget = views / 1000;      // 0.1% sub rate

  const hitLike = likes >= likeTarget;
  const hitComment = comments >= commentTarget;
  const hitSub = subs >= subTarget;
  const hits = Number(hitLike) + Number(hitComment) + Number(hitSub);
  const totalEngagement = likes + comments + subs;

  if (hits === 3) {
    return 8; // All targets hit
  }
  if (hits === 2) {
    return 6;
  }
  if (hits === 1) {
    return 3;
  }

  // Some engagement but no targets hit
  if (totalEngagement > 0) {
    // Scale based on how close to targets
    const likeRatio = Math.min(1, likes / likeTarget);
    const commentRatio = Math.min(1, comments / commentTarget);
    const subRatio = Math.min(1, subs / subTarget);
    const avgRatio = (likeRatio + commentRatio + subRatio) / 3;

    if (avgRatio >= 0.5) {
      return 2; // Halfway to targets
    }
    return 1; // Some engagement
  }

  // Zero engagement on a video with views is a bad sign
  if (views >= 1000 && totalEngagement === 0) {
    return 0;
  }

  return 0;
};

/**
 * Swipe/Start Rate scoring for Shorts
 * CTR scoring for long-form
 * This is the "first impression" metric
 */
const computeSwipeScore = (
  isShort: boolean,
  shortsViews?: number,
  shortsEngagedViews?: number,
  ctr?: number,
  analyticsViews?: number,
  analyticsEngagedViews?: number
): { score: number; rate: number | null; source: string } => {
  let rate: number | null = null;
  let source = "none";

  if (isShort) {
    // For Shorts: use engaged views / views from the Shorts feed
    // This represents viewers who stayed to watch vs swiped away
    if (shortsViews && shortsViews > 0 && shortsEngagedViews !== undefined) {
      rate = clamp(shortsEngagedViews / shortsViews, 0, 1);
      source = "shorts_feed";
    } else if (analyticsViews && analyticsViews > 0 && analyticsEngagedViews !== undefined) {
      // Fallback to overall Shorts engaged views when feed-only data is missing.
      rate = clamp(analyticsEngagedViews / analyticsViews, 0, 1);
      source = "shorts_overall";
    }
  } else {
    // For long-form: use click-through rate
    rate = normalizeRate(ctr);
    if (rate !== null) {
      source = "ctr";
    }
  }

  if (rate === null) {
    return { score: 0, rate: null, source };
  }

  // CTR thresholds for long-form (different scale than swipe)
  if (source === "ctr") {
    if (rate >= 0.10) {
      return { score: 25, rate, source }; // 10%+ CTR is exceptional
    }
    if (rate >= 0.08) {
      return { score: 20, rate, source }; // 8%+ is great
    }
    if (rate >= 0.06) {
      return { score: 15, rate, source }; // 6%+ is good
    }
    if (rate >= 0.045) {
      return { score: 10, rate, source }; // 4.5%+ is average
    }
    if (rate >= 0.03) {
      return { score: 5, rate, source }; // 3%+ is below average
    }
    return { score: 0, rate, source }; // Below 3% is poor
  }

  // Swipe/Stay rate thresholds for Shorts
  // These are based on the "viewed vs swiped away" ratio
  if (rate >= 0.811) {
    return { score: 25, rate, source }; // Top tier
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
  // FIX: Fill the gap between 0.72 and 0.73
  if (rate >= 0.72) {
    return { score: 5, rate, source }; // Borderline acceptable
  }
  // Below 0.72 is failing - most viewers swipe away
  return { score: 0, rate, source };
};

/**
 * Detect if content appears to be reused/reposted
 * Used to determine if credits are required
 */
const REUSED_CONTENT_PATTERNS = [
  /\b(compilation|best\s+of|clips?\s+from|highlights?)\b/i,
  /\b(not\s+my|no\s+copyright|don'?t\s+own|all\s+rights)\b/i,
  /\b(credit\s+to|original\s+by|source|via)\b/i,
  /\b(repost|reupload|re-?upload)\b/i,
];

const CREDIT_PATTERNS = [
  /(?:credit|source|via|from|by)[\s:]+@?\w+/i,
  /@[a-zA-Z0-9_]{2,}/,  // @mentions
  /(?:original|creator|channel)[\s:]+.+/i,
  /(?:check\s+out|follow|subscribe\s+to)[\s:]+@?\w+/i,
  /https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be|tiktok\.com|instagram\.com)/i,
];

const detectReusedContent = (video: YoutubeVideo): boolean => {
  const text = `${video.title} ${video.description}`.toLowerCase();
  return REUSED_CONTENT_PATTERNS.some(pattern => pattern.test(text));
};

const hasCredits = (description: string): boolean => {
  if (!description || description.trim().length < 5) {
    return false;
  }
  return CREDIT_PATTERNS.some(pattern => pattern.test(description));
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

/**
 * Formatting score - vertical aspect ratio and proper crediting
 * FIX: Actually check for credits when content appears reused
 */
const computeFormatScore = (video: YoutubeVideo): { score: number; isVertical: boolean; height?: number } => {
  const width = video.width ?? getBestThumbnail(video.thumbnails).width;
  const height = video.height ?? getBestThumbnail(video.thumbnails).height;
  const aspectRatio = width && height ? height / width : 0;

  // Vertical = aspect ratio >= 1.4 (roughly 9:16 or taller)
  const isVertical = aspectRatio >= 1.4;
  const hasHighRes = (height ?? 0) >= 1080;
  const formatOk = isVertical && hasHighRes;

  // FIX: Actually check credits when content appears to be reused
  const isReused = detectReusedContent(video);
  const creditsOk = isReused ? hasCredits(video.description) : true;

  let score = 0;
  if (formatOk && creditsOk) {
    score = 2;
  } else if (formatOk || creditsOk) {
    score = 1;
  } else {
    score = 0;
  }

  return { score, isVertical, height };
};

/**
 * Video weight calculation for weighted averages
 * Recent videos with more views get higher weight
 */
const computeWeight = (views: number, publishedAt: string, now: Date): number => {
  const publishedAtMs = new Date(publishedAt).getTime();
  const ageDays = Number.isFinite(publishedAtMs)
    ? Math.max(0, (now.getTime() - publishedAtMs) / DAY_MS)
    : 0;

  // View weight: scale from 0 to 1, maxing at 10k views
  // Videos under 100 views get heavily penalized
  const viewWeight = views < MIN_VIEWS_FOR_VIDEO_SCORE
    ? Math.max(0.05, views / MIN_VIEWS_FOR_VIDEO_SCORE * 0.2) // Max 0.2 weight for low-view videos
    : Math.min(1, views / 10000);

  // Time decay: exponential decay over 14 days
  // Older videos matter less
  return viewWeight * Math.exp(-ageDays / 14);
};

const stopWords = new Set([
  "a", "an", "and", "the", "to", "of", "in", "for", "on", "with", "at", "by",
  "from", "is", "are", "was", "were", "be", "this", "that", "it", "as",
  "your", "my", "our", "you", "we", "i", "me", "they", "their", "his", "her",
  "about", "how", "what", "why", "when", "which", "new", "best", "top",
  "vs", "vs.", "episode", "part", "shorts", "video", "watch", "see", "look",
  "get", "got", "like", "just", "now", "today", "day", "time", "way",
  "make", "made", "first", "last", "more", "most", "very", "really",
  "can", "will", "would", "could", "should", "must", "may", "might",
  "one", "two", "three", "1", "2", "3", "pt", "ep",
]);

const tokenize = (text: string): string[] => {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !stopWords.has(token));
};

const extractTopicTokens = (topics?: string[]): string[] => {
  if (!topics || topics.length === 0) {
    return [];
  }
  return topics
    .map((topic) => {
      const lastSegment = topic.split("/").pop() ?? "";
      return lastSegment.replace(/_/g, " ");
    })
    .filter(Boolean);
};

const buildContentTokens = (video: VideoMetrics): Set<string> => {
  const topicText = extractTopicTokens(video.topicCategories).join(" ");
  const tagsText = (video.tags ?? []).join(" ");
  const combined = [video.title, video.description, tagsText, topicText]
    .filter(Boolean)
    .join(" ");
  return new Set(tokenize(combined));
};

const computeContentCoherence = (videos: VideoMetrics[]): number | null => {
  const shorts = videos.filter(
    (video) => video.durationSeconds > 0 && video.durationSeconds <= 60
  );
  const sample = shorts.length >= MIN_NICHE_VIDEOS ? shorts : videos;
  if (sample.length < MIN_NICHE_VIDEOS) {
    return null;
  }

  const clusters: Array<{ tokens: Set<string>; count: number }> = [];
  const threshold = 0.3;
  let usableVideos = 0;

  for (const video of sample) {
    const tokens = buildContentTokens(video);
    if (tokens.size === 0) {
      continue;
    }
    usableVideos += 1;

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

  if (clusters.length === 0 || usableVideos < MIN_NICHE_VIDEOS) {
    return null;
  }

  const maxCluster = Math.max(...clusters.map((cluster) => cluster.count));
  const pTop = maxCluster / usableVideos;
  return clamp((pTop - 0.45) / (0.8 - 0.45), 0, 1);
};

const computeJSDivergence = (
  current: Record<string, number>,
  previous: Record<string, number>
): number | null => {
  const keys = new Set([...Object.keys(current), ...Object.keys(previous)]);
  if (keys.size === 0) {
    return null;
  }

  const currentTotal = Object.values(current).reduce((sum, value) => sum + value, 0);
  const previousTotal = Object.values(previous).reduce((sum, value) => sum + value, 0);
  if (currentTotal <= 0 || previousTotal <= 0) {
    return null;
  }

  let divergence = 0;
  keys.forEach((key) => {
    const p = (current[key] ?? 0) / currentTotal;
    const q = (previous[key] ?? 0) / previousTotal;
    const m = (p + q) / 2;

    if (p > 0) {
      divergence += p * Math.log(p / m);
    }
    if (q > 0) {
      divergence += q * Math.log(q / m);
    }
  });

  divergence = 0.5 * divergence;
  const normalized = divergence / Math.log(2);
  return clamp(normalized, 0, 1);
};

const computeDistributionStability = (
  pair?: {
    previous: NicheDistribution;
    current: NicheDistribution;
  }
): number | null => {
  if (!pair) {
    return null;
  }
  if (
    pair.previous.total < MIN_NICHE_DISTRIBUTION_VIEWS ||
    pair.current.total < MIN_NICHE_DISTRIBUTION_VIEWS
  ) {
    return null;
  }
  const jsd = computeJSDivergence(pair.current.values, pair.previous.values);
  if (jsd === null) {
    return null;
  }
  return clamp(1 - jsd, 0, 1);
};

const computeNicheScore = (videos: VideoMetrics[], signals?: NicheSignals): number => {
  const contentCoherence = computeContentCoherence(videos);
  const placementStability = computeDistributionStability(signals?.placement);
  const audienceStability = computeDistributionStability(signals?.audience);

  const weightedSignals = [
    { value: contentCoherence, weight: 0.5 },
    { value: placementStability, weight: 0.3 },
    { value: audienceStability, weight: 0.2 },
  ].filter((entry) => entry.value !== null && entry.value !== undefined);

  // If all signals are missing, treat niche clarity as unavailable.
  if (weightedSignals.length === 0) {
    return 0;
  }

  const totalWeight = weightedSignals.reduce((sum, entry) => sum + entry.weight, 0);
  const nicheIndex =
    weightedSignals.reduce(
      (sum, entry) => sum + (entry.value ?? 0) * entry.weight,
      0
    ) / totalWeight;

  if (nicheIndex >= 0.75) {
    return 3;
  }
  if (nicheIndex >= 0.55) {
    return 2;
  }
  if (nicheIndex >= 0.4) {
    return 1;
  }
  return 0;
};

/**
 * Niche clarity scoring - blends content, placement, and audience consistency.
 */
const clusterNiche = (videos: VideoMetrics[], signals?: NicheSignals): number => {
  return computeNicheScore(videos, signals);
};

/**
 * Consistency score - measures upload frequency
 * FIX: Stricter gates when swipe data is missing
 */
const computeConsistencyScore = (
  uploads: YoutubePlaylistItem[],
  swipeAvg: number | null,
  retentionAvg: number | null,
  hasEnoughAnalyticsData: boolean
): number => {
  // GATE 1: If we don't have enough analytics data, consistency shouldn't boost score
  // This prevents gaming by just uploading frequently with no quality
  if (!hasEnoughAnalyticsData) {
    return 0;
  }

  // GATE 2: Hard swipe fail = no consistency points
  if (swipeAvg !== null && swipeAvg < 0.72) {
    return 0;
  }

  // GATE 3: Hard retention fail = no consistency points
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

  let score = 0;
  if (daysWithUpload >= 10 && maxGap <= 1) {
    score = 6;
  } else if (daysWithUpload >= 9) {
    score = 4;
  } else if (daysWithUpload >= 7) {
    score = 2;
  }

  // FIX: If we have no swipe data at all, cap consistency at 2
  // Consistency alone shouldn't carry the score
  if (swipeAvg === null && score > 2) {
    score = 2;
  }

  return score;
};

/**
 * Generate actionable items based on score components
 */
const buildActionItems = (
  scores: Record<string, number>,
  dataConfidence: string
): ActionItem[] => {
  const items: ActionItem[] = [];

  // Data confidence warning first
  if (dataConfidence === "insufficient" || dataConfidence === "low") {
    items.push({
      title: "Get more data",
      detail: "Your channel needs more views and videos for accurate scoring. Keep posting consistently.",
      severity: "high",
    });
  }

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

  // Swipe/CTR is critical - highest priority
  if (scores.swipeScore < 15) {
    items.push({
      title: "Fix your hook",
      detail: "The first 1-2 seconds determine if viewers stay or swipe. Start with motion, conflict, or curiosity.",
      severity: "high",
    });
  }

  // Retention is the #1 algorithm signal
  if (scores.retentionScore < 20) {
    items.push({
      title: "Lift retention",
      detail: "Cut faster, remove dead air, and match the target average view duration for your video length.",
      severity: "high",
    });
  }

  if (scores.rewatchScore < 5) {
    items.push({
      title: "Encourage loops",
      detail: "For Shorts under 15s, viewers must rewatch. Add a payoff that leads back to the start.",
      severity: "high",
    });
  }

  if (scores.channelTags < 1) {
    items.push({
      title: "Remove channel keywords",
      detail: "Empty channel tags signal a cleaner, more trustworthy channel.",
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
      detail: "Keep 80%+ of recent uploads in category 24 (Entertainment).",
      severity: "medium",
    });
  }

  if (scores.enhancements < 1) {
    items.push({
      title: "Upgrade format fidelity",
      detail: "Post vertical 9:16 videos at 1080p or higher resolution.",
      severity: "medium",
    });
  }

  if (scores.engagementScore < 6) {
    items.push({
      title: "Boost engagement signals",
      detail: "Ask for likes, comments, and subscriptions in-video. Use pinned comments.",
      severity: "medium",
    });
  }

  if (scores.consistencyScore < 4) {
    items.push({
      title: "Ship more consistently",
      detail: "Aim for 9+ upload days in a 12-day window. The algorithm rewards daily creators.",
      severity: "medium",
    });
  }

  if (scores.nicheScore < 2) {
    items.push({
      title: "Tighten niche clarity",
      detail: "Focus titles and topics around one clear theme. Mixed content confuses the algorithm.",
      severity: "low",
    });
  }

  if (scores.formattingScore < 1) {
    items.push({
      title: "Fix format and credits",
      detail: "Use 9:16 vertical framing and credit any reused content properly.",
      severity: "low",
    });
  }

  return items.slice(0, 6);
};

/**
 * Determine data confidence level based on analytics coverage
 */
const calculateDataConfidence = (
  videos: VideoMetrics[],
  videosWithAnalytics: number,
  videosWithSwipeData: number
): "high" | "medium" | "low" | "insufficient" => {
  if (videos.length < MIN_VIDEOS_FOR_PERFORMANCE) {
    return "insufficient";
  }

  const analyticsRatio = videosWithAnalytics / videos.length;
  const swipeRatio = videosWithSwipeData / videos.length;

  if (analyticsRatio >= 0.8 && swipeRatio >= 0.5) {
    return "high";
  }
  if (analyticsRatio >= 0.5 && swipeRatio >= 0.3) {
    return "medium";
  }
  if (analyticsRatio >= 0.3) {
    return "low";
  }
  return "insufficient";
};

/**
 * Main trust score calculation
 */
export const calculateTrustScore = ({
  channel,
  videos,
  uploads,
  windowStart,
  windowEnd,
  now,
  nicheSignals,
}: {
  channel: YoutubeChannel;
  videos: VideoMetrics[];
  uploads: YoutubePlaylistItem[];
  windowStart: string;
  windowEnd: string;
  now: Date;
  nicheSignals?: NicheSignals;
}): TrustScoreResult => {
  const videoScores: VideoScoreBreakdown[] = [];
  const weights: number[] = [];
  const shortsSwipeFeedRates: number[] = [];
  const shortsSwipeFeedWeights: number[] = [];
  const shortsSwipeFallbackRates: number[] = [];
  const shortsSwipeFallbackWeights: number[] = [];
  const swipeScoreValues: number[] = [];
  const retentionScoreValues: number[] = [];
  const rewatchScoreValues: number[] = [];
  const engagementScoreValues: number[] = [];
  const formattingScoreValues: number[] = [];
  const enhancements: number[] = [];
  const categories = videos.map((video) => video.categoryId).filter(Boolean);

  // Track data availability
  let videosWithAnalytics = 0;
  let videosWithSwipeData = 0;

  videos.forEach((video) => {
    const views = video.views ?? 0;
    const weight = computeWeight(views, video.publishedAt, now);
    weights.push(weight);

    const isShort = video.durationSeconds > 0 && video.durationSeconds <= 60;
    const hasAnalytics = video.averageViewDuration > 0;
    const hasSwipe = isShort
      ? (((video.shortsFeedViews ?? 0) > 0 &&
        video.shortsFeedEngagedViews !== undefined) ||
        ((video.analyticsViews ?? 0) > 0 && video.engagedViews !== undefined))
      : normalizeRate(video.impressionsClickThroughRate) !== null;

    if (hasAnalytics) {
      videosWithAnalytics += 1;
    }
    if (hasSwipe) {
      videosWithSwipeData += 1;
    }

    const swipe = computeSwipeScore(
      isShort,
      video.shortsFeedViews,
      video.shortsFeedEngagedViews,
      video.impressionsClickThroughRate,
      video.analyticsViews,
      video.engagedViews
    );

    if (swipe.rate !== null && swipe.source === "shorts_feed") {
      shortsSwipeFeedRates.push(swipe.rate);
      shortsSwipeFeedWeights.push(weight);
    } else if (swipe.rate !== null && swipe.source === "shorts_overall") {
      shortsSwipeFallbackRates.push(swipe.rate);
      shortsSwipeFallbackWeights.push(weight);
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
      flags: {
        hasAnalyticsData: hasAnalytics,
        hasSwipeData: hasSwipe,
        lowConfidence: views < MIN_VIEWS_FOR_VIDEO_SCORE,
      },
    });
  });

  // Calculate data confidence
  const dataConfidence = calculateDataConfidence(
    videos,
    videosWithAnalytics,
    videosWithSwipeData
  );

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

  // Calculate shorts swipe average
  const computeWeightedSwipeAvg = (rates: number[], rateWeights: number[]): number | null => {
    if (rates.length === 0) {
      return null;
    }
    const weightSum = rateWeights.reduce((sum, value) => sum + value, 0);
    if (weightSum > 0) {
      return rates.reduce(
        (sum, value, index) => sum + value * (rateWeights[index] ?? 0),
        0
      ) / weightSum;
    }
    return rates.reduce((sum, value) => sum + value, 0) / rates.length;
  };

  const shortsSwipeFeedAvg = computeWeightedSwipeAvg(
    shortsSwipeFeedRates,
    shortsSwipeFeedWeights
  );
  const shortsSwipeAvg =
    shortsSwipeFeedAvg ??
    computeWeightedSwipeAvg(shortsSwipeFallbackRates, shortsSwipeFallbackWeights);

  const retentionAvg =
    retentionScoreValues.length > 0
      ? weightedAverage(retentionScoreValues)
      : null;

  // Calculate performance score
  let performanceScore = weightedAverage(videoScores.map((entry) => entry.scores.total));

  // Apply penalty for insufficient data
  if (dataConfidence === "insufficient") {
    performanceScore = performanceScore * 0.5; // 50% penalty
  } else if (dataConfidence === "low") {
    performanceScore = performanceScore * 0.75; // 25% penalty
  }

  // Account score components
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
  const featureEligibility = featureEligibilityMap[channel.longUploadsStatus ?? ""] ?? 0;

  const channelTags = channel.keywords && channel.keywords.trim().length > 0 ? 0 : 1;
  const channelDescription = (channel.description?.trim().length ?? 0) >= 20 ? 1 : 0;

  const entertainmentShare =
    categories.length === 0
      ? 0
      : categories.filter((id) => id === "24").length / categories.length;
  const entertainmentCategory = entertainmentShare >= 0.8 ? 1 : 0;

  const enhancementsScore = enhancements.length > 0 ? weightedAverage(enhancements) : 0;

  const accountScore =
    channelAgeScore +
    featureEligibility +
    channelTags +
    channelDescription +
    entertainmentCategory +
    enhancementsScore;

  // Consistency score with stricter gates
  // Use shortsSwipeAvg (combined feed + fallback) so consistency is gated by ANY available swipe data
  const hasEnoughAnalyticsData = videosWithAnalytics >= MIN_VIDEOS_WITH_ANALYTICS;
  const consistencyScore = computeConsistencyScore(
    uploads,
    shortsSwipeAvg,
    retentionAvg,
    hasEnoughAnalyticsData
  );

  const nicheScore = clusterNiche(videos, nicheSignals);

  // Calculate raw score
  const rawScore = accountScore + performanceScore + consistencyScore + nicheScore;

  // Apply hard cap if swipe rate is failing (use combined swipe avg for consistency)
  let finalScore = rawScore;
  if (shortsSwipeAvg !== null && shortsSwipeAvg < 0.72) {
    finalScore = Math.min(rawScore, 50);
  }

  // Additional cap for insufficient data
  if (dataConfidence === "insufficient") {
    finalScore = Math.min(finalScore, 40);
  }

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

  const actionItems = buildActionItems(components, dataConfidence);

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
    dataConfidence,
  };
};
