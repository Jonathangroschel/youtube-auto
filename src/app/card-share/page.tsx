import Link from "next/link";
import { TrustScoreGradientCard } from "@/components/trust-score/trust-score-share-experience";

type CardSharePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const getFirstParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const parseSharedScore = (value?: string) => {
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.max(0, Math.min(100, parsed));
};

const sanitizeChannel = (value?: string) => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.slice(0, 80);
};

export default async function CardSharePage({ searchParams }: CardSharePageProps) {
  const resolvedSearchParams = await searchParams;
  const score = parseSharedScore(getFirstParam(resolvedSearchParams.score));
  const channelTitle = sanitizeChannel(getFirstParam(resolvedSearchParams.channel));
  const headline = channelTitle ? `${channelTitle} Scored ${score}` : `Creator Scored ${score}`;

  if (score === null) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#020306] px-6 py-16 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(172,92,255,0.22),transparent_58%),radial-gradient(circle_at_20%_100%,rgba(56,189,248,0.16),transparent_62%)]" />
        <div className="relative mx-auto max-w-lg rounded-[28px] border border-[rgba(255,255,255,0.1)] bg-[rgba(4,5,7,0.92)] p-8 text-center">
          <p className="text-sm text-white/65">This share link is invalid.</p>
          <div className="mt-6">
            <Link
              href="/login"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-[#9aed00] px-6 text-sm font-semibold text-black transition-colors hover:bg-[#8ad600]"
            >
              Check your score
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#020306] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(172,92,255,0.28),transparent_56%),radial-gradient(circle_at_10%_100%,rgba(56,189,248,0.2),transparent_62%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[560px] flex-col items-center justify-center px-4 py-10 text-center sm:px-6 sm:py-12">
        <h1 className="max-w-[16ch] text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          {headline}
        </h1>
        <p className="mt-3 max-w-[26ch] text-base text-white/60 sm:text-lg">
          See how your channel compares in under a minute.
        </p>

        <div className="mt-6">
          <div className="origin-top scale-[0.82] min-[430px]:scale-[0.9] sm:scale-100">
            <TrustScoreGradientCard score={score} channelTitle={channelTitle} />
          </div>
        </div>

        <Link
          href="/login"
          className="mt-6 inline-flex h-12 min-w-[220px] items-center justify-center rounded-xl bg-[#9aed00] px-6 text-base font-semibold text-black transition-colors hover:bg-[#8ad600] sm:min-w-[240px]"
        >
          Check your score
        </Link>
      </div>
    </main>
  );
}
