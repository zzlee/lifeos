import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  getJournals,
  getJournal,
  createJournal,
  updateJournal,
  deleteJournal,
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getHealthRecords,
  createHealthRecord,
  updateHealthRecord,
  deleteHealthRecord,
  getDashboardSnapshot
} from "./repository";
import type { UserProfile } from "../shared/domain";
import type { Env } from "./env";

export function createServer(user: UserProfile, env: Env) {
  const server = new McpServer(
    {
      name: "lifeos-worker-mcp",
      version: "1.0.0",
    }
  );

  // Journal tools
  server.registerTool(
    "journal_ls",
    { description: "List all journals", inputSchema: z.object({
      limit: z.number().optional().describe("Limit number of entries"),
      offset: z.number().optional().describe("Offset for pagination"),
    }) },
    async (args: any) => {
      if (!env.DB) throw new Error("Database not bound");
      const res = await getJournals(env.DB, user, args.limit || 20, args.offset || 0);
      return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
    }
  );

  server.registerTool(
    "journal_get",
    { description: "Get a journal entry by ID", inputSchema: z.object({
      id: z.number().describe("Journal entry ID"),
    }) },
    async (args: any) => {
      if (!env.DB) throw new Error("Database not bound");

      try {
        const entry = await getJournal(env.DB, user, Number(args.id));
        if (!entry) throw new Error(`Journal ${args.id} not found.`);
        return { content: [{ type: "text", text: JSON.stringify(entry, null, 2) }] };
      } catch {
        // fallback
        const dashboard = await getDashboardSnapshot(env.DB, user);
        const journalEntry = dashboard.data.journals.find((j: any) => j.id === Number(args.id));
        if (!journalEntry) throw new Error(`Journal ${args.id} not found.`);
        return { content: [{ type: "text", text: JSON.stringify(journalEntry, null, 2) }] };
      }
    }
  );

  server.registerTool(
    "journal_create",
    { description: "Create a new journal entry", inputSchema: z.object({
      content: z.string().describe("Journal content"),
      tags: z.string().optional().describe("Tags (comma separated)"),
    }) },
    async (args: any) => {
      if (!env.DB) throw new Error("Database not bound");

      const tags = typeof args.tags === "string" ? args.tags.split(",").map((t: string) => t.trim()) : [];
      await createJournal(env.DB, user, args.content, tags);
      return { content: [{ type: "text", text: "Journal entry created successfully!" }] };
    }
  );

  server.registerTool(
    "journal_update",
    { description: "Update a journal entry", inputSchema: z.object({
      id: z.number().describe("Journal entry ID"),
      content: z.string().describe("New journal content"),
      tags: z.string().optional().describe("Tags (comma separated)"),
    }) },
    async (args: any) => {
      if (!env.DB) throw new Error("Database not bound");

      const tags = typeof args.tags === "string" ? args.tags.split(",").map((t: string) => t.trim()) : [];
      await updateJournal(env.DB, Number(args.id), user, args.content, tags);
      return { content: [{ type: "text", text: `Journal entry ${args.id} updated successfully!` }] };
    }
  );

  server.registerTool(
    "journal_delete",
    { description: "Delete a journal entry", inputSchema: z.object({
      id: z.number().describe("Journal entry ID"),
    }) },
    async (args: any) => {
      if (!env.DB) throw new Error("Database not bound");

      await deleteJournal(env.DB, Number(args.id), user);
      return { content: [{ type: "text", text: `Journal entry ${args.id} deleted successfully!` }] };
    }
  );

  // Finance tools
  server.registerTool(
    "finance_ls",
    { description: "List all expenses", inputSchema: z.object({
      limit: z.number().optional().describe("Limit number of entries"),
      offset: z.number().optional().describe("Offset for pagination"),
    }) },
    async (args: any) => {
      if (!env.DB) throw new Error("Database not bound");

      const res = await getExpenses(env.DB, user, args.limit || 20, args.offset || 0);
      return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
    }
  );

  server.registerTool(
    "finance_get",
    { description: "Get an expense by ID", inputSchema: z.object({
      id: z.number().describe("Expense ID"),
    }) },
    async (args: any) => {
      if (!env.DB) throw new Error("Database not bound");

      const dashboard = await getDashboardSnapshot(env.DB, user);
      const financeEntry = dashboard.data.finance.find((e: any) => e.id === Number(args.id));
      if (!financeEntry) throw new Error(`Expense ${args.id} not found.`);
      return { content: [{ type: "text", text: JSON.stringify(financeEntry, null, 2) }] };
    }
  );

  server.registerTool(
    "finance_create",
    { description: "Create a new expense", inputSchema: z.object({
      amount: z.number().describe("Amount"),
      category: z.string().describe("Category"),
      note: z.string().optional().describe("Note"),
      date: z.string().optional().describe("Date (YYYY-MM-DD)"),
    }) },
    async (args: any) => {
      if (!env.DB) throw new Error("Database not bound");

      const date = typeof args.date === "string" && args.date ? args.date : new Date().toLocaleDateString('sv-SE');
      await createExpense(env.DB, user, {
        amount: Number(args.amount),
        category: args.category,
        note: args.note || "",
        date,
      });
      return { content: [{ type: "text", text: "Expense created successfully!" }] };
    }
  );

  server.registerTool(
    "finance_update",
    { description: "Update an expense", inputSchema: z.object({
      id: z.number().describe("Expense ID"),
      amount: z.number().describe("New amount"),
      category: z.string().describe("New category"),
      note: z.string().optional().describe("Note"),
      date: z.string().optional().describe("Date (YYYY-MM-DD)"),
    }) },
    async (args: any) => {
      if (!env.DB) throw new Error("Database not bound");

      const date = typeof args.date === "string" && args.date ? args.date : new Date().toLocaleDateString('sv-SE');
      await updateExpense(env.DB, Number(args.id), user, {
        amount: Number(args.amount),
        category: args.category,
        note: args.note || "",
        date,
      });
      return { content: [{ type: "text", text: `Expense ${args.id} updated successfully!` }] };
    }
  );

  server.registerTool(
    "finance_delete",
    { description: "Delete an expense", inputSchema: z.object({
      id: z.number().describe("Expense ID"),
    }) },
    async (args: any) => {
      if (!env.DB) throw new Error("Database not bound");

      await deleteExpense(env.DB, Number(args.id), user);
      return { content: [{ type: "text", text: `Expense ${args.id} deleted successfully!` }] };
    }
  );

  // Health tools
  server.registerTool(
    "health_ls",
    { description: "List all health records", inputSchema: z.object({
      limit: z.number().optional().describe("Limit number of entries"),
      offset: z.number().optional().describe("Offset for pagination"),
    }) },
    async (args: any) => {
      if (!env.DB) throw new Error("Database not bound");

      const res = await getHealthRecords(env.DB, user, args.limit || 30, args.offset || 0);
      return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
    }
  );

  server.registerTool(
    "health_create",
    { description: "Create a new health record", inputSchema: z.object({
      sys: z.number().describe("Systolic pressure"),
      dia: z.number().describe("Diastolic pressure"),
      hr: z.number().describe("Heart rate"),
      weight: z.number().optional().describe("Weight (kg)"),
      date: z.string().optional().describe("Date (YYYY-MM-DD)"),
    }) },
    async (args: any) => {
      if (!env.DB) throw new Error("Database not bound");

      const date = typeof args.date === "string" && args.date ? args.date : new Date().toLocaleDateString('sv-SE');
      await createHealthRecord(env.DB, user, {
        sys: Number(args.sys),
        dia: Number(args.dia),
        hr: Number(args.hr),
        weight: args.weight ? Number(args.weight) : undefined,
        date,
      });
      return { content: [{ type: "text", text: "Health record created successfully!" }] };
    }
  );

  server.registerTool(
    "health_update",
    { description: "Update a health record", inputSchema: z.object({
      id: z.string().describe("Health record ID (date)"),
      sys: z.number().describe("Systolic pressure"),
      dia: z.number().describe("Diastolic pressure"),
      hr: z.number().describe("Heart rate"),
      weight: z.number().optional().describe("Weight (kg)"),
      date: z.string().optional().describe("Date (YYYY-MM-DD)"),
    }) },
    async (args: any) => {
      if (!env.DB) throw new Error("Database not bound");

      const date = typeof args.date === "string" && args.date ? args.date : new Date().toLocaleDateString('sv-SE');
      await updateHealthRecord(env.DB, Number(args.id), user, {
        sys: Number(args.sys),
        dia: Number(args.dia),
        hr: Number(args.hr),
        weight: args.weight ? Number(args.weight) : undefined,
        date,
      });
      return { content: [{ type: "text", text: `Health record ${args.id} updated successfully!` }] };
    }
  );

  server.registerTool(
    "health_delete",
    { description: "Delete a health record", inputSchema: z.object({
      id: z.string().describe("Health record ID (date)"),
    }) },
    async (args: any) => {
      if (!env.DB) throw new Error("Database not bound");

      await deleteHealthRecord(env.DB, Number(args.id), user);
      return { content: [{ type: "text", text: `Health record ${args.id} deleted successfully!` }] };
    }
  );

  return server;
}
