"use client";

import { FormEvent, useState } from "react";
import type { RetrievedContext } from "../lib/rag/types";

type Stats = {
  chunk_size: number;
  overlap_ratio: number;
  top_k: number;
};

type PromptResponse = {
  response: string;
  context: RetrievedContext[];
  Augmented_prompt: {
    System: string;
    User: string;
  };
};

const examples = [
  "Find an article that reframes marketing as a conversation with readers, aimed at writers who find self-promotion uncomfortable. Provide the title and author.",
  "List exactly 3 articles about education. Return only the titles.",
  "Find an article that argues past pandemics (such as the bubonic plague) can spur innovation and recovery, and summarise its central argument.",
  "I want practical, beginner-friendly advice on building habits that actually stick. Which article would you recommend, and why?"
];

export function AssistantClient({ stats }: { stats: Stats }) {
  const [question, setQuestion] = useState(examples[0]);
  const [result, setResult] = useState<PromptResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = question.trim();

    if (!trimmed) {
      setError("Enter a question.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/prompt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ question: trimmed })
      });

      const payload = (await response.json()) as PromptResponse | { error: string };

      if (!response.ok) {
        throw new Error("error" in payload ? payload.error : "Request failed.");
      }

      setResult(payload as PromptResponse);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Request failed."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <div className="shell">
        <header className="header">
          <div>
            <h1 className="title">Medium RAG Assistant</h1>
            <p className="subtitle">Dataset-grounded Medium article retrieval</p>
          </div>
          <div className="stats" aria-label="RAG settings">
            <div className="stat">
              <span className="stat-label">Chunk</span>
              <span className="stat-value">{stats.chunk_size}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Overlap</span>
              <span className="stat-value">{stats.overlap_ratio}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Top K</span>
              <span className="stat-value">{stats.top_k}</span>
            </div>
          </div>
        </header>

        <section className="workspace">
          <form className="query-panel" onSubmit={submit}>
            <label className="label" htmlFor="question">
              Question
            </label>
            <textarea
              id="question"
              className="question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
            />

            <div className="actions">
              <button className="submit" disabled={loading} type="submit">
                {loading ? "Searching..." : "Ask"}
              </button>
              {examples.map((example, index) => (
                <button
                  className="example"
                  key={example}
                  type="button"
                  onClick={() => setQuestion(example)}
                >
                  Example {index + 1}
                </button>
              ))}
            </div>

            {error ? <p className="error">{error}</p> : null}

            {result ? (
              <div className="answer">
                <h2>Answer</h2>
                <div className="answer-text">{result.response}</div>
              </div>
            ) : null}
          </form>

          <aside className="context-panel">
            <h2>Context</h2>
            {result?.context.length ? (
              <div className="context-list">
                {result.context.map((item, index) => (
                  <article
                    className="context-item"
                    key={`${item.article_id}-${index}`}
                  >
                    <h3 className="context-title">{item.title}</h3>
                    <p className="context-meta">
                      Article {item.article_id} | Score {item.score.toFixed(4)}
                    </p>
                    <p className="context-chunk">{item.chunk.slice(0, 360)}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="empty">No query result yet.</p>
            )}
          </aside>
        </section>
      </div>
    </main>
  );
}
