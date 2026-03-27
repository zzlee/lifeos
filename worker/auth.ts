import type { AuthMutationResponse, DemoLoginRequest, SessionResponse } from "../shared/contracts";
import type { UserProfile } from "../shared/domain";
import type { D1Database, Env } from "./env";

const DEMO_USER: UserProfile = {
  id: "demo-user",
  email: "demo@lifeos.app",
  name: "LifeOS Demo",
};

const SESSION_COOKIE = "lifeos_session";
const OAUTH_STATE_TTL_MS = 1000 * 60 * 10;
const encoder = new TextEncoder();

type SessionTokenPayload = {
  user: UserProfile;
  provider: "demo" | "google-ready";
  exp: number;
};

type OAuthStatePayload = {
  origin: string;
  exp: number;
};

type GoogleTokenResponse = {
  access_token: string;
  id_token?: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
};

type GoogleUserInfo = {
  email: string;
  email_verified?: boolean;
  name: string;
  sub: string;
};

export async function resolveSession(
  env: Env,
  headers: Headers,
): Promise<SessionResponse> {
  const cookieToken = readCookie(headers, SESSION_COOKIE);
  const headerUser = readUserFromHeaders(headers);

  const sessionFromCookie = cookieToken
    ? await verifySessionToken(cookieToken, env.SESSION_SECRET ?? "lifeos-dev-session-secret")
    : null;

  const provider = headerUser ? "google-ready" : sessionFromCookie?.provider ?? "demo";
  const user = headerUser ?? sessionFromCookie?.user ?? DEMO_USER;

  if (env.DB) {
    await ensureUser(env.DB, user);
  }

  return {
    authenticated: true,
    provider,
    user,
    googleAuthEnabled: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URI),
  };
}

export async function createDemoLoginResponse(env: Env, request: DemoLoginRequest): Promise<{ cookie: string; body: AuthMutationResponse }> {
  const user: UserProfile = {
    id: slugify(request.email ?? request.name ?? DEMO_USER.id),
    email: request.email ?? DEMO_USER.email,
    name: request.name ?? DEMO_USER.name,
  };

  if (env.DB) {
    await ensureUser(env.DB, user);
  }

  const token = await signSessionToken(
    {
      user,
      provider: "demo",
      exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
    },
    env.SESSION_SECRET ?? "lifeos-dev-session-secret",
  );

  return {
    cookie: serializeSessionCookie(token),
    body: {
      ok: true,
      session: {
        authenticated: true,
        provider: "demo",
        user,
        googleAuthEnabled: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URI),
      },
    },
  };
}

export function createLogoutResponse(env: Env): AuthMutationResponse {
  return {
    ok: true,
    session: {
      authenticated: true,
      provider: "demo",
      user: DEMO_USER,
      googleAuthEnabled: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URI),
    },
  };
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function serializeSessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`;
}

export async function getGoogleAuthStartUrl(env: Env, requestUrl: string): Promise<string | null> {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_REDIRECT_URI) return null;

  const origin = new URL(requestUrl).origin;
  const state = await createOAuthState(origin, env.SESSION_SECRET ?? "lifeos-dev-session-secret");
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function completeGoogleOAuth(
  env: Env,
  code: string,
  state: string,
): Promise<{ cookie: string; redirectUrl: string }> {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI) {
    throw new Error("Google OAuth is not configured");
  }

  const verifiedState = await verifyOAuthState(state, env.SESSION_SECRET ?? "lifeos-dev-session-secret");
  if (!verifiedState) {
    throw new Error("Invalid OAuth state");
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: env.GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error(`Google token exchange failed: ${tokenResponse.status}`);
  }

  const tokens = (await tokenResponse.json()) as GoogleTokenResponse;
  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!profileResponse.ok) {
    throw new Error(`Google userinfo fetch failed: ${profileResponse.status}`);
  }

  const googleUser = (await profileResponse.json()) as GoogleUserInfo;
  const user: UserProfile = {
    id: `google-${googleUser.sub}`,
    email: googleUser.email,
    name: googleUser.name,
  };

  if (env.DB) {
    await ensureUser(env.DB, user);
  }

  const token = await signSessionToken(
    {
      user,
      provider: "google-ready",
      exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
    },
    env.SESSION_SECRET ?? "lifeos-dev-session-secret",
  );

  return {
    cookie: serializeSessionCookie(token),
    redirectUrl: verifiedState.origin,
  };
}

async function signSessionToken(payload: SessionTokenPayload, secret: string): Promise<string> {
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = await signString(body, secret);
  return `${body}.${signature}`;
}

async function verifySessionToken(token: string, secret: string): Promise<SessionTokenPayload | null> {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = await signString(body, secret);
  if (signature !== expected) return null;

  const parsed = JSON.parse(base64UrlDecode(body)) as SessionTokenPayload;
  if (parsed.exp < Date.now()) return null;
  return parsed;
}

async function createOAuthState(origin: string, secret: string): Promise<string> {
  const payload: OAuthStatePayload = {
    origin,
    exp: Date.now() + OAUTH_STATE_TTL_MS,
  };

  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = await signString(body, secret);
  return `${body}.${signature}`;
}

async function verifyOAuthState(state: string, secret: string): Promise<OAuthStatePayload | null> {
  const [body, signature] = state.split(".");
  if (!body || !signature) return null;

  const expected = await signString(body, secret);
  if (signature !== expected) return null;

  const parsed = JSON.parse(base64UrlDecode(body)) as OAuthStatePayload;
  if (parsed.exp < Date.now()) return null;
  return parsed;
}

async function signString(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

async function ensureUser(db: D1Database, user: UserProfile): Promise<void> {
  await db
    .prepare("INSERT OR IGNORE INTO users (id, email, name) VALUES (?, ?, ?)")
    .bind(user.id, user.email, user.name)
    .run();
}

function readUserFromHeaders(headers: Headers): UserProfile | null {
  const id = headers.get("x-lifeos-user-id");
  const email = headers.get("x-lifeos-user-email");
  const name = headers.get("x-lifeos-user-name");
  if (!id || !email || !name) return null;
  return { id, email, name };
}

function readCookie(headers: Headers, name: string): string | null {
  const cookie = headers.get("cookie");
  if (!cookie) return null;

  for (const part of cookie.split(";")) {
    const [key, value] = part.trim().split("=");
    if (key === name && value) return value;
  }
  return null;
}

function base64UrlEncode(value: string): string {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return atob(padded);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "demo-user";
}
