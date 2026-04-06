import type { LifeOSState, UserProfile } from "./domain";
import type { AgentMutation } from "./lifeAgent";

export type DashboardSnapshotResponse = {
  data: LifeOSState;
  source: "mock" | "d1";
  generatedAt: string;
};

export type AgentCommandRequest = {
  command: string;
};

export type AgentCommandResponse = {
  accepted: true;
  mutation: AgentMutation;
  data: LifeOSState;
  source: "mock" | "d1";
};

export type VaultSecretResponse = {
  id: number;
  secret: string;
  source: "mock" | "d1";
};

export type SessionResponse = {
  authenticated: boolean;
  provider: "demo" | "google-ready" | "api-key";
  user: UserProfile | null;
  googleAuthEnabled: boolean;
};

export type DemoLoginRequest = {
  name?: string;
  email?: string;
};

export type AuthMutationResponse = {
  ok: true;
  session: SessionResponse;
};
