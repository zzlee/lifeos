import type {
  AgentCommandResponse,
  AuthMutationResponse,
  DashboardSnapshotResponse,
  SessionResponse,
  VaultSecretResponse,
} from "../../shared/contracts";
import type { VaultItem } from "./types";

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "";

if (!apiBase && import.meta.env.PROD) {
  console.error(
    "Critical Configuration Error: VITE_API_BASE_URL is not defined.\n" +
    "The frontend will not be able to connect to the backend Worker.\n" +
    "Please set this environment variable in the Cloudflare Pages Dashboard."
  );
}

export function isApiConfigured(): boolean {
  return apiBase.startsWith("http");
}

export async function fetchDashboardSnapshot(): Promise<DashboardSnapshotResponse> {
  const response = await fetch(`${apiBase}/api/dashboard`, { credentials: "include" });
  if (!response.ok) throw new Error(`dashboard ${response.status}`);
  return (await response.json()) as DashboardSnapshotResponse;
}

export async function fetchSession(): Promise<SessionResponse> {
  const response = await fetch(`${apiBase}/api/session`, { credentials: "include" });
  if (!response.ok) throw new Error(`session ${response.status}`);
  return (await response.json()) as SessionResponse;
}

export async function sendAgentCommand(command: string): Promise<AgentCommandResponse> {
  const response = await fetch(`${apiBase}/api/agent`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command })
  });
  if (!response.ok) throw new Error(`agent ${response.status}`);
  return (await response.json()) as AgentCommandResponse;
}

export async function fetchVaultSecret(item: VaultItem): Promise<VaultSecretResponse> {
  const response = await fetch(`${apiBase}/api/vault/${item.id}/secret`, { credentials: "include" });
  if (!response.ok) throw new Error(`vault ${response.status}`);
  return (await response.json()) as VaultSecretResponse;
}

export async function logout(): Promise<AuthMutationResponse> {
  const response = await fetch(`${apiBase}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) throw new Error(`logout ${response.status}`);
  return (await response.json()) as AuthMutationResponse;
}

export function getGoogleLoginUrl(): string {
  return `${apiBase}/api/auth/google/start`;
}
