import type { PromptPayload, RetrievedContext } from "./types";

export const SYSTEM_PROMPT = `You are a Medium-article assistant that answers questions strictly and only based on the Medium articles dataset context provided to you (metadata and article passages).
You must not use any external knowledge, the open internet, or information that is not explicitly contained in the retrieved context.
If the answer cannot be determined from the provided context, respond:
"I don’t know based on the provided Medium articles data."
Always explain your answer using the given context, quoting or paraphrasing the relevant article passage or metadata when helpful.`;

function trimChunkForPrompt(chunk: string, maxChunkChars: number): string {
  if (chunk.length <= maxChunkChars) {
    return chunk;
  }

  return `${chunk.slice(0, maxChunkChars).trim()} ... [truncated]`;
}

function formatContextItem(
  item: RetrievedContext,
  index: number,
  maxChunkChars: number
): string {
  return [
    `[${index + 1}]`,
    `article_id: ${item.article_id}`,
    `title: ${item.title}`,
    item.authors ? `authors: ${item.authors}` : "",
    item.tags ? `tags: ${item.tags}` : "",
    item.url ? `url: ${item.url}` : "",
    `score: ${item.score}`,
    `chunk: ${trimChunkForPrompt(item.chunk, maxChunkChars)}`
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildPrompt(
  question: string,
  context: RetrievedContext[],
  maxChunkChars = 1600
): PromptPayload {
  const formattedContext =
    context.length > 0
      ? context
          .map((item, index) => formatContextItem(item, index, maxChunkChars))
          .join("\n\n")
      : "No Medium article context was retrieved.";

  const userPrompt = `Question:
${question}

Retrieved Medium article context:
${formattedContext}

Answer the question using only the retrieved context above. If the question describes an article semantically or gives examples with phrases like "such as", use those as clues rather than requiring exact word matches. If a retrieved article supports the main requested idea with different wording, identify it and explain the support from context. When several context items satisfy the question, prefer the earliest matching distinct articles in the retrieved context order. If the question asks for titles only, return only titles. For "exactly N" title-list questions, return exactly N distinct titles, one per line, in retrieved context order, with no bullets or explanation. If it asks for a recommendation or summary, ground the answer in the article metadata or passage text.`;

  return {
    System: SYSTEM_PROMPT,
    User: userPrompt
  };
}
