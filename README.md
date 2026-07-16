# Paper Ledger

A private, local-first research paper tracker. It combines a compact spreadsheet-style library with structured reading notes, understanding and interest scores, and bidirectional relationships between papers.

## Run locally

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open the local address printed in the terminal. Paper data is saved automatically to IndexedDB in that browser. Use **Export** regularly to create a portable JSON backup, and **Import** to restore it.

## Included

- Add, edit, delete, search, and link papers
- All requested metadata and three structured note fields
- Priority scores 1–5 shown through title darkness, with default within-group sorting
- Understanding levels 0–3 with colored sections
- Interest scores 0–100 with value-based color
- Numeric sorting within groups or across the full library
- Organized connections, directional dependencies, and topic tags
- Automatic shared-author detection
- Clickable, color-coded connection routes with automatic lane assignment and parallel bundling by paper pair
- Local persistence plus JSON backup/restore

The four example records shown on first launch can be deleted individually or removed with **Clear library**.
