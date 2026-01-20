import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server-client";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F6F8FC] text-[#0E121B]">
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-2xl text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E7EDFF] text-lg font-semibold text-[#335CFF]">
            YA
          </div>
          <h1 className="text-2xl font-semibold md:text-3xl">
            Satura Trust Score
          </h1>
          <p className="mt-3 text-sm text-gray-500 md:text-base">
            Connect your YouTube channel, analyze performance, and get a clear
            path to improve credibility.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              className="inline-flex items-center justify-center rounded-full bg-[#335CFF] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2B4FE0]"
              href="/login"
            >
              Sign in
            </a>
            <a
              className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-white px-5 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
              href="/dashboard"
            >
              Go to dashboard
            </a>
          </div>
        </div>
      </main>
      <footer className="border-t border-gray-200 py-4 text-[11px] text-gray-500">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-2 px-6 sm:flex-row">
          <span>Privacy and terms</span>
          <div className="flex items-center gap-4">
            <a className="transition-colors hover:text-gray-700" href="/privacy-policy">
              Privacy Policy
            </a>
            <a className="transition-colors hover:text-gray-700" href="/terms-of-service">
              Terms of Service
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
