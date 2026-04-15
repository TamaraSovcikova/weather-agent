import "dotenv/config";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

const MODELS = [
  "nousresearch/hermes-3-llama-3.1-405b:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "openai/gpt-oss-20b:free",
];

export const AskResponseSchema = z.object({
  shortAnswer: z.string().describe("A concise answer to the question."),
  confidence: z.number().min(0).max(1),
  followUpQuestions: z.array(z.string()).max(3),
});

export type AskResponse = z.infer<typeof AskResponseSchema>;

export const getOpenRouter = () => {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY in .env");
  }

  return createOpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
  });
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const getErrorMessage = (err: unknown): string => {
  if (!err) return "";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  if (typeof err === "object") {
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
};

const isRateLimitError = (err: unknown): boolean => {
  const message = getErrorMessage(err).toLowerCase();
  const statusCode = (err as any)?.statusCode;

  return (
    statusCode === 429 ||
    message.includes("rate-limited") ||
    message.includes("rate limit") ||
    message.includes("too many requests") ||
    message.includes("temporarily rate-limited")
  );
};

export const askAgent = async (question: string): Promise<AskResponse> => {
  const openrouter = getOpenRouter();

  let lastError: unknown;

  for (const model of MODELS) {
    try {
      const { object } = await generateObject({
        model: openrouter(model),
        schema: AskResponseSchema,
        prompt: `Answer this question clearly and concisely:\n\n${question}`,
      });

      return object;
    } catch (err) {
      const message = getErrorMessage(err);
      if (isRateLimitError(err)) {
        console.log(`Model rate-limited: ${model} - ${message}`);
      } else {
        console.log(`Model failed: ${model} - ${message}`);
      }
      await sleep(500);
      lastError = err;
    }
  }

  throw lastError;
};

export const runAskAgentCli = async (): Promise<void> => {
  const question = process.argv.slice(2).join(" ").trim();

  if (!question) {
    console.error('Usage: npm run ask -- "your question here"');
    process.exit(1);
  }

  try {
    const result = await askAgent(question);
    console.log(JSON.stringify(result, null, 2));
  } catch (err: any) {
    const statusCode = err?.statusCode;
    const message = err?.responseBody || err?.message || "";

    const isRateLimit =
      statusCode === 429 ||
      message.includes("rate-limited") ||
      message.includes("temporarily rate-limited");

    if (isRateLimit) {
      console.log(
        "⏳ All models are currently rate-limited. Please try again in a few seconds.",
      );
    } else {
      console.log("❌ AI request failed.");
    }

    process.exit(1);
  }
};

void runAskAgentCli();
