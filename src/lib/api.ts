import type { AgentCommandResponse, DashboardSnapshotResponse, VaultSecretResponse } from "../../shared/contracts";
import { initialData } from "./mockData";
import type { LifeOSState, VaultItem } from "./types";

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
    const mutation = parseAgentInput(command, currentState);
    return {
      accepted: true,
      mutation,
      data: applyMutation(currentState, mutation),
      source: "mock"
    };
  }
}

export async function fetchVaultSecret(item: VaultItem): Promise<VaultSecretResponse> {
  try {
    const response = await fetch(`${apiBase}/api/vault/${item.id}/secret`);
    if (!response.ok) throw new Error(`vault ${response.status}`);
    return (await response.json()) as VaultSecretResponse;
  } catch {
    return {
      id: item.id,
      secret: item.secret,
      source: "mock"
    };
  }
}

function applyMutation(state: LifeOSState, mutation: AgentCommandResponse["mutation"]): LifeOSState {
  switch (mutation.kind) {
    case "expense":
      return { ...state, finance: [mutation.entry, ...state.finance] };
    case "health":
      return { ...state, health: [...state.health, mutation.entry] };
    case "journal":
      return { ...state, journals: [mutation.entry, ...state.journals] };
    case "vault":
      return { ...state, vault: [mutation.entry, ...state.vault] };
  }
}
