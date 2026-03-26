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
  <img src="https://img.shields.io/badge/Tools-21-blue?style=for-the-badge" alt="21 Tools" />
</p>

> ⚠️ **Active Development** — APIs and tools may change without prior notice. Use tagged releases (`vX.Y.Z`) for stability.

---

Local MCP server compatible with any stdio-based AI client. Provides persistent structured memory, semantic search, version tracking and reindexing using local embeddings and LanceDB.

## Stack

- **Vector DB**: [LanceDB](https://lancedb.github.io/lancedb/) (local, stored in `data/`)
- **Embeddings**: `nomic-embed-text` via [Ollama](https://ollama.com)
- **Protocol**: MCP over stdio
- **Runtime**: Node.js + TypeScript (`tsx`)

---

## Memory system

Two memory layers:

### 1. Structured memory (`memories` table)

CRUD entries with semantic embeddings and automatic version tracking. Persists across sessions.

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

### 3. Version history (`memory_versions` table)

Automatic snapshot saved every time `upsert_memory` modifies an existing entry. Query with `memory_versions(name)`.

---

## Tools (21 total)

### Session start

| Tool | Description |
|------|-------------|
| `load_context` | Bootstrap session: soul + user + feedback + projects + chatlogs. Three modes: `minimal` (~200 tokens) · `compact` (default, ~1-2k tokens) · `full` |
| `get_context_for_task` | Smart loader: given a task description, fetches only the most relevant memories semantically |

### Fast retrieval (no embedding — O(1))

| Tool | Description |
|------|-------------|
| `get_memory_by_name` | Direct lookup by exact name (e.g. `"leo_profile"`) |
| `get_memories_by_tag` | Filter all memories by tag (e.g. `"critical"`, `"commits"`) |
| `get_recent_chatlogs` | Recent chatlog entries in chronological order |

### Semantic search

| Tool | Description |
|------|-------------|
| `search_global` | ⭐ Unified search across all 4 layers (memories, codebase, docs, chatlogs) in parallel. Compact mode (~2-3k tokens) returns excerpts + location |
| `search_memories` | Full semantic search — returns complete body |
| `search_memories_lite` | Semantic search — returns 200-char excerpts only (saves tokens) |
| `batch_search_memories` | Multiple queries (newline-separated) in parallel |
| `search_codebase` | Search source code (`.ts .tsx .js .jsx`) |
| `search_docs` | Search documentation (`.md .sql .json`) |
| `search_memory` | Search conversation history / chatlogs |

### Memory CRUD

| Tool | Description |
|------|-------------|
| `upsert_memory` | ⭐ Create or update by name — no UUID needed. Auto-saves version snapshot on update |
| `save_memory` | Create new entry with automatic embedding |
| `update_memory` | Update by UUID (re-embeds automatically) |
| `delete_memory` | Delete by UUID |
| `list_memories` | List all memories, optional type filter |

### Inspection & maintenance

| Tool | Description |
|------|-------------|
| `get_memory_stats` | Total count, breakdown by type, oldest/newest, avg body length |
| `memory_versions` | Version history of a memory by name |
| `purge_old_memories` | Clean stale entries by type + age. Has `dry_run` mode (default: `true`) |
| `reindex` | Trigger reindexing: `code \| docs \| chatlogs \| all` |

---

## Agent usage protocol

```
SESSION START:
  1. get_context_for_task("what I'm about to do")  ← smart, minimal tokens
  OR
  1. load_context(mode: "compact")                 ← full session bootstrap

DURING WORK — when you learn something new:
  → upsert_memory(type, name, body, tags)          ← auto-versions on update

AFTER COMPLETING A TASK:
  → upsert_memory() if something is worth persisting
  → Append block to _chatlogs/YYYY-MM/MM.DD.md

FETCHING A KNOWN MEMORY:
  → get_memory_by_name("exact_name")              ← O(1), no embedding cost

FETCHING CRITICAL RULES:
  → get_memories_by_tag("critical")

HOUSEKEEPING (monthly):
  → get_memory_stats()                            ← check totals
  → purge_old_memories(days_ago: 60, type: "project", dry_run: true)
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
