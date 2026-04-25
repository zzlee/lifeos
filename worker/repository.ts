import type { AgentMutation } from "../shared/lifeAgent";
import type { Expense, HealthEntry, JournalEntry, LifeOSState, UserProfile } from "../shared/domain";
import type { D1Database } from "./env";
import { decryptSecret, encryptSecret } from "./crypto";

export async function getJournals(
  db: D1Database,
  user: UserProfile,
  limit: number = 20,
  offset: number = 0,
  filters: { startDate?: string; endDate?: string; query?: string; tag?: string } = {},
): Promise<JournalEntry[]> {
  let sql = "SELECT id, created_at as date, content, tags FROM journals WHERE user_id = ?";
  const params: any[] = [user.id];

  if (filters.startDate) {
    sql += " AND created_at >= ?";
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    sql += " AND created_at <= ?";
    params.push(filters.endDate);
  }
  if (filters.query) {
    sql += " AND content LIKE ?";
    params.push(`%${filters.query}%`);
  }
  if (filters.tag) {
    sql += " AND (tags LIKE ? OR tags LIKE ? OR tags LIKE ? OR tags = ?)";
    params.push(`${filters.tag},%`, `%,${filters.tag},%`, `%,${filters.tag}`, filters.tag);
  }

  sql += " ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const result = await db
    .prepare(sql)
    .bind(...params)
    .all<{ id: number; date: string; content: string; tags: string }>();
  
  return (result.results ?? []).map((entry) => ({
    ...entry,
    tags: entry.tags ? entry.tags.split(",") : []
  }));
}

export async function getJournal(
  db: D1Database,
  user: UserProfile,
  id: number,
): Promise<JournalEntry | null> {
  const result = await db
    .prepare("SELECT id, created_at as date, content, tags FROM journals WHERE user_id = ? AND id = ?")
    .bind(user.id, id)
    .first<{ id: number; date: string; content: string; tags: string }>();
  
  if (!result) return null;
  return {
    ...result,
    tags: result.tags ? result.tags.split(",") : []
  };
}

export async function createJournal(
  db: D1Database,
  user: UserProfile,
  content: string,
  tags: string[],
): Promise<{ ok: true }> {
  const createdAt = new Date().toISOString();
  await db
    .prepare("INSERT INTO journals (user_id, content, tags, created_at) VALUES (?, ?, ?, ?)")
    .bind(user.id, content, tags.join(","), createdAt)
    .run();
  
  return { ok: true };
}

export async function updateJournal(
  db: D1Database,
  id: number,
  user: UserProfile,
  content: string,
  tags: string[],
): Promise<{ ok: true }> {
  await db
    .prepare("UPDATE journals SET content = ?, tags = ? WHERE id = ? AND user_id = ?")
    .bind(content, tags.join(","), id, user.id)
    .run();
  
  return { ok: true };
}

export async function deleteJournal(
  db: D1Database,
  id: number,
  user: UserProfile,
): Promise<{ ok: true }> {
  await db
    .prepare("DELETE FROM journals WHERE id = ? AND user_id = ?")
    .bind(id, user.id)
    .run();
  
  return { ok: true };
}

export async function getDashboardSnapshot(
  db: D1Database,
  user: UserProfile,
): Promise<{ data: LifeOSState; source: "d1" }> {
  const [expenses, journals, health, vault] = await Promise.all([
    db.prepare("SELECT id, date, amount, category, note FROM expenses WHERE user_id = ? ORDER BY date DESC, id DESC LIMIT 20").bind(user.id).all<LifeOSState["finance"][number]>(),
    db.prepare("SELECT id, created_at as date, content, tags FROM journals WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 12").bind(user.id).all<{ id: number; date: string; content: string; tags: string }>(),
    db.prepare("SELECT id, recorded_at as date, sys, dia, hr, weight FROM health_daily WHERE user_id = ? ORDER BY recorded_at DESC, id DESC LIMIT 30").bind(user.id).all<LifeOSState["health"][number]>(),
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

export async function exportVault(
  db: D1Database,
  user: UserProfile,
  vaultMasterKey: string,
): Promise<Array<{ site: string; username: string; secret: string }>> {
  const records = await db
    .prepare("SELECT site, username, secret_ciphertext, secret_iv FROM vault_items WHERE user_id = ? ORDER BY site ASC")
    .bind(user.id)
    .all<{ site: string; username: string; secret_ciphertext: string; secret_iv: string }>();

  const result = [];
  for (const record of records.results || []) {
    result.push({
      site: record.site,
      username: record.username,
      secret: await decryptSecret(record.secret_ciphertext, record.secret_iv, vaultMasterKey)
    });
  }

  return result;
}

export async function createVaultItem(
  db: D1Database,
  user: UserProfile,
  entry: { site: string; username: string; secret: string },
  vaultMasterKey: string,
): Promise<{ data: LifeOSState; source: "d1" }> {
  const encrypted = await encryptSecret(entry.secret, vaultMasterKey);
  await db
    .prepare(
      "INSERT INTO vault_items (user_id, site, username, secret_ciphertext, secret_iv, secret_preview) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(
      user.id,
      entry.site,
      entry.username,
      encrypted.ciphertext,
      encrypted.iv,
      maskSecret(entry.secret),
    )
    .run();

  return getDashboardSnapshot(db, user);
}

export function maskSecret(secret: string): string {
  if (secret.length <= 4) return "****";
  return `${secret.slice(0, 2)}••••${secret.slice(-2)}`;
}

export async function getExpenses(
  db: D1Database,
  user: UserProfile,
  limit: number = 20,
  offset: number = 0,
  filters: { startDate?: string; endDate?: string; minAmount?: number; maxAmount?: number; category?: string; query?: string } = {},
): Promise<Expense[]> {
  let sql = "SELECT id, date, amount, category, note FROM expenses WHERE user_id = ?";
  const params: any[] = [user.id];

  if (filters.startDate) {
    sql += " AND date >= ?";
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    sql += " AND date <= ?";
    params.push(filters.endDate);
  }
  if (filters.minAmount !== undefined) {
    sql += " AND amount >= ?";
    params.push(filters.minAmount);
  }
  if (filters.maxAmount !== undefined) {
    sql += " AND amount <= ?";
    params.push(filters.maxAmount);
  }
  if (filters.category) {
    sql += " AND category = ?";
    params.push(filters.category);
  }
  if (filters.query) {
    sql += " AND note LIKE ?";
    params.push(`%${filters.query}%`);
  }

  sql += " ORDER BY date DESC, id DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const result = await db
    .prepare(sql)
    .bind(...params)
    .all<Expense>();
  return result.results ?? [];
}

export async function createExpense(
  db: D1Database,
  user: UserProfile,
  entry: { amount: number; category: string; note: string; date: string },
): Promise<{ ok: true }> {
  await db
    .prepare("INSERT INTO expenses (user_id, amount, category, note, date) VALUES (?, ?, ?, ?, ?)")
    .bind(user.id, entry.amount, entry.category, entry.note, entry.date)
    .run();
  return { ok: true };
}

export async function updateExpense(
  db: D1Database,
  id: number,
  user: UserProfile,
  entry: { amount: number; category: string; note: string; date: string },
): Promise<{ ok: true }> {
  await db
    .prepare("UPDATE expenses SET amount = ?, category = ?, note = ?, date = ? WHERE id = ? AND user_id = ?")
    .bind(entry.amount, entry.category, entry.note, entry.date, id, user.id)
    .run();
  return { ok: true };
}

export async function deleteExpense(
  db: D1Database,
  id: number,
  user: UserProfile,
): Promise<{ ok: true }> {
  await db
    .prepare("DELETE FROM expenses WHERE id = ? AND user_id = ?")
    .bind(id, user.id)
    .run();
  return { ok: true };
}

export async function getHealthRecords(
  db: D1Database,
  user: UserProfile,
  limit: number = 30,
  offset: number = 0,
  filters: { startDate?: string; endDate?: string } = {},
): Promise<HealthEntry[]> {
  let sql = "SELECT id, recorded_at as date, sys, dia, hr, weight FROM health_daily WHERE user_id = ?";
  const params: any[] = [user.id];

  if (filters.startDate) {
    sql += " AND recorded_at >= ?";
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    sql += " AND recorded_at <= ?";
    params.push(filters.endDate);
  }

  sql += " ORDER BY recorded_at DESC, id DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const result = await db
    .prepare(sql)
    .bind(...params)
    .all<HealthEntry & { id: number }>();
  return result.results ?? [];
}

export async function createHealthRecord(
  db: D1Database,
  user: UserProfile,
  entry: { sys: number; dia: number; hr: number; weight?: number; date: string },
): Promise<{ ok: true }> {
  await db
    .prepare("INSERT INTO health_daily (user_id, recorded_at, sys, dia, hr, weight) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(user.id, entry.date, entry.sys, entry.dia, entry.hr, entry.weight ?? null)
    .run();
  return { ok: true };
}

export async function updateHealthRecord(
  db: D1Database,
  id: number,
  user: UserProfile,
  entry: { sys: number; dia: number; hr: number; weight?: number; date: string },
): Promise<{ ok: true }> {
  await db
    .prepare("UPDATE health_daily SET recorded_at = ?, sys = ?, dia = ?, hr = ?, weight = ? WHERE id = ? AND user_id = ?")
    .bind(entry.date, entry.sys, entry.dia, entry.hr, entry.weight ?? null, id, user.id)
    .run();
  return { ok: true };
}

export async function deleteHealthRecord(
  db: D1Database,
  id: number,
  user: UserProfile,
): Promise<{ ok: true }> {
  await db
    .prepare("DELETE FROM health_daily WHERE id = ? AND user_id = ?")
    .bind(id, user.id)
    .run();
  return { ok: true };
}
