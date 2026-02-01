import Image from "next/image";
import { supabaseServer } from "@/lib/supabase/server";

export default async function WaitlistNumberPage() {
  // Get the count of waitlist signups
  const { count, error } = await supabaseServer
    .from("waitlist")
    .select("*", { count: "exact", head: true });

  const waitlistCount = error ? 0 : (count ?? 0);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4">
      <div className="w-full max-w-2xl text-center">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <Image
            src="/logo-satura.png"
            alt="Satura Logo"
            width={160}
            height={42}
            className="h-10 w-auto"
            priority
          />
        </div>

        {/* Title */}
        <h1 className="mb-3 text-3xl font-semibold text-gray-900 sm:text-4xl">
          Waitlist Signups
        </h1>
        <p className="mb-12 text-lg text-gray-600">
          People waiting to join Satura
        </p>

        {/* Count Display */}
        <div className="rounded-2xl border border-gray-200 bg-white p-12 shadow-lg">
          <div className="text-7xl font-bold text-[#335CFF] sm:text-8xl">
            {waitlistCount.toLocaleString()}
          </div>
          <p className="mt-4 text-base text-gray-500">
            {waitlistCount === 1 ? "person" : "people"} signed up
          </p>
        </div>

        {/* Footer note */}
        <p className="mt-8 text-sm text-gray-400">
          Live count • Updates automatically
        </p>
      </div>
    </div>
  );
}
