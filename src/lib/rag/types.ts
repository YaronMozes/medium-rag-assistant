export type ArticleRow = {
  title: string;
  text: string;
  url?: string;
  authors?: string;
  timestamp?: string;
  tags?: string;
};

export type ArticleChunkMetadata = {
  article_id: string;
  title: string;
  chunk: string;
  chunk_index: number;
  url: string;
  authors: string;
  timestamp: string;
  tags: string;
};

export type RetrievedContext = {
  article_id: string;
  title: string;
  chunk: string;
  score: number;
  authors?: string;
  url?: string;
  tags?: string;
};

export type PromptPayload = {
  System: string;
  User: string;
};
