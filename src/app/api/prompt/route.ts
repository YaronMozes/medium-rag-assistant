import { NextResponse } from "next/server";
import {
  answerWithChat,
  isContentPolicyError
} from "../../../lib/rag/llmod";
import { buildPrompt } from "../../../lib/rag/prompt";
import { retrieveForQuestion } from "../../../lib/rag/retrieve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PromptRequest = {
  question?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as PromptRequest | null;
    const question = typeof body?.question === "string" ? body.question.trim() : "";

    if (!question) {
      return NextResponse.json(
        { error: "Request body must include a non-empty question string." },
        { status: 400 }
      );
    }

    const { context } = await retrieveForQuestion(question);
    const promptAttempts = [1600, 700, 300].map((maxChunkChars) =>
      buildPrompt(question, context, maxChunkChars)
    );
    let response = "";
    let augmentedPrompt = promptAttempts[0];
    let lastError: unknown;

    for (const prompt of promptAttempts) {
      try {
        response = await answerWithChat(prompt.System, prompt.User);
        augmentedPrompt = prompt;
        break;
      } catch (error) {
        lastError = error;

        if (!isContentPolicyError(error)) {
          throw error;
        }
      }
    }

    if (!response) {
      throw lastError;
    }

    return NextResponse.json({
      response,
      context: context.map((item) => ({
        article_id: item.article_id,
        title: item.title,
        chunk: item.chunk,
        score: item.score
      })),
      Augmented_prompt: augmentedPrompt
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to answer the question from the Medium dataset." },
      { status: 500 }
    );
  }
}
