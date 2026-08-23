import type { AgentMutation } from "../shared/lifeAgent";
import type { Expense, HealthEntry, JournalEntry, LifeOSState, UserProfile } from "../shared/domain";
import type { D1Database } from "./env";
import { decryptSecret, encryptSecret } from "./crypto";
import { getGroupSummary } from "./line";

const groupNameCache = new Map<string, { groupName: string; timestamp: number }>();
const MAX_GROUP_CACHE_SIZE = 500;
const GROUP_CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

export async function getGroupNameCached(token: string, groupId: string): Promise<string | null> {
  const cached = groupNameCache.get(groupId);
  if (cached && Date.now() - cached.timestamp < GROUP_CACHE_TTL_MS) {
    return cached.groupName;
  }
  try {
    const summary = await getGroupSummary(token, groupId);
    if (summary && summary.groupName) {
      if (groupNameCache.size >= MAX_GROUP_CACHE_SIZE) {
        const firstKey = groupNameCache.keys().next().value;
        if (firstKey !== undefined) groupNameCache.delete(firstKey);
      }
      groupNameCache.set(groupId, { groupName: summary.groupName, timestamp: Date.now() });
      return summary.groupName;
    }
  } catch (e) {
    // Return null if LINE API fails or token is invalid
  }
  return null;
}

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
  const [expenses, journals, health, vault] = await db.batch<any>([
    db.prepare("SELECT id, date, amount, category, note FROM expenses WHERE user_id = ? ORDER BY date DESC, id DESC LIMIT 20").bind(user.id),
    db.prepare("SELECT id, created_at as date, content, tags FROM journals WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 12").bind(user.id),
    db.prepare("SELECT id, recorded_at as date, sys, dia, hr, weight FROM health_daily WHERE user_id = ? ORDER BY recorded_at DESC, id DESC LIMIT 30").bind(user.id),
    db.prepare("SELECT id, site, username, secret_preview as secret FROM vault_items WHERE user_id = ? ORDER BY site ASC LIMIT 20").bind(user.id)
  ]);

  return {
    source: "d1",
    data: {
      finance: (expenses.results as LifeOSState["finance"]) ?? [],
      journals: ((journals.results as Array<{ id: number; date: string; content: string; tags: string }>) ?? []).map((entry) => ({ ...entry, tags: entry.tags ? entry.tags.split(",") : [] })),
      health: (health.results as LifeOSState["health"]) ?? [],
      vault: (vault.results as LifeOSState["vault"]) ?? []
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

  return Promise.all(
    (records.results || []).map(async (record) => ({
      site: record.site,
      username: record.username,
      secret: await decryptSecret(record.secret_ciphertext, record.secret_iv, vaultMasterKey)
    }))
  );
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

export async function exportExpenses(
  db: D1Database,
  user: UserProfile,
  filters: {
    startDate?: string;
    endDate?: string;
    category?: string;
    limit?: number;
    offset?: number;
  } = {},
): Promise<Expense[]> {
  let sql = "SELECT id, date, amount, category, note FROM expenses WHERE user_id = ?";
  const params: any[] = [user.id];

  if (filters.startDate) {
    sql += " AND date >= ?";
    params.push(filters.startDate.slice(0, 10));
  }
  if (filters.endDate) {
    sql += " AND date <= ?";
    params.push(filters.endDate.slice(0, 10));
  }
  if (filters.category) {
    sql += " AND category = ?";
    params.push(filters.category);
  }

  sql += " ORDER BY date ASC, id ASC";

  if (filters.limit !== undefined) {
    sql += " LIMIT ?";
    params.push(filters.limit);
    if (filters.offset !== undefined) {
      sql += " OFFSET ?";
      params.push(filters.offset);
    }
  }

  const result = await db
    .prepare(sql)
    .bind(...params)
    .all<Expense>();
  return result.results ?? [];
}

export async function deleteExpensesByRange(
  db: D1Database,
  user: UserProfile,
  filters: {
    startDate?: string;
    endDate?: string;
    category?: string;
  } = {},
): Promise<{ ok: true; deletedCount: number }> {
  if (!filters.startDate && !filters.endDate && !filters.category) {
    throw new Error("At least one filter (startDate, endDate, category) must be provided to delete expenses.");
  }

  let sql = "DELETE FROM expenses WHERE user_id = ?";
  const params: any[] = [user.id];

  if (filters.startDate) {
    sql += " AND date >= ?";
    params.push(filters.startDate.slice(0, 10));
  }
  if (filters.endDate) {
    sql += " AND date <= ?";
    params.push(filters.endDate.slice(0, 10));
  }
  if (filters.category) {
    sql += " AND category = ?";
    params.push(filters.category);
  }

  const result = await db.prepare(sql).bind(...params).run();
  const deletedCount = result.meta?.changes ?? 0;
  return { ok: true, deletedCount };
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

export async function getVaultItems(
  db: D1Database,
  user: UserProfile,
  limit: number = 20,
  offset: number = 0,
  filters: { query?: string } = {},
): Promise<{ id: number; site: string; username: string; secret: string }[]> {
  let sql = "SELECT id, site, username, secret_preview as secret FROM vault_items WHERE user_id = ?";
  const params: any[] = [user.id];

  if (filters.query) {
    sql += " AND site LIKE ?";
    params.push(`%${filters.query}%`);
  }

  sql += " ORDER BY site ASC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const result = await db.prepare(sql).bind(...params).all<{ id: number; site: string; username: string; secret: string }>();
  return result.results || [];
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

// ---- LINE chat message archive ----

export type LineChatMessage = {
  roomType: "user" | "group" | "room";
  roomId: string;
  userId: string | null;
  messageType: string;
  text: string | null;
  lineMessageId: string | null;
  createdAt: string;
};

export type LineChatMessageRecord = LineChatMessage & { id: number };

/**
 * Archive one LINE message. Uses INSERT OR IGNORE with the unique
 * line_message_id index so duplicate webhook deliveries don't double-store.
 */
export async function saveLineMessage(
  db: D1Database,
  msg: LineChatMessage,
): Promise<void> {
  await db
    .prepare(
      `INSERT OR IGNORE INTO line_messages
        (room_type, room_id, user_id, message_type, text, line_message_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      msg.roomType,
      msg.roomId,
      msg.userId,
      msg.messageType,
      msg.text,
      msg.lineMessageId,
      msg.createdAt,
    )
    .run();
}

/** Query archived messages for one chat room, newest first. */
export async function getLineMessages(
  db: D1Database,
  roomType: string,
  roomId: string,
  limit: number = 50,
  offset: number = 0,
): Promise<LineChatMessageRecord[]> {
  const result = await db
    .prepare(
      `SELECT id, room_type as roomType, room_id as roomId, user_id as userId,
              message_type as messageType, text, line_message_id as lineMessageId, created_at as createdAt
       FROM line_messages
       WHERE room_type = ? AND room_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`
    )
    .bind(roomType, roomId, limit, offset)
    .all<LineChatMessageRecord>();
  return result.results ?? [];
}

/** One chat room with its last message, for the conversation list. */
export type LineRoomSummary = {
  roomType: "user" | "group" | "room";
  roomId: string;
  groupName?: string | null;
  messageCount: number;
  lastMessageType: string | null;
  lastMessageText: string | null;
  lastSenderId: string | null;
  lastMessageAt: string | null;
};

/** List all chat rooms (grouped by room), newest activity first. */
export async function listLineRooms(db: D1Database, lineToken?: string): Promise<LineRoomSummary[]> {
  const result = await db
    .prepare(
      `SELECT lm.room_type as roomType, lm.room_id as roomId,
              (SELECT COUNT(*) FROM line_messages c
                WHERE c.room_type = lm.room_type AND c.room_id = lm.room_id) as messageCount,
              lm.message_type as lastMessageType,
              lm.text as lastMessageText,
              lm.user_id as lastSenderId,
              lm.created_at as lastMessageAt
       FROM line_messages lm
       WHERE lm.id IN (SELECT MAX(id) FROM line_messages GROUP BY room_type, room_id)
       ORDER BY lm.created_at DESC`
    )
    .all<LineRoomSummary>();

  const rooms = result.results ?? [];

  if (lineToken) {
    return Promise.all(
      rooms.map(async (room) => {
        if (room.roomType === "group" && room.roomId) {
          const groupName = await getGroupNameCached(lineToken, room.roomId);
          return { ...room, groupName: groupName ?? null };
        }
        return room;
      })
    );
  }

  return rooms;
}

export type LineGroupSummary = {
  roomType: "group";
  roomId: string;
  groupName: string | null;
  messageCount: number;
  lastMessageAt: string | null;
};

/** List or query LINE group chat rooms from chat history with resolved group names. */
export async function listLineGroups(
  db: D1Database,
  lineToken?: string,
  filters: { query?: string; limit?: number; offset?: number } = {}
): Promise<LineGroupSummary[]> {
  const result = await db
    .prepare(
      `SELECT lm.room_type as roomType, lm.room_id as roomId,
              (SELECT COUNT(*) FROM line_messages c
                WHERE c.room_type = lm.room_type AND c.room_id = lm.room_id) as messageCount,
              lm.created_at as lastMessageAt
       FROM line_messages lm
       WHERE lm.room_type = 'group'
         AND lm.id IN (SELECT MAX(id) FROM line_messages WHERE room_type = 'group' GROUP BY room_id)
       ORDER BY lm.created_at DESC`
    )
    .all<{
      roomType: "group";
      roomId: string;
      messageCount: number;
      lastMessageAt: string | null;
    }>();

  let groups = (result.results ?? []).map((g) => ({
    ...g,
    groupName: null as string | null,
  }));

  if (lineToken) {
    groups = await Promise.all(
      groups.map(async (g) => {
        const groupName = await getGroupNameCached(lineToken, g.roomId);
        return { ...g, groupName };
      })
    );
  }

  if (filters.query) {
    const q = filters.query.toLowerCase();
    groups = groups.filter(
      (g) => g.roomId.toLowerCase().includes(q) || (g.groupName && g.groupName.toLowerCase().includes(q))
    );
  }

  const offset = filters.offset ?? 0;
  const limit = filters.limit ?? 50;
  return groups.slice(offset, offset + limit);
}

/** Export archived messages filtered by date range and optional room. */
export async function exportLineMessages(
  db: D1Database,
  filters: {
    startDate?: string;
    endDate?: string;
    roomType?: string;
    roomId?: string;
    limit?: number;
    offset?: number;
  } = {},
): Promise<LineChatMessageRecord[]> {
  let sql = `SELECT id, room_type as roomType, room_id as roomId, user_id as userId,
              message_type as messageType, text, line_message_id as lineMessageId, created_at as createdAt
             FROM line_messages WHERE 1=1`;
  const params: any[] = [];

  if (filters.roomType) {
    sql += " AND room_type = ?";
    params.push(filters.roomType);
  }
  if (filters.roomId) {
    sql += " AND room_id = ?";
    params.push(filters.roomId);
  }
  if (filters.startDate) {
    sql += " AND created_at >= ?";
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    let end = filters.endDate;
    if (/^\d{4}-\d{2}-\d{2}$/.test(end)) {
      end += "T23:59:59.999Z";
    }
    sql += " AND created_at <= ?";
    params.push(end);
  }

  sql += " ORDER BY created_at ASC, id ASC";

  if (filters.limit !== undefined) {
    sql += " LIMIT ?";
    params.push(filters.limit);
    if (filters.offset !== undefined) {
      sql += " OFFSET ?";
      params.push(filters.offset);
    }
  }

  const result = await db
    .prepare(sql)
    .bind(...params)
    .all<LineChatMessageRecord>();
  return result.results ?? [];
}

/** Delete archived messages filtered by date range and optional room. */
export async function deleteLineMessages(
  db: D1Database,
  filters: {
    startDate?: string;
    endDate?: string;
    roomType?: string;
    roomId?: string;
  } = {},
): Promise<{ ok: true; deletedCount: number }> {
  if (!filters.startDate && !filters.endDate && !filters.roomType && !filters.roomId) {
    throw new Error("At least one filter (startDate, endDate, roomType, roomId) must be provided to delete line messages.");
  }

  let sql = "DELETE FROM line_messages WHERE 1=1";
  const params: any[] = [];

  if (filters.roomType) {
    sql += " AND room_type = ?";
    params.push(filters.roomType);
  }
  if (filters.roomId) {
    sql += " AND room_id = ?";
    params.push(filters.roomId);
  }
  if (filters.startDate) {
    sql += " AND created_at >= ?";
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    let end = filters.endDate;
    if (/^\d{4}-\d{2}-\d{2}$/.test(end)) {
      end += "T23:59:59.999Z";
    }
    sql += " AND created_at <= ?";
    params.push(end);
  }

  const result = await db.prepare(sql).bind(...params).run();
  const deletedCount = result.meta?.changes ?? 0;
  return { ok: true, deletedCount };
}
