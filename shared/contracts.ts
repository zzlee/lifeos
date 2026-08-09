import type { Expense, HealthEntry, JournalEntry, LifeOSState, UserProfile, VaultItem } from "./domain";

export type JournalListResponse = {
  journals: JournalEntry[];
};

export type JournalMutationResponse = {
  ok: true;
};

export type ExpenseListResponse = {
  expenses: Expense[];
};

export type ExpenseMutationResponse = {
  ok: true;
};

export type HealthListResponse = {
  health: HealthEntry[];
};

export type HealthMutationResponse = {
  ok: true;
};

export type DashboardSnapshotResponse = {
  data: LifeOSState;
  source: "d1";
  generatedAt: string;
};

export type AgentCommandRequest = {
  messages?: Array<{ role: "user" | "assistant"; content: string }>;
  /** Backward-compatible single-command shape used by older CLI builds. */
  command?: string;
};

export type AgentCommandResponse = {
  accepted: true;
  reply: string;
  data: LifeOSState;
  source: "agnes";
  systemInstruction?: string;
  agentDebugError?: string;
  toolCalls?: Array<{ name: string; args: any; result: any }>;
};

export type VaultSecretResponse = {
  id: number;
  secret: string;
  source: "d1";
};

export type VaultListResponse = {
  items: VaultItem[];
};

export type VaultExportResponse = {
  items: Array<{ site: string; username: string; secret: string }>;
};

export type SessionResponse = {
  authenticated: boolean;
  provider: "none" | "google-ready" | "api-key";
  user: UserProfile | null;
  googleAuthEnabled: boolean;
};

export type ApiKey = {
  id: string;
  name: string;
  createdAt: string;
};

export type ApiKeyListResponse = {
  keys: ApiKey[];
};

export type AuthMutationResponse = {
  ok: true;
  session: SessionResponse;
};

// ---- LINE chat archive API ----

export type LineRoomSummary = {
  roomType: "user" | "group" | "room";
  roomId: string;
  messageCount: number;
  lastMessageType: string | null;
  lastMessageText: string | null;
  lastSenderId: string | null;
  lastMessageAt: string | null;
  /** Resolved display name (group name from LINE API, best-effort). */
  name?: string | null;
};

export type LineMessageView = {
  id: number;
  userId: string | null;
  userName?: string;
  pictureUrl?: string;
  messageType: string;
  text: string | null;
  createdAt: string;
};

export type LineRoomsResponse = {
  rooms: LineRoomSummary[];
  botUserId?: string | null;
};

export type LineMessagesResponse = {
  messages: LineMessageView[];
  botUserId?: string | null;
};
