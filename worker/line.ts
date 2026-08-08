// LINE Messaging API helpers
// Reference: https://developers.line.biz/en/reference/messaging-api/

const LINE_API_BASE = "https://api.line.me";

export type LineSource =
  | { type: "user"; userId?: string }
  | { type: "group"; userId?: string; groupId?: string }
  | { type: "room"; userId?: string; roomId?: string };

export type LineMessageEvent = {
  replyToken: string;
  source: LineSource;
  message: { type: string; text?: string };
  timestamp?: number;
};

/** Verify the x-line-signature header against the channel secret (HMAC-SHA256). */
export async function verifyLineSignature(
  secret: string,
  body: string,
  signature: string | null | undefined
): Promise<boolean> {
  if (!signature) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const calculated = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return signature === calculated;
}

async function lineApiGet(token: string, path: string): Promise<any> {
  const resp = await fetch(`${LINE_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`LINE API GET ${path} failed: ${resp.status} ${errBody.slice(0, 200)}`);
  }
  return resp.json();
}

/** Reply to a webhook event. Max 5 messages per reply. */
export async function replyLine(
  token: string,
  replyToken: string,
  messages: { type: string; text: string }[]
): Promise<void> {
  const resp = await fetch(`${LINE_API_BASE}/v2/bot/message/reply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ replyToken, messages }),
  });
  if (!resp.ok) {
    throw new Error(`LINE reply failed: ${resp.status} ${(await resp.text()).slice(0, 200)}`);
  }
}

// ---- profile / chat info endpoints ----

/** Get a user's profile (bot must be friends with the user). */
export function getUserProfile(token: string, userId: string): Promise<{
  displayName: string;
  userId: string;
  pictureUrl?: string;
  statusMessage?: string;
}> {
  return lineApiGet(token, `/v2/bot/profile/${userId}`);
}

/** Get group chat summary: { groupId, groupName, pictureUrl }. */
export function getGroupSummary(token: string, groupId: string): Promise<{
  groupId: string;
  groupName: string;
  pictureUrl?: string;
}> {
  return lineApiGet(token, `/v2/bot/group/${groupId}/summary`);
}

/** Get the number of members in a group chat. */
export function getGroupMemberCount(token: string, groupId: string): Promise<{ count: number }> {
  return lineApiGet(token, `/v2/bot/group/${groupId}/members/count`);
}

/** Get a member's profile within a group chat. */
export function getGroupMemberProfile(token: string, groupId: string, userId: string): Promise<{
  displayName: string;
  userId: string;
  pictureUrl?: string;
}> {
  return lineApiGet(token, `/v2/bot/group/${groupId}/member/${userId}`);
}

/** Get member userIds in a group chat (up to 100 per page). */
export function getGroupMemberIds(token: string, groupId: string, start?: string): Promise<{
  userIds: string[];
  next?: string;
}> {
  const q = start ? `?start=${start}` : "";
  return lineApiGet(token, `/v2/bot/group/${groupId}/members/ids${q}`);
}

/** Get the number of members in a multi-person chat (room). */
export function getRoomMemberCount(token: string, roomId: string): Promise<{ count: number }> {
  return lineApiGet(token, `/v2/bot/room/${roomId}/members/count`);
}

/** Get a member's profile within a room. */
export function getRoomMemberProfile(token: string, roomId: string, userId: string): Promise<{
  displayName: string;
  userId: string;
  pictureUrl?: string;
}> {
  return lineApiGet(token, `/v2/bot/room/${roomId}/member/${userId}`);
}

/** Get the bot's own info: { userId, basicId, displayName, pictureUrl, chatMode, markAsReadMode }. */
export function getBotInfo(token: string): Promise<{
  userId: string;
  basicId: string;
  displayName: string;
  pictureUrl?: string;
  chatMode: string;
  markAsReadMode: string;
}> {
  return lineApiGet(token, "/v2/bot/info");
}
