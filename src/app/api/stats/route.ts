import { NextResponse } from "next/server";
import { getRagSettings } from "../../../lib/rag/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const settings = getRagSettings();

  return NextResponse.json({
    chunk_size: settings.chunkSize,
    overlap_ratio: settings.overlapRatio,
    top_k: settings.topK
  });
}
