import type { Env } from "./env";
import type { LifeOSState } from "../shared/domain";
import {
  hydrateAgentMutation,
  parseAgentInput,
  type AgentMutation,
  type SerializedAgentMutation,
} from "../shared/lifeAgent";

const DEFAULT_MODEL = "gpt-4o-mini";

export async function resolveAgentMutation(
  env: Env,
  command: string,
  snapshot: LifeOSState,
): Promise<{ mutation: AgentMutation; source: "openai" | "heuristic" }> {
  if (!env.OPENAI_API_KEY) {
    return { mutation: parseAgentInput(command, snapshot), source: "heuristic" };
  }

  try {
    const serialized = await requestOpenAIMutation(env, command, snapshot);
    return {
      mutation: hydrateAgentMutation(serialized, snapshot),
      source: "openai",
    };
  } catch {
    return { mutation: parseAgentInput(command, snapshot), source: "heuristic" };
  }
}

async function requestOpenAIMutation(
  env: Env,
  command: string,
  snapshot: LifeOSState,
): Promise<SerializedAgentMutation> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL ?? DEFAULT_MODEL,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "You are a LifeOS command parser. Convert the user command into exactly one structured mutation for expense, health, journal, or vault. Prefer preserving user intent over guessing extra data.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                command,
                snapshot: summarizeSnapshot(snapshot),
                instructions: [
                  "Return one object only.",
                  "Use kind in expense|health|journal|vault.",
                  "For expense include amount/category/note/date optional.",
                  "For health include sys/dia/hr and optional weight/date.",
                  "For journal include content and optional tags/date.",
                  "For vault include site/username/secret.",
                  "Message should be short Traditional Chinese.",
                ],
              }),
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "lifeos_mutation",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["kind", "entry"],
            properties: {
              kind: {
                type: "string",
                enum: ["expense", "health", "journal", "vault"],
              },
              message: { type: "string" },
              entry: {
                type: "object",
                additionalProperties: true,
                properties: {
                  amount: { type: "number" },
                  category: { type: "string" },
                  note: { type: "string" },
                  date: { type: "string" },
                  sys: { type: "number" },
                  dia: { type: "number" },
                  hr: { type: "number" },
                  weight: { type: "number" },
                  content: { type: "string" },
                  tags: { type: "array", items: { type: "string" } },
                  site: { type: "string" },
                  username: { type: "string" },
                  secret: { type: "string" },
                },
              },
            },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI response failed: ${response.status}`);
  }

  const payload = (await response.json()) as {
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string }> }>;
  };

  const text =
    payload.output_text ??
    payload.output?.flatMap((item) => item.content ?? []).map((item) => item.text ?? "").find(Boolean);

  if (!text) {
    throw new Error("OpenAI response missing structured output");
  }

  return JSON.parse(text) as SerializedAgentMutation;
}

function summarizeSnapshot(snapshot: LifeOSState) {
  return {
    latestExpenseCount: snapshot.finance.length,
    latestJournalCount: snapshot.journals.length,
    latestHealthCount: snapshot.health.length,
    latestVaultCount: snapshot.vault.length,
    lastExpense: snapshot.finance[0] ?? null,
    lastHealth: snapshot.health[snapshot.health.length - 1] ?? null,
  };
}
