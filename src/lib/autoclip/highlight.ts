import type {
  AutoClipHighlight,
  TranscriptSegment,
} from "@/lib/autoclip/types";
import { safeParseJson } from "@/lib/autoclip/utils";

const MIN_HIGHLIGHT_SECONDS = 15;
const MAX_HIGHLIGHT_SECONDS = 120;
const MIN_EDIT_HIGHLIGHT_SECONDS = 1;
const DEFAULT_HIGHLIGHT_COUNT = 6;
const MIN_HIGHLIGHT_COUNT = 4;
const MAX_HIGHLIGHT_COUNT = 6;
const OVERLAP_RATIO_THRESHOLD = 0.6;
const OVERLAP_SECONDS_THRESHOLD = 2;
const MIN_TARGET_HIGHLIGHT_SECONDS = 18;
const MAX_TARGET_HIGHLIGHT_SECONDS = 45;
const DEFAULT_TARGET_HIGHLIGHT_SECONDS = 32;
const LENGTH_PENALTY_START_SECONDS = 55;
const PREFERRED_SHORT_FORM_SECONDS = 45;

type HighlightRange = { start: number; end: number };
type HighlightLimits = {
  duration: number | null;
  hasDuration: boolean;
  minLength: number;
  maxLength: number;
};
type HighlightCandidatePayload = {
  start: number;
  end: number;
  title: string;
  viralityScore?: number;
};
type ScoredHighlight = {
  highlight: AutoClipHighlight;
  score: number;
};

const buildTranscriptText = (segments: TranscriptSegment[]) =>
  segments
    .map((segment) => `${segment.start.toFixed(2)} - ${segment.end.toFixed(2)}: ${segment.text}`)
    .join("\n");

const orderSegmentsForAlignment = (segments: TranscriptSegment[]) =>
  segments
    .map((segment) => ({
      start: Number(segment.start),
      end: Number(segment.end),
      text: String(segment.text ?? "").trim(),
    }))
    .filter(
      (segment) =>
        Number.isFinite(segment.start) &&
        Number.isFinite(segment.end) &&
        segment.end > segment.start
    )
    .sort((a, b) => a.start - b.start || a.end - b.end);

const endsSentence = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }
  const cleaned = trimmed.replace(/["')\]]+$/, "");
  if (cleaned.endsWith("...")) {
    return true;
  }
  const lastChar = cleaned[cleaned.length - 1];
  return lastChar === "." || lastChar === "!" || lastChar === "?";
};

const resolveTranscriptDuration = (segments: TranscriptSegment[]) => {
  if (!segments.length) {
    return null;
  }
  let maxEnd = 0;
  segments.forEach((segment) => {
    if (Number.isFinite(segment.end)) {
      maxEnd = Math.max(maxEnd, segment.end);
    }
  });
  return maxEnd > 0 ? maxEnd : null;
};

const resolveHighlightLimits = (
  segments: TranscriptSegment[],
  durationOverride?: number | null
): HighlightLimits => {
  const transcriptDuration = resolveTranscriptDuration(segments);
  let duration = transcriptDuration ?? null;
  if (durationOverride && Number.isFinite(durationOverride) && durationOverride > 0) {
    duration = duration ? Math.max(duration, durationOverride) : durationOverride;
  }
  const hasDuration = Boolean(duration && Number.isFinite(duration) && duration > 0);
  const minLength = hasDuration
    ? Math.min(MIN_HIGHLIGHT_SECONDS, duration as number)
    : MIN_HIGHLIGHT_SECONDS;
  let maxLength = hasDuration
    ? Math.min(MAX_HIGHLIGHT_SECONDS, duration as number)
    : MAX_HIGHLIGHT_SECONDS;
  if (maxLength < minLength) {
    maxLength = minLength;
  }
  return { duration, hasDuration, minLength, maxLength };
};

const resolveEditableLimits = (
  segments: TranscriptSegment[],
  durationOverride?: number | null
): HighlightLimits => {
  const transcriptDuration = resolveTranscriptDuration(segments);
  let duration = transcriptDuration ?? null;
  if (durationOverride && Number.isFinite(durationOverride) && durationOverride > 0) {
    duration = durationOverride;
  }
  const hasDuration = Boolean(duration && Number.isFinite(duration) && duration > 0);
  const minLength = hasDuration
    ? Math.min(MIN_EDIT_HIGHLIGHT_SECONDS, duration as number)
    : MIN_EDIT_HIGHLIGHT_SECONDS;
  const maxLength = hasDuration ? (duration as number) : Number.POSITIVE_INFINITY;
  return { duration, hasDuration, minLength, maxLength };
};

const normalizeHighlightRangeWithLimits = (
  start: number,
  end: number,
  limits: HighlightLimits
) => {
  const { duration, hasDuration, minLength, maxLength } = limits;
  let nextStart = Number.isFinite(start) ? start : 0;
  let nextEnd = Number.isFinite(end) ? end : nextStart + minLength;
  if (nextEnd < nextStart) {
    const swap = nextEnd;
    nextEnd = nextStart;
    nextStart = swap;
  }
  const requestedLength = nextEnd - nextStart;
  if (requestedLength < minLength) {
    nextEnd = nextStart + minLength;
  } else if (requestedLength > maxLength) {
    nextEnd = nextStart + maxLength;
  }
  if (hasDuration) {
    const safeDuration = duration as number;
    const maxStart = Math.max(0, safeDuration - minLength);
    nextStart = Math.max(0, Math.min(nextStart, maxStart));
    nextEnd = Math.max(nextStart + minLength, Math.min(nextEnd, safeDuration));
    if (nextEnd - nextStart > maxLength) {
      nextEnd = Math.min(safeDuration, nextStart + maxLength);
    }
    if (nextEnd - nextStart < minLength) {
      nextStart = Math.max(0, nextEnd - minLength);
    }
  } else {
    nextStart = Math.max(0, nextStart);
    nextEnd = Math.max(nextStart + minLength, nextEnd);
    if (nextEnd - nextStart > maxLength) {
      nextEnd = nextStart + maxLength;
    }
  }
  return { start: nextStart, end: nextEnd };
};

export const normalizeHighlightRange = (
  segments: TranscriptSegment[],
  start: number,
  end: number,
  durationOverride?: number | null
) => {
  const limits = resolveHighlightLimits(segments, durationOverride);
  return normalizeHighlightRangeWithLimits(start, end, limits);
};

const normalizeEditableRange = (
  segments: TranscriptSegment[],
  start: number,
  end: number,
  durationOverride?: number | null
) => {
  const limits = resolveEditableLimits(segments, durationOverride);
  return normalizeHighlightRangeWithLimits(start, end, limits);
};

const alignHighlightRangeToSegments = (
  segments: TranscriptSegment[],
  start: number,
  end: number,
  limits: HighlightLimits
) => {
  const ordered = orderSegmentsForAlignment(segments);
  if (!ordered.length) {
    return { start, end };
  }
  const targetStart = start;
  const targetEnd = end;
  const findStartIndex = () => {
    for (let i = 0; i < ordered.length; i += 1) {
      const segment = ordered[i];
      if (targetStart >= segment.start && targetStart < segment.end) {
        return i;
      }
    }
    let fallback = 0;
    for (let i = 0; i < ordered.length; i += 1) {
      if (ordered[i].start <= targetStart) {
        fallback = i;
      } else {
        break;
      }
    }
    return fallback;
  };
  const findEndIndex = () => {
    for (let i = 0; i < ordered.length; i += 1) {
      const segment = ordered[i];
      if (targetEnd > segment.start && targetEnd <= segment.end) {
        return i;
      }
    }
    for (let i = 0; i < ordered.length; i += 1) {
      if (ordered[i].end >= targetEnd) {
        return i;
      }
    }
    return ordered.length - 1;
  };

  let startIndex = findStartIndex();
  let endIndex = findEndIndex();
  if (endIndex < startIndex) {
    endIndex = startIndex;
  }
  let nextStart = ordered[startIndex].start;
  let nextEnd = ordered[endIndex].end;

  const applyIndices = () => {
    nextStart = ordered[startIndex].start;
    nextEnd = ordered[endIndex].end;
  };
  const rangeLength = () => nextEnd - nextStart;

  while (rangeLength() > limits.maxLength && startIndex < endIndex) {
    const nextStartIndex = startIndex + 1;
    const nextEndIndex = endIndex - 1;
    const canMoveStart = nextStartIndex <= endIndex;
    const canMoveEnd = nextEndIndex >= startIndex;
    if (!canMoveStart && !canMoveEnd) {
      break;
    }
    const startCost = canMoveStart
      ? Math.abs(ordered[nextStartIndex].start - targetStart)
      : Number.POSITIVE_INFINITY;
    const endCost = canMoveEnd
      ? Math.abs(ordered[nextEndIndex].end - targetEnd)
      : Number.POSITIVE_INFINITY;
    if (canMoveStart && (!canMoveEnd || startCost <= endCost)) {
      startIndex = nextStartIndex;
    } else if (canMoveEnd) {
      endIndex = nextEndIndex;
    } else {
      break;
    }
    applyIndices();
  }

  const isSentenceStart = (index: number) =>
    index === 0 || endsSentence(ordered[index - 1].text);
  const isSentenceEnd = (index: number) =>
    index === ordered.length - 1 || endsSentence(ordered[index].text);

  while (startIndex > 0 && !isSentenceStart(startIndex)) {
    const candidateStart = ordered[startIndex - 1].start;
    if (nextEnd - candidateStart > limits.maxLength) {
      break;
    }
    startIndex -= 1;
    applyIndices();
  }

  while (endIndex < ordered.length - 1 && !isSentenceEnd(endIndex)) {
    const candidateEnd = ordered[endIndex + 1].end;
    if (candidateEnd - nextStart > limits.maxLength) {
      break;
    }
    endIndex += 1;
    applyIndices();
  }

  if (!isSentenceEnd(endIndex) && endIndex > startIndex) {
    let backIndex = endIndex;
    while (backIndex > startIndex && !isSentenceEnd(backIndex)) {
      const candidateEnd = ordered[backIndex - 1].end;
      if (candidateEnd - nextStart < limits.minLength) {
        break;
      }
      backIndex -= 1;
    }
    if (backIndex !== endIndex && isSentenceEnd(backIndex)) {
      endIndex = backIndex;
      applyIndices();
    }
  }

  if (rangeLength() < limits.minLength) {
    while (endIndex < ordered.length - 1) {
      const candidateEnd = ordered[endIndex + 1].end;
      if (candidateEnd - nextStart > limits.maxLength) {
        break;
      }
      endIndex += 1;
      applyIndices();
      if (rangeLength() >= limits.minLength) {
        break;
      }
    }
  }

  if (rangeLength() < limits.minLength) {
    while (startIndex > 0) {
      const candidateStart = ordered[startIndex - 1].start;
      if (nextEnd - candidateStart > limits.maxLength) {
        break;
      }
      startIndex -= 1;
      applyIndices();
      if (rangeLength() >= limits.minLength) {
        break;
      }
    }
  }

  const finalLength = rangeLength();
  if (!Number.isFinite(finalLength) || finalLength <= 0) {
    return { start, end };
  }
  if (finalLength < limits.minLength || finalLength > limits.maxLength) {
    return { start, end };
  }
  return { start: nextStart, end: nextEnd };
};

const computeOverlapSeconds = (a: HighlightRange, b: HighlightRange) =>
  Math.min(a.end, b.end) - Math.max(a.start, b.start);

const isSignificantOverlap = (a: HighlightRange, b: HighlightRange) => {
  const overlap = computeOverlapSeconds(a, b);
  if (!Number.isFinite(overlap) || overlap <= 0) {
    return false;
  }
  const aLength = Math.max(0, a.end - a.start);
  const bLength = Math.max(0, b.end - b.start);
  const minLength = Math.min(aLength, bLength);
  if (minLength <= 0) {
    return false;
  }
  return (
    overlap >= OVERLAP_SECONDS_THRESHOLD ||
    overlap / minLength >= OVERLAP_RATIO_THRESHOLD
  );
};

const resolveFlexibleHighlightLimits = (
  segments: TranscriptSegment[],
  durationOverride: number | null | undefined,
  targetCount: number
) => {
  const baseLimits = resolveHighlightLimits(segments, durationOverride);
  if (!baseLimits.hasDuration || !baseLimits.duration) {
    return baseLimits;
  }
  const durationSeconds = baseLimits.duration as number;
  const safeTarget = Math.max(targetCount, 1);
  const idealLength = durationSeconds / safeTarget;
  if (!Number.isFinite(idealLength) || idealLength <= 0) {
    return baseLimits;
  }
  if (idealLength >= baseLimits.minLength) {
    return baseLimits;
  }
  const minLength = Math.min(
    baseLimits.minLength,
    Math.max(2, idealLength)
  );
  const maxLength = Math.max(
    minLength,
    Math.min(baseLimits.maxLength, Math.max(minLength, idealLength * 1.6))
  );
  return {
    duration: durationSeconds,
    hasDuration: true,
    minLength,
    maxLength,
  };
};

const resolveTargetHighlightLength = (
  limits: HighlightLimits,
  durationSeconds: number,
  targetCount: number
) => {
  const safeTarget = Math.max(targetCount, 1);
  const idealLength =
    durationSeconds > 0
      ? durationSeconds / safeTarget
      : DEFAULT_TARGET_HIGHLIGHT_SECONDS;
  const boundedIdeal = Math.max(
    MIN_TARGET_HIGHLIGHT_SECONDS,
    Math.min(MAX_TARGET_HIGHLIGHT_SECONDS, idealLength)
  );
  return Math.min(
    limits.maxLength,
    Math.max(limits.minLength, boundedIdeal)
  );
};

const normalizeViralityScore = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 50;
  }
  return Math.max(0, Math.min(100, numeric));
};

const scoreHighlightCandidate = (
  highlight: AutoClipHighlight,
  modelViralityScore: number
) => {
  const length = Math.max(0, highlight.end - highlight.start);
  let score = modelViralityScore;
  if (length > LENGTH_PENALTY_START_SECONDS) {
    score -= Math.min(
      40,
      (length - LENGTH_PENALTY_START_SECONDS) * 0.9
    );
  } else if (length > PREFERRED_SHORT_FORM_SECONDS) {
    score -= (length - PREFERRED_SHORT_FORM_SECONDS) * 0.5;
  }
  if (length < MIN_HIGHLIGHT_SECONDS) {
    score -= (MIN_HIGHLIGHT_SECONDS - length) * 0.8;
  }
  const content = String(highlight.content ?? "");
  if (/[!?]/.test(content)) {
    score += 2;
  }
  if (
    /\b(controvers|rage|angry|fury|scam|exposed|worst|insane|crazy|drama|fight|lie|shocking)\b/i.test(
      content
    )
  ) {
    score += 4;
  }
  return score;
};

const buildFallbackHighlights = (
  segments: TranscriptSegment[],
  count: number,
  durationOverride: number | null | undefined,
  excludeRanges: HighlightRange[],
  targetCount = count
) => {
  if (count <= 0) {
    return [];
  }
  const limits = resolveHighlightLimits(segments, durationOverride);
  const { duration, minLength, maxLength } = limits;
  const durationSeconds =
    duration && Number.isFinite(duration)
      ? (duration as number)
      : resolveTranscriptDuration(segments) ?? 0;
  const targetLength = resolveTargetHighlightLength(
    limits,
    durationSeconds,
    targetCount
  );
  const candidates = segments
    .map((segment) => {
      const text = String(segment.text ?? "").trim();
      const wordCount = text ? text.split(/\s+/).length : 0;
      return {
        segment,
        wordCount,
      };
    })
    .filter((item) => item.wordCount > 0)
    .sort((a, b) => b.wordCount - a.wordCount);

  const fallback: AutoClipHighlight[] = [];
  for (const { segment } of candidates) {
    if (fallback.length >= count) {
      break;
    }
    const leadIn = Math.min(1.5, Math.max(0, targetLength * 0.1));
    const rawStart = Math.max(0, segment.start - leadIn);
    const rawEnd = rawStart + targetLength;
    const normalized = normalizeHighlightRangeWithLimits(rawStart, rawEnd, limits);
    const aligned = alignHighlightRangeToSegments(
      segments,
      normalized.start,
      normalized.end,
      limits
    );
    const content = buildHighlightContent(
      segments,
      aligned.start,
      aligned.end
    );
    if (!content) {
      continue;
    }
    const title = content.split(/\s+/).slice(0, 8).join(" ");
    const candidate = {
      start: aligned.start,
      end: aligned.end,
      content,
      title: title || undefined,
    };
    if (
      excludeRanges.some((range) => isSignificantOverlap(candidate, range)) ||
      fallback.some((range) => isSignificantOverlap(candidate, range))
    ) {
      continue;
    }
    fallback.push(candidate);
  }
  return fallback;
};

const buildCoverageHighlights = (
  segments: TranscriptSegment[],
  count: number,
  durationOverride: number | null | undefined,
  excludeRanges: HighlightRange[],
  targetCount = count
) => {
  if (count <= 0) {
    return [];
  }
  const limits = resolveHighlightLimits(segments, durationOverride);
  const { duration, minLength, maxLength } = limits;
  const durationSeconds =
    duration && Number.isFinite(duration)
      ? (duration as number)
      : resolveTranscriptDuration(segments) ?? 0;
  const targetLength = resolveTargetHighlightLength(
    limits,
    durationSeconds,
    targetCount
  );
  const orderedSegments = segments
    .filter((segment) => {
      const text = String(segment.text ?? "").trim();
      return (
        text &&
        Number.isFinite(segment.start) &&
        Number.isFinite(segment.end) &&
        segment.end > segment.start
      );
    })
    .sort((a, b) => a.start - b.start);

  const fallback: AutoClipHighlight[] = [];
  const leadIn = Math.min(1.5, Math.max(0, targetLength * 0.15));
  const binCount = Math.max(count, 1);
  const binSize = durationSeconds > 0 ? durationSeconds / binCount : 0;

  const tryAddCandidate = (anchorTime: number) => {
    if (fallback.length >= count) {
      return;
    }
    const rawStart = Math.max(0, anchorTime - leadIn);
    const normalized = normalizeHighlightRangeWithLimits(
      rawStart,
      rawStart + targetLength,
      limits
    );
    const aligned = alignHighlightRangeToSegments(
      segments,
      normalized.start,
      normalized.end,
      limits
    );
    const content = buildHighlightContent(
      segments,
      aligned.start,
      aligned.end
    );
    if (!content) {
      return;
    }
    const title = content.split(/\s+/).slice(0, 8).join(" ");
    const candidate = {
      start: aligned.start,
      end: aligned.end,
      content,
      title: title || undefined,
    };
    if (
      excludeRanges.some((range) => isSignificantOverlap(candidate, range)) ||
      fallback.some((range) => isSignificantOverlap(candidate, range))
    ) {
      return;
    }
    fallback.push(candidate);
  };

  if (orderedSegments.length && binSize > 0) {
    for (let i = 0; i < binCount; i += 1) {
      if (fallback.length >= count) {
        break;
      }
      const binStart = i * binSize;
      const binEnd = binStart + binSize;
      const segment =
        orderedSegments.find(
          (candidate) =>
            candidate.start >= binStart && candidate.start < binEnd
        ) ??
        orderedSegments.find((candidate) => candidate.start >= binStart) ??
        orderedSegments[orderedSegments.length - 1];
      if (segment) {
        tryAddCandidate(segment.start);
      }
    }
  }

  if (fallback.length < count && orderedSegments.length) {
    for (const segment of orderedSegments) {
      if (fallback.length >= count) {
        break;
      }
      tryAddCandidate(segment.start);
    }
  }

  if (fallback.length < count && binSize > 0) {
    for (let i = 0; i < binCount; i += 1) {
      if (fallback.length >= count) {
        break;
      }
      tryAddCandidate(i * binSize + binSize * 0.5);
    }
  }

  return fallback;
};

const buildTimelineHighlights = (
  segments: TranscriptSegment[],
  count: number,
  durationOverride: number | null | undefined,
  excludeRanges: HighlightRange[],
  targetCount = count
) => {
  if (count <= 0) {
    return [];
  }
  const limits = resolveHighlightLimits(segments, durationOverride);
  const { duration, minLength, maxLength } = limits;
  const durationSeconds =
    duration && Number.isFinite(duration)
      ? (duration as number)
      : resolveTranscriptDuration(segments) ?? 0;
  if (!durationSeconds || durationSeconds <= 0) {
    return [];
  }
  const targetLength = resolveTargetHighlightLength(
    limits,
    durationSeconds,
    targetCount
  );
  const span = Math.max(0, durationSeconds - targetLength);
  const steps = Math.max(count - 1, 1);
  const anchors = Array.from({ length: count }, (_val, index) =>
    count === 1 ? 0 : (span * index) / steps
  );
  const candidates = anchors
    .map((anchor) => {
      const normalized = normalizeHighlightRangeWithLimits(
        anchor,
        anchor + targetLength,
        limits
      );
      const aligned = alignHighlightRangeToSegments(
        segments,
        normalized.start,
        normalized.end,
        limits
      );
      const content = buildHighlightContent(
        segments,
        aligned.start,
        aligned.end
      );
      if (!content) {
        return null;
      }
      const title = content.split(/\s+/).slice(0, 8).join(" ");
      return {
        start: aligned.start,
        end: aligned.end,
        content,
        title: title || undefined,
      } as AutoClipHighlight;
    })
    .filter((candidate): candidate is AutoClipHighlight => Boolean(candidate));

  const filterByStartGap = (gapSeconds: number) => {
    const selected: AutoClipHighlight[] = [];
    candidates.forEach((candidate) => {
      if (
        excludeRanges.some((range) => isSignificantOverlap(candidate, range)) ||
        selected.some((item) => isSignificantOverlap(candidate, item))
      ) {
        return;
      }
      if (
        gapSeconds > 0 &&
        selected.some((item) => Math.abs(item.start - candidate.start) < gapSeconds)
      ) {
        return;
      }
      selected.push(candidate);
    });
    return selected;
  };

  const primaryGap = Math.min(2, targetLength * 0.6);
  const primary = filterByStartGap(primaryGap);
  if (primary.length >= count) {
    return primary.slice(0, count);
  }
  const relaxed = filterByStartGap(Math.min(0.5, primaryGap));
  return relaxed.slice(0, count);
};

const buildForcedTimelineHighlights = (
  segments: TranscriptSegment[],
  count: number,
  durationOverride: number | null | undefined,
  excludeRanges: HighlightRange[],
  targetCount = count
) => {
  if (count <= 0) {
    return [];
  }
  const limits = resolveFlexibleHighlightLimits(
    segments,
    durationOverride,
    targetCount
  );
  const durationSeconds =
    limits.duration && Number.isFinite(limits.duration)
      ? (limits.duration as number)
      : 0;
  if (!durationSeconds || durationSeconds <= 0) {
    return [];
  }
  const idealLength = durationSeconds / Math.max(targetCount, 1);
  const targetLength = Math.min(
    limits.maxLength,
    Math.max(limits.minLength, idealLength)
  );
  const span = Math.max(0, durationSeconds - targetLength);
  const steps = Math.max(count - 1, 1);
  const anchors = Array.from({ length: count }, (_val, index) =>
    count === 1 ? 0 : (span * index) / steps
  );
  const forced: AutoClipHighlight[] = [];
  const seen = new Set<string>(
    excludeRanges.map(
      (range) => `${range.start.toFixed(2)}-${range.end.toFixed(2)}`
    )
  );
  const leadIn = Math.min(1, Math.max(0, targetLength * 0.1));
  anchors.forEach((anchor) => {
    if (forced.length >= count) {
      return;
    }
    const rawStart = Math.max(0, anchor - leadIn);
    const normalized = normalizeHighlightRangeWithLimits(
      rawStart,
      rawStart + targetLength,
      limits
    );
    const aligned = alignHighlightRangeToSegments(
      segments,
      normalized.start,
      normalized.end,
      limits
    );
    const content = buildHighlightContent(
      segments,
      aligned.start,
      aligned.end
    );
    if (!content) {
      return;
    }
    const title = content.split(/\s+/).slice(0, 8).join(" ");
    const candidate = {
      start: aligned.start,
      end: aligned.end,
      content,
      title: title || undefined,
    };
    const key = `${candidate.start.toFixed(2)}-${candidate.end.toFixed(2)}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    forced.push(candidate);
  });
  return forced;
};

const extractJsonBlock = (value: string) => {
  const trimmed = value.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return trimmed;
  }
  const match = trimmed.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  return match ? match[1] : null;
};

const buildHighlightContent = (
  segments: TranscriptSegment[],
  start: number,
  end: number
) => {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return "";
  }
  const lines: string[] = [];
  segments.forEach((segment) => {
    if (segment.end <= start || segment.start >= end) {
      return;
    }
    if (segment.words?.length) {
      segment.words.forEach((word) => {
        if (word.end <= start || word.start >= end) {
          return;
        }
        const text = String(word.text ?? "").trim();
        if (text) {
          lines.push(text);
        }
      });
      return;
    }
    const text = String(segment.text ?? "").trim();
    if (!text) {
      return;
    }
    const segmentDuration = Math.max(0.001, segment.end - segment.start);
    const overlapStart = Math.max(segment.start, start);
    const overlapEnd = Math.min(segment.end, end);
    const startRatio = Math.max(
      0,
      Math.min(1, (overlapStart - segment.start) / segmentDuration)
    );
    const endRatio = Math.max(
      0,
      Math.min(1, (overlapEnd - segment.start) / segmentDuration)
    );
    if (startRatio <= 0 && endRatio >= 1) {
      lines.push(text);
      return;
    }
    const words = text.split(/\s+/);
    const startIndex = Math.max(0, Math.floor(words.length * startRatio));
    const endIndex = Math.min(
      words.length,
      Math.max(startIndex + 1, Math.ceil(words.length * endRatio))
    );
    const sliced = words.slice(startIndex, endIndex).join(" ").trim();
    if (sliced) {
      lines.push(sliced);
    }
  });
  return lines.join(" ").replace(/\s+/g, " ").trim();
};

export const selectHighlight = async (
  segments: TranscriptSegment[],
  options?: {
    instructions?: string;
    description?: string;
    language?: string | null;
    durationSeconds?: number | null;
    maxHighlights?: number;
    excludeRanges?: HighlightRange[];
  }
): Promise<AutoClipHighlight[]> => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY for highlight selection.");
  }

  const requestedRawCount =
    options?.maxHighlights && options.maxHighlights > 0
      ? Math.floor(options.maxHighlights)
      : DEFAULT_HIGHLIGHT_COUNT;
  const requestedHighlights = Math.min(
    MAX_HIGHLIGHT_COUNT,
    Math.max(MIN_HIGHLIGHT_COUNT, requestedRawCount)
  );
  const minHighlights = Math.min(MIN_HIGHLIGHT_COUNT, requestedHighlights);
  const limits = resolveHighlightLimits(
    segments,
    options?.durationSeconds ?? null
  );
  const model = process.env.AUTOCLIP_HIGHLIGHT_MODEL || "gpt-5-mini";
  const transcription = buildTranscriptText(segments);
  const languageHint = options?.language
    ? `Transcript language code: ${options.language}.`
    : "";
  const excludeRanges = Array.isArray(options?.excludeRanges)
    ? options.excludeRanges
        .map((range) => ({
          start: Number(range.start),
          end: Number(range.end),
        }))
        .filter(
          (range) =>
            Number.isFinite(range.start) &&
            Number.isFinite(range.end) &&
            range.end > range.start
        )
    : [];
  const excludeHint = excludeRanges.length
    ? `Avoid these timestamp ranges (seconds): ${excludeRanges
        .map(
          (range) => `${range.start.toFixed(2)}-${range.end.toFixed(2)}`
        )
        .join(", ")}.`
    : "";
  const instructions = options?.instructions?.trim();
  const description = options?.description?.trim();
  const highlightCountInstruction =
    minHighlights === requestedHighlights
      ? `Return ${requestedHighlights} distinct options when possible; avoid significant overlap.`
      : `Return between ${minHighlights} and ${requestedHighlights} distinct options when possible; avoid significant overlap and aim for ${requestedHighlights}.`;
  const shortageInstruction =
    minHighlights === requestedHighlights
      ? "If there are fewer than requested, return as many strong options as possible."
      : `If you cannot find ${requestedHighlights}, return as many strong options as possible (minimum ${minHighlights} if the transcript allows).`;
  const systemPrompt = [
    "You are a world-class short-form video clipping editor (YouTube Shorts, TikTok, Reels).",
    "The input contains a timestamped transcription of a video.",
    "Your goal is to select only moments that are truly clip-worthy and likely to perform.",
    "Every selected clip must stand on its own and make sense to someone who has not seen the rest of the video.",
    "Each clip should include enough setup/context, a clear hook, and a payoff or strong takeaway.",
    "Prefer moments that are surprising, emotionally charged, funny, controversial, high-tension, or deliver a sharp insight.",
    "Avoid random snippets, weak transitions, greetings, sponsor reads, housekeeping, repeated info, and low-energy filler.",
    "Consider the full timeline and prefer highlights from different sections when possible, not just the opening.",
    `Select each segment between ${limits.minLength.toFixed(0)} and ${limits.maxLength.toFixed(0)} seconds.`,
    "Prefer 18-45 second clips for short-form performance unless a longer setup is truly required for context/payoff.",
    "Only return clips longer than 55 seconds when there is no shorter option that still preserves the hook and payoff.",
    "Start shortly before the moment gets interesting and end shortly after the payoff lands.",
    "The selected text should contain complete sentences and a complete thought.",
    "Choose start and end times that align with transcript segment boundaries.",
    "Do not cut in the middle of sentences; prefer sentence-ending punctuation at the clip end.",
    "Use the same language as the transcript. Do not translate.",
    "Write a short-form viral title for each clip: punchy, curiosity-driven, and optimized for YouTube Shorts.",
    "Titles should be 4-10 words, use power words/emotion, and can include 1 emoji (optional).",
    "Prefer hooks: questions, bold claims, tension, humor, or controversy (without adding new facts).",
    "You may paraphrase freely or invent a creative hook based on the clip; do not repeat the transcript verbatim.",
    "Avoid adding facts that are not clearly implied by the clip.",
    highlightCountInstruction,
    shortageInstruction,
    "If you cannot reach the requested count with distinct clips, allow mild overlap to reach the target.",
    "For each clip include a viralityScore from 0 to 100 based on hook strength, emotional pull, and payoff.",
    excludeHint,
    languageHint,
    "Return JSON only in the following structure:",
    `{"highlights":[{"start":0,"end":20,"title":"...","viralityScore":85}]}`,
  ].join(" ");
  const userPrompt = [
    instructions ? `User instructions: ${instructions}` : null,
    description ? `Video description: ${description}` : null,
    "Transcript:",
    transcription,
  ]
    .filter(Boolean)
    .join("\n");

  const isGpt5Model = model.startsWith("gpt-5");
  const maxTokens = Math.max(300, requestedHighlights * 120);
  const maxTokenConfig = isGpt5Model
    ? { max_completion_tokens: maxTokens }
    : { max_tokens: maxTokens };
  const requestBody: Record<string, unknown> = {
    model,
    ...maxTokenConfig,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "highlight_selection",
        strict: true,
        schema: {
          type: "object",
          properties: {
            highlights: {
              type: "array",
              minItems: minHighlights,
              maxItems: requestedHighlights,
              items: {
                type: "object",
                properties: {
                  start: { type: "number" },
                  end: { type: "number" },
                  title: { type: "string" },
                  viralityScore: { type: "number" },
                },
                required: ["start", "end", "title", "viralityScore"],
                additionalProperties: false,
              },
            },
          },
          required: ["highlights"],
          additionalProperties: false,
        },
      },
    },
  };
  if (!isGpt5Model) {
    requestBody.temperature = 0.35;
  }
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Highlight selection failed.");
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const responseContent = data.choices?.[0]?.message?.content ?? "";
  const jsonBlock = extractJsonBlock(responseContent);
  const parsed = jsonBlock
    ? safeParseJson<{ highlights: HighlightCandidatePayload[] }>(
        jsonBlock
      )
    : null;
  const candidates = Array.isArray(parsed?.highlights)
    ? parsed?.highlights ?? []
    : [];
  const normalized = candidates
    .map((item) => {
      const rawStart = Number(item.start);
      const rawEnd = Number(item.end);
      const normalized = normalizeHighlightRangeWithLimits(rawStart, rawEnd, limits);
      const aligned = alignHighlightRangeToSegments(
        segments,
        normalized.start,
        normalized.end,
        limits
      );
      if (
        !Number.isFinite(aligned.start) ||
        !Number.isFinite(aligned.end) ||
        aligned.end <= aligned.start
      ) {
        return null;
      }
      const content = buildHighlightContent(
        segments,
        aligned.start,
        aligned.end
      );
      if (!content) {
        return null;
      }
      const rawTitle = String(item.title ?? "").trim();
      const fallbackTitle = content
        ? content.split(/\s+/).slice(0, 8).join(" ")
        : "";
      const highlight = {
        start: aligned.start,
        end: aligned.end,
        content,
        title: rawTitle || fallbackTitle || undefined,
      };
      const modelScore = normalizeViralityScore(item.viralityScore);
      return {
        highlight,
        score: scoreHighlightCandidate(highlight, modelScore),
      };
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value)) as ScoredHighlight[];

  const coverageSeed = buildCoverageHighlights(
    segments,
    requestedHighlights,
    options?.durationSeconds ?? null,
    excludeRanges,
    requestedHighlights
  ).map((highlight) => ({
    highlight,
    score: scoreHighlightCandidate(highlight, 56),
  }));

  const dedupedMap = new Map<string, ScoredHighlight>();
  [...normalized, ...coverageSeed].forEach((item) => {
    const key = `${item.highlight.start.toFixed(2)}-${item.highlight.end.toFixed(
      2
    )}`;
    const existing = dedupedMap.get(key);
    if (!existing || item.score > existing.score) {
      dedupedMap.set(key, item);
    }
  });

  const ranked = Array.from(dedupedMap.values()).sort(
    (a, b) => b.score - a.score
  );
  const selectedRanked: ScoredHighlight[] = [];
  const canAddCandidate = (candidate: ScoredHighlight) => {
    if (
      excludeRanges.some((range) =>
        isSignificantOverlap(candidate.highlight, range)
      ) ||
      selectedRanked.some((item) =>
        isSignificantOverlap(candidate.highlight, item.highlight)
      )
    ) {
      return false;
    }
    return true;
  };
  const durationForDiversity =
    limits.duration && Number.isFinite(limits.duration) && limits.duration > 0
      ? (limits.duration as number)
      : resolveTranscriptDuration(segments) ?? 0;
  if (durationForDiversity >= 8 * 60 && requestedHighlights >= 4) {
    const binCount = Math.min(requestedHighlights, 6);
    const binSize = durationForDiversity / binCount;
    const usedIndexes = new Set<number>();
    for (let bin = 0; bin < binCount; bin += 1) {
      if (selectedRanked.length >= requestedHighlights) {
        break;
      }
      const binStart = bin * binSize;
      const binEnd = bin === binCount - 1 ? durationForDiversity + 1 : (bin + 1) * binSize;
      const candidateIndex = ranked.findIndex(
        (candidate, index) =>
          !usedIndexes.has(index) &&
          candidate.highlight.start >= binStart &&
          candidate.highlight.start < binEnd &&
          canAddCandidate(candidate)
      );
      if (candidateIndex >= 0) {
        usedIndexes.add(candidateIndex);
        selectedRanked.push(ranked[candidateIndex]);
      }
    }
  }
  ranked.forEach((candidate) => {
    if (selectedRanked.length >= requestedHighlights) {
      return;
    }
    if (!canAddCandidate(candidate)) {
      return;
    }
    selectedRanked.push(candidate);
  });

  const highlights = selectedRanked
    .slice(0, requestedHighlights)
    .map((item) => item.highlight);
  if (highlights.length < requestedHighlights) {
    const fallback = buildFallbackHighlights(
      segments,
      requestedHighlights - highlights.length,
      options?.durationSeconds ?? null,
      [...excludeRanges, ...highlights],
      requestedHighlights
    );
    highlights.push(...fallback);
  }
  if (highlights.length < requestedHighlights) {
    const coverage = buildCoverageHighlights(
      segments,
      requestedHighlights - highlights.length,
      options?.durationSeconds ?? null,
      [...excludeRanges, ...highlights],
      requestedHighlights
    );
    highlights.push(...coverage);
  }
  if (highlights.length < minHighlights) {
    const coverage = buildCoverageHighlights(
      segments,
      minHighlights - highlights.length,
      options?.durationSeconds ?? null,
      [...excludeRanges, ...highlights],
      requestedHighlights
    );
    highlights.push(...coverage);
  }
  if (highlights.length < minHighlights) {
    const timeline = buildTimelineHighlights(
      segments,
      minHighlights - highlights.length,
      options?.durationSeconds ?? null,
      [...excludeRanges, ...highlights],
      requestedHighlights
    );
    highlights.push(...timeline);
  }
  if (highlights.length < minHighlights) {
    const forced = buildForcedTimelineHighlights(
      segments,
      minHighlights - highlights.length,
      options?.durationSeconds ?? null,
      [...excludeRanges, ...highlights],
      requestedHighlights
    );
    highlights.push(...forced);
  }
  if (!highlights.length) {
    throw new Error("Highlight selection returned empty result.");
  }
  return highlights.slice(0, Math.min(requestedHighlights, highlights.length));
};

export const updateHighlightWithRange = (
  segments: TranscriptSegment[],
  start: number,
  end: number,
  title?: string | null,
  durationOverride?: number | null
): AutoClipHighlight => {
  const normalized = normalizeEditableRange(
    segments,
    start,
    end,
    durationOverride
  );
  const content = buildHighlightContent(
    segments,
    normalized.start,
    normalized.end
  );
  const normalizedTitle = title ? String(title).trim() : "";
  const fallbackTitle = content
    ? content.split(/\s+/).slice(0, 8).join(" ")
    : "";
  return {
    start: normalized.start,
    end: normalized.end,
    content,
    title: normalizedTitle || fallbackTitle || undefined,
  };
};
