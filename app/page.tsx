"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Understanding = 0 | 1 | 2 | 3;
type SortKey = "title" | "year" | "citations" | "priority" | "interest" | "understanding";
type ConnectionType = "shared_topic" | "depends_on" | "supports" | "contrasts" | "method" | "related";
type Paper = { id: string; title: string; year: number; citations: number; priority: number; authors: string[]; links: string[]; mainQuestions: string; mainResults: string; myQuestions: string; understanding: Understanding; interest: number; createdAt: string; updatedAt: string };
type Connection = { id: string; sourceId: string; targetId: string; type: ConnectionType; topics: string[]; note: string };
type LibraryState = { papers: Paper[]; connections: Connection[]; mutedCommonAuthors: string[] };
type VisualConnectionType = ConnectionType | "common_authors";
type VisualConnection = Omit<Connection, "type"> & { type: VisualConnectionType; automatic?: boolean };
type ConnectionBundle = { id: string; sourceId: string; targetId: string; connections: VisualConnection[] };

const levels: Record<Understanding, { name: string; short: string; color: string; description: string }> = {
  0: { name: "Reading queue", short: "Unread", color: "#8b8c89", description: "Saved for later" },
  1: { name: "First pass", short: "Skimmed", color: "#c86b4a", description: "Core idea is familiar" },
  2: { name: "Working knowledge", short: "Understood", color: "#bd8727", description: "Results and argument are clear" },
  3: { name: "Deep understanding", short: "Methods", color: "#397c5c", description: "Can explain the methods and details" },
};
const connectionLabels: Record<ConnectionType, string> = { shared_topic: "Common topics", depends_on: "Result dependencies", supports: "Supporting evidence", contrasts: "Contrasts & disagreements", method: "Methods & approaches", related: "Other relationships" };
const visualConnectionLabels: Record<VisualConnectionType, string> = { common_authors: "Common authors", ...connectionLabels };
const connectionColors: Record<VisualConnectionType, string> = { common_authors: "#8a949f", supports: "#24543d", depends_on: "#78a96f", shared_topic: "#2f6fb2", contrasts: "#b14b4b", method: "#725b96", related: "#596574" };
const connectionTypeOrder: VisualConnectionType[] = ["common_authors", "supports", "depends_on", "shared_topic", "contrasts", "method", "related"];

const seedState: LibraryState = {
  papers: ([
    { id: "paper-attention", title: "Attention Is All You Need", year: 2017, citations: 141216, authors: ["Ashish Vaswani", "Noam Shazeer", "Niki Parmar", "Jakob Uszkoreit", "Llion Jones", "Aidan N. Gomez", "Łukasz Kaiser", "Illia Polosukhin"], links: ["https://arxiv.org/abs/1706.03762"], mainQuestions: "Can sequence transduction dispense with recurrence and convolution entirely?", mainResults: "A self-attention-only architecture improves translation quality while training substantially faster.", myQuestions: "How much of the gain comes from architecture versus scale and training choices?", understanding: 3, interest: 94, createdAt: "2026-07-12T12:00:00.000Z", updatedAt: "2026-07-12T12:00:00.000Z" },
    { id: "paper-vit", title: "An Image is Worth 16×16 Words: Transformers for Image Recognition at Scale", year: 2020, citations: 44650, authors: ["Alexey Dosovitskiy", "Lucas Beyer", "Alexander Kolesnikov", "Dirk Weissenborn", "Xiaohua Zhai", "Thomas Unterthiner", "Mostafa Dehghani", "Matthias Minderer", "Georg Heigold", "Sylvain Gelly", "Jakob Uszkoreit", "Neil Houlsby"], links: ["https://arxiv.org/abs/2010.11929"], mainQuestions: "Can a standard Transformer work directly on image patches without convolution?", mainResults: "With large-scale pretraining, Vision Transformers match or exceed strong convolutional networks.", myQuestions: "What inductive biases matter most in low-data regimes?", understanding: 2, interest: 88, createdAt: "2026-07-13T12:00:00.000Z", updatedAt: "2026-07-13T12:00:00.000Z" },
    { id: "paper-lora", title: "LoRA: Low-Rank Adaptation of Large Language Models", year: 2021, citations: 23172, authors: ["Edward J. Hu", "Yelong Shen", "Phillip Wallis", "Zeyuan Allen-Zhu", "Yuanzhi Li", "Shean Wang", "Lu Wang", "Weizhu Chen"], links: ["https://arxiv.org/abs/2106.09685"], mainQuestions: "Can large pretrained models be adapted without updating or storing all parameters?", mainResults: "Low-rank updates reduce trainable parameters and memory while matching full fine-tuning on several tasks.", myQuestions: "How stable is the optimal rank across tasks and model families?", understanding: 1, interest: 76, createdAt: "2026-07-14T12:00:00.000Z", updatedAt: "2026-07-14T12:00:00.000Z" },
    { id: "paper-bert", title: "BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding", year: 2018, citations: 129815, authors: ["Jacob Devlin", "Ming-Wei Chang", "Kenton Lee", "Kristina Toutanova"], links: ["https://arxiv.org/abs/1810.04805"], mainQuestions: "How useful is deep bidirectional pretraining for language understanding?", mainResults: "Masked-language-model pretraining produces state-of-the-art results across a broad NLP benchmark suite.", myQuestions: "Revisit the ablation study after reading more recent masking objectives.", understanding: 0, interest: 69, createdAt: "2026-07-15T12:00:00.000Z", updatedAt: "2026-07-15T12:00:00.000Z" },
  ] as Array<Omit<Paper, "priority">>).map((paper, index) => ({ ...paper, priority: [5, 4, 4, 3][index] })),
  connections: [{ id: "connection-attention-vit", sourceId: "paper-vit", targetId: "paper-attention", type: "depends_on", topics: ["self-attention", "transformer architecture"], note: "ViT transfers the Transformer architecture from token sequences to fixed-size image patches." }],
  mutedCommonAuthors: [],
};

const emptyPaper = (): Omit<Paper, "id" | "createdAt" | "updatedAt"> => ({ title: "", year: new Date().getFullYear(), citations: 0, priority: 3, authors: [], links: [], mainQuestions: "", mainResults: "", myQuestions: "", understanding: 0, interest: 50 });
const newId = (prefix: string) => `${prefix}-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`}`;
function openLibraryDb(): Promise<IDBDatabase> { return new Promise((resolve, reject) => { const request = indexedDB.open("paper-ledger", 1); request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains("library")) request.result.createObjectStore("library"); }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
async function readLibrary(): Promise<LibraryState | undefined> { const db = await openLibraryDb(); return new Promise((resolve, reject) => { const request = db.transaction("library", "readonly").objectStore("library").get("state"); request.onsuccess = () => resolve(request.result as LibraryState | undefined); request.onerror = () => reject(request.error); }); }
async function writeLibrary(state: LibraryState) { const db = await openLibraryDb(); return new Promise<void>((resolve, reject) => { const tx = db.transaction("library", "readwrite"); tx.objectStore("library").put(state, "state"); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); }
function normalizeLibrary(state: LibraryState): LibraryState { return { ...state, papers: state.papers.map((paper) => ({ ...paper, priority: Math.min(5, Math.max(1, Math.round(Number(paper.priority) || 3))) })), mutedCommonAuthors: Array.isArray(state.mutedCommonAuthors) ? [...new Set(state.mutedCommonAuthors.map(normalizeAuthor).filter(Boolean))] : [] }; }
const normalizeAuthor = (author: string) => author.trim().toLocaleLowerCase();
function commonAuthors(a?: Paper, b?: Paper) { if (!a || !b) return []; const right = new Set(b.authors.map(normalizeAuthor)); return a.authors.filter((author) => right.has(normalizeAuthor(author))); }
const interestColor = (value: number) => `hsl(${Math.round(value * 1.18)}, 56%, 37%)`;
const priorityColor = (value: number) => ["", "#667085", "#2563eb", "#b7791f", "#d05a22", "#b42318"][value] ?? "#667085";
const priorityOpacity = (value: number) => Math.min(1, Math.max(0.4, 0.25 + value * 0.15));
const compactNumber = (value: number) => new Intl.NumberFormat("en", { notation: value >= 1000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);
function linkLabel(url: string) { try { return new URL(url).hostname.replace(/^www\./, "").replace("arxiv.org", "arXiv"); } catch { return "Link"; } }
function truncate(value: string, length = 118) { if (!value) return "—"; return value.length > length ? `${value.slice(0, length).trim()}…` : value; }

export default function Home() {
  const [library, setLibrary] = useState<LibraryState>(seedState);
  const [ready, setReady] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("priority");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [grouped, setGrouped] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [paperModal, setPaperModal] = useState<"add" | "edit" | null>(null);
  const [connectionModal, setConnectionModal] = useState<"add" | "edit" | null>(null);
  const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [authorLinesModal, setAuthorLinesModal] = useState(false);
  const [paperDraft, setPaperDraft] = useState(emptyPaper());
  const [authorDraft, setAuthorDraft] = useState("");
  const [linkDraft, setLinkDraft] = useState("");
  const [connectionDraft, setConnectionDraft] = useState<{ targetId: string; type: ConnectionType; topics: string; note: string }>({ targetId: "", type: "shared_topic", topics: "", note: "" });
  const importRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const ledgerRef = useRef<HTMLElement>(null);

  useEffect(() => { readLibrary().then((stored) => { if (stored) setLibrary(normalizeLibrary(stored)); else return writeLibrary(seedState); }).catch(() => setSaveState("error")).finally(() => setReady(true)); }, []);
  useEffect(() => { if (!ready) return; setSaveState("saving"); const timer = window.setTimeout(() => { writeLibrary(library).then(() => setSaveState("saved")).catch(() => setSaveState("error")); }, 180); return () => window.clearTimeout(timer); }, [library, ready]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { if (authorLinesModal) setAuthorLinesModal(false); else if (connectionModal) setConnectionModal(null); else if (paperModal) setPaperModal(null); else if (selectedConnectionId) setSelectedConnectionId(null); else setSelectedId(null); }
      if (event.key === "/" && !paperModal && !connectionModal && !authorLinesModal && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") { event.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [paperModal, connectionModal, authorLinesModal, selectedConnectionId]);

  const selected = library.papers.find((paper) => paper.id === selectedId);
  const filtered = useMemo(() => { const term = query.trim().toLocaleLowerCase(); if (!term) return library.papers; return library.papers.filter((paper) => [paper.title, paper.authors.join(" "), paper.mainQuestions, paper.mainResults, paper.myQuestions].join(" ").toLocaleLowerCase().includes(term)); }, [library.papers, query]);
  const sorted = useMemo(() => [...filtered].sort((a, b) => { const left = sortKey === "title" ? a.title.toLocaleLowerCase() : a[sortKey]; const right = sortKey === "title" ? b.title.toLocaleLowerCase() : b[sortKey]; const result = left < right ? -1 : left > right ? 1 : 0; return sortDirection === "asc" ? result : -result; }), [filtered, sortKey, sortDirection]);
  const displayedGroups = useMemo(() => { if (!grouped) return [{ level: null as Understanding | null, papers: sorted }]; const order: Understanding[] = sortKey === "understanding" && sortDirection === "asc" ? [0, 1, 2, 3] : [3, 2, 1, 0]; return order.map((level) => ({ level, papers: sorted.filter((paper) => paper.understanding === level) })); }, [grouped, sorted, sortKey, sortDirection]);
  const selectedConnections = useMemo(() => selected ? library.connections.filter((item) => item.sourceId === selected.id || item.targetId === selected.id) : [], [selected, library.connections]);
  const automaticAuthorLinks = useMemo(() => selected ? library.papers.filter((paper) => paper.id !== selected.id).map((paper) => ({ paper, authors: commonAuthors(selected, paper) })).filter((item) => item.authors.length > 0) : [], [selected, library.papers]);
  const mutedCommonAuthorSet = useMemo(() => new Set(library.mutedCommonAuthors.map(normalizeAuthor)), [library.mutedCommonAuthors]);
  const commonAuthorStats = useMemo(() => {
    const authors = new Map<string, { name: string; paperIds: Set<string> }>();
    library.papers.forEach((paper) => {
      const seen = new Set<string>();
      paper.authors.forEach((name) => {
        const key = normalizeAuthor(name);
        if (!key || seen.has(key)) return;
        seen.add(key);
        const existing = authors.get(key);
        if (existing) existing.paperIds.add(paper.id);
        else authors.set(key, { name, paperIds: new Set([paper.id]) });
      });
    });
    return [...authors.entries()].filter(([, author]) => author.paperIds.size > 1).map(([key, author]) => ({ key, name: author.name, count: author.paperIds.size })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [library.papers]);
  const visualConnections = useMemo<VisualConnection[]>(() => {
    const automatic: VisualConnection[] = [];
    for (let left = 0; left < library.papers.length; left += 1) {
      for (let right = left + 1; right < library.papers.length; right += 1) {
        const authors = commonAuthors(library.papers[left], library.papers[right]);
        if (authors.length) automatic.push({ id: `authors:${library.papers[left].id}:${library.papers[right].id}`, sourceId: library.papers[left].id, targetId: library.papers[right].id, type: "common_authors", topics: authors, note: `${authors.join(", ")} ${authors.length === 1 ? "is an author" : "are authors"} on both papers.`, automatic: true });
      }
    }
    return [...library.connections, ...automatic];
  }, [library.papers, library.connections]);
  const connectionBundles = useMemo<ConnectionBundle[]>(() => {
    const bundles = new Map<string, ConnectionBundle>();
    visualConnections.forEach((connection) => {
      const [sourceId, targetId] = [connection.sourceId, connection.targetId].sort();
      const id = `bundle:${sourceId}:${targetId}`;
      const existing = bundles.get(id);
      if (existing) existing.connections.push(connection);
      else bundles.set(id, { id, sourceId, targetId, connections: [connection] });
    });
    return [...bundles.values()].map((bundle) => ({ ...bundle, connections: [...bundle.connections].sort((a, b) => connectionTypeOrder.indexOf(a.type) - connectionTypeOrder.indexOf(b.type) || a.id.localeCompare(b.id)) }));
  }, [visualConnections]);
  const lineConnectionBundles = useMemo(() => connectionBundles.filter((bundle) => bundle.connections.some((connection) => connection.type !== "common_authors" || connection.topics.some((author) => !mutedCommonAuthorSet.has(normalizeAuthor(author))))), [connectionBundles, mutedCommonAuthorSet]);
  const selectedConnectionBundle = connectionBundles.find((bundle) => bundle.id === selectedConnectionId);
  const selectedConnectionSource = library.papers.find((paper) => paper.id === selectedConnectionBundle?.sourceId);
  const selectedConnectionTarget = library.papers.find((paper) => paper.id === selectedConnectionBundle?.targetId);
  const editingConnection = library.connections.find((connection) => connection.id === editingConnectionId);
  const connectionSourcePaper = connectionModal === "edit" ? library.papers.find((paper) => paper.id === editingConnection?.sourceId) : selected;
  const targetPaper = library.papers.find((paper) => paper.id === connectionDraft.targetId);

  useEffect(() => { if (selectedId) setSelectedConnectionId(null); }, [selectedId]);

  function openVisualConnection(id: string) { setSelectedId(null); setSelectedConnectionId(id); }
  function openPaperFromConnection(id: string) { setSelectedConnectionId(null); setSelectedId(id); }
  function openConnectionDetails(connection: Connection) { const [sourceId, targetId] = [connection.sourceId, connection.targetId].sort(); setSelectedId(null); setSelectedConnectionId(`bundle:${sourceId}:${targetId}`); }
  function toggleCommonAuthorLine(author: string) { const key = normalizeAuthor(author); setLibrary((current) => ({ ...current, mutedCommonAuthors: current.mutedCommonAuthors.includes(key) ? current.mutedCommonAuthors.filter((item) => item !== key) : [...current.mutedCommonAuthors, key] })); }

  function changeSort(next: SortKey) { if (sortKey === next) setSortDirection((current) => current === "asc" ? "desc" : "asc"); else { setSortKey(next); setSortDirection(next === "title" ? "asc" : "desc"); } }
  function openAdd() { setPaperDraft(emptyPaper()); setAuthorDraft(""); setLinkDraft(""); setPaperModal("add"); }
  function openEdit() { if (!selected) return; const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...draft } = selected; setPaperDraft(draft); setAuthorDraft(selected.authors.join(", ")); setLinkDraft(selected.links.join("\n")); setPaperModal("edit"); }
  function savePaper(event: FormEvent) {
    event.preventDefault(); if (!paperDraft.title.trim()) return; const now = new Date().toISOString();
    const normalized = { ...paperDraft, title: paperDraft.title.trim(), year: Math.max(0, Math.round(Number(paperDraft.year) || 0)), citations: Math.max(0, Math.round(Number(paperDraft.citations) || 0)), priority: Math.min(5, Math.max(1, Math.round(Number(paperDraft.priority) || 3))), interest: Math.min(100, Math.max(0, Math.round(Number(paperDraft.interest) || 0))), authors: authorDraft.split(",").map((item) => item.trim()).filter(Boolean), links: linkDraft.split(/\n|,/).map((item) => item.trim()).filter(Boolean) };
    if (paperModal === "edit" && selected) setLibrary((current) => ({ ...current, papers: current.papers.map((paper) => paper.id === selected.id ? { ...paper, ...normalized, updatedAt: now } : paper) }));
    else { const paper: Paper = { ...normalized, id: newId("paper"), createdAt: now, updatedAt: now }; setLibrary((current) => ({ ...current, papers: [paper, ...current.papers] })); setSelectedId(paper.id); }
    setPaperModal(null);
  }
  function updateSelected(field: "mainQuestions" | "mainResults" | "myQuestions", value: string) { if (!selected) return; setLibrary((current) => ({ ...current, papers: current.papers.map((paper) => paper.id === selected.id ? { ...paper, [field]: value, updatedAt: new Date().toISOString() } : paper) })); }
  function deleteSelected() { if (!selected || !window.confirm(`Delete “${selected.title}” and all of its connections?`)) return; setLibrary((current) => ({ papers: current.papers.filter((paper) => paper.id !== selected.id), connections: current.connections.filter((connection) => connection.sourceId !== selected.id && connection.targetId !== selected.id) })); setSelectedId(null); }
  function openConnection() { const firstTarget = library.papers.find((paper) => paper.id !== selected?.id); setEditingConnectionId(null); setConnectionDraft({ targetId: firstTarget?.id ?? "", type: "shared_topic", topics: "", note: "" }); setConnectionModal("add"); }
  function editConnection(id: string) { const connection = library.connections.find((item) => item.id === id); if (!connection) return; setEditingConnectionId(id); setConnectionDraft({ targetId: connection.targetId, type: connection.type, topics: connection.topics.join(", "), note: connection.note }); setConnectionModal("edit"); }
  function closeConnectionEditor() { setConnectionModal(null); setEditingConnectionId(null); }
  function saveConnection(event: FormEvent) {
    event.preventDefault();
    const sourceId = connectionModal === "edit" ? editingConnection?.sourceId : selected?.id;
    if (!sourceId || !connectionDraft.targetId || connectionDraft.targetId === sourceId) return;
    const normalized = { type: connectionDraft.type, topics: connectionDraft.topics.split(",").map((item) => item.trim()).filter(Boolean), note: connectionDraft.note.trim() };
    if (connectionModal === "edit" && editingConnectionId) setLibrary((current) => ({ ...current, connections: current.connections.map((connection) => connection.id === editingConnectionId ? { ...connection, ...normalized } : connection) }));
    else { const connection: Connection = { id: newId("connection"), sourceId, targetId: connectionDraft.targetId, ...normalized }; setLibrary((current) => ({ ...current, connections: [...current.connections, connection] })); }
    closeConnectionEditor();
  }
  function removeConnection(id: string) { setLibrary((current) => ({ ...current, connections: current.connections.filter((connection) => connection.id !== id) })); }
  function exportLibrary() { const blob = new Blob([JSON.stringify(library, null, 2)], { type: "application/json" }); const anchor = document.createElement("a"); anchor.href = URL.createObjectURL(blob); anchor.download = `paper-ledger-${new Date().toISOString().slice(0, 10)}.json`; anchor.click(); URL.revokeObjectURL(anchor.href); }
  function importLibrary(event: React.ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; if (!file) return; file.text().then((text) => { try { const next = JSON.parse(text) as LibraryState; if (!Array.isArray(next.papers) || !Array.isArray(next.connections)) throw new Error("Invalid backup"); setLibrary(normalizeLibrary(next)); setSelectedId(null); } catch { window.alert("That file is not a valid paper-library backup."); } }); event.target.value = ""; }
  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="status-line"><span>{library.papers.length} papers</span><span>·</span><span>{library.connections.length} connections</span><span>·</span><span className={`save-state ${saveState}`}>{saveState === "saved" ? "Saved locally" : saveState === "saving" ? "Saving" : "Storage error"}</span></div>
        <div className="header-actions"><button className="button quiet" onClick={exportLibrary}>Export</button><button className="button quiet" onClick={() => importRef.current?.click()}>Import</button><input ref={importRef} hidden type="file" accept="application/json" onChange={importLibrary} /><button className="button primary" onClick={openAdd}>Add paper</button></div>
      </header>
      <section className="toolbar" aria-label="Paper controls">
        <label className="search-box"><span>Search</span><input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Title, author, or note" aria-label="Search papers" /><kbd>/</kbd></label>
        <div className="sort-control"><span className="control-label">Sort</span><select value={sortKey} onChange={(event) => changeSort(event.target.value as SortKey)} aria-label="Sort papers"><option value="priority">Priority</option><option value="interest">Interest</option><option value="understanding">Understanding</option><option value="citations">Citations</option><option value="year">Year</option><option value="title">Title</option></select><button className="direction-button" onClick={() => setSortDirection((value) => value === "asc" ? "desc" : "asc")} aria-label={`Sort ${sortDirection === "asc" ? "descending" : "ascending"}`}>{sortDirection === "asc" ? "↑" : "↓"}</button></div>
        <label className="group-toggle"><input type="checkbox" checked={grouped} onChange={(event) => setGrouped(event.target.checked)} /><span aria-hidden="true" />Group by understanding</label>
      </section>
      <div className="connection-key" aria-label="Connection color key">{(["common_authors", "supports", "depends_on", "shared_topic", "contrasts", "method"] as VisualConnectionType[]).map((type) => <span key={type}><i style={{ background: connectionColors[type] }} />{visualConnectionLabels[type]}</span>)}<button className="author-lines-button" onClick={() => setAuthorLinesModal(true)} disabled={commonAuthorStats.length === 0}>Author lines{library.mutedCommonAuthors.length > 0 ? ` (${library.mutedCommonAuthors.length} off)` : ""}</button></div>
      <section className="ledger" ref={ledgerRef} aria-live="polite">
        <ConnectionRail rootRef={ledgerRef} bundles={lineConnectionBundles} layoutKey={`${ready}:${grouped}:${sortKey}:${sortDirection}:${query}:${library.mutedCommonAuthors.join(",")}:${sorted.map((paper) => paper.id).join(",")}`} selectedId={selectedConnectionId} onSelect={openVisualConnection} />
        {!ready && <div className="loading-line">Opening your local library…</div>}
        {ready && displayedGroups.map((group) => {
          const level = group.level === null ? null : levels[group.level]; if (grouped && group.papers.length === 0) return null;
          return <div className="paper-group" key={group.level ?? "all"} style={{ "--level-color": level?.color ?? "#2c3c36" } as React.CSSProperties}>
            {level && <div className="group-header"><div><span className="level-number">{group.level}</span><h2>{level.name}</h2><span className="group-description">{level.description}</span></div><span className="paper-count">{group.papers.length} {group.papers.length === 1 ? "paper" : "papers"}</span></div>}
            <div className="table-wrap"><table><thead><tr>
              <th><SortButton label="Title & authors" column="title" current={sortKey} direction={sortDirection} onSort={changeSort} /></th><th><SortButton label="Year" column="year" current={sortKey} direction={sortDirection} onSort={changeSort} /></th><th><SortButton label="Citations" column="citations" current={sortKey} direction={sortDirection} onSort={changeSort} /></th>{!grouped && <th><SortButton label="Level" column="understanding" current={sortKey} direction={sortDirection} onSort={changeSort} /></th>}<th>Main question</th><th>Main result</th><th>My questions</th><th><SortButton label="Interest" column="interest" current={sortKey} direction={sortDirection} onSort={changeSort} /></th><th>Links</th>
            </tr></thead><tbody>{group.papers.map((paper) => {
              const connectionCount = library.connections.filter((item) => item.sourceId === paper.id || item.targetId === paper.id).length;
              return <tr key={paper.id} data-paper-id={paper.id} className={selectedId === paper.id ? "selected-row" : ""}>
                <td className="paper-identity"><button className="paper-title" style={{ opacity: priorityOpacity(paper.priority) }} onClick={() => setSelectedId(paper.id)}>{paper.title}</button><div className="authors">{paper.authors.length ? paper.authors.join(", ") : "No authors added"}</div>{connectionCount > 0 && <button className="connection-count" onClick={() => setSelectedId(paper.id)}>↗ {connectionCount} {connectionCount === 1 ? "connection" : "connections"}</button>}</td>
                <td className="number-cell">{paper.year || "—"}</td><td className="number-cell" title={paper.citations.toLocaleString()}>{compactNumber(paper.citations)}</td>{!grouped && <td><span className="level-pill" style={{ color: levels[paper.understanding].color, borderColor: levels[paper.understanding].color }}>{paper.understanding} · {levels[paper.understanding].short}</span></td>}<td className="note-cell" onClick={() => setSelectedId(paper.id)}>{truncate(paper.mainQuestions)}</td><td className="note-cell" onClick={() => setSelectedId(paper.id)}>{truncate(paper.mainResults)}</td><td className="note-cell personal" onClick={() => setSelectedId(paper.id)}>{truncate(paper.myQuestions)}</td><td><span className="interest-score" style={{ color: interestColor(paper.interest) }}>{paper.interest}</span></td><td className="link-list">{paper.links.length ? paper.links.slice(0, 2).map((link, index) => <a href={link} target="_blank" rel="noreferrer" key={`${link}-${index}`}>{linkLabel(link)} ↗</a>) : "—"}</td>
              </tr>;
            })}</tbody></table></div>
          </div>;
        })}
        {ready && filtered.length === 0 && <div className="empty-state"><span>⌕</span><h2>No matching papers</h2><p>Try a different title, author, or phrase from your notes.</p></div>}
      </section>
      <footer className="footer-note"><span>Data stays in this browser on this computer.</span><button onClick={() => { if (window.confirm("Clear every paper and connection? Export a backup first if needed.")) { setLibrary({ papers: [], connections: [], mutedCommonAuthors: [] }); setSelectedId(null); } }}>Clear library</button></footer>

      {selected && <><button className="drawer-scrim" aria-label="Close paper details" onClick={() => setSelectedId(null)} /><aside className="detail-drawer" aria-label={`Details for ${selected.title}`}>
        <div className="drawer-topline" style={{ background: levels[selected.understanding].color }} />
        <div className="drawer-header"><div className="drawer-kicker"><span style={{ color: priorityColor(selected.priority) }}>{selected.priority}/5 priority</span><span style={{ color: levels[selected.understanding].color }}>{selected.understanding} · {levels[selected.understanding].short}</span><span>{selected.year}</span><span style={{ color: interestColor(selected.interest) }}>{selected.interest} interest</span></div><button className="icon-button close" onClick={() => setSelectedId(null)} aria-label="Close">×</button><h2>{selected.title}</h2><p className="drawer-authors">{selected.authors.join(", ") || "No authors added"}</p><div className="drawer-actions"><button className="button primary small" onClick={openEdit}>Edit details</button>{selected.links.map((link, index) => <a className="button quiet small" href={link} target="_blank" rel="noreferrer" key={`${link}-${index}`}>{linkLabel(link)} ↗</a>)}<button className="text-button danger" onClick={deleteSelected}>Delete</button></div></div>
        <div className="drawer-body">
          <section className="drawer-section notes-section"><div className="section-heading"><h3>Reading notes</h3><span>Changes save automatically</span></div><label><span>Main questions</span><textarea value={selected.mainQuestions} onChange={(event) => updateSelected("mainQuestions", event.target.value)} placeholder="What is this paper trying to find out?" /></label><label><span>Main results</span><textarea value={selected.mainResults} onChange={(event) => updateSelected("mainResults", event.target.value)} placeholder="What did the authors find?" /></label><label><span>My questions</span><textarea className="personal-input" value={selected.myQuestions} onChange={(event) => updateSelected("myQuestions", event.target.value)} placeholder="What remains unclear or worth following up?" /></label></section>
          <section className="drawer-section"><div className="section-heading"><h3>Connections</h3><button className="text-button" onClick={openConnection}>＋ Add connection</button></div>
            {selectedConnections.length === 0 && <p className="subtle-empty">No manual connections yet. Link related work, dependencies, methods, or disagreements.</p>}
            {(Object.keys(connectionLabels) as ConnectionType[]).map((type) => { const items = selectedConnections.filter((connection) => connection.type === type); if (!items.length) return null; return <div className="connection-group" key={type}><h4>{connectionLabels[type]} <span>{items.length}</span></h4>{items.map((connection) => { const otherId = connection.sourceId === selected.id ? connection.targetId : connection.sourceId; const other = library.papers.find((paper) => paper.id === otherId); const shared = commonAuthors(selected, other); const directional = type === "depends_on" ? (connection.sourceId === selected.id ? "This paper depends on" : "Depends on this paper") : null; return <article className="connection-card" key={connection.id}>{directional && <div className="relationship-direction">{directional}</div>}<button className="connected-title" onClick={() => setSelectedId(otherId)}>{other?.title ?? "Missing paper"} <span>→</span></button>{connection.topics.length > 0 && <div className="tags">{connection.topics.map((topic) => <span key={topic}>{topic}</span>)}</div>}{connection.note && <p>{connection.note}</p>}{shared.length > 0 && <div className="shared-authors">Common {shared.length === 1 ? "author" : "authors"}: {shared.join(", ")}</div>}<div className="connection-card-actions"><button onClick={() => openConnectionDetails(connection)}>Details</button><button onClick={() => editConnection(connection.id)}>Edit</button><button className="danger" onClick={() => removeConnection(connection.id)} aria-label="Remove connection">Remove</button></div></article>; })}</div>; })}
          </section>
          <section className="drawer-section"><div className="section-heading"><h3>Shared authors</h3><span>Found automatically</span></div>{automaticAuthorLinks.length === 0 ? <p className="subtle-empty">No authors shared with other papers in your library.</p> : automaticAuthorLinks.map(({ paper, authors }) => <button className="author-link" key={paper.id} onClick={() => setSelectedId(paper.id)}><span className="author-avatar">{authors[0].split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><span><strong>{authors.join(", ")}</strong><small>{paper.title}</small></span><span>→</span></button>)}</section>
        </div>
      </aside></>}

      {selectedConnectionBundle && selectedConnectionSource && selectedConnectionTarget && <><button className="drawer-scrim" aria-label="Close connection details" onClick={() => setSelectedConnectionId(null)} /><aside className="detail-drawer connection-detail-drawer" aria-label={`Connections between ${selectedConnectionSource.title} and ${selectedConnectionTarget.title}`}>
        <div className="drawer-topline" style={{ background: connectionColors[selectedConnectionBundle.connections[0].type] }} />
        <div className="drawer-header connection-bundle-header"><div className="drawer-kicker"><span>{selectedConnectionBundle.connections.length} {selectedConnectionBundle.connections.length === 1 ? "connection" : "connections"}</span></div><button className="icon-button close" onClick={() => setSelectedConnectionId(null)} aria-label="Close">×</button><div className="connection-paper-pair"><button onClick={() => openPaperFromConnection(selectedConnectionSource.id)}>{selectedConnectionSource.title}</button><span>↔</span><button onClick={() => openPaperFromConnection(selectedConnectionTarget.id)}>{selectedConnectionTarget.title}</button></div></div>
        <div className="drawer-body connection-bundle-list">{selectedConnectionBundle.connections.map((connection) => <section className="drawer-section connection-detail-item" style={{ borderLeftColor: connectionColors[connection.type] }} key={connection.id}><div className="section-heading"><h3 style={{ color: connectionColors[connection.type] }}>{visualConnectionLabels[connection.type]}</h3><span>{connection.automatic ? "Found automatically" : "Saved connection"}</span></div>{connection.type === "depends_on" && <div className="relationship-direction">{library.papers.find((paper) => paper.id === connection.sourceId)?.title} depends on {library.papers.find((paper) => paper.id === connection.targetId)?.title}</div>}{connection.note && <p className="connection-full-note">{connection.note}</p>}{connection.topics.length > 0 && <div className="tags connection-detail-tags">{connection.topics.map((topic) => <span className={connection.type === "common_authors" && mutedCommonAuthorSet.has(normalizeAuthor(topic)) ? "line-muted-author" : ""} key={topic}>{topic}</span>)}</div>}{!connection.automatic && <div className="connection-detail-actions"><button className="text-button" onClick={() => editConnection(connection.id)}>Edit connection</button><button className="text-button danger" onClick={() => removeConnection(connection.id)}>Remove</button></div>}</section>)}</div>
      </aside></>}

      {authorLinesModal && <div className="modal-layer" role="presentation"><button className="modal-scrim" aria-label="Close common author line settings" onClick={() => setAuthorLinesModal(false)} /><section className="modal author-lines-modal" role="dialog" aria-modal="true" aria-labelledby="author-lines-heading">
        <div className="modal-header"><div><div className="eyebrow">Global setting</div><h2 id="author-lines-heading">Common author lines</h2></div><button type="button" className="icon-button" onClick={() => setAuthorLinesModal(false)}>×</button></div>
        <p className="author-lines-help">Turn off authors who should remain listed in connection details but should not create lines by themselves.</p>
        <div className="author-lines-list">{commonAuthorStats.map((author) => { const createsLines = !mutedCommonAuthorSet.has(author.key); return <label className="author-line-row" key={author.key}><input type="checkbox" checked={createsLines} onChange={() => toggleCommonAuthorLine(author.key)} /><span><strong>{author.name}</strong><small>{author.count} papers</small></span><em>{createsLines ? "Creates lines" : "Details only"}</em></label>; })}</div>
        <div className="modal-footer"><button type="button" className="button primary" onClick={() => setAuthorLinesModal(false)}>Done</button></div>
      </section></div>}

      {paperModal && <div className="modal-layer" role="presentation"><button className="modal-scrim" aria-label="Close editor" onClick={() => setPaperModal(null)} /><form className="modal paper-modal" onSubmit={savePaper}>
        <div className="modal-header"><div><div className="eyebrow">{paperModal === "add" ? "New library entry" : "Library entry"}</div><h2>{paperModal === "add" ? "Add a paper" : "Edit paper"}</h2></div><button type="button" className="icon-button" onClick={() => setPaperModal(null)}>×</button></div>
        <div className="form-grid"><label className="wide"><span>Title *</span><input required autoFocus value={paperDraft.title} onChange={(event) => setPaperDraft({ ...paperDraft, title: event.target.value })} placeholder="Full paper title" /></label><label><span>Year</span><input type="number" min="0" max="2200" value={paperDraft.year} onChange={(event) => setPaperDraft({ ...paperDraft, year: Number(event.target.value) })} /></label><label><span>Citations</span><input type="number" min="0" value={paperDraft.citations} onChange={(event) => setPaperDraft({ ...paperDraft, citations: Number(event.target.value) })} /></label><label className="wide"><span>Authors <small>comma-separated</small></span><input value={authorDraft} onChange={(event) => setAuthorDraft(event.target.value)} placeholder="First Author, Second Author" /></label><label className="wide"><span>Links <small>one per line</small></span><textarea value={linkDraft} onChange={(event) => setLinkDraft(event.target.value)} placeholder={"https://doi.org/…\nhttps://arxiv.org/…"} /></label>
          <label className="wide priority-field"><span>Priority</span><div className="priority-options">{[1, 2, 3, 4, 5].map((priority) => <button type="button" className={paperDraft.priority === priority ? "active" : ""} style={{ "--priority-color": priorityColor(priority) } as React.CSSProperties} onClick={() => setPaperDraft({ ...paperDraft, priority })} key={priority}>{priority}</button>)}</div></label><label className="wide level-field"><span>Understanding</span><div className="level-options">{([0, 1, 2, 3] as Understanding[]).map((level) => <button type="button" className={paperDraft.understanding === level ? "active" : ""} style={{ "--choice-color": levels[level].color } as React.CSSProperties} onClick={() => setPaperDraft({ ...paperDraft, understanding: level })} key={level}><strong>{level}</strong><span>{levels[level].short}</span></button>)}</div></label><label className="wide range-field"><span>Interest <strong style={{ color: interestColor(paperDraft.interest) }}>{paperDraft.interest}</strong> / 100</span><input type="range" min="0" max="100" value={paperDraft.interest} style={{ accentColor: interestColor(paperDraft.interest) }} onChange={(event) => setPaperDraft({ ...paperDraft, interest: Number(event.target.value) })} /></label><label className="wide"><span>Main questions</span><textarea value={paperDraft.mainQuestions} onChange={(event) => setPaperDraft({ ...paperDraft, mainQuestions: event.target.value })} placeholder="What is the paper trying to answer?" /></label><label className="wide"><span>Main results</span><textarea value={paperDraft.mainResults} onChange={(event) => setPaperDraft({ ...paperDraft, mainResults: event.target.value })} placeholder="What did the authors find?" /></label><label className="wide"><span>My questions</span><textarea className="personal-input" value={paperDraft.myQuestions} onChange={(event) => setPaperDraft({ ...paperDraft, myQuestions: event.target.value })} placeholder="What do you want to investigate or revisit?" /></label></div>
        <div className="modal-footer"><button type="button" className="button quiet" onClick={() => setPaperModal(null)}>Cancel</button><button type="submit" className="button primary">{paperModal === "add" ? "Add to library" : "Save changes"}</button></div>
      </form></div>}

      {connectionModal && connectionSourcePaper && <div className="modal-layer" role="presentation"><button className="modal-scrim" aria-label="Close connection editor" onClick={closeConnectionEditor} /><form className="modal connection-modal" onSubmit={saveConnection}>
        <div className="modal-header"><div><div className="eyebrow">Link from “{truncate(connectionSourcePaper.title, 42)}”</div><h2>{connectionModal === "edit" ? "Edit connection" : "Add a connection"}</h2></div><button type="button" className="icon-button" onClick={closeConnectionEditor}>×</button></div>
        <div className="form-stack"><label><span>Connected paper</span><select required disabled={connectionModal === "edit"} value={connectionDraft.targetId} onChange={(event) => setConnectionDraft({ ...connectionDraft, targetId: event.target.value })}>{library.papers.filter((paper) => paper.id !== connectionSourcePaper.id).map((paper) => <option value={paper.id} key={paper.id}>{paper.title}</option>)}</select></label>{targetPaper && commonAuthors(connectionSourcePaper, targetPaper).length > 0 && <div className="auto-match"><span>Auto</span> Common {commonAuthors(connectionSourcePaper, targetPaper).length === 1 ? "author" : "authors"}: <strong>{commonAuthors(connectionSourcePaper, targetPaper).join(", ")}</strong></div>}<label><span>Relationship</span><select value={connectionDraft.type} onChange={(event) => setConnectionDraft({ ...connectionDraft, type: event.target.value as ConnectionType })}>{(Object.keys(connectionLabels) as ConnectionType[]).map((type) => <option value={type} key={type}>{connectionLabels[type]}</option>)}</select></label><label><span>Common topics <small>comma-separated</small></span><input value={connectionDraft.topics} onChange={(event) => setConnectionDraft({ ...connectionDraft, topics: event.target.value })} placeholder="e.g. causal inference, panel data" /></label><label><span>How are they connected?</span><textarea value={connectionDraft.note} onChange={(event) => setConnectionDraft({ ...connectionDraft, note: event.target.value })} placeholder="Capture the dependency, disagreement, shared method, or idea…" /></label>{connectionDraft.type === "depends_on" && <p className="direction-note">This records that <strong>{connectionSourcePaper.title}</strong> depends on <strong>{targetPaper?.title}</strong>.</p>}</div>
        <div className="modal-footer"><button type="button" className="button quiet" onClick={closeConnectionEditor}>Cancel</button><button type="submit" className="button primary" disabled={!connectionDraft.targetId}>{connectionModal === "edit" ? "Save changes" : "Add connection"}</button></div>
      </form></div>}
    </main>
  );
}

function SortButton({ label, column, current, direction, onSort }: { label: string; column: SortKey; current: SortKey; direction: "asc" | "desc"; onSort: (column: SortKey) => void }) {
  return <button className={`sort-button ${current === column ? "active" : ""}`} onClick={() => onSort(column)}>{label}<span>{current === column ? (direction === "asc" ? "↑" : "↓") : "↕"}</span></button>;
}

type RailLine = { d: string; color: string; y1: number; y2: number };
type RailPath = { id: string; hitD: string; label: string; lines: RailLine[] };

function ConnectionRail({ rootRef, bundles, layoutKey, selectedId, onSelect }: { rootRef: React.RefObject<HTMLElement | null>; bundles: ConnectionBundle[]; layoutKey: string; selectedId: string | null; onSelect: (id: string) => void }) {
  const [paths, setPaths] = useState<RailPath[]>([]);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let frame = 0;
    const measure = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const rootRect = root.getBoundingClientRect();
        const visible = bundles.map((bundle) => {
          const source = root.querySelector<HTMLElement>(`[data-paper-id="${CSS.escape(bundle.sourceId)}"]`);
          const target = root.querySelector<HTMLElement>(`[data-paper-id="${CSS.escape(bundle.targetId)}"]`);
          return source && target ? { bundle, source, target } : null;
        }).filter((item): item is { bundle: ConnectionBundle; source: HTMLElement; target: HTMLElement } => Boolean(item));

        const attachmentCounts = new Map<string, number>();
        visible.forEach(({ bundle }) => {
          attachmentCounts.set(bundle.sourceId, (attachmentCounts.get(bundle.sourceId) ?? 0) + 1);
          attachmentCounts.set(bundle.targetId, (attachmentCounts.get(bundle.targetId) ?? 0) + 1);
        });
        const attachmentIndexes = new Map<string, number>();
        const intervals = visible.sort((a, b) => a.bundle.id.localeCompare(b.bundle.id)).map(({ bundle, source, target }) => {
          const endpointY = (paperId: string, element: HTMLElement) => {
            const index = attachmentIndexes.get(paperId) ?? 0;
            attachmentIndexes.set(paperId, index + 1);
            const count = attachmentCounts.get(paperId) ?? 1;
            return element.getBoundingClientRect().top - rootRect.top + element.getBoundingClientRect().height / 2 + (index - (count - 1) / 2) * 4;
          };
          const y1 = endpointY(bundle.sourceId, source);
          const y2 = endpointY(bundle.targetId, target);
          return { bundle, y1, y2, top: Math.min(y1, y2), bottom: Math.max(y1, y2) };
        }).sort((a, b) => a.top - b.top || b.bottom - a.bottom || a.bundle.id.localeCompare(b.bundle.id));

        const laneEnds: number[] = [];
        const routed = intervals.map(({ bundle, y1, y2, top, bottom }) => {
          let lane = laneEnds.findIndex((end) => top > end + 6);
          if (lane < 0) lane = laneEnds.length;
          laneEnds[lane] = bottom;
          return { bundle, y1, y2, lane };
        });
        const laneSpacing = laneEnds.length > 1 ? 42 / (laneEnds.length - 1) : 0;
        const nextPaths = routed.map(({ bundle, y1, y2, lane }) => {
          const laneX = 49 - lane * laneSpacing;
          const endpointX = 59;
          const lines = bundle.connections.map((connection, index) => {
            const offset = (index - (bundle.connections.length - 1) / 2) * 3;
            const direction = y1 <= y2 ? 1 : -1;
            const sourceOffset = offset * direction;
            const targetOffset = -offset * direction;
            return { d: `M ${endpointX} ${y1 + sourceOffset} H ${laneX + offset} V ${y2 + targetOffset} H ${endpointX}`, color: connectionColors[connection.type], y1: y1 + sourceOffset, y2: y2 + targetOffset };
          });
          return { id: bundle.id, hitD: `M ${endpointX} ${y1} H ${laneX} V ${y2} H ${endpointX}`, label: `${bundle.connections.length} ${bundle.connections.length === 1 ? "connection" : "connections"} between papers`, lines };
        });
        setHeight(root.scrollHeight);
        setPaths(nextPaths);
      });
    };

    const observer = new ResizeObserver(measure);
    observer.observe(root);
    root.querySelectorAll<HTMLElement>("[data-paper-id]").forEach((row) => observer.observe(row));
    window.addEventListener("resize", measure);
    measure();
    return () => { window.cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener("resize", measure); };
  }, [rootRef, bundles, layoutKey]);

  if (!paths.length) return null;
  return <svg className="connection-rail" width="64" height={height} viewBox={`0 0 64 ${height}`} role="img" aria-label="Connections between visible papers">
    <title>Connections between visible papers</title>
    <desc>Orthogonal colored lines connect related paper rows. Select a line to read its full description.</desc>
    {paths.map((path) => <g key={path.id} className={selectedId === path.id ? "selected" : ""}>
      {path.lines.map((line, index) => <g key={`${path.id}:${index}`}><path className="connection-path" d={line.d} fill="none" stroke={line.color} strokeWidth={selectedId === path.id ? 2 : 1.25} vectorEffect="non-scaling-stroke" /><rect x="57" y={line.y1 - 1} width="3" height="2" fill={line.color} /><rect x="57" y={line.y2 - 1} width="3" height="2" fill={line.color} /></g>)}
      <path className="connection-hit-path" d={path.hitD} fill="none" stroke="transparent" strokeWidth={Math.max(10, path.lines.length * 3 + 6)} vectorEffect="non-scaling-stroke" role="button" tabIndex={0} aria-label={`${path.label}; open details`} onClick={() => onSelect(path.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(path.id); } }} />
    </g>)}
  </svg>;
}
