import { AssistantClient } from "./assistant-client";
import { getRagSettings } from "../lib/rag/config";

export default function Home() {
  const settings = getRagSettings();

  return (
    <AssistantClient
      stats={{
        chunk_size: settings.chunkSize,
        overlap_ratio: settings.overlapRatio,
        top_k: settings.topK
      }}
    />
  );
}
