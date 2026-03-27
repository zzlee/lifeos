import { Hono } from "hono";
import { cors } from "hono/cors";
import { deleteCookie, setCookie } from "hono/cookie";
import type {
  AgentCommandRequest,
  AgentCommandResponse,
  AuthMutationResponse,
  DashboardSnapshotResponse,
  DemoLoginRequest,
  SessionResponse,
  VaultSecretResponse,
} from "../shared/contracts";
import { resolveAgentMutation } from "./agent";
import {
  clearSessionCookie,
  completeGoogleOAuth,
  createDemoLoginResponse,
  createLogoutResponse,
  getGoogleAuthStartUrl,
  resolveSession,
} from "./auth";
import type { Env } from "./env";
import { getDashboardSnapshot, getVaultSecret, persistAgentMutation } from "./repository";

const app = new Hono<{ Bindings: Env }>();

app.use("/api/*", cors());

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

app.post("/api/auth/demo-login", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as DemoLoginRequest;
  const result = await createDemoLoginResponse(c.env, body);
  setCookie(c, "lifeos_session", result.cookie.split("=")[1].split(";")[0], {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return c.json(result.body satisfies AuthMutationResponse);
});

app.post("/api/auth/logout", async (c) => {
  deleteCookie(c, "lifeos_session", { path: "/" });
  c.header("Set-Cookie", clearSessionCookie());
  return c.json(createLogoutResponse(c.env) satisfies AuthMutationResponse);
});

app.get("/api/auth/google/start", async (c) => {
  const redirectUrl = await getGoogleAuthStartUrl(c.env, c.req.url);
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
  const session = await resolveSession(c.env, c.req.raw.headers);
  const snapshot = await getDashboardSnapshot(c.env.DB, session.user!);
  const response: DashboardSnapshotResponse = {
    ...snapshot,
    generatedAt: new Date().toISOString()
  };
  return c.json(response);
});

app.post("/api/agent", async (c) => {
  const body = (await c.req.json()) as AgentCommandRequest;
  const session = await resolveSession(c.env, c.req.raw.headers);
  const snapshot = await getDashboardSnapshot(c.env.DB, session.user!);
  const agentResult = await resolveAgentMutation(c.env, body.command, snapshot.data);
  const mutation = agentResult.mutation;
  const persisted = await persistAgentMutation(c.env.DB, session.user!, mutation, c.env.VAULT_MASTER_KEY);

  const response: AgentCommandResponse = {
    accepted: true,
    mutation,
    data: persisted.data,
    source: persisted.source
  };

  return c.json(response);
});

app.get("/api/vault/:id/secret", async (c) => {
  const vaultId = Number(c.req.param("id"));
  const session = await resolveSession(c.env, c.req.raw.headers);
  const result = await getVaultSecret(c.env.DB, session.user!, vaultId, c.env.VAULT_MASTER_KEY);
  const response: VaultSecretResponse = {
    id: vaultId,
    secret: result.secret,
    source: result.source
  };
  return c.json(response);
});

export default app;
