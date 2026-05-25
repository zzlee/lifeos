import { GoogleGenAI } from "@google/genai";
import type { Env } from "./env";
import type { UserProfile } from "../shared/domain";
import {
  createExpense,
  createHealthRecord,
  createJournal,
  deleteExpense,
  deleteHealthRecord,
  deleteJournal,
  getDashboardSnapshot,
  updateExpense,
  updateHealthRecord,
  updateJournal,
} from "./repository";

type ChatMessage = { role: "user" | "assistant"; content: string };

type ToolExecutor = (args: any, env: Env, user: UserProfile) => Promise<unknown>;

type ToolSpec = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: ToolExecutor;
};

const LIFEOS_TOOLSET: ToolSpec[] = [
  {
    name: "create_expense",
    description: "Create a new expense record.",
    parameters: {
      type: "object",
      properties: { amount: { type: "number" }, category: { type: "string" }, note: { type: "string" }, occurred_at: { type: "string" } },
      required: ["amount", "category"],
    },
    execute: async (args, env, user) => createExpense(env.DB!, user, args),
  },
  {
    name: "update_expense",
    description: "Update an existing expense by id.",
    parameters: {
      type: "object",
      properties: { id: { type: "number" }, amount: { type: "number" }, category: { type: "string" }, note: { type: "string" }, occurred_at: { type: "string" } },
      required: ["id"],
    },
    execute: async (args, env, user) => updateExpense(env.DB!, Number(args.id), user, args),
  },
  {
    name: "delete_expense",
    description: "Delete an expense by id.",
    parameters: { type: "object", properties: { id: { type: "number" } }, required: ["id"] },
    execute: async (args, env, user) => deleteExpense(env.DB!, Number(args.id), user),
  },
  {
    name: "create_journal",
    description: "Create a journal entry.",
    parameters: {
      type: "object",
      properties: { content: { type: "string" }, tags: { type: "array", items: { type: "string" } } },
      required: ["content"],
    },
    execute: async (args, env, user) => createJournal(env.DB!, user, args.content, args.tags || []),
  },
  {
    name: "update_journal",
    description: "Update a journal entry by id.",
    parameters: {
      type: "object",
      properties: { id: { type: "number" }, content: { type: "string" }, tags: { type: "array", items: { type: "string" } } },
      required: ["id", "content"],
    },
    execute: async (args, env, user) => updateJournal(env.DB!, Number(args.id), user, args.content, args.tags || []),
  },
  {
    name: "delete_journal",
    description: "Delete a journal entry by id.",
    parameters: { type: "object", properties: { id: { type: "number" } }, required: ["id"] },
    execute: async (args, env, user) => deleteJournal(env.DB!, Number(args.id), user),
  },
  {
    name: "create_health",
    description: "Create a health record.",
    parameters: {
      type: "object",
      properties: { metric: { type: "string" }, value: { type: "number" }, unit: { type: "string" }, recorded_at: { type: "string" } },
      required: ["metric", "value"],
    },
    execute: async (args, env, user) => createHealthRecord(env.DB!, user, args),
  },
  {
    name: "update_health",
    description: "Update a health record by id.",
    parameters: {
      type: "object",
      properties: { id: { type: "number" }, metric: { type: "string" }, value: { type: "number" }, unit: { type: "string" }, recorded_at: { type: "string" } },
      required: ["id"],
    },
    execute: async (args, env, user) => updateHealthRecord(env.DB!, Number(args.id), user, args),
  },
  {
    name: "delete_health",
    description: "Delete a health record by id.",
    parameters: { type: "object", properties: { id: { type: "number" } }, required: ["id"] },
    execute: async (args, env, user) => deleteHealthRecord(env.DB!, Number(args.id), user),
  },
  {
    name: "create_external_transaction",
    description: "Create an external accounting transaction.",
    parameters: {
      type: "object",
      properties: { amount: { type: "number" }, category: { type: "string" }, note: { type: "string" }, user_id: { type: "number" } },
      required: ["amount", "category"],
    },
    execute: async (args) => createExternalTransaction(args),
  },
];

const TOOL_MAP = new Map(LIFEOS_TOOLSET.map((tool) => [tool.name, tool]));

export async function runLifeAgentLoop(env: Env, user: UserProfile, messages: ChatMessage[]) {
  if (!env.DB) throw new Error("Database not bound");
  if (!env.GEMINI_API_KEY || !env.GEMINI_MODEL) throw new Error("Gemini not configured");

  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  const maxTurns = 6;
  const conversation: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  for (let i = 0; i < maxTurns; i++) {
    const snapshot = await getDashboardSnapshot(env.DB, user);
    conversation.push({ role: "user", parts: [{ text: `Current dashboard snapshot: ${JSON.stringify(snapshot.data).slice(0, 7000)}` }] });

    const response = await ai.models.generateContent({
      model: env.GEMINI_MODEL,
      contents: conversation,
      config: {
        systemInstruction: "You are the LifeOS agent. Use tools for mutations, and answer with concise summaries.",
        tools: [
          {
            functionDeclarations: LIFEOS_TOOLSET.map((tool) => ({
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters,
            })),
          },
        ],
      },
    });

    const functionCalls = response.functionCalls ?? [];
    if (!functionCalls.length) {
      return { reply: response.text?.trim() || "已完成。", data: snapshot.data, source: "gemini" as const };
    }

    const results: Array<{ name: string; result: unknown }> = [];
    for (const call of functionCalls) {
      const tool = TOOL_MAP.get(call.name || "");
      const result = tool ? await tool.execute(call.args || {}, env, user) : { ok: false, error: `unknown tool ${call.name}` };
      results.push({ name: call.name || "unknown", result });
    }

    conversation.push({ role: "model", parts: [{ text: JSON.stringify(functionCalls) }] });
    conversation.push({ role: "user", parts: [{ text: `Tool results: ${JSON.stringify(results)}` }] });
  }

  const latest = await getDashboardSnapshot(env.DB, user);
  return { reply: "已執行要求，若需更精準請補充細節。", data: latest.data, source: "gemini" as const };
}

async function createExternalTransaction(args: any) {
  const resp = await fetch("https://purple-water-b776.zzlee-tw.workers.dev/api/transactions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-LifeOS-User-Id": String(args.user_id || 1) },
    body: JSON.stringify(args),
  });
  return { ok: resp.ok, status: resp.status };
}
