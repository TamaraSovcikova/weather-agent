import "dotenv/config";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

/**
 * Keep model in code (NOT env)
 * Reason: it's application logic, not a secret
 */
const MODEL = "openai/gpt-4o-mini";

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

export const askAgent = async (question: string): Promise<AskResponse> => {
  const openrouter = getOpenRouter();

  const { object } = await generateObject({
    model: openrouter(MODEL),
    schema: AskResponseSchema,
    prompt: `Answer this question clearly and concisely:\n\n${question}`,
  });

  return object;
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
  } catch (err) {
    console.error("Agent error:", err);
    process.exit(1);
  }
};

void runAskAgentCli();
