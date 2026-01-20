import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server-client";
import { supabaseServer } from "@/lib/supabase/server";
import { exchangeCodeForTokens } from "@/lib/youtube/oauth";
import { fetchChannels } from "@/lib/youtube/api";

const getRedirectUri = (): string => {
  if (process.env.YOUTUBE_OAUTH_REDIRECT_URI) {
    return process.env.YOUTUBE_OAUTH_REDIRECT_URI;
  }
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";
  return `${siteUrl}/api/trust-score/oauth/callback`;
};

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const storedState = cookieStore.get("yt_oauth_state")?.value;
  const returnTo = cookieStore.get("yt_oauth_return_to")?.value ?? "/tools/trust-score";

  cookieStore.delete("yt_oauth_state");
  cookieStore.delete("yt_oauth_return_to");

  if (!code || !state || !storedState || state !== storedState) {
    return NextResponse.redirect(
      new URL(`${returnTo}?error=oauth_state`, request.url)
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const tokens = await exchangeCodeForTokens({
      code,
      redirectUri: getRedirectUri(),
    });

    const accessToken = tokens.access_token;
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    const scopes = tokens.scope ? tokens.scope.split(" ") : [];

    const channels = await fetchChannels(accessToken);
    if (channels.length === 0) {
      return NextResponse.redirect(
        new URL(`${returnTo}?error=no_channels`, request.url)
      );
    }

    for (const channel of channels) {
      await supabaseServer.from("youtube_channels").upsert(
        {
          user_id: user.id,
          channel_id: channel.id,
          channel_title: channel.title,
          channel_description: channel.description,
          channel_handle: channel.customUrl,
          channel_thumbnail_url: channel.thumbnails[0]?.url ?? null,
          channel_keywords: channel.keywords ?? null,
          long_uploads_status: channel.longUploadsStatus ?? null,
          country: channel.country,
          published_at: channel.publishedAt ? new Date(channel.publishedAt) : null,
          uploads_playlist_id: channel.uploadsPlaylistId,
          last_connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,channel_id" }
      );

      const existingToken = await supabaseServer
        .from("youtube_channel_tokens")
        .select("refresh_token")
        .eq("user_id", user.id)
        .eq("channel_id", channel.id)
        .maybeSingle();

      const refreshToken =
        tokens.refresh_token ?? existingToken.data?.refresh_token ?? null;

      await supabaseServer.from("youtube_channel_tokens").upsert(
        {
          user_id: user.id,
          channel_id: channel.id,
          access_token: accessToken,
          refresh_token: refreshToken,
          token_expires_at: expiresAt.toISOString(),
          scopes,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,channel_id" }
      );
    }

    return NextResponse.redirect(new URL(`${returnTo}?connected=1`, request.url));
  } catch {
    return NextResponse.redirect(
      new URL(`${returnTo}?error=oauth_failed`, request.url)
    );
  }
}
