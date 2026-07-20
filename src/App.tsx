import { useEffect, useMemo, useState, useRef } from "react";
import LoginPage from "./components/LoginPage";
import { FinanceRow } from "./components/FinanceRow";
import { FixedSizeList as List } from "react-window";
import { toLocalDisplayDate, toLocalDisplayTime, toLocalInputString, getCurrentLocalInputString, localInputToUtcString } from "./lib/timeUtils";
import { updateUserProfile, fetchDashboardSnapshot, fetchSession, fetchVaultSecret, isApiConfigured, logout, sendAgentCommand, createVaultItem, fetchApiKeys, createApiKey, updateApiKey, deleteApiKey, updateVaultItem, deleteVaultItem, createJournal, updateJournal, deleteJournal, createExpense, updateExpense, deleteExpense, createHealthRecord, updateHealthRecord, deleteHealthRecord, fetchJournals, fetchExpenses, fetchHealthRecords, fetchVaultItems, fetchAccountingTransactions, createAccountingTransaction, updateAccountingTransaction, deleteAccountingTransaction, fetchAccountingCategoryOptions, type AccountingCategory } from "./lib/api";
import type { Expense, HealthEntry, JournalEntry, LifeOSState, UserProfile, VaultItem, ViewId, ApiKey } from "./lib/types";

const navItems: Array<{ id: ViewId; title: string; mobile: string; icon: string }> = [
  { id: "overview", title: "總覽面板", mobile: "總覽", icon: "🏠" },
  { id: "finance", title: "消費記錄", mobile: "消費", icon: "💳" },
  { id: "journal", title: "隨手日記", mobile: "日記", icon: "📖" },
  { id: "health", title: "生理資訊", mobile: "健康", icon: "❤️" },
  { id: "vault", title: "密碼管理", mobile: "密碼", icon: "🔐" },
  { id: "settings", title: "系統設定", mobile: "設定", icon: "⚙️" }
];

type ToastState = { visible: boolean; message: string };

const emptyState: LifeOSState = { finance: [], journals: [], health: [], vault: [] };
const defaultUser: UserProfile = { id: "", email: "", name: "", timezone: "UTC" };

function getAccountingMonthRangeUtc(month: string, timezone: string): { startDate: string; endDate: string } {
  const [yearRaw, monthRaw] = month.split("-");
  const year = Number(yearRaw);
  const monthNumber = Number(monthRaw);

  if (!Number.isInteger(year) || !Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    const start = localInputToUtcString(`${new Date().toISOString().slice(0, 7)}-01T00:00:00`, timezone);
    const end = localInputToUtcString(`${new Date().toISOString().slice(0, 10)}T23:59:59`, timezone);
    return { startDate: start, endDate: end };
  }

  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const monthPadded = String(monthNumber).padStart(2, "0");
  const dayPadded = String(lastDay).padStart(2, "0");

  return {
    startDate: localInputToUtcString(`${year}-${monthPadded}-01T00:00:00`, timezone),
    endDate: localInputToUtcString(`${year}-${monthPadded}-${dayPadded}T23:59:59`, timezone),
  };
}

export default function App() {
  if (!isApiConfigured()) {
    return (
      <div className="login-screen">
        <div className="panel login-card" style={{ maxWidth: "540px" }}>
          <div className="brand-mark" style={{ backgroundColor: "#ef4444" }}>!</div>
          <h1 style={{ color: "#ef4444" }}>Configuration Error</h1>
          <p>
            The frontend is not configured to communicate with the backend. 
            The environment variable <strong>VITE_API_BASE_URL</strong> is missing or invalid.
          </p>
          <div style={{ textAlign: "left", marginTop: "1rem", padding: "1rem", background: "#f8fafc", borderRadius: "8px", fontSize: "14px", lineHeight: "1.6" }}>
            <strong>How to fix this:</strong>
            <ol style={{ paddingLeft: "1.2rem", marginTop: "0.5rem" }}>
              <li>Visit your <strong>Cloudflare Pages</strong> dashboard.</li>
              <li>Go to <strong>Settings</strong> &rarr; <strong>Environment Variables</strong>.</li>
              <li>Add <code>VITE_API_BASE_URL</code>.</li>
              <li>Set the value to your Worker URL (e.g., <code>https://lifeos.user.workers.dev</code>).</li>
              <li><strong>Crucial:</strong> Go to the "Deployments" tab and trigger a <strong>Retry deployment</strong>.</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  const [view, setView] = useState<ViewId>("overview");
  const [data, setData] = useState<LifeOSState>(emptyState);
  const [user, setUser] = useState<UserProfile>(defaultUser);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [toast, setToast] = useState<ToastState>({ visible: false, message: "" });
  const [vaultQuery, setVaultQuery] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [isVaultModalOpen, setIsVaultModalOpen] = useState(false);
  const [editingVaultId, setEditingVaultId] = useState<number | null>(null);
  const [newVaultItem, setNewVaultItem] = useState({ site: "", username: "", secret: "" });
  const [vaultList, setVaultList] = useState<VaultItem[]>([]);
  const [vaultPage, setVaultPage] = useState(0);
  const [hasMoreVault, setHasMoreVault] = useState(false);
  const [isLoadingVault, setIsLoadingVault] = useState(false);
  const [vaultRefreshTrigger, setVaultRefreshTrigger] = useState(0);

  const [isJournalModalOpen, setIsJournalModalOpen] = useState(false);
  const [editingJournalId, setEditingJournalId] = useState<number | null>(null);
  const [newJournalEntry, setNewJournalEntry] = useState({ content: "", tags: "" });
  const [journalList, setJournalList] = useState<JournalEntry[]>([]);
  const [journalPage, setJournalPage] = useState(0);
  const [hasMoreJournals, setHasMoreJournals] = useState(false);
  const [isLoadingJournals, setIsLoadingJournals] = useState(false);
  const [journalRefreshTrigger, setJournalRefreshTrigger] = useState(0);

  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);
  const [newExpenseEntry, setNewExpenseEntry] = useState({ amount: 0, category: "", note: "", date: "" });
  const [expenseList, setExpenseList] = useState<Expense[]>([]);
  const [expensePage, setExpensePage] = useState(0);
  const [hasMoreExpenses, setHasMoreExpenses] = useState(false);
  const [isLoadingExpenses, setIsLoadingExpenses] = useState(false);
  const [expenseRefreshTrigger, setExpenseRefreshTrigger] = useState(0);
  const [financeMonth, setFinanceMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [accountingTransactions, setAccountingTransactions] = useState<any[]>([]);
  const [accountingUserId, setAccountingUserId] = useState("1");
  const [isAccountingModalOpen, setIsAccountingModalOpen] = useState(false);
  const [editingAccountingId, setEditingAccountingId] = useState<number | null>(null);
  const [newAccountingEntry, setNewAccountingEntry] = useState({ transaction_date: "", item_name: "", item_category_id: 1, payment_category_id: 1, amount: 0, notes: "" });
  const [itemCategoryOptions, setItemCategoryOptions] = useState<AccountingCategory[]>([]);
  const [paymentCategoryOptions, setPaymentCategoryOptions] = useState<AccountingCategory[]>([]);

  const [isHealthModalOpen, setIsHealthModalOpen] = useState(false);
  const [editingHealthId, setEditingHealthId] = useState<number | null>(null);
  const [newHealthEntry, setNewHealthEntry] = useState({ sys: 120, dia: 80, hr: 72, weight: 0, date: "" });
  const [healthList, setHealthList] = useState<HealthEntry[]>([]);
  const [healthPage, setHealthPage] = useState(0);
  const [hasMoreHealth, setHasMoreHealth] = useState(false);
  const [isLoadingHealth, setIsLoadingHealth] = useState(false);
  const [healthRefreshTrigger, setHealthRefreshTrigger] = useState(0);

  const [isAgentThinking, setIsAgentThinking] = useState(false);
  const [isAgentChatOpen, setIsAgentChatOpen] = useState(false);
  const [agentMessages, setAgentMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);


  const [lastAgentResponse, setLastAgentResponse] = useState<any>(null);
  const [isDebugOpen, setIsDebugOpen] = useState(false);

  function handleCloseAgentChat() {
    setIsAgentChatOpen(false);
    setAgentMessages([]);
    setLastAgentResponse(null);
    setIsDebugOpen(false);
  }

  const chatEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [agentMessages, isAgentThinking]);

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);

  useEffect(() => {
    setAccountingUserId(window.localStorage.getItem("lifeos-accounting-user-id") ?? "1");
    fetchSession()
      .then((session) => {
        setUser(session.user ?? defaultUser);
        setIsAuthenticated(session.authenticated);
      })
      .catch(() => {
        setIsAuthenticated(false);
      });
    fetchDashboardSnapshot()
      .then((snapshot) => setData(snapshot.data))
      .catch(() => {
        // Silently fail dashboard fetch if not authenticated
      });
  }, []);

  useEffect(() => {
    fetchDashboardSnapshot()
      .then((snapshot) => setData(snapshot.data))
      .catch((err) => console.error("Failed to fetch dashboard data on view change:", err));
    if (view === "settings") {
      loadKeys();
    }
  }, [view]);

  useEffect(() => {
    if (view === "finance" || view === "overview") {
      setIsLoadingExpenses(true);
      const limit = 20;
      fetchExpenses(limit, expensePage * limit)
        .then((res) => {
          setExpenseList((prev) => {
            if (expensePage === 0) return res.expenses;
            const newExpenses = [...prev];
            res.expenses.forEach(e => {
              if (!newExpenses.some(existingExpense => existingExpense.id === e.id)) {
                newExpenses.push(e);
              }
            });
            return newExpenses;
          });
          setHasMoreExpenses(res.expenses.length === limit);
        })
        .catch((err) => console.error("Failed to fetch expenses:", err))
        .finally(() => setIsLoadingExpenses(false));
      const accountingRange = getAccountingMonthRangeUtc(financeMonth, user.timezone);
      fetchAccountingTransactions(accountingRange).then(setAccountingTransactions).catch((err) => console.error("Failed to fetch accounting transactions:", err));
      fetchAccountingCategoryOptions()
        .then(({ itemCategories, paymentCategories }) => {
          setItemCategoryOptions(itemCategories);
          setPaymentCategoryOptions(paymentCategories);
          setNewAccountingEntry((prev) => ({
            ...prev,
            item_category_id: prev.item_category_id || itemCategories[0]?.id || 1,
            payment_category_id: prev.payment_category_id || paymentCategories[0]?.id || 1
          }));
        })
        .catch((err) => console.error("Failed to fetch accounting category options:", err));
    }
  }, [view, expensePage, expenseRefreshTrigger, financeMonth, user.timezone]);

  useEffect(() => {
    if (view === "vault") {
      setIsLoadingVault(true);
      const limit = 20;
      fetchVaultItems(limit, vaultPage * limit, vaultQuery)
        .then((res) => {
          setVaultList((prev) => {
            if (vaultPage === 0) return res.items;
            const newVaults = [...prev];
            res.items.forEach(e => {
              if (!newVaults.some(existingVault => existingVault.id === e.id)) {
                newVaults.push(e);
              }
            });
            return newVaults;
          });
          setHasMoreVault(res.items.length === limit);
        })
        .catch((err) => console.error("Failed to fetch vault items:", err))
        .finally(() => setIsLoadingVault(false));
    }
  }, [view, vaultPage, vaultRefreshTrigger, vaultQuery]);

  useEffect(() => {
    if (view === "health") {
      setIsLoadingHealth(true);
      const limit = 30;
      fetchHealthRecords(limit, healthPage * limit)
        .then((res) => {
          setHealthList((prev) => {
            if (healthPage === 0) return res.health;
            const newHealth = [...prev];
            res.health.forEach(e => {
              if (!newHealth.some(existingHealth => existingHealth.id === e.id)) {
                newHealth.push(e);
              }
            });
            return newHealth;
          });
          setHasMoreHealth(res.health.length === limit);
        })
        .catch((err) => console.error("Failed to fetch health records:", err))
        .finally(() => setIsLoadingHealth(false));
    }
  }, [view, healthPage, healthRefreshTrigger]);

  useEffect(() => {
    if (view === "journal") {
      setIsLoadingJournals(true);
      const limit = 20;
      fetchJournals(limit, journalPage * limit)
        .then((res) => {
          setJournalList((prev) => {
            if (journalPage === 0) return res.journals;
            const existingIds = new Set(prev.map(j => j.id));
            const newJournals = [...prev];
            res.journals.forEach(j => {
              if (!existingIds.has(j.id)) {
                newJournals.push(j);
                existingIds.add(j.id);
              }
            });
            return newJournals;
          });
          setHasMoreJournals(res.journals.length === limit);
        })
        .catch((err) => console.error("Failed to fetch journals:", err))
        .finally(() => setIsLoadingJournals(false));
    }
  }, [view, journalPage, journalRefreshTrigger]);

  async function loadKeys() {
    const res = await fetchApiKeys();
    setApiKeys(res.keys);
  }

  async function handleCreateKey(e: React.FormEvent) {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    const res = await createApiKey(newKeyName);
    setNewKeyValue(res.key);
    setNewKeyName("");
    loadKeys();
  }

  async function handleUpdateKey(id: string, currentName: string) {
    const newName = window.prompt("請輸入新的 API Key 名稱", currentName);
    if (!newName || newName.trim() === currentName) return;
    try {
      await updateApiKey(id, newName.trim());
      loadKeys();
      setToast({ visible: true, message: "API Key 已更新" });
    } catch (e) {
      setToast({ visible: true, message: "API Key 更新失敗" });
    }
  }

  async function handleDeleteKey(id: string) {
    if (!confirm("確定要刪除此 API Key 嗎？這將導致使用此 Key 的 CLI 工具失效。")) return;
    await deleteApiKey(id);
    loadKeys();
    setToast({ visible: true, message: "API Key 已成功刪除" });
  }

  useEffect(() => {
    if (!toast.visible) return;
    const timer = window.setTimeout(() => setToast({ visible: false, message: "" }), 3000);
    return () => window.clearTimeout(timer);
  }, [toast.visible]);

  const latestHealth = data.health[0];

  const allTransactions = useMemo(() => {
    const combined: any[] = [
      ...expenseList.map(e => ({ ...e, type: "internal" })),
      ...accountingTransactions.map(a => ({
        id: a.transaction_id,
        date: a.transaction_date,
        amount: a.amount,
        category: a.item_category || "未分類",
        note: a.item_name + (a.notes ? ` - ${a.notes}` : ""),
        type: "external",
        original: a
      }))
    ];

    return combined
      .filter(t => toLocalDisplayDate(t.date, user.timezone).startsWith(financeMonth))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenseList, accountingTransactions, financeMonth, user.timezone]);

  const financeTotal = useMemo(
    () => allTransactions.reduce((sum, item) => sum + item.amount, 0),
    [allTransactions],
  );

  const financeGroups = useMemo(() => groupFinance(allTransactions), [allTransactions]);

  const healthStats = useMemo(() => getHealthStats(data.health), [data.health]);

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  async function handlePromptSubmit() {
    const text = prompt.trim();
    if (!text) return;

    const nextMessages = [...agentMessages, { role: "user" as const, content: text }];
    setAgentMessages(nextMessages);
    setIsAgentChatOpen(true);
    setIsAgentThinking(true);
    try {
      const response = await sendAgentCommand(nextMessages, Number(accountingUserId) || 1);
      setData(response.data);
      setPrompt("");
      setAgentMessages((prev) => [...prev, { role: "assistant", content: response.reply }]);
      setLastAgentResponse(response);
      setToast({ visible: true, message: response.reply });
    } catch (err: any) {
      console.error("Agent command failed:", err);
      const errMsg = err?.message || "連線或處理失敗";
      setToast({ visible: true, message: `處理失敗: ${errMsg}` });
      setAgentMessages((prev) => [...prev, { role: "assistant", content: `❌ 處理失敗: ${errMsg}` }]);
    } finally {
      setIsAgentThinking(false);
    }
  }

  async function handleCopy(item: VaultItem) {
    const response = await fetchVaultSecret(item);
    await navigator.clipboard.writeText(response.secret);
    setCopiedId(item.id);
    window.setTimeout(() => setCopiedId((current) => (current === item.id ? null : current)), 2000);
  }

  async function handleCreateVaultItem(e: React.FormEvent) {
    e.preventDefault();
    if (!newVaultItem.site || (editingVaultId === null && !newVaultItem.secret)) return;
    
    try {
      if (editingVaultId !== null) {
        await updateVaultItem(editingVaultId, newVaultItem);
        setToast({ visible: true, message: `已更新 ${newVaultItem.site} 的資料` });
      } else {
        await createVaultItem(newVaultItem);
        setToast({ visible: true, message: `已新增 ${newVaultItem.site} 的密碼` });
      }
      
      const response = await fetchDashboardSnapshot();
      setData(response.data);
      if (view === "vault") {
        setVaultPage(0);
        setVaultRefreshTrigger((t) => t + 1);
      }
      setNewVaultItem({ site: "", username: "", secret: "" });
      setIsVaultModalOpen(false);
      setEditingVaultId(null);
    } catch (err: any) {
      alert(`儲存失敗: ${err.message}`);
    }
  }

  async function handleDeleteVaultItem(id: number, site: string) {
    if (!confirm(`確定要刪除 ${site} 的紀錄嗎？`)) return;
    try {
      await deleteVaultItem(id);
      const snapshot = await fetchDashboardSnapshot();
      setData(snapshot.data);
      if (view === "vault") {
        setVaultPage(0);
        setVaultRefreshTrigger((t) => t + 1);
      }
      setToast({ visible: true, message: `已刪除 ${site} 的紀錄` });
    } catch (err: any) {
      alert(`刪除失敗: ${err.message}`);
    }
  }

  async function handleDeleteAccountingTransaction(id: number) {
    if (!confirm("確定要刪除此外部記帳紀錄嗎？")) return;
    try {
      await deleteAccountingTransaction(id);
      const snapshot = await fetchDashboardSnapshot();
      setData(snapshot.data);
      if (view === "finance") {
        setExpensePage(0);
        setExpenseRefreshTrigger((t) => t + 1);
      }
      setToast({ visible: true, message: "外部記帳紀錄已刪除" });
    } catch (err: any) {
      alert(`刪除外部記帳失敗: ${err.message}`);
    }
  }

  async function handleSaveJournal(e: React.FormEvent) {
    e.preventDefault();
    if (!newJournalEntry.content) return;

    const tagsArray = newJournalEntry.tags.split(",").map((t) => t.trim()).filter((t) => t !== "");

    try {
      if (editingJournalId !== null) {
        await updateJournal(editingJournalId, { content: newJournalEntry.content, tags: tagsArray });
        setToast({ visible: true, message: "日記已更新" });
      } else {
        await createJournal({ content: newJournalEntry.content, tags: tagsArray });
        setToast({ visible: true, message: "日記已新增" });
      }
      const snapshot = await fetchDashboardSnapshot();
      setData(snapshot.data);
      if (view === "journal") {
        setJournalPage(0);
        setJournalRefreshTrigger((t) => t + 1);
      }
      setNewJournalEntry({ content: "", tags: "" });
      setIsJournalModalOpen(false);
      setEditingJournalId(null);
    } catch (err: any) {
      alert(`儲存失敗: ${err.message}`);
    }
  }

  function openNewJournal() {
    setNewJournalEntry({ content: "", tags: "" });
    setEditingJournalId(null);
    setIsJournalModalOpen(true);
  }

  function openEditJournal(entry: { id: number; content: string; tags: string[] }) {
    setNewJournalEntry({ content: entry.content, tags: entry.tags.join(", ") });
    setEditingJournalId(entry.id);
    setIsJournalModalOpen(true);
  }

  async function handleDeleteJournal(id: number) {
    if (!confirm("確定要刪除此日記嗎？")) return;
    try {
      await deleteJournal(id);
      const snapshot = await fetchDashboardSnapshot();
      setData(snapshot.data);
      if (view === "journal") {
        setJournalPage(0);
        setJournalRefreshTrigger((t) => t + 1);
      }
      setToast({ visible: true, message: "日記已刪除" });
    } catch (err: any) {
      alert(`刪除失敗: ${err.message}`);
    }
  }



  async function handleSaveExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!newExpenseEntry.amount || !newExpenseEntry.category) return;

    const entryToSave = {
      ...newExpenseEntry,
      date: localInputToUtcString(newExpenseEntry.date, user.timezone)
    };

    try {
      if (editingExpenseId !== null) {
        await updateExpense(editingExpenseId, entryToSave);
        setToast({ visible: true, message: "消費紀錄已更新" });
      } else {
        await createExpense(entryToSave);
        setToast({ visible: true, message: "消費紀錄已新增" });
      }

      const snapshot = await fetchDashboardSnapshot();
      setData(snapshot.data);
      if (view === "finance") {
        setExpensePage(0);
        setExpenseRefreshTrigger((t) => t + 1);
      }
      setNewExpenseEntry({ amount: 0, category: "", note: "", date: "" });
      setIsExpenseModalOpen(false);
      setEditingExpenseId(null);
    } catch (err: any) {
      alert(`儲存失敗: ${err.message}`);
    }
  }

  async function handleDeleteExpense(id: number) {
    if (!confirm("確定要刪除此消費紀錄嗎？")) return;
    try {
      await deleteExpense(id);
      const snapshot = await fetchDashboardSnapshot();
      setData(snapshot.data);
      if (view === "finance") {
        setExpensePage(0);
        setExpenseRefreshTrigger((t) => t + 1);
      }
      setToast({ visible: true, message: "消費紀錄已刪除" });
    } catch (err: any) {
      alert(`刪除失敗: ${err.message}`);
    }
  }

  function openEditExpense(entry: { id: number; amount: number; category: string; note: string; date: string }) {
    // Backend formats might be YYYY-MM-DD HH:mm or just YYYY-MM-DD.
    // We want the input to be YYYY-MM-DDTHH:mm.
    let formattedDate = entry.date.replace(' ', 'T');
    if (formattedDate.length === 10) {
      formattedDate += 'T00:00';
    } else if (formattedDate.length > 16) {
        formattedDate = formattedDate.slice(0, 16);
    }

    setNewExpenseEntry({ amount: entry.amount, category: entry.category, note: entry.note, date: formattedDate });
    setEditingExpenseId(entry.id);
    setIsExpenseModalOpen(true);
  }

  function openNewExpense() {
    const localISOTime = getCurrentLocalInputString(user.timezone, 'datetime-local');
    setNewExpenseEntry({ amount: 0, category: "", note: "", date: localISOTime });
    setEditingExpenseId(null);
    setIsExpenseModalOpen(true);
  }

  async function handleSaveAccounting(e: React.FormEvent) {
    e.preventDefault();
    const utcTransactionDate = localInputToUtcString(newAccountingEntry.transaction_date, user.timezone);
    const payload = { ...newAccountingEntry, transaction_date: utcTransactionDate };
    try {
      if (editingAccountingId !== null) {
        await updateAccountingTransaction(editingAccountingId, payload);
        setToast({ visible: true, message: "外部記帳紀錄已更新" });
      } else {
        await createAccountingTransaction(payload);
        setToast({ visible: true, message: "外部記帳紀錄已新增" });
      }
      const accountingRange = getAccountingMonthRangeUtc(financeMonth, user.timezone);
      setAccountingTransactions(await fetchAccountingTransactions(accountingRange));
      setIsAccountingModalOpen(false);
      setEditingAccountingId(null);
    } catch (err: any) {
      alert(`儲存失敗: ${err.message}`);
    }
  }

  function openNewAccounting() {
    setEditingAccountingId(null);
    setNewAccountingEntry({ transaction_date: getCurrentLocalInputString(user.timezone, 'datetime-local'), item_name: "", item_category_id: itemCategoryOptions[0]?.id || 1, payment_category_id: paymentCategoryOptions[0]?.id || 1, amount: 0, notes: "" });
    setIsAccountingModalOpen(true);
  }

  function openEditAccounting(entry: any) {
    setEditingAccountingId(entry.transaction_id);
    setNewAccountingEntry({
      transaction_date: toLocalInputString(entry.transaction_date || "", user.timezone, 'datetime-local'),
      item_name: entry.item_name || "",
      item_category_id: entry.item_category_id || 1,
      payment_category_id: entry.payment_category_id || 1,
      amount: entry.amount || 0,
      notes: entry.notes || ""
    });
    setIsAccountingModalOpen(true);
  }

  async function handleSaveHealth(e: React.FormEvent) {
    e.preventDefault();
    if (!newHealthEntry.sys || !newHealthEntry.dia) return;

    const entryToSave = {
      ...newHealthEntry,
      date: localInputToUtcString(newHealthEntry.date, user.timezone)
    };

    try {
      if (editingHealthId !== null) {
        await updateHealthRecord(editingHealthId as any, entryToSave);
        setToast({ visible: true, message: "健康紀錄已更新" });
      } else {
        await createHealthRecord(entryToSave);
        setToast({ visible: true, message: "健康紀錄已新增" });
      }

      const snapshot = await fetchDashboardSnapshot();
      setData(snapshot.data);
      if (view === "health") {
        setHealthPage(0);
        setHealthRefreshTrigger((t) => t + 1);
      }
      setNewHealthEntry({ sys: 120, dia: 80, hr: 72, weight: 0, date: "" });
      setIsHealthModalOpen(false);
      setEditingHealthId(null);
    } catch (err: any) {
      alert(`儲存失敗: ${err.message}`);
    }
  }

  async function handleDeleteHealth(id: number) {
    if (!confirm("確定要刪除此健康紀錄嗎？")) return;
    try {
      await deleteHealthRecord(id);
      const snapshot = await fetchDashboardSnapshot();
      setData(snapshot.data);
      if (view === "health") {
        setHealthPage(0);
        setHealthRefreshTrigger((t) => t + 1);
      }
      setToast({ visible: true, message: "健康紀錄已刪除" });
    } catch (err: any) {
      alert(`刪除失敗: ${err.message}`);
    }
  }

  function openEditHealth(entry: HealthEntry) {
    const formattedDate = toLocalInputString(entry.date, user.timezone, 'datetime-local');
    setNewHealthEntry({ sys: entry.sys, dia: entry.dia, hr: entry.hr, weight: entry.weight ?? 0, date: formattedDate });
    setEditingHealthId(entry.id);
    setIsHealthModalOpen(true);
  }

  function openNewHealth() {
    const today = getCurrentLocalInputString(user.timezone, 'datetime-local');
    setNewHealthEntry({ sys: 120, dia: 80, hr: 72, weight: 0, date: today });
    setEditingHealthId(null);
    setIsHealthModalOpen(true);
  }

  function openEditVault(item: VaultItem) {
    setNewVaultItem({ site: item.site, username: item.username, secret: "" });
    setEditingVaultId(item.id);
    setIsVaultModalOpen(true);
  }

  async function handleRefresh() {
    const snapshot = await fetchDashboardSnapshot();
    setData(snapshot.data);
    
    // Trigger re-fetches for all individual view modules, including external accounting-dev transactions
    setVaultRefreshTrigger((t) => t + 1);
    setJournalRefreshTrigger((t) => t + 1);
    setExpenseRefreshTrigger((t) => t + 1);
    setHealthRefreshTrigger((t) => t + 1);
    
    setToast({ visible: true, message: "資料已同步" });
  }

  async function handleLogout() {
    try {
      await logout();
    } catch (err) {
      console.error("Logout API failed:", err);
    } finally {
      setUser(defaultUser);
      setIsAuthenticated(false);
      setData(emptyState);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">L</div>
          <div>
            <h1>LifeOS</h1>
            <p>個人數位生活導航系統</p>
          </div>
        </div>

        <nav className="nav-list">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${view === item.id ? "active" : ""}`}
              onClick={() => setView(item.id)}
            >
              <span>{item.icon}</span>
              {item.title}
            </button>
          ))}
        </nav>

        {isAuthenticated && (
          <div className="profile-card">
            <div className="avatar">{user.name.slice(0, 1)}</div>
            <div>
              <strong>{user.name}</strong>
              <p>{user.email}</p>
            </div>
          </div>
        )}
        <div className="auth-actions">
          <button className="secondary-button auth-button auth-button-light" type="button" onClick={() => void handleLogout()}>
            Logout
          </button>
        </div>
      </aside>

      <main className="content-shell">
        <header className="topbar">
          <h2>{navItems.find((item) => item.id === view)?.title}</h2>
          <div style={{ display: "flex", gap: "12px", alignItems: "center", flex: 1, justifyContent: "flex-end" }}>
            <div className="agent-bar">
              <span className="agent-icon">🤖</span>
              <input
                value={prompt}
                disabled={isAgentThinking}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !isAgentThinking) void handlePromptSubmit();
                }}
                placeholder="LifeOS Agent: 輸入「剛花150吃午餐」、「血壓120/80」或「新增 GitHub 帳號 dev 密碼 xyz」..."
              />
              <button
                type="button"
                disabled={isAgentThinking}
                onClick={() => void handlePromptSubmit()}
                aria-label={isAgentThinking ? "AI 處理中" : "傳送給 AI 代理"}
              >
                {isAgentThinking ? "⏳" : "🚀"}
              </button>
            </div>
            <button className="icon-button" onClick={() => void handleRefresh()} title="同步資料" aria-label="同步資料">🔄</button>
          </div>
        </header>

        {isAgentChatOpen && (
          <div className="modal-overlay" onClick={handleCloseAgentChat}>
            <div className="panel modal-content" style={{ width: "min(640px, 95vw)", maxWidth: "min(640px, 95vw)", maxHeight: "80vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
              <div className="panel-header">
                <h4>LifeOS Agent 對話</h4>
                <button className="close-button" onClick={handleCloseAgentChat} aria-label="關閉">✕</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "16px", overflowY: "auto", flex: 1, paddingRight: "4px" }}>
                {agentMessages.map((m, idx) => (
                  <div key={idx} style={{ padding: "12px 16px", borderRadius: "16px", background: m.role === "user" ? "#e0f2fe" : "#f1f5f9", alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%" }}>
                    <div style={{ fontSize: "0.85em", fontWeight: "bold", color: m.role === "user" ? "#0284c7" : "#475569", marginBottom: "4px" }}>
                      {m.role === "user" ? "你" : "Agent"}
                    </div>
                    <div style={{ color: "#1e293b", wordBreak: "break-word", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{m.content}</div>
                  </div>
                ))}
                {isAgentThinking && (
                  <div style={{ padding: "12px 16px", borderRadius: "16px", background: "#f1f5f9", alignSelf: "flex-start", maxWidth: "85%", color: "#64748b" }}>
                    Agent 思考中...
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {lastAgentResponse && (
                <div style={{ marginTop: "12px", borderTop: "1px solid #e2e8f0", paddingTop: "12px" }}>
                  <button
                    onClick={() => setIsDebugOpen(!isDebugOpen)}
                    style={{
                      fontSize: "0.8em",
                      padding: "6px 12px",
                      background: "#f1f5f9",
                      color: "#475569",
                      border: "1px solid #cbd5e1",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontWeight: "bold",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    ⚙️ {isDebugOpen ? "隱藏工具調用偵錯" : "顯示工具調用偵錯"}
                    {lastAgentResponse.toolCalls && lastAgentResponse.toolCalls.length > 0 && (
                      <span style={{ background: "#0284c7", color: "#fff", borderRadius: "50%", padding: "2px 6px", fontSize: "0.85em" }}>
                        {lastAgentResponse.toolCalls.length}
                      </span>
                    )}
                  </button>
                  {isDebugOpen && (
                    <div style={{ marginTop: "10px", padding: "12px", background: "#f8fafc", borderRadius: "8px", border: "1px dashed #cbd5e1", fontSize: "0.85em", color: "#334155", overflowY: "auto", maxHeight: "220px", display: "flex", flexDirection: "column", gap: "10px" }}>
                      {lastAgentResponse.agentDebugError && (
                        <div style={{ color: "#b91c1c", fontWeight: "bold", whiteSpace: "pre-wrap", borderBottom: "1px solid #f1f5f9", paddingBottom: "6px" }}>
                          ❌ 外部連線錯誤：{lastAgentResponse.agentDebugError}
                        </div>
                      )}
                      
                      <div style={{ fontWeight: "bold", color: "#0284c7" }}>🛠️ 代理工具調用軌跡 (Tool Execution Log)</div>
                      
                      {lastAgentResponse.toolCalls && lastAgentResponse.toolCalls.length > 0 ? (
                        lastAgentResponse.toolCalls.map((call: any, idx: number) => (
                          <div key={idx} style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "8px 10px" }}>
                            <div style={{ fontWeight: "bold", color: "#0f766e", marginBottom: "4px" }}>
                              [{idx + 1}] Tool: <code style={{ background: "#f1f5f9", padding: "2px 4px", borderRadius: "4px" }}>{call.name}</code>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.9em" }}>
                              <div>
                                <strong>傳入參數 (Arguments):</strong>
                                <pre style={{ background: "#fafafa", padding: "6px", borderRadius: "4px", margin: "4px 0 0 0", overflowX: "auto" }}>
                                  {JSON.stringify(call.args, null, 2)}
                                </pre>
                              </div>
                              <div style={{ marginTop: "4px" }}>
                                <strong>回傳結果 (Result):</strong>
                                <pre style={{ background: "#fafafa", padding: "6px", borderRadius: "4px", margin: "4px 0 0 0", overflowX: "auto" }}>
                                  {JSON.stringify(call.result, null, 2)}
                                </pre>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div style={{ color: "#64748b", fontStyle: "italic" }}>此對話回合中 AI 代理直接完成了任務，未調用任何子工具。</div>
                      )}
                      
                      {lastAgentResponse.systemInstruction && (
                        <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "8px", marginTop: "4px" }}>
                          <div style={{ fontWeight: "bold", color: "#475569", marginBottom: "4px" }}>系統指令範本 (System Instruction):</div>
                          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", background: "#f1f5f9", padding: "8px", borderRadius: "4px", margin: 0, fontSize: "0.9em" }}>
                            {lastAgentResponse.systemInstruction}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}


              <div style={{ display: "flex", gap: "10px", marginTop: "16px", borderTop: "1px solid #e2e8f0", paddingTop: "12px" }}>
                <input
                  style={{
                    flex: 1,
                    padding: "10px 14px",
                    borderRadius: "12px",
                    border: "1px solid #cbd5e1",
                    outline: "none",
                    fontSize: "0.95em",
                  }}
                  value={prompt}
                  disabled={isAgentThinking}
                  onChange={(event) => setPrompt(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !isAgentThinking) void handlePromptSubmit();
                  }}
                  placeholder="輸入您的回覆或指令..."
                />
                <button
                  type="button"
                  style={{
                    padding: "10px 18px",
                    borderRadius: "12px",
                    background: "#0284c7",
                    color: "#ffffff",
                    border: "none",
                    cursor: prompt.trim() ? "pointer" : "not-allowed",
                    opacity: prompt.trim() ? 1 : 0.6,
                    fontWeight: "bold",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: "70px"
                  }}
                  disabled={isAgentThinking || !prompt.trim()}
                  onClick={() => void handlePromptSubmit()}
                >
                  {isAgentThinking ? "⏳" : "傳送"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className={`toast ${toast.visible ? "visible" : ""}`}>
          <span>✅</span>
          <div>
            <strong>AI 處理成功</strong>
            <p>{toast.message}</p>
          </div>
        </div>

        <div className="page-scroll">
          {view === "overview" && (
            <section className="page-section">
              <div className="hero-copy">
                <p className="eyebrow">您的數位生活導航</p>
                <h3>把消費、健康、日記與密碼集中在一個乾淨的日常工作台。</h3>
              </div>

              <div className="stats-grid">
                <StatCard title="本月支出" value={`NT$ ${financeTotal}`} accent="emerald" icon="💳" onClick={() => setView("finance")} />
                <StatCard title="最新血壓" value={latestHealth ? `${latestHealth.sys}/${latestHealth.dia}` : "--/--"} accent="rose" icon="❤️" onClick={() => setView("health")} />
                <StatCard title="日記篇數" value={`${data.journals.length}`} accent="blue" icon="📖" onClick={() => setView("journal")} />
                <StatCard title="安全密碼庫" value={`${data.vault.length}`} accent="amber" icon="🔐" onClick={() => setView("vault")} />
              </div>

              <div className="panel-grid panel-grid-two">
                <div className="panel">
                  <div className="panel-header">
                    <h4>本月消費結構</h4>
                    <span>AI 歸類</span>
                  </div>
                  <DonutChart groups={financeGroups} />
                </div>
                <div className="panel">
                  <div className="panel-header">
                    <h4>近期日記與心情</h4>
                    <span>最近 3 則</span>
                  </div>
                  <div className="journal-stack">
                    {data.journals.slice(0, 3).map((entry) => (
                      <JournalCard key={entry.id} entry={entry} compact timezone={user.timezone} />
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {view === "finance" && (
            <section className="page-section">
              <SectionHeading
                title="生活消費記錄 (Finance)"
                description="透過 AI 自動歸類的消費數據分析。"
                action={
                  <div style={{display:"flex",gap:"0.5rem", alignItems:"center"}}>
                    <input
                      type="month"
                      value={financeMonth}
                      onChange={e => setFinanceMonth(e.target.value)}
                      style={{ padding: "0.5rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1" }}
                    />
                    <button className="icon-button" onClick={openNewExpense} title="新增消費" aria-label="新增消費">💳</button>
                    <button className="icon-button" onClick={openNewAccounting} title="新增外部記帳" aria-label="新增外部記帳">🏦</button>
                  </div>
                }
              />
              <div className="panel-grid finance-layout">
                <div className="panel">
                  <div className="panel-header">
                    <h4>支出分佈</h4>
                  </div>
                  <DonutChart groups={financeGroups} />
                </div>
                <div className="panel">
                  <div className="panel-header">
                    <h4>交易明細</h4>
                  </div>
                  <div className="list-wrap" style={{ display: 'block', width: '100%' }}>
                    {allTransactions.length > 0 ? (
                      <List
                        height={400}
                        itemCount={allTransactions.length}
                        itemSize={70}
                        width="100%"
                        itemData={{
                          items: allTransactions,
                          timezone: user.timezone,
                          openEditExpense,
                          openEditAccounting,
                          handleDeleteExpense,
                          handleDeleteAccountingTransaction
                        }}
                      >
                        {FinanceRow}
                      </List>
                    ) : (
                      <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>尚無資料</div>
                    )}
                  </div>
                  {hasMoreExpenses && (
                    <div style={{ textAlign: "center", marginTop: "1rem", paddingBottom: "1rem" }}>
                      <button
                        className="secondary-button"
                        onClick={() => setExpensePage(p => p + 1)}
                        disabled={isLoadingExpenses}
                      >
                        {isLoadingExpenses ? "載入中..." : "載入更多"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {view === "journal" && (
            <section className="page-section">
              <SectionHeading
                title="隨手日記 (Journal)"
                description="記錄日常瑣事與靈感。"
                action={<button className="primary-button" onClick={openNewJournal}>+ 新增日記</button>}
              />
              <div className="card-grid">
                {journalList.map((entry) => (
                  <JournalCard key={entry.id} entry={entry} onClick={() => openEditJournal(entry)} onDelete={(e) => { e.stopPropagation(); handleDeleteJournal(entry.id); }} timezone={user.timezone} />
                ))}
              </div>
              {hasMoreJournals && (
                <div style={{ textAlign: "center", marginTop: "1rem" }}>
                  <button
                    className="secondary-button"
                    onClick={() => setJournalPage(p => p + 1)}
                    disabled={isLoadingJournals}
                  >
                    {isLoadingJournals ? "載入中..." : "載入更多"}
                  </button>
                </div>
              )}
            </section>
          )}

          {view === "health" && (
            <section className="page-section">
              <SectionHeading
                title="生理資訊 (Health)"
                description="統整血壓、心跳與體重趨勢。"
                action={<button className="primary-button" onClick={openNewHealth}>+ 新增紀錄</button>}
              />
              <div className="panel">
                <div className="panel-header">
                  <h4>血壓與心跳趨勢分析</h4>
                  <span>最近 7 次紀錄</span>
                </div>
                <HealthChart entries={[...data.health.slice(0, 7)].reverse()} timezone={user.timezone} />
              </div>
              <div className="stats-grid health-grid">
                <MetricCard title="平均收縮壓" value={`${healthStats.avgSys}`} accent="rose" icon="💓" />
                <MetricCard title="平均舒張壓" value={`${healthStats.avgDia}`} accent="orange" icon="🩸" />
                <MetricCard title="平均心跳" value={`${healthStats.avgHr}`} accent="blue" icon="⏱️" />
              </div>
              <div className="panel" style={{ marginTop: "1rem" }}>
                <div className="panel-header">
                  <h4>健康紀錄</h4>
                </div>
                <div className="table-wrap" style={{ display: 'block' }}>
                  {healthList.length > 0 ? (() => {
                    const HealthRow = ({ index, style }: { index: number, style: React.CSSProperties }) => {
                      const item = healthList[index];
                      return (
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => openEditHealth(item)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              openEditHealth(item);
                            }
                          }}
                          style={{ ...style, display: 'flex', alignItems: 'center', padding: '0 12px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}>
                          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <div style={{ color: '#64748b', fontSize: '0.8rem', marginBottom: '4px' }}>
                              {toLocalDisplayTime(item.date, user.timezone)}
                            </div>
                            <div style={{ display: 'flex', gap: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.9rem', color: '#334155' }}>
                              <span>血壓: {item.sys}/{item.dia}</span>
                              <span>心跳: {item.hr}</span>
                              <span>體重: {item.weight ?? "-"}</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                            <div className="table-actions">
                              <button className="icon-button danger" onClick={(e) => { e.stopPropagation(); handleDeleteHealth(item.id); }} title="刪除" aria-label="刪除健康紀錄">🗑️</button>
                            </div>
                          </div>
                        </div>
                      );
                    };
                    return (
                      <List
                        height={400}
                        itemCount={healthList.length}
                        itemSize={70}
                        width="100%"
                      >
                        {HealthRow}
                      </List>
                    );
                  })() : (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>尚無資料</div>
                  )}
                </div>
                {hasMoreHealth && (
                  <div style={{ textAlign: "center", marginTop: "1rem", paddingBottom: "1rem" }}>
                    <button
                      className="secondary-button"
                      onClick={() => setHealthPage(p => p + 1)}
                      disabled={isLoadingHealth}
                    >
                      {isLoadingHealth ? "載入中..." : "載入更多"}
                    </button>
                  </div>
                )}
              </div>
            </section>
          )}

          {view === "vault" && (
            <section className="page-section">
              <SectionHeading
                title="簡易密碼管理 (Vault)"
                description="安全加密的密碼庫。"
              />
              <div className="panel">
                <div className="vault-toolbar">
                  <label className="search-field">
                    <span>🔍</span>
                    <input
                      value={vaultQuery}
                      onChange={(event) => { setVaultQuery(event.target.value); setVaultPage(0); }}
                      placeholder="搜尋站點名稱..."
                    />
                  </label>
                  <button className="secondary-button" type="button" onClick={() => {
                    setEditingVaultId(null);
                    setNewVaultItem({ site: "", username: "", secret: "" });
                    setIsVaultModalOpen(true);
                  }}>新增密碼</button>
                </div>
                <div className="card-grid vault-grid">
                  {vaultList.map((item) => (
                    <div className="vault-card" key={item.id}>
                      <div className="vault-header">
                        <div className="vault-logo">🌐</div>
                        <div style={{ flex: 1 }}>
                          <strong>{item.site}</strong>
                          <p>{item.username}</p>
                        </div>
                        <div className="vault-actions">
                          <button className="icon-button" title="編輯" aria-label={`編輯 ${item.site}`} onClick={() => openEditVault(item)}>✏️</button>
                          <button className="icon-button" title="刪除" aria-label={`刪除 ${item.site}`} onClick={() => handleDeleteVaultItem(item.id, item.site)}>🗑️</button>
                        </div>
                      </div>
                      <div className="secret-row">
                        <code>{copiedId === item.id ? "已複製到剪貼簿" : "••••••••"}</code>
                        <button type="button" aria-label={`複製 ${item.site} 密碼`} onClick={() => void handleCopy(item)}>
                          {copiedId === item.id ? "已複製" : "📋"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {hasMoreVault && (
                  <div style={{ textAlign: "center", marginTop: "1rem", paddingBottom: "1rem" }}>
                    <button
                      className="secondary-button"
                      onClick={() => setVaultPage(p => p + 1)}
                      disabled={isLoadingVault}
                    >
                      {isLoadingVault ? "載入中..." : "載入更多"}
                    </button>
                  </div>
                )}
              </div>
            </section>
          )}

          {view === "settings" && (
            <section className="page-section">
              <SectionHeading
                title="系統設定 (Settings)"
                description="管理您的 API Keys 以便在 CLI 或第三方工具中使用 LifeOS。"
              />
              

              <div className="panel" style={{ marginBottom: "2rem" }}>
                <div className="panel-header">
                  <h4>時間設定</h4>
                  <p className="text-sm text-slate-500">選擇您所在的時區，確保所有時間顯示與您的當地時間一致。</p>
                </div>
                <div className="settings-content" style={{ marginTop: "1.5rem" }}>
                  <div className="form-group" style={{ maxWidth: "300px" }}>
                    <label>時區 (Timezone)</label>
                    <select
                      value={user.timezone}
                      onChange={async (e) => {
                        const newTz = e.target.value;
                        setUser({ ...user, timezone: newTz });
                        try {
                          await updateUserProfile(newTz);
                          setToast({ visible: true, message: "時區已更新" });
                        } catch(err) {
                          setToast({ visible: true, message: "時區更新重試失敗" });
                        }
                      }}
                      className="input-field"
                      style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #cbd5e1" }}
                    >
                      <option value="UTC">UTC</option>
                      <option value="Asia/Taipei">Asia/Taipei (UTC+8)</option>
                      <option value="America/New_York">America/New_York</option>
                      <option value="America/Los_Angeles">America/Los_Angeles</option>
                      <option value="Europe/London">Europe/London</option>
                      <option value="Europe/Paris">Europe/Paris</option>
                      <option value="Asia/Tokyo">Asia/Tokyo (UTC+9)</option>
                      <option value="Australia/Sydney">Australia/Sydney</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="panel" style={{ marginBottom: "2rem" }}>
                <div className="panel-header"><h4>外部記帳設定</h4><p className="text-sm text-slate-500">設定 accounting API 使用的 user id。</p></div>
                <div className="settings-content" style={{ marginTop: "1rem", maxWidth: "300px" }}>
                  <label>Accounting User ID</label>
                  <input className="input-field" value={accountingUserId} onChange={(e)=>setAccountingUserId(e.target.value)} />
                  <button className="secondary-button" style={{marginTop:"0.5rem"}} onClick={()=>{window.localStorage.setItem("lifeos-accounting-user-id", accountingUserId || "1"); setToast({visible:true,message:"Accounting user id 已儲存"});}}>儲存</button>
                </div>
              </div>
              <div className="panel">
                <div className="panel-header">
                  <h4>API Key 管理</h4>
                  <p className="text-sm text-slate-500">這些金鑰允許對您的 LifeOS 數據進行程式化存取。請妥善保管。</p>
                </div>
                
                <div className="settings-content" style={{ marginTop: "1.5rem" }}>
                  <form onSubmit={handleCreateKey} className="inline-form" style={{ display: "flex", gap: "1rem", marginBottom: "2rem" }}>
                    <input 
                      className="flex-1"
                      value={newKeyName}
                      onChange={e => setNewKeyName(e.target.value)}
                      placeholder="給這把金鑰一個名稱 (例如: Home PC CLI)" 
                    />
                    <button type="submit" className="primary-button">建立新金鑰</button>
                  </form>

                  <div className="table-wrap">
                    <table className="api-keys-table">
                      <thead>
                        <tr>
                          <th>名稱</th>
                          <th>ID</th>
                          <th>建立日期</th>
                          <th className="align-right">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {apiKeys.length === 0 ? (
                          <tr>
                            <td colSpan={4} style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>尚未建立任何 API Key</td>
                          </tr>
                        ) : (
                          apiKeys.map(key => (
                            <tr key={key.id}>
                              <td><strong>{key.name}</strong></td>
                              <td><code style={{ fontSize: "12px" }}>{key.id}</code></td>
                              <td>{new Date(key.createdAt).toLocaleDateString()}</td>
                              <td className="align-right" style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                                <button
                                  className="text-button"
                                  onClick={() => handleUpdateKey(key.id, key.name)}
                                  style={{ fontSize: "14px", fontWeight: "600" }}
                                >
                                  修改
                                </button>
                                <button 
                                  className="text-button danger" 
                                  onClick={() => handleDeleteKey(key.id)}
                                  style={{ color: "#ef4444", fontSize: "14px", fontWeight: "600" }}
                                >
                                  刪除
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>

        <nav className="mobile-nav">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`mobile-nav-item ${view === item.id ? "active" : ""}`}
              onClick={() => setView(item.id)}
            >
              <span>{item.icon}</span>
              <small>{item.mobile}</small>
            </button>
          ))}
          <button
            className="mobile-nav-item"
            style={{ color: "#ef4444" }}
            onClick={() => void handleLogout()}
          >
            <span>🚪</span>
            <small>登出</small>
          </button>
        </nav>
      </main>

      {isVaultModalOpen && (
        <div className="modal-overlay">
          <div className="panel modal-content">
            <div className="panel-header">
              <h4>{editingVaultId ? "編輯密碼紀錄" : "新增密碼紀錄"}</h4>
              <button className="close-button" aria-label="關閉" onClick={() => setIsVaultModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateVaultItem} className="modal-form">
              <div className="form-group">
                <label>站點名稱</label>
                <input 
                  required 
                  value={newVaultItem.site} 
                  onChange={e => setNewVaultItem({...newVaultItem, site: e.target.value})}
                  placeholder="例如: GitHub, Facebook" 
                />
              </div>
              <div className="form-group">
                <label>使用者名稱 / Email</label>
                <input 
                  required 
                  value={newVaultItem.username} 
                  onChange={e => setNewVaultItem({...newVaultItem, username: e.target.value})}
                  placeholder="您的帳號" 
                />
              </div>
              <div className="form-group">
                <label>密碼 {editingVaultId && "(留空則不更動)"}</label>
                <input 
                  required={!editingVaultId}
                  type="password"
                  value={newVaultItem.secret} 
                  onChange={e => setNewVaultItem({...newVaultItem, secret: e.target.value})}
                  placeholder={editingVaultId ? "新密碼 (若不修改請留空)" : "密碼明文 (存入後將加密)"} 
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setIsVaultModalOpen(false)}>取消</button>
                <button type="submit" className="primary-button">{editingVaultId ? "更新紀錄" : "儲存密碼"}</button>
              </div>
            </form>
          </div>
        </div>
      )}


      {isJournalModalOpen && (
        <div className="modal-overlay">
          <div className="panel modal-content">
            <div className="panel-header">
              <h4>{editingJournalId ? "編輯日記" : "新增日記"}</h4>
              <button className="close-button" aria-label="關閉" onClick={() => setIsJournalModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveJournal} className="modal-form">
              <div className="form-group">
                <label>日記內容</label>
                <textarea
                  required
                  aria-label="日記內容"
                  value={newJournalEntry.content}
                  onChange={(e) => setNewJournalEntry({ ...newJournalEntry, content: e.target.value })}
                  placeholder="今天有什麼新鮮事？寫下你的想法..."
                  rows={4}
                />
              </div>
              <div className="form-group">
                <label>標籤 (用逗號分隔)</label>
                <input
                  type="text"
                  aria-label="日記標籤"
                  value={newJournalEntry.tags}
                  onChange={(e) => setNewJournalEntry({ ...newJournalEntry, tags: e.target.value })}
                  placeholder="例如: 工作, 想法"
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setIsJournalModalOpen(false)}>取消</button>
                <button type="submit" className="primary-button">{editingJournalId ? "更新日記" : "新增日記"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isExpenseModalOpen && (
        <div className="modal-overlay">
          <div className="panel modal-content">
            <div className="panel-header">
              <h4>{editingExpenseId ? "編輯消費" : "新增消費"}</h4>
              <button className="close-button" aria-label="關閉" onClick={() => setIsExpenseModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveExpense} className="modal-form">
              <div className="form-group">
                <label>金額</label>
                <input 
                  type="number"
                  required 
                  value={newExpenseEntry.amount} 
                  onChange={e => setNewExpenseEntry({...newExpenseEntry, amount: Number(e.target.value)})}
                  onFocus={e => e.target.select()}
                  placeholder="NT$ 金額"
                />
              </div>
              <div className="form-group">
                <label>類別</label>
                <input 
                  required 
                  value={newExpenseEntry.category} 
                  onChange={e => setNewExpenseEntry({...newExpenseEntry, category: e.target.value})}
                  placeholder="例如: 午餐, 交通"
                />
              </div>
              <div className="form-group">
                <label>日期與時間</label>
                <input 
                  type="datetime-local"
                  required 
                  value={newExpenseEntry.date} 
                  onChange={e => setNewExpenseEntry({...newExpenseEntry, date: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>備註</label>
                <input 
                  value={newExpenseEntry.note} 
                  onChange={e => setNewExpenseEntry({...newExpenseEntry, note: e.target.value})}
                  placeholder="選填"
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setIsExpenseModalOpen(false)}>取消</button>
                <button type="submit" className="primary-button">{editingExpenseId ? "更新消費" : "儲存消費"}</button>
              </div>
            </form>
          </div>
        </div>
      )}


      {isAccountingModalOpen && (
        <div className="modal-overlay">
          <div className="panel modal-content">
            <div className="panel-header">
              <h4>{editingAccountingId ? "編輯外部記帳" : "新增外部記帳"}</h4>
              <button className="close-button" aria-label="關閉" onClick={() => setIsAccountingModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveAccounting} className="modal-form">
              <div className="form-group">
                <label>品項</label>
                <input
                  required
                  value={newAccountingEntry.item_name}
                  onChange={e => setNewAccountingEntry({ ...newAccountingEntry, item_name: e.target.value })}
                  onFocus={e => e.target.select()}
                  onClick={e => e.currentTarget.select()}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>金額</label>
                  <input
                    type="number"
                    required
                    value={newAccountingEntry.amount}
                    onChange={e => setNewAccountingEntry({ ...newAccountingEntry, amount: Number(e.target.value) })}
                    onFocus={e => e.target.select()}
                    onClick={e => e.currentTarget.select()}
                  />
                </div>
                <div className="form-group">
                  <label>日期</label>
                  <input
                    type="datetime-local"
                    required
                    value={newAccountingEntry.transaction_date}
                    onChange={e => setNewAccountingEntry({ ...newAccountingEntry, transaction_date: e.target.value })}
                    onFocus={e => e.target.select()}
                    onClick={e => e.currentTarget.select()}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>項目類別</label>
                  <select
                    required
                    value={newAccountingEntry.item_category_id}
                    onChange={e => setNewAccountingEntry({ ...newAccountingEntry, item_category_id: Number(e.target.value) })}
                  >
                    {itemCategoryOptions.length > 0 ? itemCategoryOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>) : <option value={newAccountingEntry.item_category_id}>{newAccountingEntry.item_category_id}</option>}
                  </select>
                </div>
                <div className="form-group">
                  <label>支付類別</label>
                  <select
                    required
                    value={newAccountingEntry.payment_category_id}
                    onChange={e => setNewAccountingEntry({ ...newAccountingEntry, payment_category_id: Number(e.target.value) })}
                  >
                    {paymentCategoryOptions.length > 0 ? paymentCategoryOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>) : <option value={newAccountingEntry.payment_category_id}>{newAccountingEntry.payment_category_id}</option>}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>備註</label>
                <input
                  value={newAccountingEntry.notes}
                  onChange={e => setNewAccountingEntry({ ...newAccountingEntry, notes: e.target.value })}
                  onFocus={e => e.target.select()}
                  onClick={e => e.currentTarget.select()}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setIsAccountingModalOpen(false)}>取消</button>
                <button type="submit" className="primary-button">儲存</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {isHealthModalOpen && (
        <div className="modal-overlay">
          <div className="panel modal-content">
            <div className="panel-header">
              <h4>{editingHealthId ? "編輯健康紀錄" : "新增健康紀錄"}</h4>
              <button className="close-button" aria-label="關閉" onClick={() => setIsHealthModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveHealth} className="modal-form">
              <div className="form-group">
                <label>日期與時間</label>
                <input 
                  type="datetime-local"
                  required 
                  value={newHealthEntry.date} 
                  onChange={e => setNewHealthEntry({...newHealthEntry, date: e.target.value})}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>收縮壓 (sys)</label>
                  <input 
                    type="number"
                    required 
                    value={newHealthEntry.sys} 
                    onChange={e => setNewHealthEntry({...newHealthEntry, sys: Number(e.target.value)})}
                    onFocus={e => e.target.select()}
                    placeholder="120"
                  />
                </div>
                <div className="form-group">
                  <label>舒張壓 (dia)</label>
                  <input 
                    type="number"
                    required 
                    value={newHealthEntry.dia} 
                    onChange={e => setNewHealthEntry({...newHealthEntry, dia: Number(e.target.value)})}
                    onFocus={e => e.target.select()}
                    placeholder="80"
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>心跳 (hr)</label>
                  <input 
                    type="number"
                    required 
                    value={newHealthEntry.hr} 
                    onChange={e => setNewHealthEntry({...newHealthEntry, hr: Number(e.target.value)})}
                    onFocus={e => e.target.select()}
                    placeholder="72"
                  />
                </div>
                <div className="form-group">
                  <label>體重 (kg)</label>
                  <input 
                    type="number"
                    step="0.1"
                    value={newHealthEntry.weight || ""} 
                    onChange={e => setNewHealthEntry({...newHealthEntry, weight: e.target.value ? Number(e.target.value) : 0})}
                    onFocus={e => e.target.select()}
                    placeholder="選填"
                  />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setIsHealthModalOpen(false)}>取消</button>
                <button type="submit" className="primary-button">{editingHealthId ? "更新紀錄" : "儲存紀錄"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {newKeyValue && (
        <div className="modal-overlay">
          <div className="panel modal-content" style={{ maxWidth: "500px" }}>
            <div className="panel-header">
              <h4 style={{ color: "#10b981" }}>金鑰建立成功！</h4>
            </div>
            <div className="modal-body" style={{ padding: "1.5rem 0" }}>
              <p style={{ fontSize: "14px", color: "#64748b", marginBottom: "1rem" }}>
                請<strong>立即複製</strong>這把金鑰。基於安全考量，它將不會再次顯示。
              </p>
              <div 
                className="key-display" 
                style={{ 
                  background: "#f1f5f9", 
                  padding: "1rem", 
                  borderRadius: "8px", 
                  fontFamily: "monospace", 
                  wordBreak: "break-all",
                  border: "1px solid #e2e8f0",
                  fontSize: "13px"
                }}
              >
                {newKeyValue}
              </div>
            </div>
            <div className="modal-actions">
              <button className="primary-button" onClick={() => setNewKeyValue(null)}>我知道了</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionHeading({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="section-heading">
      <div className="section-title">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

function StatCard({ title, value, accent, icon, onClick }: { title: string; value: string; accent: string; icon: string; onClick?: () => void }) {
  return (
    <article
      className="stat-card"
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      style={{ cursor: onClick ? "pointer" : "default" }}
    >
      <div className="stat-head">
        <p>{title}</p>
        <span className={`accent-${accent}`}>{icon}</span>
      </div>
      <strong>{value}</strong>
    </article>
  );
}

function MetricCard({ title, value, accent, icon }: { title: string; value: string; accent: string; icon: string }) {
  return (
    <article className="metric-card">
      <div className={`metric-icon accent-${accent}`}>{icon}</div>
      <div>
        <p>{title}</p>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function JournalCard({ entry, compact = false, onClick, onDelete, timezone }: { entry: { id: number; date: string; content: string; tags: string[] }; compact?: boolean; onClick?: () => void; onDelete?: (e: React.MouseEvent) => void; timezone: string }) {
  return (
    <article
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      className={`journal-card ${compact ? "compact" : ""}`}
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : "default" }}>
      <p className="journal-date">{toLocalDisplayTime(entry.date, timezone)}</p>
      <p className="journal-content">{entry.content}</p>
      <div className="tag-row">
        {entry.tags.map((tag) => (
          <span className="tag blue" key={tag}>
            #{tag}
          </span>
        ))}
      </div>
      {onDelete && (
        <div className="card-actions">
          <button className="icon-button danger" onClick={onDelete} title="刪除" aria-label="刪除日記">🗑️</button>
        </div>
      )}
    </article>
  );
}

function DonutChart({ groups }: { groups: Array<{ category: string; amount: number; color: string }> }) {
  const total = groups.reduce((sum, item) => sum + item.amount, 0);
  if (total === 0) return <div className="donut-layout">沒有數據</div>;
  
  const segments = groups.map((item, index) => {
    const previous = groups.slice(0, index).reduce((sum, current) => sum + current.amount, 0);
    return {
      ...item,
      start: (previous / total) * 100,
      size: (item.amount / total) * 100
    };
  });

  return (
    <div className="donut-layout">
      <div
        className="donut"
        style={{
          background: `conic-gradient(${segments
            .map((item) => `${item.color} ${item.start}% ${item.start + item.size}%`)
            .join(", ")})`
        }}
      >
        <div className="donut-hole">
          <strong>NT$ {total}</strong>
          <span>總支出</span>
        </div>
      </div>
      <div className="legend-list">
        {groups.map((item) => (
          <div className="legend-item" key={item.category}>
            <span className="legend-dot" style={{ backgroundColor: item.color }} />
            <div>
              <strong>{item.category}</strong>
              <p>NT$ {item.amount}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HealthChart({ entries, timezone }: { entries: HealthEntry[]; timezone: string }) {
  if (entries.length === 0) return <div>沒有健康數據</div>;
  const width = 780;
  const height = 280;
  const padding = 24;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const max = 150;
  const min = 50;

  function buildLine(values: number[]) {
    return values
      .map((value, index) => {
        const x = padding + (innerWidth / Math.max(values.length - 1, 1)) * index;
        const y = padding + ((max - value) / (max - min)) * innerHeight;
        return `${index === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
  }

  const sysLine = buildLine(entries.map((item) => item.sys));
  const diaLine = buildLine(entries.map((item) => item.dia));
  const hrLine = buildLine(entries.map((item) => item.hr));

  return (
    <div className="health-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Health trends">
        {[0, 1, 2, 3].map((step) => {
          const y = padding + (innerHeight / 3) * step;
          return <line key={step} x1={padding} y1={y} x2={width - padding} y2={y} className="chart-grid" />;
        })}
        <path d={sysLine} className="chart-line rose" />
        <path d={diaLine} className="chart-line orange" />
        <path d={hrLine} className="chart-line blue dashed" />
        {entries.map((entry, index) => {
          const x = padding + (innerWidth / Math.max(entries.length - 1, 1)) * index;
          return (
            <text key={toLocalDisplayDate(entry.date, timezone)} x={x} y={height - 6} textAnchor="middle" className="chart-label">
              {toLocalDisplayDate(entry.date, timezone)}
            </text>
          );
        })}
      </svg>
      <div className="legend-inline">
        <span><i className="swatch rose" />收縮壓</span>
        <span><i className="swatch orange" />舒張壓</span>
        <span><i className="swatch blue" />心跳</span>
      </div>
    </div>
  );
}

function getHealthStats(entries: HealthEntry[]) {
  if (!entries.length) return { avgSys: "--", avgDia: "--", avgHr: "--" };
  return {
    avgSys: Math.round(entries.reduce((sum, item) => sum + item.sys, 0) / entries.length),
    avgDia: Math.round(entries.reduce((sum, item) => sum + item.dia, 0) / entries.length),
    avgHr: Math.round(entries.reduce((sum, item) => sum + item.hr, 0) / entries.length)
  };
}

function groupFinance(items: { category: string; amount: number }[]) {
  const palette = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#7c3aed", "#ec4899", "#8b5cf6", "#14b8a6"];
  return Object.entries(
    items.reduce<Record<string, number>>((acc, item) => {
      acc[item.category] = (acc[item.category] ?? 0) + item.amount;
      return acc;
    }, {}),
  ).map(([category, amount], index) => ({
    category,
    amount,
    color: palette[index % palette.length],
  }));
}
