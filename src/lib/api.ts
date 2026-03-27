import type {
  AgentCommandResponse,
  AuthMutationResponse,
  DashboardSnapshotResponse,
  DemoLoginRequest,
  SessionResponse,
  VaultSecretResponse,
} from "../../shared/contracts";
import { initialData } from "./mockData";
import type { LifeOSState, UserProfile, VaultItem } from "./types";

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "";
const demoUser: UserProfile = {
  id: "demo-user",
  email: "demo@lifeos.app",
  name: "LifeOS Demo",
};

export async function fetchDashboardSnapshot(): Promise<DashboardSnapshotResponse> {
  try {
    const response = await fetch(`${apiBase}/api/dashboard`, { credentials: "include" });
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

export async function fetchSession(): Promise<SessionResponse> {
  try {
    const response = await fetch(`${apiBase}/api/session`, { credentials: "include" });
    if (!response.ok) throw new Error(`session ${response.status}`);
    return (await response.json()) as SessionResponse;
  } catch {
    return {
      authenticated: true,
      provider: "demo",
      user: demoUser,
      googleAuthEnabled: false,
    };
  }
}

export async function sendAgentCommand(command: string, currentState: LifeOSState): Promise<AgentCommandResponse> {
  try {
    const response = await fetch(`${apiBase}/api/agent`, {
      method: "POST",
      credentials: "include",
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
    const response = await fetch(`${apiBase}/api/vault/${item.id}/secret`, { credentials: "include" });
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

export async function loginDemo(input: DemoLoginRequest): Promise<AuthMutationResponse> {
  const response = await fetch(`${apiBase}/api/auth/demo-login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(`login ${response.status}`);
  return (await response.json()) as AuthMutationResponse;
}

export async function logout(): Promise<AuthMutationResponse> {
  const response = await fetch(`${apiBase}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) throw new Error(`logout ${response.status}`);
  return (await response.json()) as AuthMutationResponse;
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
