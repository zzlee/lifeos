import { Hono } from "hono";
import { cors } from "hono/cors";
import type {
  AgentCommandRequest,
  AgentCommandResponse,
  ApiKeyListResponse,
  AuthMutationResponse,
  DashboardSnapshotResponse,
  SessionResponse,
  VaultExportResponse,
  VaultSecretResponse,
} from "../shared/contracts";
import { runLifeAgentLoop } from "./agent";
import {
  clearSessionCookie,
  clearUserCache,
  completeGoogleOAuth,
  createLogoutResponse,
  getGoogleAuthStartUrl,
  resolveSession,
} from "./auth";
import type { Env } from "./env";
import { decryptSecret, encryptSecret } from "./crypto";
import { replyLine, verifyLineSignature } from "./line";
import { handleLineMessage } from "./lineCommands";
import { getDashboardSnapshot, getVaultSecret, getVaultItems, createVaultItem, exportVault, maskSecret, getJournals, createJournal, updateJournal, deleteJournal, getExpenses, createExpense, updateExpense, deleteExpense, getHealthRecords, createHealthRecord, updateHealthRecord, deleteHealthRecord } from "./repository";

const app = new Hono<{ Bindings: Env }>();

app.use("/api/*", async (c, next) => {
  const allowedOriginsStr = c.env?.ALLOWED_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173";
  const allowedOrigins = allowedOriginsStr.split(",").map((o) => o.trim());

  const corsHandler = cors({
    origin: allowedOrigins,
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-LifeOS-User-Id", "X-LifeOS-User-Email", "X-LifeOS-User-Name"],
    exposeHeaders: ["Set-Cookie"],
  });
  return corsHandler(c, next);
});

app.get("/api/ping", (c) =>
  c.json({
    ok: true,
    service: "lifeos-worker",
    now: new Date().toISOString()
  }),
);

app.get("/api/test-external", async (c) => {
  const url = "https://purple-water-b776.zzlee-tw.workers.dev/api/transactions?user-id=1";
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json"
      }
    });
    const status = resp.status;
    const body = await resp.text();
    return c.json({ status, body: body.slice(0, 800) });
  } catch (err: any) {
    return c.json({ error: err.message, stack: err.stack });
  }
});

app.get("/api/session", async (c) => {
  const session = await resolveSession(c.env, c.req.raw.headers);
  return c.json(session satisfies SessionResponse);
});

app.get("/api/auth/keys", async (c) => {
  const session = await resolveSession(c.env, c.req.raw.headers);
  if (!session.authenticated || !session.user) {
    return c.json({ ok: false, error: "Unauthorized" }, 401);
  }

  if (!c.env.DB) return c.json({ error: "Database not bound" }, 500);

  const keys = await c.env.DB.prepare(
    "SELECT id, name, created_at as createdAt FROM api_keys WHERE user_id = ? ORDER BY created_at DESC"
  ).bind(session.user.id).all<{ id: string; name: string; createdAt: string }>();

  return c.json({ keys: keys.results } satisfies ApiKeyListResponse);
});

app.post("/api/auth/keys", async (c) => {
  try {
    const session = await resolveSession(c.env, c.req.raw.headers);
    if (!session.authenticated || !session.user) {
      return c.json({ ok: false, error: "Unauthorized" }, 401);
    }

    const body = (await c.req.json().catch(() => ({}))) as { name: string };
    const name = body.name || "New API Key";
    const key = crypto.randomUUID() + crypto.randomUUID();

    const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
    const keyHash = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

    if (c.env.DB) {
      await c.env.DB.prepare(
        "INSERT INTO api_keys (id, user_id, key_hash, name) VALUES (?, ?, ?, ?)"
      ).bind(crypto.randomUUID(), session.user.id, keyHash, name).run();
    }

    return c.json({ ok: true, key });
  } catch (e: any) {
    console.error("API Key Generation Error:", e);
    return c.json({ ok: false, error: e.message || "Internal Server Error" }, 500);
  }
});

app.put("/api/auth/keys/:id", async (c) => {
  const session = await resolveSession(c.env, c.req.raw.headers);
  if (!session.authenticated || !session.user) {
    return c.json({ ok: false, error: "Unauthorized" }, 401);
  }

  const keyId = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as { name: string };
  const newName = body.name?.trim();

  if (!newName) {
    return c.json({ ok: false, error: "Name is required" }, 400);
  }

  if (c.env.DB) {
    await c.env.DB.prepare(
      "UPDATE api_keys SET name = ? WHERE id = ? AND user_id = ?"
    ).bind(newName, keyId, session.user.id).run();
  }

  return c.json({ ok: true });
});

app.delete("/api/auth/keys/:id", async (c) => {
  const session = await resolveSession(c.env, c.req.raw.headers);
  if (!session.authenticated || !session.user) {
    return c.json({ ok: false, error: "Unauthorized" }, 401);
  }

  const keyId = c.req.param("id");
  if (c.env.DB) {
    await c.env.DB.prepare(
      "DELETE FROM api_keys WHERE id = ? AND user_id = ?"
    ).bind(keyId, session.user.id).run();
  }

  return c.json({ ok: true });
});


app.put("/api/auth/profile", async (c) => {
  if (!c.env.DB) return c.json({ error: "Database not bound" }, 500);
  const session = await resolveSession(c.env, c.req.raw.headers);
  if (!session.authenticated || !session.user) return c.json({ error: "Unauthorized" }, 401);

  const body = await c.req.json() as any;
  if (body && body.timezone) {
    await c.env.DB.prepare("UPDATE users SET timezone = ? WHERE id = ?").bind(body.timezone, session.user.id).run();
    clearUserCache(session.user.id);
  }
  return c.json({ ok: true });
});

app.post("/api/auth/logout", async (c) => {
  c.header("Set-Cookie", clearSessionCookie(), { append: true });
  return c.json(createLogoutResponse() satisfies AuthMutationResponse);
});

app.get("/api/auth/google/start", async (c) => {
  const from = c.req.query("from");
  const redirectUrl = await getGoogleAuthStartUrl(c.env, from || c.req.url);
  if (!redirectUrl) {
    return c.json({ ok: false, error: "Google OAuth is not configured" }, 501);
  }
  return c.redirect(redirectUrl, 302);
});

app.get("/api/auth/google/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const error = c.req.query("error");

  if (error) {
    return c.json({ ok: false, error }, 400);
  }

  if (!code || !state) {
    return c.json({ ok: false, error: "Missing OAuth code or state" }, 400);
  }

  try {
    const result = await completeGoogleOAuth(c.env, code, state);
    c.header("Set-Cookie", result.cookie, { append: true });
    return c.redirect(result.redirectUrl, 302);
  } catch (oauthError) {
    const message = oauthError instanceof Error ? oauthError.message : "OAuth callback failed";
    return c.json({ ok: false, error: message }, 500);
  }
});

app.get("/api/dashboard", async (c) => {
  if (!c.env.DB) return c.json({ error: "Database not bound" }, 500);
  const session = await resolveSession(c.env, c.req.raw.headers);
  if (!session.authenticated || !session.user) return c.json({ error: "Unauthorized" }, 401);
  
  const snapshot = await getDashboardSnapshot(c.env.DB, session.user);
  const response: DashboardSnapshotResponse = {
    ...snapshot,
    generatedAt: new Date().toISOString()
  };
  return c.json(response);
});

app.post("/api/agent", async (c) => {
  try {
    if (!c.env.DB) return c.json({ error: "Database not bound" }, 500);
    
    const body = (await c.req.json()) as AgentCommandRequest & { command?: string; accounting_user_id?: number };
    const session = await resolveSession(c.env, c.req.raw.headers);
    if (!session.authenticated || !session.user) return c.json({ error: "Unauthorized" }, 401);

    const messages = Array.isArray(body.messages) && body.messages.length > 0
      ? body.messages
      : (body.command ? [{ role: "user" as const, content: body.command }] : []);
    const agentResult = await runLifeAgentLoop(c.env, session.user, messages, body.accounting_user_id);

    const response: AgentCommandResponse = {
      accepted: true,
      reply: agentResult.reply,
      data: agentResult.data,
      source: agentResult.source,
      systemInstruction: agentResult.systemInstruction,
      agentDebugError: agentResult.agentDebugError,
      toolCalls: agentResult.toolCalls
    };

    return c.json(response);
  } catch (error) {
    console.error("Agent error:", error);
    const message = error instanceof Error ? error.message : "Agent request failed";
    return c.json({ error: message }, 500);
  }
});

app.get("/api/vault/:id/secret", async (c) => {
  if (!c.env.DB) return c.json({ error: "Database not bound" }, 500);
  if (!c.env.VAULT_MASTER_KEY) return c.json({ error: "Vault key not configured" }, 500);
  
  const vaultId = Number(c.req.param("id"));
  const session = await resolveSession(c.env, c.req.raw.headers);
  if (!session.authenticated || !session.user) return c.json({ error: "Unauthorized" }, 401);

  const result = await getVaultSecret(c.env.DB, session.user, vaultId, c.env.VAULT_MASTER_KEY);
  const response: VaultSecretResponse = {
    id: vaultId,
    secret: result.secret,
    source: result.source
  };
  return c.json(response);
});

app.get("/api/vault", async (c) => {
  if (!c.env.DB) return c.json({ error: "Database not bound" }, 500);

  const session = await resolveSession(c.env, c.req.raw.headers);
  if (!session.authenticated || !session.user) return c.json({ error: "Unauthorized" }, 401);

  const limit = Number(c.req.query("limit") || 20);
  const offset = Number(c.req.query("offset") || 0);
  const query = c.req.query("query");

  const items = await getVaultItems(c.env.DB, session.user, limit, offset, { query });
  return c.json({ items });
});

app.get("/api/vault/export", async (c) => {
  if (!c.env.DB) return c.json({ error: "Database not bound" }, 500);
  if (!c.env.VAULT_MASTER_KEY) return c.json({ error: "Vault key not configured" }, 500);

  const session = await resolveSession(c.env, c.req.raw.headers);
  if (!session.authenticated || !session.user) return c.json({ error: "Unauthorized" }, 401);

  const items = await exportVault(c.env.DB, session.user, c.env.VAULT_MASTER_KEY);
  return c.json({ items } satisfies VaultExportResponse);
});

app.post("/api/vault", async (c) => {
  if (!c.env.DB) return c.json({ error: "Database not bound" }, 500);
  if (!c.env.VAULT_MASTER_KEY) return c.json({ error: "Vault key not configured" }, 500);

  const body = (await c.req.json()) as { site: string; username: string; secret: string };
  const session = await resolveSession(c.env, c.req.raw.headers);
  if (!session.authenticated || !session.user) return c.json({ error: "Unauthorized" }, 401);

  const result = await createVaultItem(c.env.DB, session.user, body, c.env.VAULT_MASTER_KEY);
  return c.json(result);
});

app.put("/api/vault/:id", async (c) => {
  if (!c.env.DB) return c.json({ error: "Database not bound" }, 500);
  if (!c.env.VAULT_MASTER_KEY) return c.json({ error: "Vault key not configured" }, 500);

  const vaultId = Number(c.req.param("id"));
  const body = (await c.req.json()) as { site: string; username: string; secret: string };
  const session = await resolveSession(c.env, c.req.raw.headers);
  if (!session.authenticated || !session.user) return c.json({ error: "Unauthorized" }, 401);

  if (body.secret) {
    const encrypted = await encryptSecret(body.secret, c.env.VAULT_MASTER_KEY);
    await c.env.DB.prepare(
      "UPDATE vault_items SET site = ?, username = ?, secret_ciphertext = ?, secret_iv = ?, secret_preview = ? WHERE id = ? AND user_id = ?"
    ).bind(
      body.site,
      body.username,
      encrypted.ciphertext,
      encrypted.iv,
      maskSecret(body.secret),
      vaultId,
      session.user.id
    ).run();
  } else {
    await c.env.DB.prepare(
      "UPDATE vault_items SET site = ?, username = ? WHERE id = ? AND user_id = ?"
    ).bind(
      body.site,
      body.username,
      vaultId,
      session.user.id
    ).run();
  }

  return c.json({ ok: true });
});

app.delete("/api/vault/:id", async (c) => {
  if (!c.env.DB) return c.json({ error: "Database not bound" }, 500);
  
  const vaultId = Number(c.req.param("id"));
  const session = await resolveSession(c.env, c.req.raw.headers);
  if (!session.authenticated || !session.user) return c.json({ error: "Unauthorized" }, 401);

  await c.env.DB.prepare(
    "DELETE FROM vault_items WHERE id = ? AND user_id = ?"
  ).bind(vaultId, session.user.id).run();

  return c.json({ ok: true });
});

app.get("/api/journals", async (c) => {
  if (!c.env.DB) return c.json({ error: "Database not bound" }, 500);
  
  const session = await resolveSession(c.env, c.req.raw.headers);
  if (!session.authenticated || !session.user) return c.json({ error: "Unauthorized" }, 401);

  const limit = Number(c.req.query("limit") || 20);
  const offset = Number(c.req.query("offset") || 0);
  
  const startDate = c.req.query("startDate");
  const endDate = c.req.query("endDate");
  const query = c.req.query("query");
  const tag = c.req.query("tag");

  const journals = await getJournals(c.env.DB, session.user, limit, offset, { startDate, endDate, query, tag });
  return c.json({ journals });
});

app.post("/api/journals", async (c) => {
  if (!c.env.DB) return c.json({ error: "Database not bound" }, 500);
  
  const session = await resolveSession(c.env, c.req.raw.headers);
  if (!session.authenticated || !session.user) return c.json({ error: "Unauthorized" }, 401);

  const body = (await c.req.json()) as { content: string; tags: string[] };
  await createJournal(c.env.DB, session.user, body.content, body.tags || []);
  return c.json({ ok: true });
});

app.put("/api/journals/:id", async (c) => {
  if (!c.env.DB) return c.json({ error: "Database not bound" }, 500);
  
  const journalId = Number(c.req.param("id"));
  const session = await resolveSession(c.env, c.req.raw.headers);
  if (!session.authenticated || !session.user) return c.json({ error: "Unauthorized" }, 401);

  const body = (await c.req.json()) as { content: string; tags: string[] };
  await updateJournal(c.env.DB, journalId, session.user, body.content, body.tags || []);
  return c.json({ ok: true });
});

app.delete("/api/journals/:id", async (c) => {
  if (!c.env.DB) return c.json({ error: "Database not bound" }, 500);
  
  const journalId = Number(c.req.param("id"));
  const session = await resolveSession(c.env, c.req.raw.headers);
  if (!session.authenticated || !session.user) return c.json({ error: "Unauthorized" }, 401);

  await deleteJournal(c.env.DB, journalId, session.user);
  return c.json({ ok: true });
});

app.get("/api/expenses", async (c) => {
  if (!c.env.DB) return c.json({ error: "Database not bound" }, 500);
  
  const session = await resolveSession(c.env, c.req.raw.headers);
  if (!session.authenticated || !session.user) return c.json({ error: "Unauthorized" }, 401);

  const limit = Number(c.req.query("limit") || 20);
  const offset = Number(c.req.query("offset") || 0);
  
  const startDate = c.req.query("startDate");
  const endDate = c.req.query("endDate");
  const minAmountStr = c.req.query("minAmount");
  const maxAmountStr = c.req.query("maxAmount");
  const category = c.req.query("category");
  const query = c.req.query("query");

  const minAmount = minAmountStr !== undefined ? Number(minAmountStr) : undefined;
  const maxAmount = maxAmountStr !== undefined ? Number(maxAmountStr) : undefined;

  const expenses = await getExpenses(c.env.DB, session.user, limit, offset, { startDate, endDate, minAmount, maxAmount, category, query });
  return c.json({ expenses });
});

app.post("/api/expenses", async (c) => {
  if (!c.env.DB) return c.json({ error: "Database not bound" }, 500);
  
  const session = await resolveSession(c.env, c.req.raw.headers);
  if (!session.authenticated || !session.user) return c.json({ error: "Unauthorized" }, 401);

  const body = (await c.req.json()) as { amount: number; category: string; note: string; date: string };
  await createExpense(c.env.DB, session.user, body);
  return c.json({ ok: true });
});

app.put("/api/expenses/:id", async (c) => {
  if (!c.env.DB) return c.json({ error: "Database not bound" }, 500);
  
  const expenseId = Number(c.req.param("id"));
  const session = await resolveSession(c.env, c.req.raw.headers);
  if (!session.authenticated || !session.user) return c.json({ error: "Unauthorized" }, 401);

  const body = (await c.req.json()) as { amount: number; category: string; note: string; date: string };
  await updateExpense(c.env.DB, expenseId, session.user, body);
  return c.json({ ok: true });
});

app.delete("/api/expenses/:id", async (c) => {
  if (!c.env.DB) return c.json({ error: "Database not bound" }, 500);
  
  const expenseId = Number(c.req.param("id"));
  const session = await resolveSession(c.env, c.req.raw.headers);
  if (!session.authenticated || !session.user) return c.json({ error: "Unauthorized" }, 401);

  await deleteExpense(c.env.DB, expenseId, session.user);
  return c.json({ ok: true });
});

app.get("/api/health", async (c) => {
  if (!c.env.DB) return c.json({ error: "Database not bound" }, 500);
  
  const session = await resolveSession(c.env, c.req.raw.headers);
  if (!session.authenticated || !session.user) return c.json({ error: "Unauthorized" }, 401);

  const limit = Number(c.req.query("limit") || 30);
  const offset = Number(c.req.query("offset") || 0);
  
  const startDate = c.req.query("startDate");
  const endDate = c.req.query("endDate");

  const health = await getHealthRecords(c.env.DB, session.user, limit, offset, { startDate, endDate });
  return c.json({ health });
});

app.post("/api/health", async (c) => {
  if (!c.env.DB) return c.json({ error: "Database not bound" }, 500);
  
  const session = await resolveSession(c.env, c.req.raw.headers);
  if (!session.authenticated || !session.user) return c.json({ error: "Unauthorized" }, 401);

  const body = (await c.req.json()) as { sys: number; dia: number; hr: number; weight?: number; date: string };
  await createHealthRecord(c.env.DB, session.user, body);
  return c.json({ ok: true });
});

app.put("/api/health/:id", async (c) => {
  if (!c.env.DB) return c.json({ error: "Database not bound" }, 500);
  
  const healthId = Number(c.req.param("id"));
  const session = await resolveSession(c.env, c.req.raw.headers);
  if (!session.authenticated || !session.user) return c.json({ error: "Unauthorized" }, 401);

  const body = (await c.req.json()) as { sys: number; dia: number; hr: number; weight?: number; date: string };
  await updateHealthRecord(c.env.DB, healthId, session.user, body);
  return c.json({ ok: true });
});

app.delete("/api/health/:id", async (c) => {
  if (!c.env.DB) return c.json({ error: "Database not bound" }, 500);
  
  const healthId = Number(c.req.param("id"));
  const session = await resolveSession(c.env, c.req.raw.headers);
  if (!session.authenticated || !session.user) return c.json({ error: "Unauthorized" }, 401);

  await deleteHealthRecord(c.env.DB, healthId, session.user);
  return c.json({ ok: true });
});

app.post("/api/line/webhook", async (c) => {
  if (!c.env.LINE_CHANNEL_SECRET || !c.env.LINE_CHANNEL_ACCESS_TOKEN) {
    return c.json({ error: "Line configuration missing" }, 500);
  }

  const signature = c.req.header("x-line-signature");
  const body = await c.req.text();

  const valid = await verifyLineSignature(c.env.LINE_CHANNEL_SECRET, body, signature);
  if (!valid) return c.text("Invalid signature", 401);

  const events = JSON.parse(body).events;
  const replyPromises = events
    .filter((event: any) => event.type === "message" && (event.message.type === "text" || event.message.type === "image"))
    .map(async (event: any) => {
      let messages: { type: string; text: string }[] = [{ type: "text", text: "收到" }];

      if (event.message.type === "text") {
        const commandMessages = await handleLineMessage(c.env, event);
        if (commandMessages) messages = commandMessages;
      }

      try {
        await replyLine(c.env.LINE_CHANNEL_ACCESS_TOKEN!, event.replyToken, messages);
      } catch (replyErr: any) {
        console.error("LINE reply failed:", replyErr);
      }
    });

  await Promise.all(replyPromises);

  return c.text("OK");
});

app.notFound(async (c) => {

  if (c.req.path.startsWith("/api/")) {
    return c.text("LifeOS Worker: Route not found. Are you calling an API endpoint?", 404);
  }
  
  // Serve index.html for SPA routing
  const response = await c.env.ASSETS.fetch(new Request(new URL("/index.html", c.req.url)));
  if (response.ok) return response;
  
  return c.text("LifeOS: Page not found", 404);
});

export default app;
