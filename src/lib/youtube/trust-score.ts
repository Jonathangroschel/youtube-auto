import type { YoutubeChannel, YoutubePlaylistItem, YoutubeVideo, ChannelMetrics } from "@/lib/youtube/api";

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
  severity: "high" | "medium" | "low" | "positive";
  category?: string;
};

type VideoScoreBreakdown = {
  videoId: string;
  title: string;
  publishedAt: string;
  durationSeconds: number;
  weight: number;
  views: number;
  scores: {
    engagedView: number;
    retention: number;
    rewatch: number;
    engagement: number;
    formatting: number;
    total: number;
  };
  metrics: {
    engagedViewRate?: number;
    engagedViewSource?: string;
    ctr?: number;
    startRate?: number;
    averageViewDuration: number;
    targetAvd: number;
    loopRatio: number;
  };
  flags: {
    hasAnalyticsData: boolean;
    hasEngagedViewData: boolean;
    lowConfidence: boolean;
  };
};

export type TrustScoreResult = {
  score: number;
  scoreRaw: number;
  accountScore: number;
  performanceScore: number;
  consistencyScore: number;
  engagedViewAvg: number | null;
  shareRate: number | null;
  retentionAvg: number | null;
  windowStart: string;
  windowEnd: string;
  videoCount: number;
  actionItems: ActionItem[];
  components: Record<string, number>;
  videoBreakdown: VideoScoreBreakdown[];
  dataConfidence: "high" | "medium" | "low" | "insufficient";
};

const DAY_MS = 24 * 60 * 60 * 1000;

// Minimum thresholds for reliable scoring
const MIN_VIEWS_FOR_VIDEO_SCORE = 100;
const MIN_VIDEOS_WITH_ANALYTICS = 3;
const MIN_VIDEOS_FOR_PERFORMANCE = 5;

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
 * Share Rate scoring - how often viewers share content
 * High share rate signals highly valuable, recommendation-worthy content
 * Max score: 7 points
 * 
 * Note: Shares are rare - typical rates are 0.01% to 0.1%
 * Shorts tend to have lower share rates than long-form content
 */
const computeShareRateScore = (
  totalViews: number,
  totalShares: number
): { score: number; rate: number } => {
  if (totalViews <= 0) {
    return { score: 0, rate: 0 };
  }

  const rate = totalShares / totalViews;

  // Thresholds calibrated for realistic share rates (shares are rare)
  if (rate >= 0.003) {
    return { score: 7, rate };  // 0.3%+ Exceptional
  }
  if (rate >= 0.002) {
    return { score: 6, rate };  // 0.2%+ Excellent
  }
  if (rate >= 0.001) {
    return { score: 5, rate };  // 0.1%+ Great
  }
  if (rate >= 0.0005) {
    return { score: 4, rate };  // 0.05%+ Good
  }
  if (rate >= 0.0003) {
    return { score: 3, rate };  // 0.03%+ Above average
  }
  if (rate >= 0.0002) {
    return { score: 2, rate };  // 0.02%+ Average
  }
  if (rate >= 0.0001) {
    return { score: 1, rate };  // 0.01%+ Below average
  }
  return { score: 0, rate };    // <0.01% Needs work
};


/**
 * Engaged View Rate scoring for Shorts
 * CTR scoring for long-form
 * This measures the percentage of viewers who watched past the first few seconds
 * Based on YouTube's official engagedViews metric
 */
const computeEngagedViewScore = (
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
    // This represents viewers who watched past the initial seconds
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

  // CTR thresholds for long-form (different scale)
  if (source === "ctr") {
    if (rate >= 0.10) {
      return { score: 21, rate, source }; // 10%+ CTR is exceptional
    }
    if (rate >= 0.08) {
      return { score: 16, rate, source }; // 8%+ is great
    }
    if (rate >= 0.06) {
      return { score: 12, rate, source }; // 6%+ is good
    }
    if (rate >= 0.045) {
      return { score: 8, rate, source }; // 4.5%+ is average
    }
    if (rate >= 0.03) {
      return { score: 4, rate, source }; // 3%+ is below average
    }
    return { score: 0, rate, source }; // Below 3% is poor
  }

  // Engaged View Rate thresholds for Shorts
  // Based on engagedViews/views ratio - percentage who watched past the hook
  if (rate >= 0.85) {
    return { score: 21, rate, source }; // Excellent - 85%+ watched past hook
  }
  if (rate >= 0.75) {
    return { score: 15, rate, source }; // Good - 75%+ watched past hook
  }
  if (rate >= 0.65) {
    return { score: 8, rate, source };  // Average - 65%+ watched past hook
  }
  if (rate >= 0.55) {
    return { score: 4, rate, source };  // Below average - 55%+ watched past hook
  }
  // Below 55% is failing - most viewers leave before hook
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

/**
 * Consistency score - measures upload frequency with progressive tiers
 * Uses soft gates instead of hard zeros to allow new creators to see progress
 */
const computeConsistencyScore = (
  uploads: YoutubePlaylistItem[],
  engagedViewAvg: number | null,
  retentionAvg: number | null,
  hasEnoughAnalyticsData: boolean
): number => {
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

  const daysWithUpload = uploadDates.size;

  // Calculate max gap between uploads
  let maxGap = 0;
  let currentGap = 0;
  for (const day of days) {
    if (uploadDates.has(day)) {
      currentGap = 0;
    } else {
      currentGap += 1;
      maxGap = Math.max(maxGap, currentGap);
    }
  }

  // Progressive base score
  let score = 0;
  if (daysWithUpload >= 10) {
    score = 6;        // Near-daily
  } else if (daysWithUpload >= 7) {
    score = 5;        // Very active
  } else if (daysWithUpload >= 5) {
    score = 4;        // Active
  } else if (daysWithUpload >= 4) {
    score = 3;        // Regular (~2.3/week)
  } else if (daysWithUpload >= 3) {
    score = 2;        // Consistent (~1.75/week)
  } else if (daysWithUpload >= 2) {
    score = 1;        // Light (~1/week)
  } else if (daysWithUpload >= 1) {
    score = 0.5;      // Sporadic
  }

  // Gap penalty: Large gaps hurt consistency
  if (maxGap >= 5) {
    score = score * 0.5;  // 50% penalty for 5+ day gaps
  } else if (maxGap >= 4) {
    score = score * 0.75; // 25% penalty for 4 day gaps
  }

  // SOFT GATES (instead of hard zero)
  // If analytics data is insufficient, reduce by 50%
  if (!hasEnoughAnalyticsData) {
    score = score * 0.5;
  }

  // If engaged view rate is failing (<55%), reduce by 50% (not zero)
  if (engagedViewAvg !== null && engagedViewAvg < 0.55) {
    score = score * 0.5;
  }

  // If retention is very poor, reduce by 50%
  if (retentionAvg !== null && retentionAvg < 5) {
    score = score * 0.5;
  }

  return Math.round(score * 10) / 10; // Round to 1 decimal
};

/**
 * Generate actionable items based on score components
 * Designed to give specific, plain-English advice that new Shorts creators can immediately use
 */
const buildActionItems = (
  scores: Record<string, number>,
  dataConfidence: string
): ActionItem[] => {
  const items: ActionItem[] = [];
  const issues: ActionItem[] = [];
  const wins: ActionItem[] = [];

  // Normalize scores to percentages for easier threshold comparison
  const engagedPct = (scores.engagedViewScore / 21) * 100;
  const retentionPct = (scores.retentionScore / 40) * 100;
  const rewatchPct = (scores.rewatchScore / 10) * 100;
  const engagementPct = (scores.engagementScore / 8) * 100;
  const consistencyPct = (scores.consistencyScore / 6) * 100;
  const sharePct = (scores.shareRateScore / 7) * 100;
  const formatPct = (scores.formattingScore / 2) * 100;

  // ===================
  // DATA CONFIDENCE
  // ===================
  if (dataConfidence === "insufficient") {
    issues.push({
      title: "Keep posting to unlock insights",
      detail: "We need at least 5 videos with 100+ views each to give you accurate recommendations. Focus on posting consistently for now. Your scores will become more reliable as you grow.",
      severity: "high",
      category: "data",
    });
  } else if (dataConfidence === "low") {
    issues.push({
      title: "More data coming soon",
      detail: "Your scores are based on limited data. Keep posting and check back in a few days for more accurate insights.",
      severity: "medium",
      category: "data",
    });
  }

  // ===================
  // HOOK / ENGAGED VIEW RATE (Most important for Shorts)
  // ===================
  if (engagedPct < 30) {
    // Critical - most viewers leaving immediately
    issues.push({
      title: "Your hook is losing viewers",
      detail: "Most viewers swipe away before your video even starts. Your first frame needs to stop the scroll instantly. Try: start mid-action, use bold text on screen, or open with something unexpected. No logos, no slow intros.",
      severity: "high",
      category: "hook",
    });
  } else if (engagedPct < 55) {
    // Needs significant work
    issues.push({
      title: "Stronger hooks needed",
      detail: "Too many viewers are swiping away in the first second. Lead with your most interesting moment, not a buildup to it. Ask yourself: 'Would I stop scrolling for this first frame?'",
      severity: "high",
      category: "hook",
    });
  } else if (engagedPct < 75) {
    // Room for improvement
    issues.push({
      title: "Test different opening frames",
      detail: "Your hooks are okay but could be better. Try filming 3 different openings for your next video and see which one feels most scroll-stopping. Movement, faces, and text overlays usually win.",
      severity: "medium",
      category: "hook",
    });
  } else if (engagedPct >= 85) {
    // Winning
    wins.push({
      title: "Your hooks are working",
      detail: "Viewers are staying past the first second. That's the hardest part. Keep doing what you're doing and don't overthink it.",
      severity: "positive",
      category: "hook",
    });
  }

  // ===================
  // RETENTION
  // ===================
  if (retentionPct < 15) {
    // Critical
    issues.push({
      title: "Viewers are dropping off fast",
      detail: "People start your videos but don't finish them. Every second needs to earn the next. Cut anything that doesn't add value. Be ruthless. If you're explaining something, show don't tell. If there's a pause, cut it.",
      severity: "high",
      category: "retention",
    });
  } else if (retentionPct < 40) {
    // Needs work
    issues.push({
      title: "Tighten your pacing",
      detail: "Your videos have slow moments where viewers leave. Watch your own content and notice where you'd get bored. Those spots need to be cut or made more interesting. Aim for something new every 1-2 seconds.",
      severity: "high",
      category: "retention",
    });
  } else if (retentionPct < 65) {
    // Getting there
    issues.push({
      title: "Keep viewers hooked longer",
      detail: "You're keeping some viewers but losing others mid-video. Try adding an 'open loop' early. Hint at something coming that viewers have to wait for. 'Wait for the end' only works if you've earned their trust.",
      severity: "medium",
      category: "retention",
    });
  } else if (retentionPct >= 80) {
    wins.push({
      title: "Strong watch time",
      detail: "Viewers are watching most of your content. This is your competitive advantage. YouTube loves this. Protect your pacing and don't let videos get bloated.",
      severity: "positive",
      category: "retention",
    });
  }

  // ===================
  // REWATCH / LOOP (Critical for short Shorts)
  // ===================
  if (rewatchPct < 20) {
    issues.push({
      title: "Your videos aren't looping",
      detail: "For Shorts under 30 seconds, YouTube wants viewers to watch more than once. The best trick: make your ending connect to your beginning, so viewers don't even notice when it restarts. Or end on a cliffhanger that makes them rewatch to understand.",
      severity: "high",
      category: "rewatch",
    });
  } else if (rewatchPct < 50) {
    issues.push({
      title: "Add replay value",
      detail: "Viewers watch once and leave. Try hiding a small detail early that only makes sense after the payoff. Curious viewers will rewatch to spot it. Or make content so satisfying people want to see it again.",
      severity: "medium",
      category: "rewatch",
    });
  } else if (rewatchPct >= 80) {
    wins.push({
      title: "Viewers are rewatching",
      detail: "Your content has replay value. This is rare and YouTube rewards it heavily. Keep creating content that's satisfying to watch multiple times.",
      severity: "positive",
      category: "rewatch",
    });
  }

  // ===================
  // ENGAGEMENT (Likes, Comments, Subs)
  // ===================
  if (engagementPct < 25) {
    issues.push({
      title: "Get viewers to interact",
      detail: "People watch but don't like, comment, or subscribe. This usually means your content is 'fine' but not emotionally activating. Try: share a hot take people will agree OR disagree with, ask a genuine question, or create moments that make people want to tag a friend.",
      severity: "medium",
      category: "engagement",
    });
  } else if (engagementPct < 50) {
    issues.push({
      title: "Spark more conversation",
      detail: "Engagement is below average. End your videos with something that invites a response. Try a question, a controversial opinion, or asking viewers to share their experience. Respond to comments quickly to encourage more.",
      severity: "medium",
      category: "engagement",
    });
  } else if (engagementPct >= 75) {
    wins.push({
      title: "Great engagement",
      detail: "Viewers are liking, commenting, and subscribing at a strong rate. This tells YouTube your content is valuable. Keep fostering that community.",
      severity: "positive",
      category: "engagement",
    });
  }

  // ===================
  // SHARE RATE
  // ===================
  if (sharePct < 20) {
    issues.push({
      title: "Make content worth sharing",
      detail: "Shares are the strongest signal to YouTube that your content is valuable, but almost no one is sharing yours. Think: 'Would someone send this to a friend?' Content that makes people look funny, smart, or helpful gets shared. Relatable beats impressive.",
      severity: "medium",
      category: "shares",
    });
  } else if (sharePct < 50) {
    issues.push({
      title: "Create more shareable moments",
      detail: "Some viewers share, but you can do better. Try: relatable struggles people want to say 'this is so me', useful tips worth saving, or takes so spicy people need to debate them with friends.",
      severity: "low",
      category: "shares",
    });
  } else if (sharePct >= 80) {
    wins.push({
      title: "Your content is getting shared",
      detail: "People are sending your videos to friends. This is one of the strongest growth signals. Whatever you're doing, it's working.",
      severity: "positive",
      category: "shares",
    });
  }

  // ===================
  // CONSISTENCY
  // ===================
  if (consistencyPct < 35) {
    issues.push({
      title: "Post more regularly",
      detail: "You're not posting often enough for YouTube to learn who should see your content. The algorithm rewards creators who show up consistently. Aim for at least 4-5 videos per week while you're growing. You can slow down once you have momentum. Note: This score is also affected by your hook and retention performance.",
      severity: "medium",
      category: "consistency",
    });
  } else if (consistencyPct < 65) {
    issues.push({
      title: "Fill the gaps in your schedule",
      detail: "You post sometimes, but gaps of 3+ days hurt your momentum. Try batch-creating content when you're in a flow state so you always have something ready to post. Note: This score is also affected by your hook and retention performance.",
      severity: "low",
      category: "consistency",
    });
  } else if (consistencyPct >= 85) {
    wins.push({
      title: "Consistent posting",
      detail: "You're showing up regularly. This builds trust with both YouTube and your audience. Keep this rhythm going.",
      severity: "positive",
      category: "consistency",
    });
  }

  // ===================
  // FORMATTING
  // ===================
  if (formatPct < 50) {
    issues.push({
      title: "Fix your video format",
      detail: "Your videos aren't optimized for Shorts. Use vertical 9:16 format (full phone screen), shoot in 1080p or higher, and keep faces and action in the center. Horizontal or blurry videos get buried.",
      severity: "medium",
      category: "format",
    });
  }

  // ===================
  // CHANNEL SETUP (Lower priority but easy wins)
  // ===================
  if (scores.channelAge < 1) {
    issues.push({
      title: "Verify your channel",
      detail: "New and unverified channels have limited reach. Verify your phone number in YouTube Studio to unlock full features and build baseline trust with the algorithm.",
      severity: "medium",
      category: "setup",
    });
  }

  if (scores.featureEligibility < 0.5) {
    issues.push({
      title: "Unlock all YouTube features",
      detail: "Your channel doesn't have full features enabled yet. Go to YouTube Studio → Settings → Channel → Feature eligibility, and complete phone verification to unlock everything.",
      severity: "low",
      category: "setup",
    });
  }

  if (scores.channelDescription < 1) {
    issues.push({
      title: "Write a channel description",
      detail: "Your bio is empty or too short. Write 2-3 sentences about what viewers can expect from your channel. This helps YouTube understand who to recommend you to.",
      severity: "low",
      category: "setup",
    });
  }

  // ===================
  // COMPOUND ISSUES (when multiple things are wrong)
  // ===================
  const hookAndRetentionBad = engagedPct < 50 && retentionPct < 40;
  const viewsButNoGrowth = engagementPct < 40 && sharePct < 40;

  if (hookAndRetentionBad && issues.length >= 2) {
    // Replace the first two issues with a compound recommendation
    const hookIndex = issues.findIndex(i => i.category === "hook");
    const retentionIndex = issues.findIndex(i => i.category === "retention");
    
    if (hookIndex >= 0 && retentionIndex >= 0) {
      // Remove both and add compound
      const filtered = issues.filter(i => i.category !== "hook" && i.category !== "retention");
      filtered.unshift({
        title: "Focus on hooks first",
        detail: "Both your hooks and retention need work, but start with hooks. Nothing else matters if viewers swipe away in the first second. Once you're keeping 70%+ of viewers past the hook, then focus on the rest of the video.",
        severity: "high",
        category: "compound",
      });
      issues.length = 0;
      issues.push(...filtered);
    }
  }

  if (viewsButNoGrowth && !issues.some(i => i.category === "compound")) {
    issues.push({
      title: "You're getting views but not growing",
      detail: "People watch your content but don't engage or come back. This often means videos are 'interesting enough to watch' but not 'interesting enough to care about.' Find what makes YOU different and lean into it hard.",
      severity: "medium",
      category: "compound",
    });
  }

  // ===================
  // ASSEMBLE FINAL LIST
  // ===================
  // Prioritize: High severity issues first, then medium, then low, then wins
  const highIssues = issues.filter(i => i.severity === "high");
  const mediumIssues = issues.filter(i => i.severity === "medium");
  const lowIssues = issues.filter(i => i.severity === "low");

  // Always show issues first, but include 1-2 wins if there's room
  items.push(...highIssues);
  items.push(...mediumIssues);
  items.push(...lowIssues);
  
  // Add wins at the end (max 2)
  const winsToAdd = wins.slice(0, 2);
  
  // Return max 6 items total, ensuring at least 1 win if they have any and room
  const maxIssues = winsToAdd.length > 0 ? 5 : 6;
  const finalItems = items.slice(0, maxIssues);
  
  if (winsToAdd.length > 0 && finalItems.length < 6) {
    finalItems.push(...winsToAdd.slice(0, 6 - finalItems.length));
  }

  return finalItems;
};

/**
 * Determine data confidence level based on analytics coverage
 */
const calculateDataConfidence = (
  videos: VideoMetrics[],
  videosWithAnalytics: number,
  videosWithEngagedViewData: number
): "high" | "medium" | "low" | "insufficient" => {
  if (videos.length < MIN_VIDEOS_FOR_PERFORMANCE) {
    return "insufficient";
  }

  const analyticsRatio = videosWithAnalytics / videos.length;
  const engagedViewRatio = videosWithEngagedViewData / videos.length;

  if (analyticsRatio >= 0.8 && engagedViewRatio >= 0.5) {
    return "high";
  }
  if (analyticsRatio >= 0.5 && engagedViewRatio >= 0.3) {
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
  channelMetrics,
}: {
  channel: YoutubeChannel;
  videos: VideoMetrics[];
  uploads: YoutubePlaylistItem[];
  windowStart: string;
  windowEnd: string;
  now: Date;
  channelMetrics?: ChannelMetrics;
}): TrustScoreResult => {
  const videoScores: VideoScoreBreakdown[] = [];
  const weights: number[] = [];
  const shortsEngagedFeedRates: number[] = [];
  const shortsEngagedFeedWeights: number[] = [];
  const shortsEngagedFallbackRates: number[] = [];
  const shortsEngagedFallbackWeights: number[] = [];
  const engagedViewScoreValues: number[] = [];
  const retentionScoreValues: number[] = [];
  const rewatchScoreValues: number[] = [];
  const engagementScoreValues: number[] = [];
  const formattingScoreValues: number[] = [];
  const enhancements: number[] = [];
  const categories = videos.map((video) => video.categoryId).filter(Boolean);

  // Track data availability
  let videosWithAnalytics = 0;
  let videosWithEngagedViewData = 0;

  videos.forEach((video) => {
    const views = video.views ?? 0;
    const weight = computeWeight(views, video.publishedAt, now);
    weights.push(weight);

    const isShort = video.durationSeconds > 0 && video.durationSeconds <= 60;
    const hasAnalytics = video.averageViewDuration > 0;
    const hasEngagedViewData = isShort
      ? (((video.shortsFeedViews ?? 0) > 0 &&
        video.shortsFeedEngagedViews !== undefined) ||
        ((video.analyticsViews ?? 0) > 0 && video.engagedViews !== undefined))
      : normalizeRate(video.impressionsClickThroughRate) !== null;

    if (hasAnalytics) {
      videosWithAnalytics += 1;
    }
    if (hasEngagedViewData) {
      videosWithEngagedViewData += 1;
    }

    const engagedView = computeEngagedViewScore(
      isShort,
      video.shortsFeedViews,
      video.shortsFeedEngagedViews,
      video.impressionsClickThroughRate,
      video.analyticsViews,
      video.engagedViews
    );

    if (engagedView.rate !== null && engagedView.source === "shorts_feed") {
      shortsEngagedFeedRates.push(engagedView.rate);
      shortsEngagedFeedWeights.push(weight);
    } else if (engagedView.rate !== null && engagedView.source === "shorts_overall") {
      shortsEngagedFallbackRates.push(engagedView.rate);
      shortsEngagedFallbackWeights.push(weight);
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
      engagedView.score +
      retention.score +
      rewatch.score +
      engagement +
      format.score;

    engagedViewScoreValues.push(engagedView.score);
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
        engagedView: engagedView.score,
        retention: retention.score,
        rewatch: rewatch.score,
        engagement,
        formatting: format.score,
        total: videoScore,
      },
      metrics: {
        engagedViewRate: engagedView.rate ?? undefined,
        engagedViewSource: engagedView.source,
        ctr: isShort ? undefined : normalizeRate(video.impressionsClickThroughRate) ?? undefined,
        startRate: isShort && engagedView.rate !== null ? engagedView.rate : undefined,
        averageViewDuration: video.averageViewDuration,
        targetAvd: retention.target,
        loopRatio: rewatch.loopRatio,
      },
      flags: {
        hasAnalyticsData: hasAnalytics,
        hasEngagedViewData: hasEngagedViewData,
        lowConfidence: views < MIN_VIEWS_FOR_VIDEO_SCORE,
      },
    });
  });

  // Calculate data confidence
  const dataConfidence = calculateDataConfidence(
    videos,
    videosWithAnalytics,
    videosWithEngagedViewData
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

  // Calculate shorts engaged view average
  const computeWeightedEngagedAvg = (rates: number[], rateWeights: number[]): number | null => {
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

  const shortsEngagedFeedAvg = computeWeightedEngagedAvg(
    shortsEngagedFeedRates,
    shortsEngagedFeedWeights
  );
  const engagedViewAvg =
    shortsEngagedFeedAvg ??
    computeWeightedEngagedAvg(shortsEngagedFallbackRates, shortsEngagedFallbackWeights);

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

  // Calculate channel-level metrics scores
  const shareRateResult = computeShareRateScore(
    channelMetrics?.views ?? 0,
    channelMetrics?.shares ?? 0
  );

  // Consistency score with soft gates
  // Use engagedViewAvg (combined feed + fallback) so consistency is gated by ANY available engaged view data
  const hasEnoughAnalyticsData = videosWithAnalytics >= MIN_VIDEOS_WITH_ANALYTICS;
  const consistencyScore = computeConsistencyScore(
    uploads,
    engagedViewAvg,
    retentionAvg,
    hasEnoughAnalyticsData
  );

  // Calculate raw score with channel metrics
  const rawScore = accountScore + performanceScore + consistencyScore + shareRateResult.score;

  // Apply soft cap if engaged view rate is failing (use combined engaged avg)
  // Changed from hard cap to soft 50% penalty to allow new creators to see progress
  let finalScore = rawScore;
  if (engagedViewAvg !== null && engagedViewAvg < 0.55) {
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
    engagedViewScore: weightedAverage(engagedViewScoreValues),
    retentionScore: weightedAverage(retentionScoreValues),
    rewatchScore: weightedAverage(rewatchScoreValues),
    engagementScore: weightedAverage(engagementScoreValues),
    formattingScore: weightedAverage(formattingScoreValues),
    shareRateScore: shareRateResult.score,
    consistencyScore,
  };

  const actionItems = buildActionItems(components, dataConfidence);

  return {
    score: Math.round(finalScore),
    scoreRaw: Number(finalScore.toFixed(2)),
    accountScore: Number(accountScore.toFixed(2)),
    performanceScore: Number(performanceScore.toFixed(2)),
    consistencyScore,
    engagedViewAvg: engagedViewAvg !== null ? Number(engagedViewAvg.toFixed(4)) : null,
    shareRate: channelMetrics && channelMetrics.views > 0 ? Number(shareRateResult.rate.toFixed(6)) : null,
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
