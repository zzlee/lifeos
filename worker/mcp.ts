import { McpServer, type CallToolResult, type ServerContext } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";
import {
  getJournals,
  getJournal,
  createJournal,
  updateJournal,
  deleteJournal,
  getExpenses,
  exportExpenses,
  deleteExpensesByRange,
  createExpense,
  updateExpense,
  deleteExpense,
  getHealthRecords,
  createHealthRecord,
  updateHealthRecord,
  deleteHealthRecord,
  getDashboardSnapshot,
  listLineRooms,
  getLineMessages,
  exportLineMessages,
  deleteLineMessages,
  getVaultItems,
  createVaultItem,
  exportVault
} from "./repository";
import type { UserProfile } from "../shared/domain";
import type { Env } from "./env";

type AuthContext = { user: UserProfile; env: Env };

function getAuthContext(ctx: ServerContext): AuthContext {
  const extra = ctx.http?.authInfo?.extra as AuthContext | undefined;
  if (!extra || !extra.user || !extra.env) {
    throw new Error("Unauthorized context");
  }
  return extra;
}

function toText(value: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

const today = () => new Date().toLocaleDateString("sv-SE");

export function createMcpServer() {
  const server = new McpServer({
    name: "lifeos-worker-mcp",
    version: "1.0.0",
  });

  // --- Journal tools ---
  server.registerTool(
    "journal_ls",
    {
      description: "List all journals",
      inputSchema: z.object({
        limit: z.number().int().positive().optional().describe("Limit number of entries"),
        offset: z.number().int().nonnegative().optional().describe("Offset for pagination"),
      }),
    },
    async ({ limit, offset }, ctx) => {
      const { user, env } = getAuthContext(ctx);
      if (!env.DB) throw new Error("Database not bound");
      return toText(await getJournals(env.DB, user, limit ?? 20, offset ?? 0));
    }
  );

  server.registerTool(
    "journal_get",
    {
      description: "Get a journal entry by ID",
      inputSchema: z.object({
        id: z.number().int().positive().describe("Journal entry ID"),
      }),
    },
    async ({ id }, ctx) => {
      const { user, env } = getAuthContext(ctx);
      if (!env.DB) throw new Error("Database not bound");
      const entry = await getJournal(env.DB, user, id);
      if (!entry) throw new Error(`Journal ${id} not found.`);
      return toText(entry);
    }
  );

  server.registerTool(
    "journal_create",
    {
      description: "Create a new journal entry",
      inputSchema: z.object({
        content: z.string().describe("Journal content"),
        tags: z.string().optional().describe("Tags (comma separated)"),
      }),
    },
    async ({ content, tags }, ctx) => {
      const { user, env } = getAuthContext(ctx);
      if (!env.DB) throw new Error("Database not bound");
      const tagList = typeof tags === "string" ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [];
      await createJournal(env.DB, user, content, tagList);
      return toText({ ok: true, message: "Journal entry created successfully!" });
    }
  );

  server.registerTool(
    "journal_update",
    {
      description: "Update a journal entry",
      inputSchema: z.object({
        id: z.number().int().positive().describe("Journal entry ID"),
        content: z.string().describe("New journal content"),
        tags: z.string().optional().describe("Tags (comma separated)"),
      }),
    },
    async ({ id, content, tags }, ctx) => {
      const { user, env } = getAuthContext(ctx);
      if (!env.DB) throw new Error("Database not bound");
      const tagList = typeof tags === "string" ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [];
      await updateJournal(env.DB, id, user, content, tagList);
      return toText({ ok: true, message: `Journal entry ${id} updated successfully!` });
    }
  );

  server.registerTool(
    "journal_delete",
    {
      description: "Delete a journal entry",
      inputSchema: z.object({
        id: z.number().int().positive().describe("Journal entry ID"),
      }),
    },
    async ({ id }, ctx) => {
      const { user, env } = getAuthContext(ctx);
      if (!env.DB) throw new Error("Database not bound");
      await deleteJournal(env.DB, id, user);
      return toText({ ok: true, message: `Journal entry ${id} deleted successfully!` });
    }
  );

  // --- Finance tools ---
  server.registerTool(
    "finance_ls",
    {
      description: "List all expenses",
      inputSchema: z.object({
        limit: z.number().int().positive().optional().describe("Limit number of entries"),
        offset: z.number().int().nonnegative().optional().describe("Offset for pagination"),
      }),
    },
    async ({ limit, offset }, ctx) => {
      const { user, env } = getAuthContext(ctx);
      if (!env.DB) throw new Error("Database not bound");
      return toText(await getExpenses(env.DB, user, limit ?? 20, offset ?? 0));
    }
  );

  server.registerTool(
    "finance_get",
    {
      description: "Get an expense by ID",
      inputSchema: z.object({
        id: z.number().int().positive().describe("Expense ID"),
      }),
    },
    async ({ id }, ctx) => {
      const { user, env } = getAuthContext(ctx);
      if (!env.DB) throw new Error("Database not bound");
      const dashboard = await getDashboardSnapshot(env.DB, user);
      const entry = dashboard.data.finance.find((e) => e.id === id);
      if (!entry) throw new Error(`Expense ${id} not found.`);
      return toText(entry);
    }
  );

  server.registerTool(
    "finance_create",
    {
      description: "Create a new expense",
      inputSchema: z.object({
        amount: z.number().describe("Amount"),
        category: z.string().describe("Category"),
        note: z.string().optional().describe("Note"),
        date: z.string().optional().describe("Date (YYYY-MM-DD)"),
      }),
    },
    async ({ amount, category, note, date }, ctx) => {
      const { user, env } = getAuthContext(ctx);
      if (!env.DB) throw new Error("Database not bound");
      await createExpense(env.DB, user, {
        amount: Number(amount),
        category,
        note: note || "",
        date: date || today(),
      });
      return toText({ ok: true, message: "Expense created successfully!" });
    }
  );

  server.registerTool(
    "finance_update",
    {
      description: "Update an expense",
      inputSchema: z.object({
        id: z.number().int().positive().describe("Expense ID"),
        amount: z.number().describe("New amount"),
        category: z.string().describe("New category"),
        note: z.string().optional().describe("Note"),
        date: z.string().optional().describe("Date (YYYY-MM-DD)"),
      }),
    },
    async ({ id, amount, category, note, date }, ctx) => {
      const { user, env } = getAuthContext(ctx);
      if (!env.DB) throw new Error("Database not bound");
      await updateExpense(env.DB, id, user, {
        amount: Number(amount),
        category,
        note: note || "",
        date: date || today(),
      });
      return toText({ ok: true, message: `Expense ${id} updated successfully!` });
    }
  );

  server.registerTool(
    "finance_delete",
    {
      description: "Delete an expense",
      inputSchema: z.object({
        id: z.number().int().positive().describe("Expense ID"),
      }),
    },
    async ({ id }, ctx) => {
      const { user, env } = getAuthContext(ctx);
      if (!env.DB) throw new Error("Database not bound");
      await deleteExpense(env.DB, id, user);
      return toText({ ok: true, message: `Expense ${id} deleted successfully!` });
    }
  );

  server.registerTool(
    "finance_export",
    {
      description: "Export expense records filtered by date range and optional category",
      inputSchema: z.object({
        startDate: z.string().optional().describe("Start date filter (YYYY-MM-DD)"),
        endDate: z.string().optional().describe("End date filter (YYYY-MM-DD)"),
        category: z.string().optional().describe("Category filter"),
        limit: z.number().int().positive().optional().describe("Limit number of entries"),
        offset: z.number().int().nonnegative().optional().describe("Offset for pagination"),
      }),
    },
    async ({ startDate, endDate, category, limit, offset }, ctx) => {
      const { user, env } = getAuthContext(ctx);
      if (!env.DB) throw new Error("Database not bound");
      return toText(await exportExpenses(env.DB, user, { startDate, endDate, category, limit, offset }));
    }
  );

  server.registerTool(
    "finance_delete_range",
    {
      description: "Delete expense records filtered by date range and optional category",
      inputSchema: z.object({
        startDate: z.string().optional().describe("Start date filter (YYYY-MM-DD)"),
        endDate: z.string().optional().describe("End date filter (YYYY-MM-DD)"),
        category: z.string().optional().describe("Category filter"),
      }),
    },
    async ({ startDate, endDate, category }, ctx) => {
      const { user, env } = getAuthContext(ctx);
      if (!env.DB) throw new Error("Database not bound");
      const result = await deleteExpensesByRange(env.DB, user, { startDate, endDate, category });
      return toText({ ok: true, message: `Deleted ${result.deletedCount} expense record(s).`, deletedCount: result.deletedCount });
    }
  );

  // --- Health tools ---
  server.registerTool(
    "health_ls",
    {
      description: "List all health records",
      inputSchema: z.object({
        limit: z.number().int().positive().optional().describe("Limit number of entries"),
        offset: z.number().int().nonnegative().optional().describe("Offset for pagination"),
      }),
    },
    async ({ limit, offset }, ctx) => {
      const { user, env } = getAuthContext(ctx);
      if (!env.DB) throw new Error("Database not bound");
      return toText(await getHealthRecords(env.DB, user, limit ?? 30, offset ?? 0));
    }
  );

  server.registerTool(
    "health_create",
    {
      description: "Create a new health record",
      inputSchema: z.object({
        sys: z.number().describe("Systolic pressure"),
        dia: z.number().describe("Diastolic pressure"),
        hr: z.number().describe("Heart rate"),
        weight: z.number().optional().describe("Weight (kg)"),
        date: z.string().optional().describe("Date (YYYY-MM-DD)"),
      }),
    },
    async ({ sys, dia, hr, weight, date }, ctx) => {
      const { user, env } = getAuthContext(ctx);
      if (!env.DB) throw new Error("Database not bound");
      await createHealthRecord(env.DB, user, {
        sys: Number(sys),
        dia: Number(dia),
        hr: Number(hr),
        weight: weight !== undefined ? Number(weight) : undefined,
        date: date || today(),
      });
      return toText({ ok: true, message: "Health record created successfully!" });
    }
  );

  server.registerTool(
    "health_update",
    {
      description: "Update a health record",
      inputSchema: z.object({
        id: z.string().describe("Health record ID (date)"),
        sys: z.number().describe("Systolic pressure"),
        dia: z.number().describe("Diastolic pressure"),
        hr: z.number().describe("Heart rate"),
        weight: z.number().optional().describe("Weight (kg)"),
        date: z.string().optional().describe("Date (YYYY-MM-DD)"),
      }),
    },
    async ({ id, sys, dia, hr, weight, date }, ctx) => {
      const { user, env } = getAuthContext(ctx);
      if (!env.DB) throw new Error("Database not bound");
      await updateHealthRecord(env.DB, Number(id), user, {
        sys: Number(sys),
        dia: Number(dia),
        hr: Number(hr),
        weight: weight !== undefined ? Number(weight) : undefined,
        date: date || today(),
      });
      return toText({ ok: true, message: `Health record ${id} updated successfully!` });
    }
  );

  server.registerTool(
    "health_delete",
    {
      description: "Delete a health record",
      inputSchema: z.object({
        id: z.string().describe("Health record ID (date)"),
      }),
    },
    async ({ id }, ctx) => {
      const { user, env } = getAuthContext(ctx);
      if (!env.DB) throw new Error("Database not bound");
      await deleteHealthRecord(env.DB, Number(id), user);
      return toText({ ok: true, message: `Health record ${id} deleted successfully!` });
    }
  );

  // --- Vault tools ---
  server.registerTool(
    "vault_ls",
    {
      description: "List vault items with masked secrets",
      inputSchema: z.object({
        query: z.string().optional().describe("Filter by site keyword"),
        limit: z.number().int().positive().optional().describe("Limit number of entries"),
        offset: z.number().int().nonnegative().optional().describe("Offset for pagination"),
      }),
    },
    async ({ query, limit, offset }, ctx) => {
      const { user, env } = getAuthContext(ctx);
      if (!env.DB) throw new Error("Database not bound");
      return toText(await getVaultItems(env.DB, user, limit ?? 20, offset ?? 0, { query }));
    }
  );

  server.registerTool(
    "vault_create",
    {
      description: "Create a new vault item",
      inputSchema: z.object({
        site: z.string().describe("Website or service name"),
        username: z.string().describe("Username or account name"),
        secret: z.string().describe("Password or secret"),
      }),
    },
    async ({ site, username, secret }, ctx) => {
      const { user, env } = getAuthContext(ctx);
      if (!env.DB) throw new Error("Database not bound");
      if (!env.VAULT_MASTER_KEY) throw new Error("Vault master key not configured");
      await createVaultItem(env.DB, user, { site, username, secret }, env.VAULT_MASTER_KEY);
      return toText({ ok: true, message: "Vault item created successfully!" });
    }
  );

  server.registerTool(
    "vault_export",
    {
      description: "Export all vault items with decrypted secrets",
      inputSchema: z.object({}),
    },
    async (_, ctx) => {
      const { user, env } = getAuthContext(ctx);
      if (!env.DB) throw new Error("Database not bound");
      if (!env.VAULT_MASTER_KEY) throw new Error("Vault master key not configured");
      return toText(await exportVault(env.DB, user, env.VAULT_MASTER_KEY));
    }
  );

  // --- LINE chat tools ---
  server.registerTool(
    "line_rooms_ls",
    {
      description: "List all LINE chat rooms with summary of last messages",
      inputSchema: z.object({}),
    },
    async (_, ctx) => {
      const { env } = getAuthContext(ctx);
      if (!env.DB) throw new Error("Database not bound");
      return toText(await listLineRooms(env.DB));
    }
  );

  server.registerTool(
    "line_messages_ls",
    {
      description: "Get archived messages for a specific LINE chat room",
      inputSchema: z.object({
        roomType: z.enum(["user", "group", "room"]).describe("Room type (user, group, room)"),
        roomId: z.string().describe("Room ID"),
        limit: z.number().int().positive().optional().describe("Limit number of entries"),
        offset: z.number().int().nonnegative().optional().describe("Offset for pagination"),
      }),
    },
    async ({ roomType, roomId, limit, offset }, ctx) => {
      const { env } = getAuthContext(ctx);
      if (!env.DB) throw new Error("Database not bound");
      return toText(await getLineMessages(env.DB, roomType, roomId, limit ?? 50, offset ?? 0));
    }
  );

  server.registerTool(
    "line_messages_export",
    {
      description: "Export archived LINE chat messages filtered by time range and optional room",
      inputSchema: z.object({
        startDate: z.string().optional().describe("Start date/time filter (YYYY-MM-DD or ISO string)"),
        endDate: z.string().optional().describe("End date/time filter (YYYY-MM-DD or ISO string)"),
        roomType: z.enum(["user", "group", "room"]).optional().describe("Room type filter (user, group, room)"),
        roomId: z.string().optional().describe("Room ID filter"),
        limit: z.number().int().positive().optional().describe("Limit number of entries"),
        offset: z.number().int().nonnegative().optional().describe("Offset for pagination"),
      }),
    },
    async ({ startDate, endDate, roomType, roomId, limit, offset }, ctx) => {
      const { env } = getAuthContext(ctx);
      if (!env.DB) throw new Error("Database not bound");
      return toText(await exportLineMessages(env.DB, { startDate, endDate, roomType, roomId, limit, offset }));
    }
  );

  server.registerTool(
    "line_messages_delete",
    {
      description: "Delete archived LINE chat messages filtered by time range and optional room",
      inputSchema: z.object({
        startDate: z.string().optional().describe("Start date/time filter (YYYY-MM-DD or ISO string)"),
        endDate: z.string().optional().describe("End date/time filter (YYYY-MM-DD or ISO string)"),
        roomType: z.enum(["user", "group", "room"]).optional().describe("Room type filter (user, group, room)"),
        roomId: z.string().optional().describe("Room ID filter"),
      }),
    },
    async ({ startDate, endDate, roomType, roomId }, ctx) => {
      const { env } = getAuthContext(ctx);
      if (!env.DB) throw new Error("Database not bound");
      const result = await deleteLineMessages(env.DB, { startDate, endDate, roomType, roomId });
      return toText({ ok: true, message: `Deleted ${result.deletedCount} chat message(s).`, deletedCount: result.deletedCount });
    }
  );

  return server;
}

export const mcpHandler = createMcpHandler(createMcpServer, {
  route: "/api/mcp",
  legacy: "stateless",
  onerror(err) {
    console.error("[MCP Error]", err);
  },
});
