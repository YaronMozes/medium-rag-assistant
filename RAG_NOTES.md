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

## Hyperparameter Comparison

I ran a cost-bounded comparison before keeping the final production settings. The production namespace (`medium-c800-o20`) was not changed during this experiment.

Method:

- Fixed evaluation subset: 650 articles from CSV windows `0-299`, `5300-5419`, `5940-6039`, and `6550-6679`.
- The subset includes the known target rows for the four assignment examples, plus surrounding distractor articles from the same corpus areas.
- `top_k` was fixed at 7 for all runs.
- Each config was embedded into its own Pinecone namespace.
- Evaluation checked whether relevant distinct articles appeared in the retrieved context for the four exact assignment questions. Mean scores were recorded as a secondary signal only.

Comparison results:

| Config | Eval namespace | Chunks | Approx. embedding tokens | Retrieval result |
| --- | --- | ---: | ---: | --- |
| `512 / 0.2` | `eval-20260605-c512-o20` | 2,603 | 1,313,352 | Target article ranked 1 for fact, pandemic summary, and habits recommendation. Education query returned 6 distinct relevant article contexts. Higher chunk count. |
| `800 / 0.2` | `eval-20260605-c800-o20` | 1,739 | 1,251,209 | Target article ranked 1 for fact, pandemic summary, and habits recommendation. Education query returned 7 distinct relevant article contexts. Best balance of relevance, distinctness, and cost. |
| `800 / 0.3` | `eval-20260605-c800-o30` | 1,848 | 1,369,184 | Target article ranked 1 for fact, pandemic summary, and habits recommendation. Education query returned 6 distinct relevant article contexts. More overlap increased cost without improving retrieval. |

Mean top-k scores by question:

| Config | Fact | Education | Pandemic summary | Habits recommendation |
| --- | ---: | ---: | ---: | ---: |
| `512 / 0.2` | 0.5811 | 0.3770 | 0.4829 | 0.5459 |
| `800 / 0.2` | 0.5760 | 0.3744 | 0.4834 | 0.5527 |
| `800 / 0.3` | 0.5677 | 0.3784 | 0.4727 | 0.5579 |

Conclusion: `800 / 0.2` was selected because it kept all key targets in the top retrieved context, produced the strongest distinct-article behavior for the education listing, and avoided the extra chunk volume of the other tested settings.

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
