# Medium RAG Assistant

Vercel-ready RAG assistant for the `medium-english-50mb.csv` assignment dataset.

## Configuration

Copy `.env.example` to `.env.local` and fill in:

- `OPENAI_API_KEY`
- `PINECONE_API_KEY`

The app is configured for LLMod's OpenAI-compatible endpoint:

```env
OPENAI_BASE_URL=https://api.llmod.ai/v1
CHAT_MODEL=4UHRUIN-gpt-5-mini
EMBEDDING_MODEL=4UHRUIN-text-embedding-3-small
```

Current RAG hyperparameters:

```json
{
  "chunk_size": 800,
  "overlap_ratio": 0.2,
  "top_k": 7
}
```

Chunks use approximate tokens, estimated as `ceil(character_count / 4)`.

## Development

```bash
npm install
npm run dev
```

Local app URL:

```text
http://127.0.0.1:3000
```

## Ingestion

Validate model access:

```bash
npm run check:models
```

Estimate full-corpus chunk volume without API calls:

```bash
npm run ingest -- --dry-run
```

Ingest a small subset:

```bash
npm run ingest -- --limit=100
```

Ingest the remaining corpus after the first 3 test articles:

```bash
npm run ingest -- --offset=3
```

The default namespace is derived from the chunk settings, for example `medium-c800-o20`. Set `PINECONE_NAMESPACE` only if you want to override it.

## API

`POST /api/prompt`

```json
{
  "question": "List exactly 3 articles about education. Return only the titles."
}
```

Returns:

```json
{
  "response": "Final answer",
  "context": [
    {
      "article_id": "1234",
      "title": "Article title",
      "chunk": "Retrieved article chunk",
      "score": 0.1234
    }
  ],
  "Augmented_prompt": {
    "System": "system prompt",
    "User": "user prompt"
  }
}
```

`GET /api/stats`

```json
{
  "chunk_size": 800,
  "overlap_ratio": 0.2,
  "top_k": 7
}
```
