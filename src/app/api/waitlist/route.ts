import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    // Validate email
    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: "Supabase credentials are not configured" },
        { status: 500 }
      );
    }

    const supabase = createSupabaseClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Get request metadata
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";

    // Insert email into waitlist
    const { error } = await supabase
      .from("waitlist")
      .insert({
        email: email.toLowerCase().trim(),
        source: "landing_page",
        ip_address: ip,
        user_agent: userAgent,
      });

    if (error) {
      // Check if it's a duplicate email error
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "This email is already on the waitlist!", alreadyExists: true },
          { status: 409 }
        );
      }

      if (error.code === "42P01") {
        return NextResponse.json(
          { error: "Waitlist table is missing. Run the Supabase migrations." },
          { status: 500 }
        );
      }

      if (error.code === "42501") {
        return NextResponse.json(
          { error: "Waitlist insert blocked by database policy." },
          { status: 500 }
        );
      }

      console.error("Waitlist insert error:", error);
      return NextResponse.json(
        { error: "Failed to join waitlist" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, message: "Successfully joined the waitlist!" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Waitlist API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
