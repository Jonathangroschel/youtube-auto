"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function RedirectAuthedToDashboard() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    // Client-side redirect keeps the homepage statically cacheable for SEO/verification,
    // while still taking logged-in users straight to the app.
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (cancelled) {
          return;
        }
        if (session) {
          router.replace("/dashboard");
        }
      })
      .catch(() => {
        // If session lookup fails, keep showing the marketing page.
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}

