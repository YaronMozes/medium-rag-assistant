import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse";
import dotenv from "dotenv";
import type { PineconeRecord } from "@pinecone-database/pinecone";
import {
  approximateTokens,
  buildEmbeddingInput,
  chunkText,
  normalizeText
} from "../src/lib/rag/chunk";
import { EMBEDDING_DIMENSIONS, getRagSettings } from "../src/lib/rag/config";
import { createEmbeddings } from "../src/lib/rag/llmod";
import {
  ensurePineconeIndex,
  getArticleIndex
} from "../src/lib/rag/pinecone";
import type { ArticleChunkMetadata, ArticleRow } from "../src/lib/rag/types";

dotenv.config({ path: ".env.local", quiet: true });

type PendingChunk = {
  id: string;
  input: string;
  metadata: ArticleChunkMetadata;
};

type CliOptions = {
  file: string;
  limit?: number;
  offset: number;
  embeddingBatchSize: number;
  dryRun: boolean;
};

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix));
  return value?.slice(prefix.length);
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function readOptionalInteger(name: string): number | undefined {
  const raw = readArg(name);
  if (!raw) {
    return undefined;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`--${name} must be a non-negative integer`);
  }

  return parsed;
}

function getOptions(): CliOptions {
  return {
    file: readArg("file") ?? "medium-english-50mb.csv",
    limit: readOptionalInteger("limit"),
    offset: readOptionalInteger("offset") ?? 0,
    embeddingBatchSize: readOptionalInteger("batch-size") ?? 48,
    dryRun: hasFlag("dry-run")
  };
}

function sanitizeRow(raw: Record<string, unknown>): ArticleRow {
  return {
    title: normalizeText(raw.title),
    text: normalizeText(raw.text),
    url: normalizeText(raw.url),
    authors: normalizeText(raw.authors),
    timestamp: normalizeText(raw.timestamp),
    tags: normalizeText(raw.tags)
  };
}

function createChunkId(articleId: string, chunkIndex: number): string {
  return `article-${articleId}-chunk-${chunkIndex}`;
}

async function withRetries<T>(
  label: string,
  operation: () => Promise<T>,
  attempts = 4
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) {
        break;
      }

      const delayMs = 1000 * 2 ** (attempt - 1);
      console.warn(
        `${label} failed on attempt ${attempt}; retrying in ${delayMs}ms`
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

async function main() {
  const options = getOptions();
  const settings = getRagSettings();
  const filePath = path.resolve(process.cwd(), options.file);

  if (!fs.existsSync(filePath)) {
    throw new Error(`CSV file not found: ${filePath}`);
  }

  console.log("Ingestion settings:");
  console.log(`  file: ${options.file}`);
  console.log(`  namespace: ${settings.namespace}`);
  console.log(`  chunk_size: ${settings.chunkSize}`);
  console.log(`  overlap_ratio: ${settings.overlapRatio}`);
  console.log(`  embedding_batch_size: ${options.embeddingBatchSize}`);
  console.log(`  limit: ${options.limit ?? "all"}`);
  console.log(`  offset: ${options.offset}`);
  console.log(`  dry_run: ${options.dryRun}`);

  if (options.dryRun) {
    console.log("Dry run enabled. Pinecone and LLMod will not be called.");
  } else {
    await ensurePineconeIndex();
  }

  const index = options.dryRun ? undefined : await getArticleIndex();
  const pending: PendingChunk[] = [];
  let seenArticles = 0;
  let processedArticles = 0;
  let skippedEmptyArticles = 0;
  let totalChunks = 0;
  let totalUpserted = 0;
  let totalApproxEmbeddingTokens = 0;

  async function flush() {
    while (pending.length > 0) {
      const batch = pending.splice(0, options.embeddingBatchSize);

      if (options.dryRun) {
        totalUpserted += batch.length;
        continue;
      }

      const embeddings = await withRetries("Embedding batch", () =>
        createEmbeddings(batch.map((item) => item.input))
      );
      const records: PineconeRecord<ArticleChunkMetadata>[] = embeddings.map(
        (values, indexInBatch) => {
          if (values.length !== EMBEDDING_DIMENSIONS) {
            throw new Error(
              `Embedding dimension mismatch: got ${values.length}, expected ${EMBEDDING_DIMENSIONS}`
            );
          }

          return {
            id: batch[indexInBatch].id,
            values,
            metadata: batch[indexInBatch].metadata
          };
        }
      );

      await withRetries("Pinecone upsert", () =>
        index!.upsert({
          records,
          namespace: settings.namespace
        })
      );

      totalUpserted += records.length;
      console.log(`Upserted ${totalUpserted} chunks...`);
    }
  }

  const parser = fs.createReadStream(filePath).pipe(
    parse({
      columns: true,
      bom: true,
      skip_empty_lines: true,
      relax_column_count: true
    })
  );

  for await (const rawRow of parser) {
    const row = sanitizeRow(rawRow);
    const articleId = String(seenArticles);
    seenArticles += 1;

    if (seenArticles <= options.offset) {
      continue;
    }

    if (options.limit !== undefined && processedArticles >= options.limit) {
      break;
    }

    const chunks = chunkText(row.text, settings.chunkSize, settings.overlapRatio);

    if (chunks.length === 0) {
      skippedEmptyArticles += 1;
      continue;
    }

    chunks.forEach((chunk, chunkIndex) => {
      const input = buildEmbeddingInput(row, chunk);
      totalApproxEmbeddingTokens += approximateTokens(input);

      pending.push({
        id: createChunkId(articleId, chunkIndex),
        input,
        metadata: {
          article_id: articleId,
          title: row.title,
          chunk,
          chunk_index: chunkIndex,
          url: row.url ?? "",
          authors: row.authors ?? "",
          timestamp: row.timestamp ?? "",
          tags: row.tags ?? ""
        }
      });
    });

    processedArticles += 1;
    totalChunks += chunks.length;

    if (pending.length >= options.embeddingBatchSize) {
      await flush();
    }
  }

  await flush();

  console.log("Ingestion complete:");
  console.log(`  processed_articles: ${processedArticles}`);
  console.log(`  skipped_empty_articles: ${skippedEmptyArticles}`);
  console.log(`  chunks_created: ${totalChunks}`);
  console.log(`  chunks_upserted: ${totalUpserted}`);
  console.log(`  approximate_embedding_tokens: ${totalApproxEmbeddingTokens}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
