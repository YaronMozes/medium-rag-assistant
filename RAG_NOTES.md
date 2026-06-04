# RAG Notes

## Chosen Hyperparameters

```json
{
  "chunk_size": 800,
  "overlap_ratio": 0.2,
  "top_k": 7
}
```

Chunks use approximate tokens, estimated as `ceil(character_count / 4)`.

Rationale:

- `chunk_size=800` preserves enough article context for summaries and recommendations while staying below the assignment limit of 1024.
- `overlap_ratio=0.2` reduces boundary loss without excessive duplicate embedding cost.
- `top_k=7` gives the chat model enough evidence for multi-result and summary questions while keeping prompt size controlled.

## Retrieval Details

The retriever embeds both:

1. The original user question.
2. A keyword-focused version of the question.

Results are merged with reciprocal-rank fusion, plus a small title/tag keyword boost. For list-style questions, the final context enforces one chunk per article so returned evidence represents distinct articles.

The chat prompt includes shortened chunk excerpts to keep prompts efficient and avoid provider-side content filtering. The API still returns the full retrieved chunks in the `context` field.

## Ingestion

Full ingestion was completed into Pinecone namespace:

```text
medium-c800-o20
```

Totals:

- Processed articles: `7682`
- Chunks created/upserted: `21238`
- Approximate embedding tokens: `15450200`

The initial 3-article smoke test created 7 chunks. The remaining full run used `--offset=3` and created 21,231 chunks.

## Validation Queries

These assignment-style queries were tested locally through `POST /api/prompt`:

- Precise fact retrieval: marketing as a conversation for introverted writers.
- Multi-result listing: exactly 3 education article titles.
- Summary extraction: plague/pandemic history as a driver of public-health innovation.
- Recommendation: beginner-friendly advice for habits that stick.

`GET /api/stats` returns the required strict JSON shape.
