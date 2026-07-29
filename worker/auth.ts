import type { AuthMutationResponse, SessionResponse } from "../shared/contracts";
import type { UserProfile } from "../shared/domain";
import type { D1Database, Env } from "./env";

const SESSION_COOKIE = "lifeos_session";
const OAUTH_STATE_TTL_MS = 1000 * 60 * 10;
const encoder = new TextEncoder();

const sessionUserCache = new Map<string, { user: UserProfile; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes
const CACHE_MAX_SIZE = 1000;

export function clearUserCache(userId: string) {
  sessionUserCache.delete(userId);
}

function pruneCache() {
  if (sessionUserCache.size > CACHE_MAX_SIZE) {
    const now = Date.now();
    for (const [key, value] of sessionUserCache.entries()) {
      if (now - value.timestamp > CACHE_TTL) {
        sessionUserCache.delete(key);
      }
    }
    // If still too large after expiry prune, remove oldest entries
    if (sessionUserCache.size > CACHE_MAX_SIZE) {
      let entriesToRemove = sessionUserCache.size - CACHE_MAX_SIZE;
      for (const key of sessionUserCache.keys()) {
        sessionUserCache.delete(key);
        entriesToRemove--;
        if (entriesToRemove <= 0) break;
      }
    }
  }
}

type SessionTokenPayload = {
  user: UserProfile;
  provider: "google-ready";
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
  if (!env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET environment variable is not configured.");
  }

  const authHeader = headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const hash = await hashKey(token);

    if (env.DB) {
      const user = await env.DB.prepare(
        "SELECT u.id, u.email, u.name, u.timezone FROM api_keys k INNER JOIN users u ON k.user_id = u.id WHERE k.key_hash = ?"
      ).bind(hash).first<UserProfile>();

      if (user) {
        return {
          authenticated: true,
          provider: "api-key",
          user,
          googleAuthEnabled: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URI),
        };
      }
    }
  }

  const cookieToken = readCookie(headers, SESSION_COOKIE);
  const headerUser = readUserFromHeaders(headers);

  const sessionFromCookie = cookieToken
    ? await verifySessionToken(cookieToken, env.SESSION_SECRET)
    : null;

  const provider = headerUser ? "google-ready" : sessionFromCookie?.provider ?? "none";
  let user = headerUser ?? sessionFromCookie?.user ?? null;

  if (user && env.DB) {
    const cached = sessionUserCache.get(user.id);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      user = cached.user;
    } else {
      const dbUser = await env.DB.prepare(
        "SELECT id, email, name, timezone FROM users WHERE id = ?"
      ).bind(user.id).first<UserProfile>();
      if (dbUser) {
        user = dbUser;
        sessionUserCache.set(user.id, { user, timestamp: Date.now() });
        pruneCache();
      }
    }
  }

  return {
    authenticated: !!user,
    provider,
    user,
    googleAuthEnabled: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URI),
  };
}

export function createLogoutResponse(): AuthMutationResponse {
  return {
    ok: true,
    session: {
      authenticated: false,
      provider: "none",
      user: null,
      googleAuthEnabled: false,
    },
  };
}

export function serializeSessionCookie(token: string): string {
  // Use SameSite=Lax and Secure for standard use. 
  // Since frontend and backend are now unified on the same domain, SameSite=Lax is sufficient and’s safer.
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=604800`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`;
}

export async function getGoogleAuthStartUrl(env: Env, requestUrl: string): Promise<string | null> {
  if (!env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET environment variable is not configured.");
  }
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_REDIRECT_URI || !env.GOOGLE_CLIENT_SECRET) {
    console.error("Google OAuth Configuration Error: Missing required environment variables.");
    if (!env.GOOGLE_CLIENT_ID) console.error("Missing: GOOGLE_CLIENT_ID");
    if (!env.GOOGLE_REDIRECT_URI) console.error("Missing: GOOGLE_REDIRECT_URI");
    if (!env.GOOGLE_CLIENT_SECRET) console.error("Missing: GOOGLE_CLIENT_SECRET");
    return null;
  }

  const origin = new URL(requestUrl).origin;
  const state = await createOAuthState(origin, env.SESSION_SECRET);
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
  if (!env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET environment variable is not configured.");
  }
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI) {
    const missing = [];
    if (!env.GOOGLE_CLIENT_ID) missing.push("GOOGLE_CLIENT_ID");
    if (!env.GOOGLE_CLIENT_SECRET) missing.push("GOOGLE_CLIENT_SECRET");
    if (!env.GOOGLE_REDIRECT_URI) missing.push("GOOGLE_REDIRECT_URI");
    throw new Error(`Google OAuth is not configured. Missing: ${missing.join(", ")}`);
  }

  const verifiedState = await verifyOAuthState(state, env.SESSION_SECRET);
  if (!verifiedState) {
    throw new Error("Invalid OAuth state");
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "LifeOS/1.0"
    },
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
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      "User-Agent": "LifeOS/1.0"
    },
  });

  if (!profileResponse.ok) {
    throw new Error(`Google userinfo fetch failed: ${profileResponse.status}`);
  }

  const googleUser = (await profileResponse.json()) as GoogleUserInfo;
  const user: UserProfile = {
    id: `google-${googleUser.sub}`,
    email: googleUser.email,
    name: googleUser.name,
    timezone: "UTC",
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
    env.SESSION_SECRET,
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
    .prepare("INSERT OR IGNORE INTO users (id, email, name, timezone) VALUES (?, ?, ?, ?)")
    .bind(user.id, user.email, user.name, user.timezone || "UTC")
    .run();
}

function readUserFromHeaders(headers: Headers): UserProfile | null {
  const id = headers.get("x-lifeos-user-id");
  const email = headers.get("x-lifeos-user-email");
  const name = headers.get("x-lifeos-user-name");
  if (!id || !email || !name) return null;
  return { id, email, name, timezone: headers.get("x-lifeos-user-timezone") || "UTC" };
}

function readCookie(headers: Headers, name: string): string | null {
  const cookie = headers.get("cookie");
  if (!cookie) return null;

  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${escapedName}=([^;]+)`));
  return match ? match[1] : null;
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
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hashKey(key: string): Promise<string> {
  const msgUint8 = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  return bytesToBase64Url(new Uint8Array(hashBuffer));
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "demo-user";
}
