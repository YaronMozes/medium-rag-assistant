export const EMBEDDING_DIMENSIONS = 1536;
export type RagSettings = {
  chunkSize: number;
  overlapRatio: number;
  topK: number;
  namespace: string;
};

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function parseNumber(name: string, fallback: number): number {
  const raw = optionalEnv(name);
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be a valid number`);
  }

  return parsed;
}

function parseInteger(name: string, fallback: number): number {
  const parsed = parseNumber(name, fallback);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${name} must be an integer`);
  }

  return parsed;
}

export function getRagSettings(): RagSettings {
  const chunkSize = parseInteger("RAG_CHUNK_SIZE", 800);
  const overlapRatio = parseNumber("RAG_OVERLAP_RATIO", 0.2);
  const topK = parseInteger("RAG_TOP_K", 7);

  if (chunkSize < 1 || chunkSize > 1024) {
    throw new Error("RAG_CHUNK_SIZE must be between 1 and 1024");
  }

  if (overlapRatio < 0 || overlapRatio > 0.3) {
    throw new Error("RAG_OVERLAP_RATIO must be between 0 and 0.3");
  }

  if (topK < 1 || topK > 30) {
    throw new Error("RAG_TOP_K must be between 1 and 30");
  }

  const namespace =
    optionalEnv("PINECONE_NAMESPACE") ??
    `medium-c${chunkSize}-o${Math.round(overlapRatio * 100)}`;

  return {
    chunkSize,
    overlapRatio,
    topK,
    namespace
  };
}

export function getModelConfig() {
  return {
    apiKey: requireEnv("OPENAI_API_KEY"),
    baseURL: optionalEnv("OPENAI_BASE_URL"),
    chatModel: optionalEnv("CHAT_MODEL") ?? "4UHRUIN-gpt-5-mini",
    embeddingModel:
      optionalEnv("EMBEDDING_MODEL") ?? "4UHRUIN-text-embedding-3-small"
  };
}

export function getPineconeConfig() {
  return {
    apiKey: requireEnv("PINECONE_API_KEY"),
    indexName: optionalEnv("PINECONE_INDEX_NAME") ?? "medium-rag",
    cloud: optionalEnv("PINECONE_CLOUD") ?? "aws",
    region: optionalEnv("PINECONE_REGION") ?? "us-east-1"
  };
}
