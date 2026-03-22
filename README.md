<p align="center">
  <img src="public/logo.svg" alt="mcp-memory" width="120" height="120" />
</p>

<h1 align="center">mcp-memory</h1>
<p align="center"><strong>Persistent vector memory for any MCP-compatible AI client — local, semantic, structured</strong></p>

<p align="center">
  <a href="https://github.com/natuleadan/mcp-memory/releases"><img src="https://img.shields.io/github/v/release/natuleadan/mcp-memory?include_prereleases&style=for-the-badge" alt="GitHub release" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License" /></a>
  <img src="https://img.shields.io/badge/LanceDB-local-green?style=for-the-badge" alt="LanceDB" />
  <img src="https://img.shields.io/badge/Ollama-nomic--embed-purple?style=for-the-badge" alt="Ollama" />
  <img src="https://img.shields.io/badge/Status-In%20Development-orange?style=for-the-badge" alt="In Development" />
</p>

> ⚠️ **Active Development** — APIs and tools may change without prior notice. Use tagged releases (`vX.Y.Z`) for stability.

---

Local MCP server compatible with any stdio-based AI client. Provides persistent structured memory, semantic search and reindexing using local embeddings and LanceDB.

## Stack

- **Vector DB**: [LanceDB](https://lancedb.github.io/lancedb/) (local, stored in `data/`)
- **Embeddings**: `nomic-embed-text` via [Ollama](https://ollama.com)
- **Protocol**: MCP over stdio

---

## Memory system

Two memory layers:

### 1. Structured memory (`memories` table)
CRUD entries with semantic embeddings. Persists across sessions.

| Type | Purpose |
|------|---------|
| `soul` | Agent identity, values and personality |
| `user` | User profile: role, expertise, preferences |
| `feedback` | Learned rules: corrections and confirmed approaches |
| `project` | Active work, decisions, project state |
| `reference` | Pointers to external systems, tools, docs |
| `pending` | Open tasks and follow-ups |

### 2. Episodic memory (indexed chatlogs)
Conversation history indexed by date. Queryable via `search_memory`.

---

## Tools

### Structured memory (CRUD)

| Tool | Description |
|------|-------------|
| `upsert_memory` | ⭐ Create or update by name — no UUID needed |
| `save_memory` | Create new entry with automatic embedding |
| `update_memory` | Update by UUID (re-embeds automatically) |
| `delete_memory` | Delete by UUID |
| `list_memories` | List all, optional type filter |
| `search_memories` | Semantic search in `memories` table |

### Contextual search (read-only)

| Tool | Description |
|------|-------------|
| `search_codebase` | Search source code (`.ts .tsx .js .jsx`) |
| `search_docs` | Search documentation (`.md .sql .json`) |
| `search_memory` | Search conversation history/chatlogs |

### Maintenance

| Tool | Description |
|------|-------------|
| `reindex` | Trigger reindexing: `code \| docs \| chatlogs \| all` |

---

## Agent usage protocol

```
START of conversation:
  1. search_memories("relevant topic")
  2. list_memories("pending") — review open items

WHEN learning something new:
  → upsert_memory(type, name, body, tags)

AFTER completing a task:
  → upsert_memory() if something is worth persisting
  → Append block to _chatlogs/YYYY-MM/MM.DD.md (Obsidian format)

WHEN completing a pending item:
  → update_memory(id) or delete_memory(id)
```

---

## Setup

See [INSTALL.md](./INSTALL.md) for full setup instructions including Ollama, LanceDB and client configuration.

```bash
cp .env.example .env   # fill in your paths
pnpm install
pnpm index:all         # initial indexing
pnpm start             # start MCP server
```

---

## Indexing

```bash
pnpm index:all        # code + docs + chatlogs
pnpm index:code       # source code only
pnpm index:docs       # documentation only
pnpm index:chatlogs   # conversation history only
```

Indexers are incremental — only new or modified files are processed.

To reindex from scratch:

```bash
rm -rf data/
pnpm index:all
```

---

## Environment variables

| Variable | Description |
|----------|-------------|
| `OLLAMA_HOST` | Ollama server URL (default: `http://localhost:11434`) |
| `FULLSTACK_DIR` | Absolute path to the project repo to index |
| `CHATLOG_DIR` | Absolute path to the chatlogs folder |
| `LANCEDB_DIR` | Absolute path to store LanceDB indexes (default: `./data`) |

---

## Community

See [INSTALL.md](./INSTALL.md) for setup. Contributions are subject to [natuleadan](https://github.com/natuleadan) review policies and terms.

Thanks to all contributors:

<p align="left">
  <a href="https://github.com/natuleadan"><img src="https://avatars.githubusercontent.com/u/210283438?v=4&s=48" width="48" height="48" alt="natuleadan" title="natuleadan"/></a>
  <a href="https://github.com/leojara95"><img src="https://avatars.githubusercontent.com/u/268038834?v=4&s=48" width="48" height="48" alt="leojara95" title="leojara95"/></a>
</p>

---

## Star History

<a href="https://www.star-history.com/?repos=leojara95%2Fmcp-memory&type=date&legend=top-left">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/image?repos=natuleadan/mcp-memory&type=date&theme=dark&legend=top-left" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/image?repos=natuleadan/mcp-memory&type=date&theme=light&legend=top-left" />
    <img alt="Star History Chart" src="https://api.star-history.com/image?repos=natuleadan/mcp-memory&type=date&legend=top-left" />
  </picture>
</a>

---

## License

MIT © [Leonardo Jara](https://github.com/leojara95)
