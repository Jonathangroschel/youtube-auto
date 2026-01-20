import { NextResponse } from "next/server";
import crypto from "crypto";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server-client";
import { getYoutubeOAuthUrl } from "@/lib/youtube/oauth";

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const url = new URL(request.url);
  const returnTo = url.searchParams.get("returnTo") ?? "/tools/trust-score";
  const state = crypto.randomUUID();
  const cookieStore = await cookies();

  cookieStore.set("yt_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 10,
    path: "/",
  });

  cookieStore.set("yt_oauth_return_to", returnTo, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 10,
    path: "/",
  });

  const redirectUri = getRedirectUri();
  const oauthUrl = getYoutubeOAuthUrl({ state, redirectUri });
  return NextResponse.redirect(oauthUrl);
}
