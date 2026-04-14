import "dotenv/config";
import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";

export const AskResponseSchema = z.object({
  shortAnswer: z.string().describe("A concise answer to the question."),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Confidence score from 0 to 1."),
  followUpQuestions: z
    .array(z.string())
    .max(3)
    .describe("Up to three optional follow-up questions."),
});

export type AskResponse = z.infer<typeof AskResponseSchema>;

export const askAgent = async (question: string): Promise<AskResponse> => {
  const { object } = await generateObject({
    model: anthropic("claude-3-5-sonnet-latest"),
    schema: AskResponseSchema,
    prompt: `Answer this question:\n\n${question}`,
  });

  return object;
};

export const runAskAgentCli = async (): Promise<void> => {
  const question = process.argv.slice(2).join(" ").trim();

  if (!question) {
    console.error("Usage: npm run ask -- \"your question here\"");
    process.exit(1);
  }

  const result = await askAgent(question);
  console.log(JSON.stringify(result, null, 2));
};

void runAskAgentCli();
