import OpenAI from "openai";
import { getModelConfig } from "./config";

let client: OpenAI | undefined;

export function getOpenAIClient(): OpenAI {
  if (!client) {
    const { apiKey, baseURL } = getModelConfig();
    client = new OpenAI({
      apiKey,
      baseURL
    });
  }

  return client;
}

export async function createEmbeddings(inputs: string[]): Promise<number[][]> {
  if (inputs.length === 0) {
    return [];
  }

  const { embeddingModel } = getModelConfig();
  const response = await getOpenAIClient().embeddings.create({
    model: embeddingModel,
    input: inputs
  });

  return response.data.map((item) => item.embedding);
}

export async function createEmbedding(input: string): Promise<number[]> {
  const [embedding] = await createEmbeddings([input]);
  if (!embedding) {
    throw new Error("Embedding response did not include a vector");
  }

  return embedding;
}

function stringifyMessageContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }

        if (
          part &&
          typeof part === "object" &&
          "text" in part &&
          typeof part.text === "string"
        ) {
          return part.text;
        }

        return "";
      })
      .join("");
  }

  return "";
}

export async function answerWithChat(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const { chatModel } = getModelConfig();
  const response = await getOpenAIClient().chat.completions.create({
    model: chatModel,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ]
  });

  const content = response.choices[0]?.message?.content;
  const text = stringifyMessageContent(content).trim();

  if (!text) {
    throw new Error("Chat response did not include text content");
  }

  return text;
}

export function isContentPolicyError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : JSON.stringify(error ?? "");

  return /content.?policy|content management policy|content.?filter/i.test(
    message
  );
}
