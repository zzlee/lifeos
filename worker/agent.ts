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
  getJournals,
} from "./repository";

type ChatMessage = { role: "user" | "assistant"; content: string };

type ToolExecutor = (args: any, env: Env, user: UserProfile, accountingUserId?: number) => Promise<unknown>;

type ToolSpec = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: ToolExecutor;
};

function localInputToUtcStringInWorker(localStr: string, timeZone: string): string {
  if (!localStr) return "";
  if (localStr.endsWith("Z") || /([+-]\d{2}:\d{2})$/.test(localStr)) {
    try {
      return new Date(localStr).toISOString();
    } catch {
      return localStr;
    }
  }
  try {
    const strToParse = localStr.length === 10 ? localStr + "T12:00:00" : localStr;
    const tempUtc = new Date(strToParse + "Z");
    const targetLocalStr = tempUtc.toLocaleString('sv-SE', { timeZone }).replace(' ', 'T');
    const targetLocalTime = new Date(targetLocalStr + "Z").getTime();
    const offset = targetLocalTime - tempUtc.getTime();
    const realUtc = new Date(tempUtc.getTime() - offset);
    return realUtc.toISOString();
  } catch (e) {
    try {
      return new Date(localStr).toISOString();
    } catch {
      return localStr;
    }
  }
}

function normalizeStartDate(d?: string, timeZone?: string): string | undefined {
  if (!d) return undefined;
  if (d.length === 10 && timeZone) {
    return localInputToUtcStringInWorker(`${d}T00:00:00`, timeZone);
  }
  return d;
}

function normalizeEndDate(d?: string, timeZone?: string): string | undefined {
  if (!d) return undefined;
  if (d.length === 10 && timeZone) {
    return localInputToUtcStringInWorker(`${d}T23:59:59.999`, timeZone);
  }
  return d;
}

const LIFEOS_TOOLSET: ToolSpec[] = [
  {
    name: "create_expense",
    description: "Create a new expense or transaction. By default, it will be saved to the external accounting system. Set 'local' parameter to true ONLY if you explicitly want to save it to the local database.",
    parameters: {
      type: "object",
      properties: { 
        amount: { type: "number" }, 
        category: { type: "string", description: "Required ONLY if local is true." },
        note: { type: "string" }, 
        date: { type: "string", description: "ISO timestamp or YYYY-MM-DD" },
        local: { type: "boolean", description: "Set to true ONLY if the user explicitly specifies storing 'locally', 'internally', or in 'local database'." },
        item_name: { type: "string", description: "Name of the item for external accounting. Highly recommended if local is false (or fallback to note/category)." },
        item_category_id: { type: "number", description: "ID of the item category for external accounting. Required if local is false." },
        payment_category_id: { type: "number", description: "ID of the payment category for external accounting. Required if local is false." }
      },
      required: ["amount", "item_name", "item_category_id", "payment_category_id"],
    },
    execute: async (args, env, user, accountingUserId) => {
      const isLocal = args.local === true;
      const resolvedDate = localInputToUtcStringInWorker(String(args.date || new Date().toISOString()), user.timezone || "Asia/Taipei");
      if (isLocal) {
        return createExpense(env.DB!, user, {
          amount: Number(args.amount) || 0,
          category: String(args.category || "AI 自動"),
          note: String(args.note || ""),
          date: resolvedDate,
        });
      } else {
        return createExternalTransaction({
          transaction_date: resolvedDate,
          item_name: String(args.item_name || args.note || args.category || "AI 自動"),
          item_category_id: Number(args.item_category_id) || 3, // fallback to a safe default if needed
          amount: Number(args.amount) || 0,
          payment_category_id: Number(args.payment_category_id) || 1, // fallback
          notes: args.note ? String(args.note) : undefined,
        }, accountingUserId || 1);
      }
    },
  },
  {
    name: "update_expense",
    description: "Update an existing expense or transaction by id.",
    parameters: {
      type: "object",
      properties: { 
        id: { type: "number" }, 
        amount: { type: "number" }, 
        category: { type: "string", description: "Required ONLY if source is local." },
        note: { type: "string" }, 
        date: { type: "string", description: "ISO timestamp or YYYY-MM-DD" },
        source: { type: "string", enum: ["local", "external"], description: "Whether the record is in the 'local' database or 'external' system (must match the source returned by query_expenses)." },
        item_name: { type: "string", description: "Name of the item for external accounting. Required if source is external." },
        item_category_id: { type: "number", description: "ID of the item category for external accounting. Required if source is external." },
        payment_category_id: { type: "number", description: "ID of the payment category for external accounting. Required if source is external." }
      },
      required: ["id", "amount", "source"],
    },
    execute: async (args, env, user, accountingUserId) => {
      const isLocal = args.source === "local";
      const resolvedDate = localInputToUtcStringInWorker(String(args.date || new Date().toISOString()), user.timezone || "Asia/Taipei");
      if (isLocal) {
        return updateExpense(env.DB!, Number(args.id), user, {
          amount: Number(args.amount) || 0,
          category: String(args.category || "AI 自動"),
          note: String(args.note || ""),
          date: resolvedDate,
        });
      } else {
        return updateExternalTransaction(Number(args.id), {
          transaction_date: resolvedDate,
          item_name: String(args.item_name || args.note || args.category || "AI 自動"),
          item_category_id: Number(args.item_category_id) || 3,
          amount: Number(args.amount) || 0,
          payment_category_id: Number(args.payment_category_id) || 1,
          notes: args.note ? String(args.note) : undefined,
        }, accountingUserId || 1);
      }
    },
  },
  {
    name: "delete_expense",
    description: "Delete an expense or transaction by id.",
    parameters: { 
      type: "object", 
      properties: { 
        id: { type: "number" },
        source: { type: "string", enum: ["local", "external"], description: "Whether the record is in the 'local' database or 'external' system (must match the source returned by query_expenses)." }
      }, 
      required: ["id", "source"] 
    },
    execute: async (args, env, user, accountingUserId) => {
      const isLocal = args.source === "local";
      if (isLocal) {
        return deleteExpense(env.DB!, Number(args.id), user);
      } else {
        return deleteExternalTransaction(Number(args.id), accountingUserId || 1);
      }
    },
  },
  {
    name: "create_journal",
    description: "Create a journal entry.",
    parameters: {
      type: "object",
      properties: {
        content: { type: "string" },
        tags: { type: "array", items: { type: "string" } }
      },
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
      date: localInputToUtcStringInWorker(String(args.date || args.recorded_at || new Date().toISOString()), user.timezone || "Asia/Taipei"),
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
      date: localInputToUtcStringInWorker(String(args.date || args.recorded_at || new Date().toISOString()), user.timezone || "Asia/Taipei"),
    }),
  },
  {
    name: "delete_health",
    description: "Delete a health record by id.",
    parameters: { type: "object", properties: { id: { type: "number" } }, required: ["id"] },
    execute: async (args, env, user) => deleteHealthRecord(env.DB!, Number(args.id), user),
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
    execute: async (args, env, user, accountingUserId) => {
      const normalizedStart = normalizeStartDate(args.start_date, user.timezone);
      const normalizedEnd = normalizeEndDate(args.end_date, user.timezone);

      // 1. Fetch local expenses from D1
      const localExpenses = await getExpenses(env.DB!, user, 100, 0, {
        startDate: normalizedStart,
        endDate: normalizedEnd,
        category: args.category,
        query: args.keyword,
      });

      // 2. Fetch external transactions
      const externalTxList = await fetchExternalTransactions({
        startDate: normalizedStart,
        endDate: normalizedEnd,
        userId: accountingUserId || 1,
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
        startDate: normalizeStartDate(args.start_date, user.timezone),
        endDate: normalizeEndDate(args.end_date, user.timezone),
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
  {
    name: "query_journals",
    description: "Query and search personal journal entries by date range, tag, or content keywords.",
    parameters: {
      type: "object",
      properties: {
        start_date: { type: "string", description: "Filter start date (YYYY-MM-DD or ISO timestamp)" },
        end_date: { type: "string", description: "Filter end date (YYYY-MM-DD or ISO timestamp)" },
        tag: { type: "string", description: "Filter by a specific tag name" },
        keyword: { type: "string", description: "Filter by keyword inside journal content" },
        limit: { type: "number", description: "Limit number of entries returned (default 30)" },
      },
    },
    execute: async (args, env, user) => {
      const limit = Number(args.limit) || 30;
      const records = await getJournals(env.DB!, user, limit, 0, {
        startDate: normalizeStartDate(args.start_date, user.timezone),
        endDate: normalizeEndDate(args.end_date, user.timezone),
        query: args.keyword,
        tag: args.tag,
      });

      return records.map(r => ({
        id: r.id,
        date: r.date.slice(0, 10),
        content: r.content,
        tags: r.tags,
      }));
    }
  },
];

const TOOL_MAP = new Map(LIFEOS_TOOLSET.map((tool) => [tool.name, tool]));

export async function runLifeAgentLoop(env: Env, user: UserProfile, messages: ChatMessage[], accountingUserId?: number) {
  console.log("Agent received messages:", JSON.stringify(messages, null, 2));
  if (!env.DB) throw new Error("Database not bound");
  if (!env.GEMINI_API_KEY) throw new Error("Gemini API key not configured");

  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  const model = env.GEMINI_MODEL || "gemini-2.5-flash";
  const maxTurns = 6;
  const conversation: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const userLocalTime = new Date().toLocaleString("zh-TW", { timeZone: user.timezone || "Asia/Taipei" });

  let itemCategoriesStr = "";
  let paymentCategoriesStr = "";
  let agentDebugError: string | undefined = undefined;

  try {
    const categories = await fetchAccountingCategories(accountingUserId);
    itemCategoriesStr = categories.itemCategories.map(c => `${c.id}:${c.name}`).join(", ");
    paymentCategoriesStr = categories.paymentCategories.map(c => `${c.id}:${c.name}`).join(", ");
  } catch (error: any) {
    console.error("Failed to fetch accounting categories for agent context:", error);
    agentDebugError = `[DEBUG ERROR] Failed to fetch accounting categories: ${error.message}`;
    itemCategoriesStr = "(Failed to load item categories)";
    paymentCategoriesStr = "(Failed to load payment categories)";
  }

  const systemInstruction = `You are the LifeOS agent. Use tools for queries and mutations, and answer with concise summaries. Current local date/time: ${userLocalTime}. User Timezone: ${user.timezone || "Asia/Taipei"}. Use this current date/time to resolve relative dates like "today", "yesterday", or "last week" when performing queries or mutations.

DATE/TIME HANDLING INSTRUCTIONS:
1. Always resolve relative terms (e.g. "today", "yesterday", "last Wednesday") in the user's local timezone context using the provided 'Current local date/time' and 'User Timezone'.
2. When calling tools (both query and mutation), you MUST ALWAYS supply dates in the user's LOCAL timezone format (e.g. 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:mm:ss').
3. DO NOT attempt to manually convert local dates to UTC or apply timezone offsets. The tool execution backend is fully timezone-aware and will automatically perform the local-to-UTC conversion based on the user's timezone.
4. For specific times mentioned by the user (e.g. "yesterday at 3:30 PM", "today noon"), format the parameters as a local ISO string without offset, e.g. '2026-05-26T15:30:00' or '2026-05-27T12:00:00'.
5. If the user only gives a date (e.g. "yesterday"), pass a simple 'YYYY-MM-DD' string (e.g. '2026-05-26').

CRITICAL INSTRUCTIONS FOR RETRIEVING DATA:
1. Since the dashboard snapshot is no longer in your context, you MUST ALWAYS call the corresponding query tools ('query_expenses', 'query_health', or 'query_journals') to fetch the data first if the user asks you to list, show, query, search, summarize, or check any transactions, expenses, health records, or journals! Do not assume the database is empty or make up answers without calling these query tools first!
2. When querying expenses or health records without a specific narrow date range specified by the user, DO NOT default to a narrow date filter (like 'today' or 'this week'). Instead, leave the 'start_date' and 'end_date' parameters completely empty or specify a very wide range so that all historical data (including past weeks and months) can be fetched and integrated successfully!

ACCOUNTING CATEGORIES:
For external transactions, you MUST use the following category IDs for 'item_category_id' and 'payment_category_id'.
Item Categories (ID:Name): ${itemCategoriesStr}
Payment Categories (ID:Name): ${paymentCategoriesStr}`;

  const executedToolCalls: Array<{ name: string; args: any; result: any }> = [];

  for (let i = 0; i < maxTurns; i++) {
    // Note: Dashboard Snapshot injection removed to optimize context token usage.
    // Query tools should be used by the agent to fetch expenses or health data.

    const response = await ai.models.generateContent({
      model,
      contents: conversation,
      config: {
        systemInstruction,
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
      return { 
        reply: response.text?.trim() || "已完成。", 
        data: snapshot.data, 
        source: "gemini" as const, 
        systemInstruction, 
        agentDebugError,
        toolCalls: executedToolCalls
      };
    }

    const results: Array<{ name: string; result: unknown }> = [];
    for (const call of functionCalls) {
      const tool = TOOL_MAP.get(call.name || "");
      const result = tool ? await tool.execute(call.args || {}, env, user, accountingUserId) : { ok: false, error: `unknown tool ${call.name}` };
      results.push({ name: call.name || "unknown", result });
      executedToolCalls.push({ name: call.name || "unknown", args: call.args || {}, result });
    }

    conversation.push({ role: "model", parts: [{ text: JSON.stringify(functionCalls) }] });
    conversation.push({ role: "user", parts: [{ text: `Tool results: ${JSON.stringify(results)}` }] });
  }

  const latest = await getDashboardSnapshot(env.DB, user);
  return { 
    reply: "已執行要求，若需更精準請補充細節。", 
    data: latest.data, 
    source: "gemini" as const, 
    systemInstruction, 
    agentDebugError,
    toolCalls: executedToolCalls
  };
}

function getValidUserId(userId?: any): number {
  if (userId === undefined || userId === null) return 1;
  const parsed = Number(userId);
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }
  return 1;
}

async function createExternalTransaction(args: any, userId?: number) {
  const cleanUserId = getValidUserId(userId);
  const resp = await fetch("https://purple-water-b776.zzlee-tw.workers.dev/api/transactions", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json", 
      "X-LifeOS-User-Id": String(cleanUserId),
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "application/json"
    },
    body: JSON.stringify({ ...args, user_id: cleanUserId }),
  });
  return { ok: resp.ok, status: resp.status };
}

async function updateExternalTransaction(id: number, args: any, userId?: number) {
  const cleanUserId = getValidUserId(userId);
  const resp = await fetch(`https://purple-water-b776.zzlee-tw.workers.dev/api/transactions/${id}`, {
    method: "PUT",
    headers: { 
      "Content-Type": "application/json", 
      "X-LifeOS-User-Id": String(cleanUserId),
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "application/json"
    },
    body: JSON.stringify({ ...args, user_id: cleanUserId }),
  });
  return { ok: resp.ok, status: resp.status };
}

async function deleteExternalTransaction(id: number, userId?: number) {
  const cleanUserId = getValidUserId(userId);
  const resp = await fetch(`https://purple-water-b776.zzlee-tw.workers.dev/api/transactions/${id}?user-id=${cleanUserId}`, {
    method: "DELETE",
    headers: { 
      "X-LifeOS-User-Id": String(cleanUserId),
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "application/json"
    },
  });
  return { ok: resp.ok, status: resp.status };
}

async function fetchExternalTransactions(query: { startDate?: string; endDate?: string; userId?: number }) {
  const cleanUserId = getValidUserId(query.userId);
  const url = new URL("https://purple-water-b776.zzlee-tw.workers.dev/api/transactions");
  url.searchParams.set("user-id", String(cleanUserId));
  if (query.startDate) url.searchParams.set("startDate", query.startDate);
  if (query.endDate) url.searchParams.set("endDate", query.endDate);
  try {
    const resp = await fetch(url.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json"
      }
    });
    if (!resp.ok) return [];
    return (await resp.json()) as any[];
  } catch (e) {
    console.error("External fetch failed:", e);
    return [];
  }
}

async function fetchAccountingCategories(userId?: number) {
  const cleanUserId = getValidUserId(userId);
  const fetchCategory = async (path: string) => {
    try {
      const url = `https://purple-water-b776.zzlee-tw.workers.dev${path}?user-id=${cleanUserId}`;
      const resp = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "application/json"
        }
      });
      if (!resp.ok) return [];
      const data = await resp.json() as any[];
      return data
        .map((item) => ({
          id: Number(item.id ?? item.item_category_id ?? item.payment_category_id),
          name: String(item.name ?? item.item_category ?? item.payment_category ?? "")
        }))
        .filter((item) => Number.isFinite(item.id) && item.id > 0 && item.name.trim().length > 0);
    } catch (e: any) {
      console.error(`External fetch category failed for ${path}:`, e);
      return [];
    }
  };

  const [itemCategories, paymentCategories] = await Promise.all([
    fetchCategory("/api/item-categories"),
    fetchCategory("/api/payment-categories")
  ]);

  return { itemCategories, paymentCategories };
}
