import { Hono } from "hono";
import { cors } from "hono/cors";
import { deleteCookie } from "hono/cookie";
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
import { resolveAgentMutation } from "./agent";
import {
  clearSessionCookie,
  completeGoogleOAuth,
  createLogoutResponse,
  getGoogleAuthStartUrl,
  resolveSession,
} from "./auth";
import type { Env } from "./env";
import { getDashboardSnapshot, getVaultSecret, persistAgentMutation, createVaultItem, exportVault } from "./repository";

const app = new Hono<{ Bindings: Env }>();

app.use("/api/*", async (c, next) => {
  const origin = c.req.header("Origin");
  const corsHandler = cors({
    origin: origin || "*",
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-LifeOS-User-Id", "X-LifeOS-User-Email", "X-LifeOS-User-Name"],
    exposeHeaders: ["Set-Cookie"],
  });
  return corsHandler(c, next);
});

app.get("/", (c) =>
  c.text("LifeOS API is running. Use /api/health to verify service status."),
);

app.get("/api/health", (c) =>
  c.json({
    ok: true,
    service: "lifeos-worker",
    now: new Date().toISOString()
  }),
);

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

app.post("/api/auth/logout", async (c) => {
  deleteCookie(c, "lifeos_session", { path: "/" });
  c.header("Set-Cookie", clearSessionCookie());
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
    c.header("Set-Cookie", result.cookie);
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
  if (!c.env.DB) return c.json({ error: "Database not bound" }, 500);
  if (!c.env.VAULT_MASTER_KEY) return c.json({ error: "Vault key not configured" }, 500);
  
  const body = (await c.req.json()) as AgentCommandRequest;
  const session = await resolveSession(c.env, c.req.raw.headers);
  if (!session.authenticated || !session.user) return c.json({ error: "Unauthorized" }, 401);

  const snapshot = await getDashboardSnapshot(c.env.DB, session.user);
  const agentResult = await resolveAgentMutation(c.env, body.command, snapshot.data);
  const mutation = agentResult.mutation;
  const persisted = await persistAgentMutation(c.env.DB, session.user, mutation, c.env.VAULT_MASTER_KEY);

  const response: AgentCommandResponse = {
    accepted: true,
    mutation,
    data: persisted.data,
    source: persisted.source
  };

  return c.json(response);
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

app.notFound((c) => {
  return c.text("LifeOS Worker: Route not found. Are you calling an API endpoint?", 404);
});

export default app;
