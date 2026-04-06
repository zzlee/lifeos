import { useEffect, useMemo, useState } from "react";
import LoginPage from "./components/LoginPage";
import { fetchDashboardSnapshot, fetchSession, fetchVaultSecret, getGoogleLoginUrl, logout, sendAgentCommand } from "./lib/api";
import type { Expense, HealthEntry, JournalEntry, LifeOSState, UserProfile, VaultItem, ViewId } from "./lib/types";

const navItems: Array<{ id: ViewId; title: string; mobile: string; icon: string }> = [
  { id: "overview", title: "總覽面板", mobile: "總覽", icon: "🏠" },
  { id: "finance", title: "消費記錄", mobile: "消費", icon: "💳" },
  { id: "journal", title: "隨手日記", mobile: "日記", icon: "📖" },
  { id: "health", title: "生理資訊", mobile: "健康", icon: "❤️" },
  { id: "vault", title: "密碼管理", mobile: "密碼", icon: "🔐" }
];

type ToastState = { visible: boolean; message: string };

const emptyState: LifeOSState = { finance: [], journals: [], health: [], vault: [] };
const defaultUser: UserProfile = { id: "", email: "", name: "" };

export default function App() {
  const [view, setView] = useState<ViewId>("overview");
  const [data, setData] = useState<LifeOSState>(emptyState);
  const [user, setUser] = useState<UserProfile>(defaultUser);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [googleAuthEnabled, setGoogleAuthEnabled] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [toast, setToast] = useState<ToastState>({ visible: false, message: "" });
  const [vaultQuery, setVaultQuery] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  useEffect(() => {
    fetchSession().then((session) => {
      setUser(session.user ?? defaultUser);
      setIsAuthenticated(session.authenticated);
      setGoogleAuthEnabled(session.googleAuthEnabled);
    });
    fetchDashboardSnapshot().then((snapshot) => setData(snapshot.data));
  }, []);

  useEffect(() => {
    if (!toast.visible) return;
    const timer = window.setTimeout(() => setToast({ visible: false, message: "" }), 3000);
    return () => window.clearTimeout(timer);
  }, [toast.visible]);

  const financeTotal = useMemo(
    () => data.finance.reduce((sum, item) => sum + item.amount, 0),
    [data.finance],
  );

  const latestHealth = data.health[data.health.length - 1];
  const financeGroups = useMemo(() => groupFinance(data.finance), [data.finance]);
  const filteredVault = useMemo(
    () => data.vault.filter((item) => item.site.toLowerCase().includes(vaultQuery.toLowerCase())),
    [data.vault, vaultQuery],
  );

  const healthStats = useMemo(() => getHealthStats(data.health), [data.health]);

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  async function handlePromptSubmit() {
    const text = prompt.trim();
    if (!text) return;

    const response = await sendAgentCommand(text);
    const mutation = response.mutation;
    setData(response.data);
    setPrompt("");
    setToast({ visible: true, message: mutation.message });
  }

  async function handleCopy(item: VaultItem) {
    const response = await fetchVaultSecret(item);
    await navigator.clipboard.writeText(response.secret);
    setCopiedId(item.id);
    window.setTimeout(() => setCopiedId((current) => (current === item.id ? null : current)), 2000);
  }

  async function handleLogout() {
    const response = await logout();
    setUser(response.session.user ?? defaultUser);
    setIsAuthenticated(false);
    setGoogleAuthEnabled(response.session.googleAuthEnabled);
    const snapshot = await fetchDashboardSnapshot();
    setData(snapshot.data);
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
          <a className="secondary-button auth-button auth-link" href={getGoogleLoginUrl()}>
            Google Login
          </a>
          <button className="secondary-button auth-button auth-button-light" type="button" onClick={() => void handleLogout()}>
            Logout
          </button>
          <p className="auth-hint">{googleAuthEnabled ? "Google OAuth 已配置" : "Google OAuth 尚未配置"}</p>
        </div>
      </aside>

      <main className="content-shell">
        <header className="topbar">
          <h2>{navItems.find((item) => item.id === view)?.title}</h2>
          <div className="agent-bar">
            <span className="agent-icon">🤖</span>
            <input
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void handlePromptSubmit();
              }}
              placeholder="LifeOS Agent: 輸入「剛花150吃午餐」、「血壓120/80」或「新增 GitHub 帳號 dev 密碼 xyz」..."
            />
            <button type="button" onClick={() => void handlePromptSubmit()}>
              🚀
            </button>
          </div>
        </header>

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
                <p>
                  這個前端骨架依照 sample UI 建立，先以 mock data 驅動頁面與自然語言入口，後續可直接接上
                  Cloudflare Workers、D1 與 OAuth。
                </p>
              </div>

              <div className="stats-grid">
                <StatCard title="本月支出" value={`NT$ ${financeTotal}`} accent="emerald" icon="💳" />
                <StatCard title="最新血壓" value={latestHealth ? `${latestHealth.sys}/${latestHealth.dia}` : "--/--"} accent="rose" icon="❤️" />
                <StatCard title="日記篇數" value={`${data.journals.length}`} accent="blue" icon="📖" />
                <StatCard title="安全密碼庫" value={`${data.vault.length}`} accent="amber" icon="🔐" />
              </div>

              <div className="panel-grid panel-grid-two">
                <div className="panel">
                  <div className="panel-header">
                    <h4>本週消費結構</h4>
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
                      <JournalCard key={entry.id} entry={entry} compact />
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
                description="透過 AI 自動歸類的消費數據分析。此視圖保留 sample 的結構，但改成 React state 與可延伸的資料模型。"
              />
              <div className="panel-grid finance-layout">
                <div className="panel">
                  <div className="panel-header">
                    <h4>支出分佈</h4>
                    <span>近 5 筆</span>
                  </div>
                  <DonutChart groups={financeGroups} />
                </div>
                <div className="panel">
                  <div className="panel-header">
                    <h4>交易明細</h4>
                    <span>Cloudflare D1 Ready</span>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>日期</th>
                          <th>類別</th>
                          <th>備註</th>
                          <th className="align-right">金額</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.finance.map((item) => (
                          <tr key={item.id}>
                            <td>{item.date}</td>
                            <td><span className="tag neutral">{item.category}</span></td>
                            <td>{item.note}</td>
                            <td className="align-right strong">NT$ {item.amount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </section>
          )}

          {view === "journal" && (
            <section className="page-section">
              <SectionHeading
                title="隨手日記 (Journal)"
                description="記錄日常瑣事與靈感，前端先提供情緒標籤、卡片檢視與後續串接 AI 分析的欄位位置。"
              />
              <div className="card-grid">
                {data.journals.map((entry) => (
                  <JournalCard key={entry.id} entry={entry} />
                ))}
              </div>
            </section>
          )}

          {view === "health" && (
            <section className="page-section">
              <SectionHeading
                title="生理資訊 (Health)"
                description="統整血壓、心跳與體重趨勢。這裡先用原生 SVG 折線圖，不增加額外圖表依賴。"
              />
              <div className="panel">
                <div className="panel-header">
                  <h4>血壓與心跳趨勢分析</h4>
                  <span>最近 7 次紀錄</span>
                </div>
                <HealthChart entries={data.health} />
              </div>
              <div className="stats-grid health-grid">
                <MetricCard title="平均收縮壓" value={`${healthStats.avgSys}`} accent="rose" icon="💓" />
                <MetricCard title="平均舒張壓" value={`${healthStats.avgDia}`} accent="orange" icon="🩸" />
                <MetricCard title="平均心跳" value={`${healthStats.avgHr}`} accent="blue" icon="⏱️" />
              </div>
            </section>
          )}

          {view === "vault" && (
            <section className="page-section">
              <SectionHeading
                title="簡易密碼管理 (Vault)"
                description="保留 sample 的搜尋與快速複製體驗，資料欄位已對齊未來 Workers 端加密後的密碼庫模型。"
              />
              <div className="panel">
                <div className="vault-toolbar">
                  <label className="search-field">
                    <span>🔍</span>
                    <input
                      value={vaultQuery}
                      onChange={(event) => setVaultQuery(event.target.value)}
                      placeholder="搜尋站點名稱..."
                    />
                  </label>
                  <button className="secondary-button" type="button">新增密碼</button>
                </div>
                <div className="card-grid vault-grid">
                  {filteredVault.map((item) => (
                    <div className="vault-card" key={item.id}>
                      <div className="vault-header">
                        <div className="vault-logo">🌐</div>
                        <div>
                          <strong>{item.site}</strong>
                          <p>{item.username}</p>
                        </div>
                      </div>
                      <div className="secret-row">
                        <code>{copiedId === item.id ? "已複製到剪貼簿" : item.secret}</code>
                        <button type="button" onClick={() => void handleCopy(item)}>
                          {copiedId === item.id ? "已複製" : "📋"}
                        </button>
                      </div>
                    </div>
                  ))}
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
        </nav>
      </main>
    </div>
  );
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="section-heading">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

function StatCard({ title, value, accent, icon }: { title: string; value: string; accent: string; icon: string }) {
  return (
    <article className="stat-card">
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

function JournalCard({ entry, compact = false }: { entry: JournalEntry; compact?: boolean }) {
  return (
    <article className={`journal-card ${compact ? "compact" : ""}`}>
      <p className="journal-date">{entry.date}</p>
      <p className="journal-content">{entry.content}</p>
      <div className="tag-row">
        {entry.tags.map((tag) => (
          <span className="tag blue" key={tag}>
            #{tag}
          </span>
        ))}
      </div>
    </article>
  );
}

function DonutChart({ groups }: { groups: Array<{ category: string; amount: number; color: string }> }) {
  const total = groups.reduce((sum, item) => sum + item.amount, 0);
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

function HealthChart({ entries }: { entries: HealthEntry[] }) {
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
            <text key={entry.date} x={x} y={height - 6} textAnchor="middle" className="chart-label">
              {entry.date}
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

function groupFinance(items: Expense[]) {
  const palette = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#7c3aed"];
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
