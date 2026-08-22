import { Server } from "@modelcontextprotocol/sdk/server";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { api } from "./api";

export async function startMcpServer() {
  const server = new Server(
    {
      name: "lifeos-cli-mcp",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        // Journal tools
        {
          name: "journal_ls",
          description: "List all journals",
          inputSchema: {
            type: "object",
            properties: {
              limit: { type: "number", description: "Limit number of entries" },
              offset: { type: "number", description: "Offset for pagination" },
            },
          },
        },
        {
          name: "journal_get",
          description: "Get a journal entry by ID",
          inputSchema: {
            type: "object",
            properties: {
              id: { type: "number", description: "Journal entry ID" },
            },
            required: ["id"],
          },
        },
        {
          name: "finance_export",
          description: "Export expense records filtered by date range and optional category",
          inputSchema: {
            type: "object",
            properties: {
              startDate: { type: "string", description: "Start date filter (YYYY-MM-DD)" },
              endDate: { type: "string", description: "End date filter (YYYY-MM-DD)" },
              category: { type: "string", description: "Category filter" },
              limit: { type: "number", description: "Limit number of entries" },
              offset: { type: "number", description: "Offset for pagination" },
            },
          },
        },
        {
          name: "finance_delete_range",
          description: "Delete expense records filtered by date range and optional category",
          inputSchema: {
            type: "object",
            properties: {
              startDate: { type: "string", description: "Start date filter (YYYY-MM-DD)" },
              endDate: { type: "string", description: "End date filter (YYYY-MM-DD)" },
              category: { type: "string", description: "Category filter" },
            },
          },
        },
        {
          name: "journal_create",
          description: "Create a new journal entry",
          inputSchema: {
            type: "object",
            properties: {
              content: { type: "string", description: "Journal content" },
              tags: { type: "string", description: "Tags (comma separated)" },
            },
            required: ["content"],
          },
        },
        {
          name: "journal_update",
          description: "Update a journal entry",
          inputSchema: {
            type: "object",
            properties: {
              id: { type: "number", description: "Journal entry ID" },
              content: { type: "string", description: "New journal content" },
              tags: { type: "string", description: "Tags (comma separated)" },
            },
            required: ["id", "content"],
          },
        },
        {
          name: "journal_delete",
          description: "Delete a journal entry",
          inputSchema: {
            type: "object",
            properties: {
              id: { type: "number", description: "Journal entry ID" },
            },
            required: ["id"],
          },
        },

        // Finance tools
        {
          name: "finance_ls",
          description: "List all expenses",
          inputSchema: {
            type: "object",
            properties: {
              limit: { type: "number", description: "Limit number of entries" },
              offset: { type: "number", description: "Offset for pagination" },
            },
          },
        },
        {
          name: "finance_get",
          description: "Get an expense by ID",
          inputSchema: {
            type: "object",
            properties: {
              id: { type: "number", description: "Expense ID" },
            },
            required: ["id"],
          },
        },
        {
          name: "finance_create",
          description: "Create a new expense",
          inputSchema: {
            type: "object",
            properties: {
              amount: { type: "number", description: "Amount" },
              category: { type: "string", description: "Category" },
              note: { type: "string", description: "Note" },
              date: { type: "string", description: "Date (YYYY-MM-DD)" },
            },
            required: ["amount", "category"],
          },
        },
        {
          name: "finance_update",
          description: "Update an expense",
          inputSchema: {
            type: "object",
            properties: {
              id: { type: "number", description: "Expense ID" },
              amount: { type: "number", description: "New amount" },
              category: { type: "string", description: "New category" },
              note: { type: "string", description: "Note" },
              date: { type: "string", description: "Date (YYYY-MM-DD)" },
            },
            required: ["id", "amount", "category"],
          },
        },
        {
          name: "finance_delete",
          description: "Delete an expense",
          inputSchema: {
            type: "object",
            properties: {
              id: { type: "number", description: "Expense ID" },
            },
            required: ["id"],
          },
        },

        // Health tools
        {
          name: "health_ls",
          description: "List all health records",
          inputSchema: {
            type: "object",
            properties: {
              limit: { type: "number", description: "Limit number of entries" },
              offset: { type: "number", description: "Offset for pagination" },
            },
          },
        },
        {
          name: "health_create",
          description: "Create a new health record",
          inputSchema: {
            type: "object",
            properties: {
              sys: { type: "number", description: "Systolic pressure" },
              dia: { type: "number", description: "Diastolic pressure" },
              hr: { type: "number", description: "Heart rate" },
              weight: { type: "number", description: "Weight (kg)" },
              date: { type: "string", description: "Date (YYYY-MM-DD)" },
            },
            required: ["sys", "dia", "hr"],
          },
        },
        {
          name: "health_update",
          description: "Update a health record",
          inputSchema: {
            type: "object",
            properties: {
              id: { type: "string", description: "Health record ID (date)" },
              sys: { type: "number", description: "Systolic pressure" },
              dia: { type: "number", description: "Diastolic pressure" },
              hr: { type: "number", description: "Heart rate" },
              weight: { type: "number", description: "Weight (kg)" },
              date: { type: "string", description: "Date (YYYY-MM-DD)" },
            },
            required: ["id", "sys", "dia", "hr"],
          },
        },
        {
          name: "health_delete",
          description: "Delete a health record",
          inputSchema: {
            type: "object",
            properties: {
              id: { type: "string", description: "Health record ID (date)" },
            },
            required: ["id"],
          },
        },
        {
          name: "line_rooms_ls",
          description: "List all LINE chat rooms with summary of last messages",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
        {
          name: "line_messages_ls",
          description: "Get archived messages for a specific LINE chat room",
          inputSchema: {
            type: "object",
            properties: {
              roomType: { type: "string", description: "Room type (user, group, room)" },
              roomId: { type: "string", description: "Room ID" },
              limit: { type: "number", description: "Limit number of entries" },
              offset: { type: "number", description: "Offset for pagination" },
            },
            required: ["roomType", "roomId"],
          },
        },
        {
          name: "line_messages_export",
          description: "Export archived LINE chat messages filtered by time range and optional room",
          inputSchema: {
            type: "object",
            properties: {
              startDate: { type: "string", description: "Start date/time filter (YYYY-MM-DD or ISO string)" },
              endDate: { type: "string", description: "End date/time filter (YYYY-MM-DD or ISO string)" },
              roomType: { type: "string", description: "Room type (user, group, room)" },
              roomId: { type: "string", description: "Room ID" },
              limit: { type: "number", description: "Limit number of entries" },
              offset: { type: "number", description: "Offset for pagination" },
            },
          },
        },
        {
          name: "line_messages_delete",
          description: "Delete archived LINE chat messages filtered by time range and optional room",
          inputSchema: {
            type: "object",
            properties: {
              startDate: { type: "string", description: "Start date/time filter (YYYY-MM-DD or ISO string)" },
              endDate: { type: "string", description: "End date/time filter (YYYY-MM-DD or ISO string)" },
              roomType: { type: "string", description: "Room type (user, group, room)" },
              roomId: { type: "string", description: "Room ID" },
            },
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const args = request.params.arguments || {};
      let res;

      switch (request.params.name) {
        // Journal
        case "journal_ls":
          res = await api.get(`/api/journals?limit=${args.limit || 20}&offset=${args.offset || 0}`);
          return { content: [{ type: "text", text: JSON.stringify(res.data.journals, null, 2) }] };
        case "journal_get":
          res = await api.get("/api/dashboard");
          const journalEntry = res.data.data.journals.find((j: any) => j.id === Number(args.id));
          if (!journalEntry) throw new Error(`Journal ${args.id} not found.`);
          return { content: [{ type: "text", text: JSON.stringify(journalEntry, null, 2) }] };
        case "journal_create": {
          const tags = typeof args.tags === "string" ? args.tags.split(",").map((t) => t.trim()) : [];
          await api.post("/api/journals", { content: args.content, tags });
          return { content: [{ type: "text", text: "Journal entry created successfully!" }] };
        }
        case "journal_update": {
          const tags = typeof args.tags === "string" ? args.tags.split(",").map((t) => t.trim()) : [];
          await api.put(`/api/journals/${args.id}`, { content: args.content, tags });
          return { content: [{ type: "text", text: `Journal entry ${args.id} updated successfully!` }] };
        }
        case "journal_delete":
          await api.delete(`/api/journals/${args.id}`);
          return { content: [{ type: "text", text: `Journal entry ${args.id} deleted successfully!` }] };

        // Finance
        case "finance_ls":
          res = await api.get(`/api/expenses?limit=${args.limit || 20}&offset=${args.offset || 0}`);
          return { content: [{ type: "text", text: JSON.stringify(res.data.expenses, null, 2) }] };
        case "finance_get":
          res = await api.get("/api/dashboard");
          const financeEntry = res.data.data.finance.find((e: any) => e.id === Number(args.id));
          if (!financeEntry) throw new Error(`Expense ${args.id} not found.`);
          return { content: [{ type: "text", text: JSON.stringify(financeEntry, null, 2) }] };
        case "finance_create": {
          const date = typeof args.date === "string" && args.date ? args.date : new Date().toLocaleDateString('sv-SE');
          await api.post("/api/expenses", {
            amount: Number(args.amount),
            category: args.category,
            note: args.note || "",
            date,
          });
          return { content: [{ type: "text", text: "Expense created successfully!" }] };
        }
        case "finance_update": {
          const date = typeof args.date === "string" && args.date ? args.date : new Date().toLocaleDateString('sv-SE');
          await api.put(`/api/expenses/${args.id}`, {
            amount: Number(args.amount),
            category: args.category,
            note: args.note || "",
            date,
          });
          return { content: [{ type: "text", text: `Expense ${args.id} updated successfully!` }] };
        }
        case "finance_delete":
          await api.delete(`/api/expenses/${args.id}`);
          return { content: [{ type: "text", text: `Expense ${args.id} deleted successfully!` }] };
        case "finance_export":
          res = await api.get('/api/expenses/export', {
            params: {
              startDate: args.startDate,
              endDate: args.endDate,
              category: args.category,
              limit: args.limit,
              offset: args.offset,
            },
          });
          return { content: [{ type: "text", text: JSON.stringify(res.data.expenses, null, 2) }] };
        case "finance_delete_range":
          res = await api.delete('/api/expenses/range', {
            params: {
              startDate: args.startDate,
              endDate: args.endDate,
              category: args.category,
            },
          });
          return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };

        // Health
        case "health_ls":
          res = await api.get(`/api/health?limit=${args.limit || 30}&offset=${args.offset || 0}`);
          return { content: [{ type: "text", text: JSON.stringify(res.data.health, null, 2) }] };
        case "health_create": {
          const date = typeof args.date === "string" && args.date ? args.date : new Date().toLocaleDateString('sv-SE');
          await api.post("/api/health", {
            sys: Number(args.sys),
            dia: Number(args.dia),
            hr: Number(args.hr),
            weight: args.weight ? Number(args.weight) : undefined,
            date,
          });
          return { content: [{ type: "text", text: "Health record created successfully!" }] };
        }
        case "health_update": {
          const date = typeof args.date === "string" && args.date ? args.date : new Date().toLocaleDateString('sv-SE');
          await api.put(`/api/health/${args.id}`, {
            sys: Number(args.sys),
            dia: Number(args.dia),
            hr: Number(args.hr),
            weight: args.weight ? Number(args.weight) : undefined,
            date,
          });
          return { content: [{ type: "text", text: `Health record ${args.id} updated successfully!` }] };
        }
        case "health_delete":
          await api.delete(`/api/health/${args.id}`);
          return { content: [{ type: "text", text: `Health record ${args.id} deleted successfully!` }] };

        // LINE chat tools
        case "line_rooms_ls": {
          res = await api.get('/api/line/rooms');
          return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
        }
        case "line_messages_ls": {
          if (!args.roomType || !args.roomId) throw new Error('roomType and roomId are required');
          res = await api.get(`/api/line/rooms/${args.roomType}/${args.roomId}/messages`, {
            params: { limit: args.limit || 50, offset: args.offset || 0 },
          });
          return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
        }
        case "line_messages_export": {
          res = await api.get('/api/line/messages/export', {
            params: {
              startDate: args.startDate,
              endDate: args.endDate,
              roomType: args.roomType,
              roomId: args.roomId,
              limit: args.limit,
              offset: args.offset,
            },
          });
          return { content: [{ type: "text", text: JSON.stringify(res.data.messages, null, 2) }] };
        }
        case "line_messages_delete": {
          res = await api.delete('/api/line/messages', {
            params: {
              startDate: args.startDate,
              endDate: args.endDate,
              roomType: args.roomType,
              roomId: args.roomId,
            },
          });
          return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
        }

        default:
          throw new Error(`Unknown tool: ${request.params.name}`);
      }
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `Error: ${error.response?.data?.error || error.message}` }],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
