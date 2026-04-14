const fs = require("fs");
const file = "worker/auth.ts";
let content = fs.readFileSync(file, "utf8");

content = content.replace(
  `  const provider = headerUser ? "google-ready" : sessionFromCookie?.provider ?? "none";
  const user = headerUser ?? sessionFromCookie?.user ?? null;

  return {
    authenticated: !!user,
    provider,
    user,
    googleAuthEnabled: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URI),
  };`,
  `  const provider = headerUser ? "google-ready" : sessionFromCookie?.provider ?? "none";
  let user = headerUser ?? sessionFromCookie?.user ?? null;

  if (user && env.DB) {
    const dbUser = await env.DB.prepare(
      "SELECT id, email, name, timezone FROM users WHERE id = ?"
    ).bind(user.id).first<UserProfile>();
    if (dbUser) {
      user = dbUser;
    }
  }

  return {
    authenticated: !!user,
    provider,
    user,
    googleAuthEnabled: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URI),
  };`
);

fs.writeFileSync(file, content);
