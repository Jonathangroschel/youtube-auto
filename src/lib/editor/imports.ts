export type SplitScreenLayout = "stacked" | "side-by-side";

export type SplitScreenImportPayloadV1 = {
  version: 1;
  layout: SplitScreenLayout;
  mainVideo: {
    url: string;
    name: string;
    assetId?: string | null;
  };
  backgroundVideo: {
    url: string;
    name: string;
  };
  subtitles: {
    autoGenerate: boolean;
    styleId: string | null;
  };
};

export type StreamerVideoImportPayloadV1 = {
  version: 1;
  mainVideo: {
    url?: string;
    name: string;
    assetId?: string | null;
  };
  titleText: string;
  subtitles: {
    autoGenerate: boolean;
    styleId: string | null;
  };
};

export type RedditVideoImportPayloadV1 = {
  version: 1;
  post: {
    username: string;
    avatarUrl: string;
    likes: string;
    comments: string;
    title: string;
    darkMode: boolean;
    showIntroCard: boolean;
  };
  script: string;
  gameplay: {
    url: string;
    name: string;
  };
  subtitles: {
    styleId: string | null;
    mode: "one-word" | "lines";
  };
  audio: {
    introVoice: string | null;
    scriptVoice: string;
    backgroundMusic?: {
      url: string;
      name: string;
      volume?: number;
    } | null;
  };
  timing: {
    introSeconds: number;
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const parseSplitScreenImportPayload = (
  raw: string | null
): SplitScreenImportPayloadV1 | null => {
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return null;
    }
    if (parsed.version !== 1) {
      return null;
    }
    const layout =
      parsed.layout === "stacked" || parsed.layout === "side-by-side"
        ? parsed.layout
        : null;
    if (!layout) {
      return null;
    }
    const mainVideo = isRecord(parsed.mainVideo) ? parsed.mainVideo : null;
    const backgroundVideo = isRecord(parsed.backgroundVideo)
      ? parsed.backgroundVideo
      : null;
    const subtitles = isRecord(parsed.subtitles) ? parsed.subtitles : null;
    if (!mainVideo || !backgroundVideo || !subtitles) {
      return null;
    }
    const mainUrl = typeof mainVideo.url === "string" ? mainVideo.url.trim() : "";
    const mainName =
      typeof mainVideo.name === "string" && mainVideo.name.trim().length > 0
        ? mainVideo.name.trim()
        : "Main video";
    const backgroundUrl =
      typeof backgroundVideo.url === "string" ? backgroundVideo.url.trim() : "";
    const backgroundName =
      typeof backgroundVideo.name === "string" &&
      backgroundVideo.name.trim().length > 0
        ? backgroundVideo.name.trim()
        : "Background video";
    if (!mainUrl || !backgroundUrl) {
      return null;
    }
    const assetId =
      typeof mainVideo.assetId === "string" && mainVideo.assetId.trim().length > 0
        ? mainVideo.assetId.trim()
        : null;
    const styleId =
      typeof subtitles.styleId === "string" && subtitles.styleId.trim().length > 0
        ? subtitles.styleId.trim()
        : null;
    const autoGenerate = Boolean(subtitles.autoGenerate);
    return {
      version: 1,
      layout,
      mainVideo: {
        url: mainUrl,
        name: mainName,
        assetId,
      },
      backgroundVideo: {
        url: backgroundUrl,
        name: backgroundName,
      },
      subtitles: {
        autoGenerate,
        styleId,
      },
    };
  } catch {
    return null;
  }
};

export const parseRedditVideoImportPayload = (
  raw: string | null
): RedditVideoImportPayloadV1 | null => {
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== 1) {
      return null;
    }

    const post = isRecord(parsed.post) ? parsed.post : null;
    const gameplay = isRecord(parsed.gameplay) ? parsed.gameplay : null;
    const subtitles = isRecord(parsed.subtitles) ? parsed.subtitles : null;
    const audio = isRecord(parsed.audio) ? parsed.audio : null;
    const timing = isRecord(parsed.timing) ? parsed.timing : null;

    if (!post || !gameplay || !subtitles || !audio || !timing) {
      return null;
    }

    const username =
      typeof post.username === "string" && post.username.trim().length > 0
        ? post.username.trim()
        : "reddit-user";
    const avatarUrl =
      typeof post.avatarUrl === "string" ? post.avatarUrl.trim() : "";
    const likes =
      typeof post.likes === "string" && post.likes.trim().length > 0
        ? post.likes.trim()
        : "0";
    const comments =
      typeof post.comments === "string" && post.comments.trim().length > 0
        ? post.comments.trim()
        : "0";
    const title =
      typeof post.title === "string" ? post.title.trim() : "";
    if (!avatarUrl || !title) {
      return null;
    }
    const darkMode = Boolean(post.darkMode);
    const parseOptionalBoolean = (value: unknown, defaultValue: boolean) => {
      if (typeof value === "boolean") {
        return value;
      }
      if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (!normalized) {
          return defaultValue;
        }
        if (["true", "1", "yes", "y", "on"].includes(normalized)) {
          return true;
        }
        if (["false", "0", "no", "n", "off"].includes(normalized)) {
          return false;
        }
        return defaultValue;
      }
      if (typeof value === "number" && Number.isFinite(value)) {
        return value !== 0;
      }
      return defaultValue;
    };
    // Default to showing the intro card for older payloads that predate this field.
    const showIntroCard = parseOptionalBoolean(post.showIntroCard, true);

    const scriptValue = parsed.script;
    const script = typeof scriptValue === "string" ? scriptValue.trim() : "";
    if (!script) {
      return null;
    }

    const gameplayUrl =
      typeof gameplay.url === "string" ? gameplay.url.trim() : "";
    const gameplayName =
      typeof gameplay.name === "string" && gameplay.name.trim().length > 0
        ? gameplay.name.trim()
        : "Gameplay footage";
    if (!gameplayUrl) {
      return null;
    }

    const subtitleMode =
      subtitles.mode === "one-word" || subtitles.mode === "lines"
        ? subtitles.mode
        : null;
    if (!subtitleMode) {
      return null;
    }
    const subtitleStyleId =
      typeof subtitles.styleId === "string" && subtitles.styleId.trim().length > 0
        ? subtitles.styleId.trim()
        : null;

    const introVoice =
      typeof audio.introVoice === "string" && audio.introVoice.trim().length > 0
        ? audio.introVoice.trim()
        : null;
    const scriptVoice =
      typeof audio.scriptVoice === "string" ? audio.scriptVoice.trim() : "";
    if (!scriptVoice) {
      return null;
    }

    const backgroundMusic = isRecord(audio.backgroundMusic)
      ? audio.backgroundMusic
      : null;
    const musicUrl =
      typeof backgroundMusic?.url === "string"
        ? backgroundMusic.url.trim()
        : "";
    const musicName =
      typeof backgroundMusic?.name === "string" &&
      backgroundMusic.name.trim().length > 0
        ? backgroundMusic.name.trim()
        : "";
    const musicVolume =
      typeof backgroundMusic?.volume === "number" &&
      Number.isFinite(backgroundMusic.volume)
        ? backgroundMusic.volume
        : undefined;
    const normalizedMusic =
      musicUrl && musicName
        ? { url: musicUrl, name: musicName, volume: musicVolume }
        : null;

    const introSeconds =
      typeof timing.introSeconds === "number" && Number.isFinite(timing.introSeconds)
        ? Math.max(0, timing.introSeconds)
        : 3;

    return {
      version: 1,
      post: {
        username,
        avatarUrl,
        likes,
        comments,
        title,
        darkMode,
        showIntroCard,
      },
      script,
      gameplay: { url: gameplayUrl, name: gameplayName },
      subtitles: { styleId: subtitleStyleId, mode: subtitleMode },
      audio: {
        introVoice,
        scriptVoice,
        backgroundMusic: normalizedMusic,
      },
      timing: { introSeconds },
    };
  } catch {
    return null;
  }
};
