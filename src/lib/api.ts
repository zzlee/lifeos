import type {
  AgentCommandResponse,
  ApiKeyListResponse,
  AuthMutationResponse,
  DashboardSnapshotResponse,
  ExpenseListResponse,
  ExpenseMutationResponse,
  HealthListResponse,
  HealthMutationResponse,
  JournalListResponse,
  JournalMutationResponse,
  SessionResponse,
  VaultSecretResponse,
  VaultListResponse,
} from "../../shared/contracts";
import type { VaultItem } from "./types";

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "";

const getUrl = (path: string) => (apiBase ? `${apiBase}${path}` : path);

export function isApiConfigured(): boolean {
  return apiBase === "" || apiBase.startsWith("https");
}

export async function fetchDashboardSnapshot(): Promise<DashboardSnapshotResponse> {
  const response = await fetch(getUrl("/api/dashboard"), { credentials: "include" });
  if (!response.ok) throw new Error(`dashboard ${response.status}`);
  return (await response.json()) as DashboardSnapshotResponse;
}

export async function fetchSession(): Promise<SessionResponse> {
  const response = await fetch(getUrl("/api/session"), { credentials: "include" });
  if (!response.ok) throw new Error(`session ${response.status}`);
  return (await response.json()) as SessionResponse;
}

export async function sendAgentCommand(command: string): Promise<AgentCommandResponse> {
  const response = await fetch(getUrl("/api/agent"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command })
  });
  if (!response.ok) throw new Error(`agent ${response.status}`);
  return (await response.json()) as AgentCommandResponse;
}

export async function fetchApiKeys(): Promise<ApiKeyListResponse> {
  const response = await fetch(getUrl("/api/auth/keys"), { credentials: "include" });
  if (!response.ok) throw new Error(`fetch keys ${response.status}`);
  return (await response.json()) as ApiKeyListResponse;
}

export async function createApiKey(name: string): Promise<{ ok: boolean; key: string }> {
  const response = await fetch(getUrl("/api/auth/keys"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name })
  });
  if (!response.ok) throw new Error(`create key ${response.status}`);
  return (await response.json()) as { ok: boolean; key: string };
}

export async function deleteApiKey(id: string): Promise<{ ok: boolean }> {
  const response = await fetch(getUrl(`/api/auth/keys/${id}`), {
    method: "DELETE",
    credentials: "include"
  });
  if (!response.ok) throw new Error(`delete key ${response.status}`);
  return (await response.json()) as { ok: boolean };
}

export async function fetchVaultItems(limit: number = 20, offset: number = 0, query: string = ""): Promise<VaultListResponse> {
  const url = new URL(getUrl("/api/vault"), window.location.origin);
  url.searchParams.set("limit", limit.toString());
  url.searchParams.set("offset", offset.toString());
  if (query) url.searchParams.set("query", query);

  const response = await fetch(url.toString(), { credentials: "include" });
  if (!response.ok) throw new Error(`fetch vault ${response.status}`);
  return (await response.json()) as VaultListResponse;
}

export async function fetchVaultSecret(item: VaultItem): Promise<VaultSecretResponse> {
  const response = await fetch(getUrl(`/api/vault/${item.id}/secret`), { credentials: "include" });
  if (!response.ok) throw new Error(`vault ${response.status}`);
  return (await response.json()) as VaultSecretResponse;
}

export async function createVaultItem(entry: { site: string; username: string; secret: string }): Promise<DashboardSnapshotResponse> {
  const response = await fetch(getUrl("/api/vault"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry)
  });
  if (!response.ok) throw new Error(`create vault ${response.status}`);
  return (await response.json()) as DashboardSnapshotResponse;
}

export async function updateVaultItem(id: number, entry: { site: string; username: string; secret: string }): Promise<{ ok: boolean }> {
  const response = await fetch(getUrl(`/api/vault/${id}`), {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry)
  });
  if (!response.ok) throw new Error(`update vault ${response.status}`);
  return (await response.json()) as { ok: boolean };
}

export async function deleteVaultItem(id: number): Promise<{ ok: boolean }> {
  const response = await fetch(getUrl(`/api/vault/${id}`), {
    method: "DELETE",
    credentials: "include"
  });
  if (!response.ok) throw new Error(`delete vault ${response.status}`);
  return (await response.json()) as { ok: boolean };
}

export async function fetchJournals(limit: number = 20, offset: number = 0): Promise<JournalListResponse> {
  const response = await fetch(getUrl(`/api/journals?limit=${limit}&offset=${offset}`), { credentials: "include" });
  if (!response.ok) throw new Error(`fetch journals ${response.status}`);
  return (await response.json()) as JournalListResponse;
}

export async function createJournal(entry: { content: string; tags: string[] }): Promise<JournalMutationResponse> {
  const response = await fetch(getUrl("/api/journals"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry)
  });
  if (!response.ok) throw new Error(`create journal ${response.status}`);
  return (await response.json()) as JournalMutationResponse;
}

export async function updateJournal(id: number, entry: { content: string; tags: string[] }): Promise<JournalMutationResponse> {
  const response = await fetch(getUrl(`/api/journals/${id}`), {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry)
  });
  if (!response.ok) throw new Error(`update journal ${response.status}`);
  return (await response.json()) as JournalMutationResponse;
}

export async function deleteJournal(id: number): Promise<JournalMutationResponse> {
  const response = await fetch(getUrl(`/api/journals/${id}`), {
    method: "DELETE",
    credentials: "include"
  });
  if (!response.ok) throw new Error(`delete journal ${response.status}`);
  return (await response.json()) as JournalMutationResponse;
}

export async function fetchExpenses(limit: number = 20, offset: number = 0): Promise<ExpenseListResponse> {
  const response = await fetch(getUrl(`/api/expenses?limit=${limit}&offset=${offset}`), { credentials: "include" });
  if (!response.ok) throw new Error(`fetch expenses ${response.status}`);
  return (await response.json()) as ExpenseListResponse;
}

export async function createExpense(entry: { amount: number; category: string; note: string; date: string }): Promise<ExpenseMutationResponse> {
  const response = await fetch(getUrl("/api/expenses"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry)
  });
  if (!response.ok) throw new Error(`create expense ${response.status}`);
  return (await response.json()) as ExpenseMutationResponse;
}

export async function updateExpense(id: number, entry: { amount: number; category: string; note: string; date: string }): Promise<ExpenseMutationResponse> {
  const response = await fetch(getUrl(`/api/expenses/${id}`), {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry)
  });
  if (!response.ok) throw new Error(`update expense ${response.status}`);
  return (await response.json()) as ExpenseMutationResponse;
}

export async function deleteExpense(id: number): Promise<ExpenseMutationResponse> {
  const response = await fetch(getUrl(`/api/expenses/${id}`), {
    method: "DELETE",
    credentials: "include"
  });
  if (!response.ok) throw new Error(`delete expense ${response.status}`);
  return (await response.json()) as ExpenseMutationResponse;
}

export async function fetchHealthRecords(limit: number = 30, offset: number = 0): Promise<HealthListResponse> {
  const response = await fetch(getUrl(`/api/health?limit=${limit}&offset=${offset}`), { credentials: "include" });
  if (!response.ok) throw new Error(`fetch health ${response.status}`);
  return (await response.json()) as HealthListResponse;
}

export async function createHealthRecord(entry: { sys: number; dia: number; hr: number; weight?: number; date: string }): Promise<HealthMutationResponse> {
  const response = await fetch(getUrl("/api/health"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry)
  });
  if (!response.ok) throw new Error(`create health ${response.status}`);
  return (await response.json()) as HealthMutationResponse;
}

export async function updateHealthRecord(id: number, entry: { sys: number; dia: number; hr: number; weight?: number; date: string }): Promise<HealthMutationResponse> {
  const response = await fetch(getUrl(`/api/health/${id}`), {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry)
  });
  if (!response.ok) throw new Error(`update health ${response.status}`);
  return (await response.json()) as HealthMutationResponse;
}

export async function deleteHealthRecord(id: number): Promise<HealthMutationResponse> {
  const response = await fetch(getUrl(`/api/health/${id}`), {
    method: "DELETE",
    credentials: "include"
  });
  if (!response.ok) throw new Error(`delete health ${response.status}`);
  return (await response.json()) as HealthMutationResponse;
}

export async function logout(): Promise<AuthMutationResponse> {
  const response = await fetch(getUrl("/api/auth/logout"), {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) throw new Error(`logout ${response.status}`);
  return (await response.json()) as AuthMutationResponse;
}

export function getGoogleLoginUrl(): string {
  return getUrl(`/api/auth/google/start?from=${encodeURIComponent(window.location.origin)}`);
}

export async function updateUserProfile(timezone: string): Promise<{ ok: boolean }> {
  const response = await fetch(getUrl("/api/auth/profile"), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ timezone }),
    credentials: "include",
  });
  if (!response.ok) throw new Error("Failed to update profile");
  return response.json();
}
