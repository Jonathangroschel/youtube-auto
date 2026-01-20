const GOOGLE_OAUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
];

const getEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
};

export const getYoutubeOAuthUrl = ({
  state,
  redirectUri,
}: {
  state: string;
  redirectUri: string;
}): string => {
  const params = new URLSearchParams({
    client_id: getEnv("YOUTUBE_OAUTH_CLIENT_ID"),
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: YOUTUBE_SCOPES.join(" "),
    state,
  });

  return `${GOOGLE_OAUTH_BASE}?${params.toString()}`;
};

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
};

export const exchangeCodeForTokens = async ({
  code,
  redirectUri,
}: {
  code: string;
  redirectUri: string;
}): Promise<TokenResponse> => {
  const body = new URLSearchParams({
    code,
    client_id: getEnv("YOUTUBE_OAUTH_CLIENT_ID"),
    client_secret: getEnv("YOUTUBE_OAUTH_CLIENT_SECRET"),
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to exchange code for tokens: ${errorText}`);
  }

  return (await response.json()) as TokenResponse;
};

export const refreshAccessToken = async (
  refreshToken: string
): Promise<TokenResponse> => {
  const body = new URLSearchParams({
    client_id: getEnv("YOUTUBE_OAUTH_CLIENT_ID"),
    client_secret: getEnv("YOUTUBE_OAUTH_CLIENT_SECRET"),
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to refresh access token: ${errorText}`);
  }

  return (await response.json()) as TokenResponse;
};
