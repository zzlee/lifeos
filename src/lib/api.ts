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
const accountingApiBase = "https://purple-water-b776.zzlee-tw.workers.dev";

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

export async function sendAgentCommand(messages: Array<{ role: "user" | "assistant"; content: string }>): Promise<AgentCommandResponse> {
  const response = await fetch(getUrl("/api/agent"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages })
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

export type AccountingTransaction = {
  transaction_id: number;
  transaction_date: string;
  item_name: string;
  item_category: string;
  payment_category: string;
  amount: number;
  notes?: string | null;
  item_category_id: number;
  payment_category_id: number;
};

type AccountingTransactionInput = {
  transaction_date: string;
  item_name: string;
  item_category_id: number;
  amount: number;
  payment_category_id: number;
  notes?: string;
};

function getAccountingUserId(): number {
  const raw = window.localStorage.getItem("lifeos-accounting-user-id") ?? "1";
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}



export type AccountingCategory = {
  id: number;
  name: string;
};

export type AccountingCategoryOptions = {
  itemCategories: AccountingCategory[];
  paymentCategories: AccountingCategory[];
};

async function fetchCategoryEndpoint(path: string): Promise<AccountingCategory[]> {
  const response = await fetch(`${accountingApiBase}${path}`);
  if (!response.ok) throw new Error(`accounting categories ${response.status}`);
  const payload = await response.json() as any[];
  return payload
    .map((item) => ({
      id: Number(item.id ?? item.item_category_id ?? item.payment_category_id),
      name: String(item.name ?? item.item_category ?? item.payment_category ?? "")
    }))
    .filter((item) => Number.isFinite(item.id) && item.id > 0 && item.name.trim().length > 0);
}

export async function fetchAccountingCategoryOptions(): Promise<AccountingCategoryOptions> {
  const [itemResult, paymentResult] = await Promise.allSettled([
    fetchCategoryEndpoint('/api/item-categories'),
    fetchCategoryEndpoint('/api/payment-categories')
  ]);

  if (itemResult.status === 'fulfilled' && paymentResult.status === 'fulfilled') {
    return { itemCategories: itemResult.value, paymentCategories: paymentResult.value };
  }

  const transactions = await fetchAccountingTransactions();
  const itemMap = new Map<number, string>();
  const paymentMap = new Map<number, string>();

  for (const tx of transactions) {
    if (tx.item_category_id > 0 && tx.item_category) itemMap.set(tx.item_category_id, tx.item_category);
    if (tx.payment_category_id > 0 && tx.payment_category) paymentMap.set(tx.payment_category_id, tx.payment_category);
  }

  const toList = (m: Map<number, string>): AccountingCategory[] =>
    Array.from(m.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.id - b.id);

  return {
    itemCategories: itemResult.status === 'fulfilled' ? itemResult.value : toList(itemMap),
    paymentCategories: paymentResult.status === 'fulfilled' ? paymentResult.value : toList(paymentMap)
  };
}

type AccountingTransactionQuery = {
  startDate?: string;
  endDate?: string;
};

export async function fetchAccountingTransactions(query: AccountingTransactionQuery = {}): Promise<AccountingTransaction[]> {
  const url = new URL(`${accountingApiBase}/api/transactions`);
  url.searchParams.set("user-id", String(getAccountingUserId()));
  if (query.startDate) {
    url.searchParams.set("startDate", query.startDate);
  }
  if (query.endDate) {
    url.searchParams.set("endDate", query.endDate);
  }
  const response = await fetch(url.toString());
  if (!response.ok) throw new Error(`accounting tx ${response.status}`);
  return (await response.json()) as AccountingTransaction[];
}

export async function createAccountingTransaction(entry: AccountingTransactionInput): Promise<AccountingTransaction> {
  const response = await fetch(`${accountingApiBase}/api/transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...entry, user_id: getAccountingUserId() })
  });
  if (!response.ok) throw new Error(`create accounting tx ${response.status}`);
  return (await response.json()) as AccountingTransaction;
}

export async function updateAccountingTransaction(id: number, entry: AccountingTransactionInput): Promise<AccountingTransaction> {
  const response = await fetch(`${accountingApiBase}/api/transactions/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...entry, user_id: getAccountingUserId() })
  });
  if (!response.ok) throw new Error(`update accounting tx ${response.status}`);
  return (await response.json()) as AccountingTransaction;
}
