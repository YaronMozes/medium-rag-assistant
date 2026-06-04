import dotenv from "dotenv";
import { getModelConfig } from "../src/lib/rag/config";
import { createEmbedding, getOpenAIClient } from "../src/lib/rag/llmod";

dotenv.config({ path: ".env.local", quiet: true });

async function main() {
  const config = getModelConfig();
  console.log(`Base URL: ${config.baseURL ?? "default OpenAI SDK endpoint"}`);
  console.log(`Chat model: ${config.chatModel}`);
  console.log(`Embedding model: ${config.embeddingModel}`);

  const models = await getOpenAIClient().models.list();
  const ids = models.data.map((model) => model.id).sort();
  console.log(`Models visible through the key: ${ids.length}`);
  console.log(
    `Configured chat model visible: ${ids.includes(config.chatModel) ? "yes" : "no"}`
  );
  console.log(
    `Configured embedding model visible: ${
      ids.includes(config.embeddingModel) ? "yes" : "no"
    }`
  );

  const embedding = await createEmbedding("Medium article retrieval test");
  console.log(`Embedding dimensions: ${embedding.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
