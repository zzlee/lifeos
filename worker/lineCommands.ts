// LINE slash command handling for the LifeOS LINE bot.
import type { Env } from "./env";
import {
  getBotInfo,
  getGroupMemberCount,
  getGroupMemberIds,
  getGroupMemberProfile,
  getGroupSummary,
  getRoomMemberCount,
  getRoomMemberProfile,
  getUserProfile,
  replyLine,
  type LineMessageEvent,
  type LineSource,
} from "./line";

const HELP_TEXT = `LifeOS LINE Bot 指令
/help — 顯示本清單
/me — 顯示發話者的 LINE 資料
/group — 顯示當前群組資訊(名稱、ID、成員數)
/room — 顯示當前聊天室資訊
/where — 顯示當前對話類型與 ID
/bot — 顯示 bot 自身資訊
/members — 列出群組成員`;

const UNKNOWN_COMMAND = `未知指令。輸入 /help 查看可用指令。`;

export type ParsedCommand = { name: string; args: string[] };

/** Parse a "/command arg1 arg2" style message. Returns null for non-command text. */
export function parseLineCommand(text: string): ParsedCommand | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) return null;
  const parts = trimmed.split(/\s+/);
  return { name: parts[0].toLowerCase(), args: parts.slice(1) };
}

/** Human-readable description of where the event happened. */
export function formatWhere(source: LineSource): string {
  const lines = [`類型: ${source.type}`];
  if (source.userId) lines.push(`使用者 ID: ${source.userId}`);
  if (source.type === "group" && source.groupId) lines.push(`群組 ID: ${source.groupId}`);
  if (source.type === "room" && source.roomId) lines.push(`聊天室 ID: ${source.roomId}`);
  return lines.join("\n");
}

function formatProfile(profile: { displayName: string; userId: string; pictureUrl?: string; statusMessage?: string }): string {
  const lines = [`名稱: ${profile.displayName}`, `ID: ${profile.userId}`];
  if (profile.statusMessage) lines.push(`狀態: ${profile.statusMessage}`);
  if (profile.pictureUrl) lines.push(`大頭照: ${profile.pictureUrl}`);
  return lines.join("\n");
}

function formatGroupSummaryText(
  summary: { groupId: string; groupName: string; pictureUrl?: string },
  count: number | null,
  senderName?: string
): string {
  const lines = [`群組名稱: ${summary.groupName}`, `群組 ID: ${summary.groupId}`];
  if (count !== null) lines.push(`成員數: ${count}`);
  if (senderName) lines.push(`發話者(群內): ${senderName}`);
  if (summary.pictureUrl) lines.push(`群組圖: ${summary.pictureUrl}`);
  return lines.join("\n");
}

/**
 * Handle one incoming message event.
 * Returns the messages to reply with, or null when the message is not a slash command
 * (caller decides the default behavior, e.g. "收到").
 */
export async function handleLineMessage(
  env: Env,
  event: LineMessageEvent
): Promise<{ type: string; text: string }[] | null> {
  const token = env.LINE_CHANNEL_ACCESS_TOKEN;
  const text = event.message.text;
  if (!token || !text) return null;

  const cmd = parseLineCommand(text);
  if (!cmd) return null;

  const { name, args } = cmd;
  const source = event.source;

  try {
    switch (name) {
      case "/help": {
        return [{ type: "text", text: HELP_TEXT }];
      }

      case "/me": {
        if (!source.userId) return [{ type: "text", text: "無法取得發話者 ID" }];
        const profile = await getUserProfile(token, source.userId);
        return [{ type: "text", text: `👤 我的 LINE 資料\n${formatProfile(profile)}` }];
      }

      case "/group": {
        if (source.type !== "group" || !source.groupId) {
          return [{ type: "text", text: "目前不在群組對話中。若要查看個人資料請用 /me。" }];
        }
        const [summary, countRes, memberProfile] = await Promise.all([
          getGroupSummary(token, source.groupId),
          getGroupMemberCount(token, source.groupId),
          source.userId ? getGroupMemberProfile(token, source.groupId, source.userId) : null,
        ]);
        return [
          {
            type: "text",
            text: `👥 群組資訊\n${formatGroupSummaryText(summary, countRes.count, memberProfile?.displayName)}`,
          },
        ];
      }

      case "/room": {
        if (source.type !== "room" || !source.roomId) {
          return [{ type: "text", text: "目前不在聊天室對話中。若要查看群組資訊請用 /group。" }];
        }
        const [countRes, memberProfile] = await Promise.all([
          getRoomMemberCount(token, source.roomId),
          source.userId ? getRoomMemberProfile(token, source.roomId, source.userId) : null,
        ]);
        const lines = [
          `💬 聊天室資訊`,
          `聊天室 ID: ${source.roomId}`,
          `成員數: ${countRes.count}`,
        ];
        if (memberProfile?.displayName) lines.push(`發話者: ${memberProfile.displayName}`);
        return [{ type: "text", text: lines.join("\n") }];
      }

      case "/where": {
        return [{ type: "text", text: `📍 目前位置\n${formatWhere(source)}` }];
      }

      case "/bot": {
        const info = await getBotInfo(token);
        const lines = [
          `🤖 Bot 資訊`,
          `名稱: ${info.displayName}`,
          `Bot ID: ${info.userId}`,
          `Basic ID: ${info.basicId}`,
          `聊天模式: ${info.chatMode}`,
        ];
        if (info.pictureUrl) lines.push(`大頭照: ${info.pictureUrl}`);
        return [{ type: "text", text: lines.join("\n") }];
      }

      case "/members": {
        if (source.type !== "group" || !source.groupId) {
          return [{ type: "text", text: "目前不在群組對話中,無法列出成員。" }];
        }
        return [{ type: "text", text: await buildMemberListText(token, source.groupId, args) }];
      }

      default: {
        return [{ type: "text", text: UNKNOWN_COMMAND }];
      }
    }
  } catch (err: any) {
    console.error("LINE command error:", err);
    return [
      {
        type: "text",
        text: `⚠️ 指令執行失敗:${err instanceof Error ? err.message.slice(0, 300) : String(err)}`,
      },
    ];
  }
}

/** Build a member list for a group chat. Fetch profiles concurrently, capped for reply size. */
export async function buildMemberListText(token: string, groupId: string, args: string[]): Promise<string> {
  const [countRes, idsRes] = await Promise.all([
    getGroupMemberCount(token, groupId),
    getGroupMemberIds(token, groupId),
  ]);
  const total = countRes.count;
  const ids = idsRes.userIds;
  const limit = 20;
  const shown = ids.slice(0, limit);
  const profiles = await Promise.all(
    shown.map(async (id) => {
      try {
        const p = await getGroupMemberProfile(token, groupId, id);
        return { id, name: p.displayName };
      } catch {
        return { id, name: "(無法取得名稱)" };
      }
    })
  );
  const lines = [`👥 群組成員 (${total})`];
  profiles.forEach((p, i) => lines.push(`${i + 1}. ${p.name} (${p.id})`));
  if (total > shown.length) lines.push(`…還有 ${total - shown.length} 位(依 /members 分頁不支援,可用 LINE 群組資訊查看)`);
  return lines.join("\n");
}

/** Convenience: reply to the event with text, used by the webhook for command replies. */
export async function replyWithText(env: Env, event: LineMessageEvent, text: string): Promise<void> {
  const token = env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return;
  await replyLine(token, event.replyToken, [{ type: "text", text }]);
}
