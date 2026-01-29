import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Only run auth/session middleware on app/auth routes (keeps marketing pages cacheable and public).
    "/dashboard/:path*",
    "/editor/:path*",
    "/projects/:path*",
    "/assets/:path*",
    "/tools/:path*",
    "/login",
  ],
};
