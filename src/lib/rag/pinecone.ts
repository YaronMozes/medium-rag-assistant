import { Pinecone, type RecordMetadata } from "@pinecone-database/pinecone";
import {
  EMBEDDING_DIMENSIONS,
  getPineconeConfig,
  getRagSettings
} from "./config";
import type { ArticleChunkMetadata, RetrievedContext } from "./types";

type PineconeArticleMetadata = ArticleChunkMetadata & RecordMetadata;

let client: Pinecone | undefined;

export function getPineconeClient(): Pinecone {
  if (!client) {
    client = new Pinecone({
      apiKey: getPineconeConfig().apiKey
    });
  }

  return client;
}

export async function ensurePineconeIndex(): Promise<void> {
  const pc = getPineconeClient();
  const { indexName, cloud, region } = getPineconeConfig();
  const indexes = await pc.listIndexes();
  const existing = indexes.indexes?.find((index) => index.name === indexName);

  if (!existing) {
    await pc.createIndex({
      name: indexName,
      dimension: EMBEDDING_DIMENSIONS,
      metric: "cosine",
      spec: {
        serverless: {
          cloud,
          region
        }
      },
      waitUntilReady: true,
      suppressConflicts: true
    });

    return;
  }

  const described = await pc.describeIndex(indexName);
  if (described.dimension !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Pinecone index ${indexName} has dimension ${described.dimension}; expected ${EMBEDDING_DIMENSIONS}`
    );
  }
}

export async function getArticleIndex() {
  const pc = getPineconeClient();
  const { indexName } = getPineconeConfig();
  const described = await pc.describeIndex(indexName);

  if (!described.host) {
    throw new Error(`Pinecone index ${indexName} does not have a host yet`);
  }

  return pc.index<PineconeArticleMetadata>({ host: described.host });
}

export async function queryArticleChunks(
  embedding: number[],
  topK = getRagSettings().topK
): Promise<RetrievedContext[]> {
  const index = await getArticleIndex();
  const { namespace } = getRagSettings();
  const fetchK = Math.min(topK * 3, 30);
  const response = await index.query({
    vector: embedding,
    topK: fetchK,
    includeMetadata: true,
    namespace
  });

  const articleCounts = new Map<string, number>();

  const contexts: RetrievedContext[] = response.matches.flatMap((match) => {
      const metadata = match.metadata;
      if (!metadata) {
        return [];
      }

      const context = {
        article_id: String(metadata.article_id ?? ""),
        title: String(metadata.title ?? ""),
        chunk: String(metadata.chunk ?? ""),
        score: Number(match.score ?? 0),
        authors: String(metadata.authors ?? "") || undefined,
        url: String(metadata.url ?? "") || undefined,
        tags: String(metadata.tags ?? "") || undefined
      };

      return context.chunk ? [context] : [];
    });

  return contexts
    .filter((item) => {
      const currentCount = articleCounts.get(item.article_id) ?? 0;
      if (currentCount >= 2) {
        return false;
      }

      articleCounts.set(item.article_id, currentCount + 1);
      return true;
    })
    .slice(0, topK);
}
