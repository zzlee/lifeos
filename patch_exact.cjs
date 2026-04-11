const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

// The best way to not mess up formatting is exact string replace.

const target1 = `  const [isVaultModalOpen, setIsVaultModalOpen] = useState(false);
  const [editingVaultId, setEditingVaultId] = useState<number | null>(null);
  const [newVaultItem, setNewVaultItem] = useState({ site: "", username: "", secret: "" });

  const [isJournalModalOpen, setIsJournalModalOpen] = useState(false);
  const [editingJournalId, setEditingJournalId] = useState<number | null>(null);
  const [newJournalEntry, setNewJournalEntry] = useState({ content: "", tags: "" });`;

const replace1 = `  const [isVaultModalOpen, setIsVaultModalOpen] = useState(false);
  const [editingVaultId, setEditingVaultId] = useState<number | null>(null);
  const [newVaultItem, setNewVaultItem] = useState({ site: "", username: "", secret: "" });

  const [newInlineJournalEntry, setNewInlineJournalEntry] = useState({ content: "", tags: "" });`;

content = content.replace(target1, replace1);


const target2 = `  function openNewJournal() {
    setEditingJournalId(null);
    setNewJournalEntry({ content: "", tags: "" });
    setIsJournalModalOpen(true);
  }

  function openEditJournal(entry: any) {
    setEditingJournalId(entry.id);
    setNewJournalEntry({ content: entry.content, tags: entry.tags.join(", ") });
    setIsJournalModalOpen(true);
  }`;

content = content.replace(target2, "");


const target3 = `  async function handleSaveJournal(e: React.FormEvent) {
    e.preventDefault();
    if (!newJournalEntry.content) return;
    try {
      if (editingJournalId) {
        await updateJournal(editingJournalId, {
          content: newJournalEntry.content,
          tags: newJournalEntry.tags
            .split(",")
            .map((t) => t.trim())
            .filter((t) => t !== ""),
        });
        setToast({ visible: true, message: "日記已更新" });
      } else {
        await createJournal({
          content: newJournalEntry.content,
          tags: newJournalEntry.tags
            .split(",")
            .map((t) => t.trim())
            .filter((t) => t !== ""),
        });
        setToast({ visible: true, message: "日記已新增" });
      }
      const snapshot = await fetchDashboardSnapshot();
      setData(snapshot.data);
      setNewJournalEntry({ content: "", tags: "" });
      setIsJournalModalOpen(false);
      setEditingJournalId(null);
    } catch (err: any) {
      alert(\`儲存失敗: \${err.message}\`);
    }
  }`;

const replace3 = `  async function handleCreateJournal(e: React.FormEvent) {
    e.preventDefault();
    if (!newInlineJournalEntry.content) return;
    try {
      await createJournal({
        content: newInlineJournalEntry.content,
        tags: newInlineJournalEntry.tags.split(",").map((t) => t.trim()).filter((t) => t !== ""),
      });
      setToast({ visible: true, message: "日記已新增" });
      setNewInlineJournalEntry({ content: "", tags: "" });
      const snapshot = await fetchDashboardSnapshot();
      setData(snapshot.data);
    } catch (err: any) {
      alert(\`新增失敗: \${err.message}\`);
    }
  }

  async function handleUpdateJournal(id: number, content: string, tagsStr: string) {
    try {
      await updateJournal(id, {
        content: content,
        tags: tagsStr.split(",").map((t) => t.trim()).filter((t) => t !== ""),
      });
      setToast({ visible: true, message: "日記已更新" });
      const snapshot = await fetchDashboardSnapshot();
      setData(snapshot.data);
    } catch (err: any) {
      alert(\`更新失敗: \${err.message}\`);
    }
  }`;

content = content.replace(target3, replace3);


const target4 = `          {view === "journal" && (
            <section className="page-section">
              <SectionHeading
                title="隨手日記 (Journal)"
                description="記錄日常瑣事與靈感。"
                action={<button className="primary-button" onClick={openNewJournal}>+ 新增日記</button>}
              />
              <div className="card-grid">
                {data.journals.map((entry) => (
                  <JournalCard key={entry.id} entry={entry} onEdit={() => openEditJournal(entry)} onDelete={() => handleDeleteJournal(entry.id)} />
                ))}
              </div>
            </section>
          )}`;

const replace4 = `          {view === "journal" && (
            <section className="page-section">
              <SectionHeading
                title="隨手日記 (Journal)"
                description="記錄日常瑣事與靈感。"
              />
              <form onSubmit={handleCreateJournal} className="inline-journal-form panel" style={{ marginBottom: "20px" }}>
                <div className="form-group">
                  <textarea
                    required
                    value={newInlineJournalEntry.content}
                    onChange={(e) => setNewInlineJournalEntry({ ...newInlineJournalEntry, content: e.target.value })}
                    placeholder="寫下你的想法..."
                    rows={3}
                  />
                </div>
                <div className="form-group row" style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <input
                    style={{ flex: 1 }}
                    type="text"
                    value={newInlineJournalEntry.tags}
                    onChange={(e) => setNewInlineJournalEntry({ ...newInlineJournalEntry, tags: e.target.value })}
                    placeholder="標籤 (用逗號分隔)"
                  />
                  <button type="submit" className="primary-button">新增</button>
                </div>
              </form>
              <div className="card-grid">
                {data.journals.map((entry) => (
                  <JournalCard key={entry.id} entry={entry} onUpdate={(content, tags) => handleUpdateJournal(entry.id, content, tags)} onDelete={() => handleDeleteJournal(entry.id)} />
                ))}
              </div>
            </section>
          )}`;

content = content.replace(target4, replace4);


const target5 = `      {isJournalModalOpen && (
        <div className="modal-overlay">
          <div className="panel modal-content">
            <div className="panel-header">
              <h4>{editingJournalId ? "編輯日記" : "新增日記"}</h4>
              <button className="close-button" onClick={() => setIsJournalModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveJournal} className="modal-form">
              <div className="form-group">
                <label>內容</label>
                <textarea
                  required
                  value={newJournalEntry.content}
                  onChange={e => setNewJournalEntry({...newJournalEntry, content: e.target.value})}
                  placeholder="寫下你的想法..."
                  rows={5}
                />
              </div>
              <div className="form-group">
                <label>標籤 (用逗號分隔)</label>
                <input
                  type="text"
                  value={newJournalEntry.tags}
                  onChange={e => setNewJournalEntry({...newJournalEntry, tags: e.target.value})}
                  placeholder="例如: 工作, 靈感"
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setIsJournalModalOpen(false)}>取消</button>
                <button type="submit" className="primary-button">儲存</button>
              </div>
            </form>
          </div>
        </div>
      )}`;

content = content.replace(target5, "");


const target6 = `function JournalCard({ entry, compact = false, onEdit, onDelete }: { entry: { id: number; date: string; content: string; tags: string[] }; compact?: boolean; onEdit?: () => void; onDelete?: () => void }) {
  return (
    <article className={\`journal-card \${compact ? "compact" : ""}\`}>
      <p className="journal-date">{entry.date}</p>
      <p className="journal-content">{entry.content}</p>
      <div className="tag-row">
        {entry.tags.map((tag) => (
          <span className="tag blue" key={tag}>
            #{tag}
          </span>
        ))}
      </div>
      {(onEdit || onDelete) && (
        <div className="card-actions">
          {onEdit && <button className="icon-button" onClick={onEdit} title="編輯">✏️</button>}
          {onDelete && <button className="icon-button danger" onClick={onDelete} title="刪除">🗑️</button>}
        </div>
      )}
    </article>
  );
}`;

const replace6 = `function JournalCard({ entry, compact = false, onUpdate, onDelete }: { entry: { id: number; date: string; content: string; tags: string[] }; compact?: boolean; onUpdate?: (content: string, tags: string) => void; onDelete?: () => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(entry.content);
  const [editTags, setEditTags] = useState(entry.tags.join(", "));

  const handleSave = () => {
    if (onUpdate) {
      onUpdate(editContent, editTags);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditContent(entry.content);
    setEditTags(entry.tags.join(", "));
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <article className={\`journal-card \${compact ? "compact" : ""}\`}>
        <div className="form-group" style={{ marginBottom: "12px" }}>
          <textarea
            required
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={3}
            style={{ width: "100%", boxSizing: "border-box" }}
          />
        </div>
        <div className="form-group" style={{ marginBottom: "12px" }}>
          <input
            type="text"
            value={editTags}
            onChange={(e) => setEditTags(e.target.value)}
            placeholder="標籤 (用逗號分隔)"
            style={{ width: "100%", boxSizing: "border-box" }}
          />
        </div>
        <div className="card-actions" style={{ justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
          <button className="primary-button" onClick={handleSave} style={{ padding: "6px 12px", fontSize: "0.9rem" }}>儲存</button>
          <button className="secondary-button" onClick={handleCancel} style={{ padding: "6px 12px", fontSize: "0.9rem" }}>取消</button>
        </div>
      </article>
    );
  }

  return (
    <article className={\`journal-card \${compact ? "compact" : ""}\`}>
      <p className="journal-date">{entry.date}</p>
      <p className="journal-content">{entry.content}</p>
      <div className="tag-row">
        {entry.tags.map((tag) => (
          <span className="tag blue" key={tag}>
            #{tag}
          </span>
        ))}
      </div>
      {(onUpdate || onDelete) && (
        <div className="card-actions">
          {onUpdate && <button className="icon-button" onClick={() => setIsEditing(true)} title="編輯">✏️</button>}
          {onDelete && <button className="icon-button danger" onClick={onDelete} title="刪除">🗑️</button>}
        </div>
      )}
    </article>
  );
}`;

content = content.replace(target6, replace6);

fs.writeFileSync('src/App.tsx', content);
