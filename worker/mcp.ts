import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPTransport } from "@hono/mcp";
import { z } from "zod";
import type { Env } from "./env";
import {
  getJournals, createJournal, updateJournal, deleteJournal,
  getExpenses, createExpense, updateExpense, deleteExpense,
  getHealthRecords, createHealthRecord, updateHealthRecord, deleteHealthRecord
} from "./repository";
import type { UserProfile } from "../shared/domain";

const instances = new Map<string, { mcp: McpServer; transport: StreamableHTTPTransport }>();

export const getMcpTransportForUser = (env: Env, user: UserProfile): StreamableHTTPTransport => {
  if (instances.has(user.id)) {
    return instances.get(user.id)!.transport;
  }

  const mcp = new McpServer({
    name: "LifeOS MCP",
    version: "1.0.0"
  });

  mcp.tool("get_journals", "Get recent journal entries", {
    limit: z.number().optional().describe("Number of entries to return (default: 20)"),
    offset: z.number().optional().describe("Number of entries to skip (default: 0)")
  }, async ({ limit = 20, offset = 0 }) => {
    if (!env.DB) throw new Error("Database not bound");
    const journals = await getJournals(env.DB, user, limit, offset);
    return { content: [{ type: "text", text: JSON.stringify(journals, null, 2) }] };
  });

  mcp.tool("create_journal", "Create a new journal entry", {
    content: z.string().describe("The journal entry text"),
    tags: z.array(z.string()).optional().describe("Optional list of tags")
  }, async ({ content, tags = [] }) => {
    if (!env.DB) throw new Error("Database not bound");
    await createJournal(env.DB, user, content, tags);
    return { content: [{ type: "text", text: "Journal entry created successfully" }] };
  });

  mcp.tool("update_journal", "Update an existing journal entry", {
    id: z.number().describe("The ID of the journal entry"),
    content: z.string().describe("The journal entry text"),
    tags: z.array(z.string()).optional().describe("Optional list of tags")
  }, async ({ id, content, tags = [] }) => {
    if (!env.DB) throw new Error("Database not bound");
    await updateJournal(env.DB, id, user, content, tags);
    return { content: [{ type: "text", text: "Journal entry updated successfully" }] };
  });

  mcp.tool("delete_journal", "Delete a journal entry", {
    id: z.number().describe("The ID of the journal entry")
  }, async ({ id }) => {
    if (!env.DB) throw new Error("Database not bound");
    await deleteJournal(env.DB, id, user);
    return { content: [{ type: "text", text: "Journal entry deleted successfully" }] };
  });

  mcp.tool("get_expenses", "Get recent financial expenses", {
    limit: z.number().optional().describe("Number of entries to return (default: 20)"),
    offset: z.number().optional().describe("Number of entries to skip (default: 0)")
  }, async ({ limit = 20, offset = 0 }) => {
    if (!env.DB) throw new Error("Database not bound");
    const expenses = await getExpenses(env.DB, user, limit, offset);
    return { content: [{ type: "text", text: JSON.stringify(expenses, null, 2) }] };
  });

  mcp.tool("create_expense", "Create a new financial expense", {
    amount: z.number().describe("The expense amount"),
    category: z.string().describe("Expense category (e.g., Food, Travel)"),
    note: z.string().describe("Description of the expense"),
    date: z.string().describe("ISO 8601 date string of the expense")
  }, async ({ amount, category, note, date }) => {
    if (!env.DB) throw new Error("Database not bound");
    await createExpense(env.DB, user, { amount, category, note, date });
    return { content: [{ type: "text", text: "Expense created successfully" }] };
  });

  mcp.tool("update_expense", "Update a financial expense", {
    id: z.number().describe("The ID of the expense"),
    amount: z.number().describe("The expense amount"),
    category: z.string().describe("Expense category (e.g., Food, Travel)"),
    note: z.string().describe("Description of the expense"),
    date: z.string().describe("ISO 8601 date string of the expense")
  }, async ({ id, amount, category, note, date }) => {
    if (!env.DB) throw new Error("Database not bound");
    await updateExpense(env.DB, id, user, { amount, category, note, date });
    return { content: [{ type: "text", text: "Expense updated successfully" }] };
  });

  mcp.tool("delete_expense", "Delete a financial expense", {
    id: z.number().describe("The ID of the expense")
  }, async ({ id }) => {
    if (!env.DB) throw new Error("Database not bound");
    await deleteExpense(env.DB, id, user);
    return { content: [{ type: "text", text: "Expense deleted successfully" }] };
  });

  mcp.tool("get_health_records", "Get recent health records", {
    limit: z.number().optional().describe("Number of entries to return (default: 30)"),
    offset: z.number().optional().describe("Number of entries to skip (default: 0)")
  }, async ({ limit = 30, offset = 0 }) => {
    if (!env.DB) throw new Error("Database not bound");
    const records = await getHealthRecords(env.DB, user, limit, offset);
    return { content: [{ type: "text", text: JSON.stringify(records, null, 2) }] };
  });

  mcp.tool("create_health_record", "Create a new health record", {
    sys: z.number().describe("Systolic blood pressure"),
    dia: z.number().describe("Diastolic blood pressure"),
    hr: z.number().describe("Heart rate"),
    weight: z.number().optional().describe("Weight (optional)"),
    date: z.string().describe("ISO 8601 date string of the reading")
  }, async ({ sys, dia, hr, weight, date }) => {
    if (!env.DB) throw new Error("Database not bound");
    await createHealthRecord(env.DB, user, { sys, dia, hr, weight, date });
    return { content: [{ type: "text", text: "Health record created successfully" }] };
  });

  mcp.tool("update_health_record", "Update a health record", {
    id: z.number().describe("The ID of the health record"),
    sys: z.number().describe("Systolic blood pressure"),
    dia: z.number().describe("Diastolic blood pressure"),
    hr: z.number().describe("Heart rate"),
    weight: z.number().optional().describe("Weight (optional)"),
    date: z.string().describe("ISO 8601 date string of the reading")
  }, async ({ id, sys, dia, hr, weight, date }) => {
    if (!env.DB) throw new Error("Database not bound");
    await updateHealthRecord(env.DB, id, user, { sys, dia, hr, weight, date });
    return { content: [{ type: "text", text: "Health record updated successfully" }] };
  });

  mcp.tool("delete_health_record", "Delete a health record", {
    id: z.number().describe("The ID of the health record")
  }, async ({ id }) => {
    if (!env.DB) throw new Error("Database not bound");
    await deleteHealthRecord(env.DB, id, user);
    return { content: [{ type: "text", text: "Health record deleted successfully" }] };
  });

  const transport = new StreamableHTTPTransport();
  mcp.connect(transport);

  instances.set(user.id, { mcp, transport });
  return transport;
};
