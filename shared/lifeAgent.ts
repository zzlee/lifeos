import type { Expense, HealthEntry, JournalEntry, LifeOSState, VaultItem } from "./domain";

export type AgentMutation =
  | { kind: "expense"; message: string; entry: Expense }
  | { kind: "health"; message: string; entry: HealthEntry }
  | { kind: "journal"; message: string; entry: JournalEntry }
  | { kind: "vault"; message: string; entry: VaultItem };

const today = "2026-03-27";
const shortDate = "03-27";
const now = "2026-03-27 09:30";

export function parseAgentInput(input: string, state: LifeOSState): AgentMutation {
  const text = input.trim();

  if (/(密碼|password|帳號|account)/i.test(text) && /(新增|加入|保存|記住|vault|密碼庫)/i.test(text)) {
    const entry = parseVaultCommand(text, state);
    return {
      kind: "vault",
      message: `已新增密碼：${entry.site}`,
      entry
    };
  }

  if (/(花|買|元|午餐|晚餐|早餐|咖啡|交通)/.test(text)) {
    const amountMatch = text.match(/\d+(?:\.\d+)?/);
    const amount = amountMatch ? Number(amountMatch[0]) : 0;
    const category = inferCategory(text);
    return {
      kind: "expense",
      message: `已記錄消費：NT$ ${amount || 0}`,
      entry: {
        id: Date.now(),
        date: today,
        amount: amount || 0,
        category,
        note: text
      }
    };
  }

  if (/(血壓|心跳|體重|kg|KG)/.test(text)) {
    const pairs = text.match(/\d+(?:\.\d+)?/g) ?? [];
    const latest = state.health[state.health.length - 1];
    const next: HealthEntry = {
      date: shortDate,
      sys: latest?.sys ?? 120,
      dia: latest?.dia ?? 80,
      hr: latest?.hr ?? 72,
      weight: latest?.weight
    };

    const bpMatch = text.match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
    if (bpMatch) {
      next.sys = Number(bpMatch[1]);
      next.dia = Number(bpMatch[2]);
    }

    if (/心跳/.test(text)) {
      const hrMatch = text.match(/心跳\D*(\d{2,3})/);
      if (hrMatch) next.hr = Number(hrMatch[1]);
    } else if (pairs.length >= 3 && !bpMatch) {
      next.hr = Number(pairs[2]);
    }

    if (/(體重|kg|KG)/.test(text)) {
      const weightMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:kg|KG|公斤)?/);
      if (weightMatch) next.weight = Number(weightMatch[1]);
    }

    return {
      kind: "health",
      message: `已更新健康資料：${next.sys}/${next.dia}，心跳 ${next.hr}`,
      entry: next
    };
  }

  return {
    kind: "journal",
    message: "已新增隨手日記",
    entry: {
      id: Date.now(),
      date: now,
      content: text,
      tags: inferTags(text)
    }
  };
}

function inferCategory(text: string): string {
  if (/(咖啡|午餐|晚餐|早餐|餐|牛肉麵)/.test(text)) return "餐飲";
  if (/(高鐵|捷運|公車|停車|油)/.test(text)) return "交通";
  if (/(電影|遊戲|串流)/.test(text)) return "娛樂";
  return "AI 自動";
}

function inferTags(text: string): string[] {
  if (/(上線|完成|順利|敲定)/.test(text)) return ["成就感", "工作"];
  if (/(累|煩|雷|焦慮)/.test(text)) return ["壓力", "隨記"];
  if (/(跑步|運動|健身)/.test(text)) return ["活力", "運動"];
  return ["隨記"];
}

function parseVaultCommand(text: string, state: LifeOSState): VaultItem {
  const structured =
    text.match(/新增\s+(.+?)\s+帳號\s+(.+?)\s+密碼\s+(.+)/i) ??
    text.match(/(?:網站|site)\s*[:：]?\s*([^\s，,]+).*(?:帳號|username|account)\s*[:：]?\s*([^\s，,]+).*(?:密碼|password)\s*[:：]?\s*(.+)$/i);

  const fallbackSite =
    text.match(/(?:網站|site)\s*[:：]?\s*([^\s，,]+)/i)?.[1] ??
    text.match(/新增\s+([^\s，,]+)/)?.[1] ??
    `Vault ${state.vault.length + 1}`;
  const fallbackUsername = text.match(/(?:帳號|username|account)\s*[:：]?\s*([^\s，,]+)/i)?.[1] ?? "lifeos_user";
  const fallbackSecret = text.match(/(?:密碼|password)\s*[:：]?\s*(.+)$/i)?.[1]?.trim() ?? "change-me";

  return {
    id: Date.now(),
    site: structured?.[1]?.trim() ?? fallbackSite,
    username: structured?.[2]?.trim() ?? fallbackUsername,
    secret: structured?.[3]?.trim() ?? fallbackSecret
  };
}
