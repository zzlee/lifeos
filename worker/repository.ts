import { initialData } from "../shared/mockData";
import type { LifeOSState } from "../shared/domain";
import type { D1Database } from "./env";

export async function getDashboardSnapshot(db?: D1Database): Promise<{ data: LifeOSState; source: "mock" | "d1" }> {
  if (!db) {
    return { data: structuredClone(initialData), source: "mock" };
  }

  const [expenses, journals, health, vault] = await Promise.all([
    db.prepare("SELECT id, date, amount, category, note FROM expenses ORDER BY date DESC LIMIT 20").all<LifeOSState["finance"][number]>(),
    db.prepare("SELECT id, created_at as date, content, tags FROM journals ORDER BY created_at DESC LIMIT 12").all<{ id: number; date: string; content: string; tags: string }>(),
    db.prepare("SELECT recorded_at as date, sys, dia, hr, weight FROM health_daily ORDER BY recorded_at ASC LIMIT 30").all<LifeOSState["health"][number]>(),
    db.prepare("SELECT id, site, username, secret_preview as secret FROM vault_items ORDER BY site ASC LIMIT 20").all<LifeOSState["vault"][number]>()
  ]);

  return {
    source: "d1",
    data: {
      finance: expenses.results,
      journals: journals.results.map((entry) => ({ ...entry, tags: entry.tags ? entry.tags.split(",") : [] })),
      health: health.results,
      vault: vault.results
    }
  };
}
