import type { Env } from "./env";
import type { UserProfile } from "../shared/domain";
import { createExpense, createHealthRecord, createJournal, deleteExpense, deleteHealthRecord, deleteJournal, getDashboardSnapshot, updateExpense, updateHealthRecord, updateJournal } from "./repository";

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models";

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function runLifeAgentLoop(env: Env, user: UserProfile, messages: ChatMessage[]) {
  if (!env.DB) throw new Error("Database not bound");
  if (!env.GEMINI_API_KEY || !env.GEMINI_MODEL) throw new Error("Gemini not configured");

  const maxTurns = 6;
  let transcript = [...messages];
  for (let i = 0; i < maxTurns; i++) {
    const snapshot = await getDashboardSnapshot(env.DB, user);
    const modelResponse = await callGemini(env, transcript, snapshot.data);
    const toolCall = extractToolCall(modelResponse);
    if (!toolCall) {
      return { reply: modelResponse, data: snapshot.data, source: "gemini" as const };
    }
    const result = await executeTool(toolCall.name, toolCall.arguments, env, user);
    transcript = [
      ...transcript,
      { role: "assistant", content: `TOOL_CALL ${JSON.stringify(toolCall)}` },
      { role: "assistant", content: `TOOL_RESULT ${JSON.stringify(result)}` },
    ];
  }

  const latest = await getDashboardSnapshot(env.DB, user);
  return { reply: "已執行要求，若需更精準請補充細節。", data: latest.data, source: "gemini" as const };
}

async function callGemini(env: Env, messages: ChatMessage[], snapshot: any): Promise<string> {
  const prompt = `你是 LifeOS 的代理人，可主動操作消費、日記、健康資料（新增/修改/刪除），並在消費面整合 internal expenses 與 external accounting。\n` +
  `可用工具: create_expense, update_expense, delete_expense, create_journal, update_journal, delete_journal, create_health, update_health, delete_health, create_external_transaction.\n` +
  `若需呼叫工具，僅輸出 JSON: {"tool":"...","arguments":{...}}。否則輸出自然語言回答。\n` +
  `snapshot=${JSON.stringify(snapshot).slice(0, 7000)}`;

  const contents = [
    ...messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
    { role: "user", parts: [{ text: prompt }] },
  ];

  const res = await fetch(`${GEMINI_URL}/${env.GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents }),
  });
  if (!res.ok) throw new Error(`Gemini failed ${res.status}`);
  const data = await res.json() as any;
  return data.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("\n")?.trim() || "";
}

function extractToolCall(text: string): { name: string; arguments: any } | null {
  try {
    const parsed = JSON.parse(text);
    if (parsed.tool && typeof parsed.tool === "string") return { name: parsed.tool, arguments: parsed.arguments || {} };
  } catch {}
  return null;
}

async function executeTool(name: string, args: any, env: Env, user: UserProfile) {
  if (!env.DB) throw new Error("Database not bound");
  switch (name) {
    case "create_expense": return createExpense(env.DB, user, args);
    case "update_expense": return updateExpense(env.DB, Number(args.id), user, args);
    case "delete_expense": return deleteExpense(env.DB, Number(args.id), user);
    case "create_journal": return createJournal(env.DB, user, args.content, args.tags || []);
    case "update_journal": return updateJournal(env.DB, Number(args.id), user, args.content, args.tags || []);
    case "delete_journal": return deleteJournal(env.DB, Number(args.id), user);
    case "create_health": return createHealthRecord(env.DB, user, args);
    case "update_health": return updateHealthRecord(env.DB, Number(args.id), user, args);
    case "delete_health": return deleteHealthRecord(env.DB, Number(args.id), user);
    case "create_external_transaction": return createExternalTransaction(args);
    default: return { ok: false, error: `unknown tool ${name}` };
  }
}

async function createExternalTransaction(args: any) {
  const resp = await fetch("https://purple-water-b776.zzlee-tw.workers.dev/api/transactions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-LifeOS-User-Id": String(args.user_id || 1) },
    body: JSON.stringify(args),
  });
  return { ok: resp.ok, status: resp.status };
}
