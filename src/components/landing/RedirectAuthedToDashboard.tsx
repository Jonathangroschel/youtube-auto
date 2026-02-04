"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RedirectAuthedToDashboard() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | null = null;
    let idleId: number | null = null;

    const checkSession = async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!cancelled && session) {
          router.replace("/dashboard");
        }
      } catch {
        // If session lookup fails, keep showing the marketing page.
      }
    };

    const idleWindow = window as Window & {
      requestIdleCallback?: (
        callback: () => void,
        options?: { timeout?: number }
      ) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    if (idleWindow.requestIdleCallback) {
      idleId = idleWindow.requestIdleCallback(
        () => {
          void checkSession();
        },
        { timeout: 2500 }
      );
    } else {
      timeoutId = window.setTimeout(() => {
        void checkSession();
      }, 800);
    }

    return () => {
      cancelled = true;
      if (idleId !== null) {
        idleWindow.cancelIdleCallback?.(idleId);
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [router]);

  return null;
}
