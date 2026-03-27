import type { LifeOSState } from "./types";
import { initialData } from "./mockData";

export async function fetchDashboardSnapshot(): Promise<LifeOSState> {
  return Promise.resolve(structuredClone(initialData));
}

export async function sendAgentCommand(command: string): Promise<{ accepted: true; command: string }> {
  return Promise.resolve({ accepted: true, command });
}
