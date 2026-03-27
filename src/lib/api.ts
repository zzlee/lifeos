import type { AgentCommandResponse, DashboardSnapshotResponse } from "../../shared/contracts";
import { initialData } from "./mockData";
import type { LifeOSState } from "./types";

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "";

export async function fetchDashboardSnapshot(): Promise<DashboardSnapshotResponse> {
  try {
    const response = await fetch(`${apiBase}/api/dashboard`);
    if (!response.ok) throw new Error(`dashboard ${response.status}`);
    return (await response.json()) as DashboardSnapshotResponse;
  } catch {
    return {
      data: structuredClone(initialData),
      source: "mock",
      generatedAt: new Date().toISOString()
    };
  }
}

export async function sendAgentCommand(command: string, currentState: LifeOSState): Promise<AgentCommandResponse> {
  try {
    const response = await fetch(`${apiBase}/api/agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command })
    });
    if (!response.ok) throw new Error(`agent ${response.status}`);
    return (await response.json()) as AgentCommandResponse;
  } catch {
    const { parseAgentInput } = await import("./agent");
    return {
      accepted: true,
      mutation: parseAgentInput(command, currentState),
      source: "mock"
    };
  }
}
