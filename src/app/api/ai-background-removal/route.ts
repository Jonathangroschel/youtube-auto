import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";

export const runtime = "nodejs";

const OUTPUT_CODEC = "vp9";

type IncomingPayload = {
  videoUrl?: string;
  subjectIsPerson?: boolean;
};

export async function POST(request: Request) {
  const apiKey = process.env.FAL_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing FAL_KEY." }, { status: 500 });
  }

  let payload: IncomingPayload = {};
  try {
    payload = (await request.json()) as IncomingPayload;
  } catch {
    payload = {};
  }

  const videoUrl =
    typeof payload.videoUrl === "string" ? payload.videoUrl.trim() : "";
  if (!videoUrl) {
    return NextResponse.json({ error: "Video URL is required." }, { status: 400 });
  }

  const subjectIsPerson =
    typeof payload.subjectIsPerson === "boolean" ? payload.subjectIsPerson : true;

  fal.config({ credentials: apiKey });

  try {
    const result = await fal.subscribe("veed/video-background-removal", {
      input: {
        video_url: videoUrl,
        output_codec: OUTPUT_CODEC,
        refine_foreground_edges: true,
        subject_is_person: subjectIsPerson,
      },
      logs: true,
    });

    return NextResponse.json({
      ...result.data,
      requestId: result.requestId,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Background removal failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
