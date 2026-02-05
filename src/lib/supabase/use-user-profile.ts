"use client";

import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

type UserProfile = {
  user: User | null;
  userEmail: string;
  userName: string;
  userAvatar: string | null;
  userAvatarSrc: string;
  userInitials: string;
};

const toTrimmedString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const defaultAvatarSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img" aria-label="Default profile avatar">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#9aed00" />
      <stop offset="50%" stop-color="#00c2ff" />
      <stop offset="100%" stop-color="#6a47ff" />
    </linearGradient>
  </defs>
  <rect width="96" height="96" rx="48" fill="url(#g)" />
  <circle cx="74" cy="22" r="20" fill="rgba(255,255,255,0.22)" />
  <circle cx="18" cy="82" r="22" fill="rgba(255,255,255,0.16)" />
</svg>
`;

const defaultAvatarSrc = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
  defaultAvatarSvg
)}`;

export const useUserProfile = (): UserProfile => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let active = true;

    const loadUser = async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const {
        data: { user: nextUser },
      } = await supabase.auth.getUser();
      if (active) {
        setUser(nextUser);
      }
    };

    void loadUser();
    return () => {
      active = false;
    };
  }, []);

  const userEmail = toTrimmedString(user?.email);
  const userName =
    [
      user?.user_metadata?.full_name,
      user?.user_metadata?.name,
      userEmail.split("@")[0],
      "User",
    ]
      .map(toTrimmedString)
      .find((value) => value.length > 0) ?? "User";
  const userAvatarCandidate =
    user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture;
  const userAvatar = toTrimmedString(userAvatarCandidate) || null;
  const userAvatarSrc = userAvatar ?? defaultAvatarSrc;
  const userInitials =
    userName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "U";

  return {
    user,
    userEmail,
    userName,
    userAvatar,
    userAvatarSrc,
    userInitials,
  };
};
