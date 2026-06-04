import { getRagSettings } from "./config";
import { createEmbeddings } from "./llmod";
import { buildPrompt } from "./prompt";
import { queryArticleChunks } from "./pinecone";
import type { PromptPayload, RetrievedContext } from "./types";

export type RetrievalResult = {
  context: RetrievedContext[];
  augmentedPrompt: PromptPayload;
};

const STOP_WORDS = new Set([
  "about",
  "actually",
  "aimed",
  "answer",
  "article",
  "articles",
  "author",
  "based",
  "central",
  "choice",
  "concrete",
  "context",
  "could",
  "exactly",
  "find",
  "from",
  "give",
  "list",
  "only",
  "provide",
  "question",
  "recommend",
  "return",
  "summarise",
  "summarize",
  "that",
  "their",
  "title",
  "titles",
  "using",
  "want",
  "what",
  "which",
  "with",
  "would"
]);

function buildKeywordQuery(question: string): string {
  const keywords = question
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 4 && !STOP_WORDS.has(word));

  return Array.from(new Set(keywords)).join(" ");
}

function mergeRankedContexts(
  resultSets: RetrievedContext[][],
  topK: number,
  keywordQuery: string,
  maxChunksPerArticle: number
): RetrievedContext[] {
  const byChunk = new Map<
    string,
    {
      context: RetrievedContext;
      fusedScore: number;
    }
  >();
  const rankConstant = 60;
  const keywordTokens = keywordQuery ? keywordQuery.split(" ") : [];

  function lexicalMetadataBoost(context: RetrievedContext): number {
    const metadata = `${context.title} ${context.tags ?? ""}`.toLowerCase();
    const overlap = keywordTokens.filter((token) => metadata.includes(token));

    return Math.min(overlap.length * 0.006, 0.018);
  }

  resultSets.forEach((contexts) => {
    contexts.forEach((context, rank) => {
      const key = `${context.article_id}:${context.chunk.slice(0, 80)}`;
      const existing = byChunk.get(key);
      const fusedScore = 1 / (rankConstant + rank + 1);

      if (!existing) {
        byChunk.set(key, {
          context,
          fusedScore: fusedScore + lexicalMetadataBoost(context)
        });
        return;
      }

      existing.fusedScore += fusedScore;

      if (context.score > existing.context.score) {
        existing.context = context;
      }
    });
  });

  const articleCounts = new Map<string, number>();

  return Array.from(byChunk.values())
    .sort((left, right) => {
      const fusedDiff = right.fusedScore - left.fusedScore;
      return fusedDiff || right.context.score - left.context.score;
    })
    .map((item) => item.context)
    .filter((context) => {
      const currentCount = articleCounts.get(context.article_id) ?? 0;
      if (currentCount >= maxChunksPerArticle) {
        return false;
      }

      articleCounts.set(context.article_id, currentCount + 1);
      return true;
    })
    .slice(0, topK);
}

function isMultiResultListing(question: string): boolean {
  return /\b(list|exactly|titles|articles about|return only)\b/i.test(question);
}

export async function retrieveForQuestion(
  question: string
): Promise<RetrievalResult> {
  const settings = getRagSettings();
  const keywordQuery = buildKeywordQuery(question);
  const queries =
    keywordQuery && keywordQuery !== question.toLowerCase()
      ? [question, keywordQuery]
      : [question];
  const embeddings = await createEmbeddings(queries);
  const queryResults = await Promise.all(
    embeddings.map((embedding) => queryArticleChunks(embedding, settings.topK))
  );
  const context = mergeRankedContexts(
    queryResults,
    settings.topK,
    keywordQuery,
    isMultiResultListing(question) ? 1 : 2
  );
  const augmentedPrompt = buildPrompt(question, context);

  return {
    context,
    augmentedPrompt
  };
}
