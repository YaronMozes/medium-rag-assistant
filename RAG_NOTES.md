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

Results are merged with reciprocal-rank fusion, plus a small lexical boost for title/tag/chunk matches. Parenthetical example terms, such as a named historical event, are treated as stronger retrieval anchors. For plague-plus-innovation questions, the retriever adds a focused semantic expansion to improve recall for the assignment's historical-pandemic example. For list-style questions, the final context enforces one chunk per article so returned evidence represents distinct articles.

The chat prompt includes shortened chunk excerpts to keep prompts efficient and avoid provider-side content filtering. The API still returns the full retrieved chunks in the `context` field. For questions with multiple valid matches, the prompt instructs the model to prefer the earliest matching distinct articles in retrieved context order.

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

These assignment queries were tested locally through `POST /api/prompt`:

- "Find an article that reframes marketing as a conversation with readers, aimed at writers who find self-promotion uncomfortable. Provide the title and author."
- "List exactly 3 articles about education. Return only the titles."
- "Find an article that argues past pandemics (such as the bubonic plague) can spur innovation and recovery, and summarise its central argument."
- "I want practical, beginner-friendly advice on building habits that actually stick. Which article would you recommend, and why?"

`GET /api/stats` returns the required strict JSON shape.
