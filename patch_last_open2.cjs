const fs = require('fs');

const path = 'src/App.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/  function openEditJournal\(entry: \{ id: number; content: string; tags: string\[\] \}\) \{[\s\S]*?setIsJournalModalOpen\(true\);\n  \}\n/m, '');

fs.writeFileSync(path, content);
