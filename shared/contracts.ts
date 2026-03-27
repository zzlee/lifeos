import type { LifeOSState } from "./domain";
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
  source: "mock" | "d1";
};
