export type ViewId = "overview" | "finance" | "journal" | "health" | "vault" | "settings";

export type ApiKey = {
  id: string;
  name: string;
  createdAt: string;
};

export type UserProfile = {
  id: string;
  email: string;
  name: string;
  timezone: string;
};

export type Expense = {
  id: number;
  date: string;
  amount: number;
  category: string;
  note: string;
};

export type JournalEntry = {
  id: number;
  date: string;
  content: string;
  tags: string[];
};

export type HealthEntry = {
  date: string;
  sys: number;
  dia: number;
  hr: number;
  weight?: number;
};

export type VaultItem = {
  id: number;
  site: string;
  username: string;
  secret: string;
};

export type LifeOSState = {
  finance: Expense[];
  journals: JournalEntry[];
  health: HealthEntry[];
  vault: VaultItem[];
};
