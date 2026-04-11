const fs = require('fs');

const path = 'src/App.tsx';
let content = fs.readFileSync(path, 'utf8');

// The file contents didn't get patched because the regex or string replacements didn't find matches.
// We will replace with regular expressions with relaxed spacing.

// 1. replace state
content = content.replace(
  /  const \[isJournalModalOpen,\s*setIsJournalModalOpen\] = useState\(false\);\s*const \[editingJournalId,\s*setEditingJournalId\] = useState<number \| null>\(null\);\s*const \[newJournalEntry,\s*setNewJournalEntry\] = useState\(\{ content: "", tags: "" \}\);/m,
  '  const [newInlineJournalEntry, setNewInlineJournalEntry] = useState({ content: "", tags: "" });'
);

// 2. handleSaveJournal
const saveRegex = /  async function handleSaveJournal\(e: React\.FormEvent\) \{[\s\S]*?catch \(err: any\) \{\n\s*alert\(`儲存失敗: \$\{err\.message\}`\);\n\s*\}\n  \}/m;
const newHandlers = `  async function handleCreateJournal(e: React.FormEvent) {
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
content = content.replace(saveRegex, newHandlers);

// 3. openNewJournal and openEditJournal
content = content.replace(/  function openNewJournal\(\) \{[\s\S]*?setIsJournalModalOpen\(true\);\n  \}\n/m, '');
content = content.replace(/  function openEditJournal\(entry: any\) \{[\s\S]*?setIsJournalModalOpen\(true\);\n  \}\n/m, '');

// 4. Section mapping
const viewJournalRegex = /<SectionHeading\s*title="隨手日記 \(Journal\)"\s*description="記錄日常瑣事與靈感。"\s*action=\{<button className="primary-button" onClick=\{openNewJournal\}>\+ 新增日記<\/button>\}\s*\/>\s*<div className="card-grid">\s*\{data\.journals\.map\(\(entry\) => \(\s*<JournalCard key=\{entry\.id\} entry=\{entry\} onEdit=\{\(\) => openEditJournal\(entry\)\} onDelete=\{\(\) => handleDeleteJournal\(entry\.id\)\} \/>\s*\)\)\}\s*<\/div>/m;
const newViewJournal = `<SectionHeading
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
              </div>`;
content = content.replace(viewJournalRegex, newViewJournal);

// 5. Remove Modal
const modalRegex = /      \{isJournalModalOpen && \([\s\S]*?<div className="panel modal-content">[\s\S]*?<\/div>\n      \)\}\n/m;
content = content.replace(modalRegex, '');

// 6. JournalCard
const journalCardRegex = /function JournalCard\(\{ entry, compact = false, onEdit, onDelete \}: \{ entry: \{ id: number; date: string; content: string; tags: string\[\] \}; compact\?: boolean; onEdit\?: \(\) => void; onDelete\?: \(\) => void \}\) \{[\s\S]*?\}\n/m;
const newJournalCard = `function JournalCard({ entry, compact = false, onUpdate, onDelete }: { entry: { id: number; date: string; content: string; tags: string[] }; compact?: boolean; onUpdate?: (content: string, tags: string) => void; onDelete?: () => void }) {
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
}
`;
content = content.replace(journalCardRegex, newJournalCard);

fs.writeFileSync(path, content);
