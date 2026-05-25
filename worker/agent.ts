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
  getExpenses,
  getHealthRecords,
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
    description: "Create a new local expense record in the local D1 database. ONLY use this tool if the user explicitly specifies storing it 'locally', 'internally', or in 'local database'.",
    parameters: {
      type: "object",
      properties: { amount: { type: "number" }, category: { type: "string" }, note: { type: "string" }, date: { type: "string", description: "ISO timestamp or YYYY-MM-DD" } },
      required: ["amount", "category"],
    },
    execute: async (args, env, user) => createExpense(env.DB!, user, {
      amount: Number(args.amount) || 0,
      category: String(args.category || "AI 自動"),
      note: String(args.note || ""),
      date: String(args.date || args.occurred_at || new Date().toISOString()),
    }),
  },
  {
    name: "update_expense",
    description: "Update an existing expense by id in the local database.",
    parameters: {
      type: "object",
      properties: { id: { type: "number" }, amount: { type: "number" }, category: { type: "string" }, note: { type: "string" }, date: { type: "string", description: "ISO timestamp or YYYY-MM-DD" } },
      required: ["id", "amount", "category"],
    },
    execute: async (args, env, user) => updateExpense(env.DB!, Number(args.id), user, {
      amount: Number(args.amount) || 0,
      category: String(args.category || "AI 自動"),
      note: String(args.note || ""),
      date: String(args.date || args.occurred_at || new Date().toISOString()),
    }),
  },
  {
    name: "delete_expense",
    description: "Delete an expense by id in the local database.",
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
      properties: { sys: { type: "number" }, dia: { type: "number" }, hr: { type: "number" }, weight: { type: "number" }, date: { type: "string", description: "ISO timestamp or YYYY-MM-DD" } },
      required: ["sys", "dia", "hr"],
    },
    execute: async (args, env, user) => createHealthRecord(env.DB!, user, {
      sys: Number(args.sys) || 120,
      dia: Number(args.dia) || 80,
      hr: Number(args.hr) || 72,
      weight: args.weight === undefined ? undefined : Number(args.weight),
      date: String(args.date || args.recorded_at || new Date().toISOString()),
    }),
  },
  {
    name: "update_health",
    description: "Update a health record by id.",
    parameters: {
      type: "object",
      properties: { id: { type: "number" }, sys: { type: "number" }, dia: { type: "number" }, hr: { type: "number" }, weight: { type: "number" }, date: { type: "string", description: "ISO timestamp or YYYY-MM-DD" } },
      required: ["id", "sys", "dia", "hr"],
    },
    execute: async (args, env, user) => updateHealthRecord(env.DB!, Number(args.id), user, {
      sys: Number(args.sys) || 120,
      dia: Number(args.dia) || 80,
      hr: Number(args.hr) || 72,
      weight: args.weight === undefined ? undefined : Number(args.weight),
      date: String(args.date || args.recorded_at || new Date().toISOString()),
    }),
  },
  {
    name: "delete_health",
    description: "Delete a health record by id.",
    parameters: { type: "object", properties: { id: { type: "number" } }, required: ["id"] },
    execute: async (args, env, user) => deleteHealthRecord(env.DB!, Number(args.id), user),
  },
  {
    name: "create_external_transaction",
    description: "Create an external accounting transaction in the external system. This is the DEFAULT tool for recording any new expenses or transactions unless the user explicitly specifies recording it 'locally', 'internally', or in 'local database'.",
    parameters: {
      type: "object",
      properties: { amount: { type: "number" }, category: { type: "string" }, note: { type: "string" }, user_id: { type: "number" } },
      required: ["amount", "category"],
    },
    execute: async (args) => createExternalTransaction(args),
  },
  {
    name: "query_expenses",
    description: "Query and search expense/transaction records from both internal local database and external accounting system.",
    parameters: {
      type: "object",
      properties: {
        start_date: { type: "string", description: "Filter start date (YYYY-MM-DD or ISO timestamp)" },
        end_date: { type: "string", description: "Filter end date (YYYY-MM-DD or ISO timestamp)" },
        category: { type: "string", description: "Filter by category name" },
        keyword: { type: "string", description: "Filter by keyword in notes, item name or description" },
      },
    },
    execute: async (args, env, user) => {
      // 1. Fetch local expenses from D1
      const localExpenses = await getExpenses(env.DB!, user, 100, 0, {
        startDate: args.start_date,
        endDate: args.end_date,
        category: args.category,
        query: args.keyword,
      });

      // 2. Fetch external transactions
      const externalTxList = await fetchExternalTransactions({
        startDate: args.start_date,
        endDate: args.end_date,
      });

      // 3. Filter external transactions programmatically
      let filteredExt = externalTxList;
      if (args.category) {
        const catLower = args.category.toLowerCase();
        filteredExt = filteredExt.filter(tx => 
          (tx.item_category && tx.item_category.toLowerCase().includes(catLower)) ||
          (tx.payment_category && tx.payment_category.toLowerCase().includes(catLower))
        );
      }
      if (args.keyword) {
        const kwLower = args.keyword.toLowerCase();
        filteredExt = filteredExt.filter(tx => 
          (tx.item_name && tx.item_name.toLowerCase().includes(kwLower)) ||
          (tx.notes && tx.notes.toLowerCase().includes(kwLower))
        );
      }

      // 4. Combine and normalize results
      const unifiedLocal = localExpenses.map(e => ({
        id: e.id,
        source: "local",
        date: e.date.slice(0, 10),
        amount: e.amount,
        category: e.category,
        note: e.note || "",
      }));

      const unifiedExternal = filteredExt.map(tx => ({
        id: tx.transaction_id,
        source: "external",
        date: tx.transaction_date.slice(0, 10),
        amount: tx.amount,
        category: tx.item_category ? `${tx.item_category} (${tx.payment_category || "未指定"})` : "未指定",
        note: tx.item_name + (tx.notes ? ` - ${tx.notes}` : ""),
      }));

      // Merge and sort by date descending
      const merged = [...unifiedLocal, ...unifiedExternal].sort((a, b) => b.date.localeCompare(a.date));
      return merged.slice(0, 50); // limit to top 50 results for the AI
    }
  },
  {
    name: "query_health",
    description: "Query and search daily health metrics (such as blood pressure, heart rate, and weight) within a specified date range.",
    parameters: {
      type: "object",
      properties: {
        start_date: { type: "string", description: "Filter start date (YYYY-MM-DD or ISO timestamp)" },
        end_date: { type: "string", description: "Filter end date (YYYY-MM-DD or ISO timestamp)" },
        limit: { type: "number", description: "Limit number of entries returned (default 50)" },
      },
    },
    execute: async (args, env, user) => {
      const limit = Number(args.limit) || 50;
      const records = await getHealthRecords(env.DB!, user, limit, 0, {
        startDate: args.start_date,
        endDate: args.end_date,
      });

      return records.map(r => ({
        id: r.id,
        date: r.date.slice(0, 10),
        sys: r.sys,
        dia: r.dia,
        hr: r.hr,
        weight: r.weight,
      }));
    }
  },
];

const TOOL_MAP = new Map(LIFEOS_TOOLSET.map((tool) => [tool.name, tool]));

export async function runLifeAgentLoop(env: Env, user: UserProfile, messages: ChatMessage[]) {
  if (!env.DB) throw new Error("Database not bound");
  if (!env.GEMINI_API_KEY) throw new Error("Gemini API key not configured");

  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  const model = env.GEMINI_MODEL || "gemini-2.5-flash";
  const maxTurns = 6;
  const conversation: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  for (let i = 0; i < maxTurns; i++) {
    // Note: Dashboard Snapshot injection removed to optimize context token usage.
    // Query tools should be used by the agent to fetch expenses or health data.

    const response = await ai.models.generateContent({
      model,
      contents: conversation,
      config: {
        systemInstruction: "You are the LifeOS agent. Use tools for queries and mutations, and answer with concise summaries.",
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
      // Fetch snapshot once at completion to sync UI state
      const snapshot = await getDashboardSnapshot(env.DB, user);
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

async function fetchExternalTransactions(query: { startDate?: string; endDate?: string }) {
  const url = new URL("https://purple-water-b776.zzlee-tw.workers.dev/api/transactions");
  url.searchParams.set("user-id", "1"); // default to 1 as per CLI / frontend behavior
  if (query.startDate) url.searchParams.set("startDate", query.startDate.slice(0, 10));
  if (query.endDate) url.searchParams.set("endDate", query.endDate.slice(0, 10));
  try {
    const resp = await fetch(url.toString());
    if (!resp.ok) return [];
    return (await resp.json()) as any[];
  } catch {
    return [];
  }
}
