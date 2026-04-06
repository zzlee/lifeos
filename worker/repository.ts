import type { AgentMutation } from "../shared/lifeAgent";
import type { LifeOSState, UserProfile } from "../shared/domain";
import type { D1Database } from "./env";
import { decryptSecret, encryptSecret } from "./crypto";

export async function getDashboardSnapshot(
  db: D1Database,
  user: UserProfile,
): Promise<{ data: LifeOSState; source: "d1" }> {
  const [expenses, journals, health, vault] = await Promise.all([
    db.prepare("SELECT id, date, amount, category, note FROM expenses WHERE user_id = ? ORDER BY date DESC, id DESC LIMIT 20").bind(user.id).all<LifeOSState["finance"][number]>(),
    db.prepare("SELECT id, created_at as date, content, tags FROM journals WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 12").bind(user.id).all<{ id: number; date: string; content: string; tags: string }>(),
    db.prepare("SELECT recorded_at as date, sys, dia, hr, weight FROM health_daily WHERE user_id = ? ORDER BY recorded_at ASC, id ASC LIMIT 30").bind(user.id).all<LifeOSState["health"][number]>(),
    db.prepare("SELECT id, site, username, secret_preview as secret FROM vault_items WHERE user_id = ? ORDER BY site ASC LIMIT 20").bind(user.id).all<LifeOSState["vault"][number]>()
  ]);

  return {
    source: "d1",
    data: {
      finance: expenses.results ?? [],
      journals: (journals.results ?? []).map((entry) => ({ ...entry, tags: entry.tags ? entry.tags.split(",") : [] })),
      health: health.results ?? [],
      vault: vault.results ?? []
    }
  };
}

export async function persistAgentMutation(
  db: D1Database,
  user: UserProfile,
  mutation: AgentMutation,
  vaultMasterKey: string,
): Promise<{ data: LifeOSState; source: "d1" }> {
  switch (mutation.kind) {
    case "expense":
      await db
        .prepare("INSERT INTO expenses (user_id, amount, category, note, date) VALUES (?, ?, ?, ?, ?)")
        .bind(user.id, mutation.entry.amount, mutation.entry.category, mutation.entry.note, mutation.entry.date)
        .run();
      break;
    case "journal":
      await db
        .prepare("INSERT INTO journals (user_id, content, tags, created_at) VALUES (?, ?, ?, ?)")
        .bind(user.id, mutation.entry.content, mutation.entry.tags.join(","), mutation.entry.date)
        .run();
      break;
    case "health":
      await db
        .prepare("INSERT INTO health_daily (user_id, recorded_at, sys, dia, hr, weight) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(user.id, mutation.entry.date, mutation.entry.sys, mutation.entry.dia, mutation.entry.hr, mutation.entry.weight ?? null)
        .run();
      break;
    case "vault": {
      const encrypted = await encryptSecret(mutation.entry.secret, vaultMasterKey);
      await db
        .prepare(
          "INSERT INTO vault_items (user_id, site, username, secret_ciphertext, secret_iv, secret_preview) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(
          user.id,
          mutation.entry.site,
          mutation.entry.username,
          encrypted.ciphertext,
          encrypted.iv,
          maskSecret(mutation.entry.secret),
        )
        .run();
      break;
    }
  }

  return getDashboardSnapshot(db, user);
}

export async function getVaultSecret(
  db: D1Database,
  user: UserProfile,
  vaultId: number,
  vaultMasterKey: string,
): Promise<{ secret: string; source: "d1" }> {
  const record = await db
    .prepare("SELECT secret_ciphertext, secret_iv FROM vault_items WHERE user_id = ? AND id = ?")
    .bind(user.id, vaultId)
    .first<{ secret_ciphertext: string; secret_iv: string }>();

  if (!record) {
    return { secret: "", source: "d1" };
  }

  return {
    secret: await decryptSecret(record.secret_ciphertext, record.secret_iv, vaultMasterKey),
    source: "d1"
  };
}

function maskSecret(secret: string): string {
  if (secret.length <= 4) return "****";
  return `${secret.slice(0, 2)}••••${secret.slice(-2)}`;
}
