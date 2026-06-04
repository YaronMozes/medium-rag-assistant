import type { ArticleRow } from "./types";

export function normalizeText(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

export function approximateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function chunkText(
  text: string,
  chunkSize: number,
  overlapRatio: number
): string[] {
  const normalized = normalizeText(text);
  if (!normalized) {
    return [];
  }

  const words = normalized.split(" ");
  const maxChars = Math.max(1, chunkSize * 4);
  const overlapChars = Math.floor(maxChars * overlapRatio);
  const chunks: string[] = [];
  let start = 0;

  while (start < words.length) {
    let end = start;
    let charCount = 0;

    while (end < words.length) {
      const nextWordLength = words[end].length + (end === start ? 0 : 1);
      if (charCount > 0 && charCount + nextWordLength > maxChars) {
        break;
      }

      charCount += nextWordLength;
      end += 1;
    }

    if (end === start) {
      end += 1;
    }

    chunks.push(words.slice(start, end).join(" "));

    if (end >= words.length) {
      break;
    }

    let overlapStart = end;
    let tailChars = 0;

    while (overlapStart > start && tailChars < overlapChars) {
      overlapStart -= 1;
      tailChars += words[overlapStart].length + 1;
    }

    start = Math.max(overlapStart, start + 1);
  }

  return chunks;
}

export function buildEmbeddingInput(row: ArticleRow, chunk: string): string {
  const title = normalizeText(row.title);
  const authors = normalizeText(row.authors);
  const tags = normalizeText(row.tags);

  return [
    title ? `Title: ${title}` : "",
    authors ? `Authors: ${authors}` : "",
    tags ? `Tags: ${tags}` : "",
    `Text: ${chunk}`
  ]
    .filter(Boolean)
    .join("\n");
}
