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
  <img src="https://img.shields.io/badge/Tools-14-blue?style=for-the-badge" alt="14 Tools" />
</p>

> ⚠️ **Active Development** — APIs and tools may change without prior notice. Use tagged releases (`vX.Y.Z`) for stability.

---

Local MCP server compatible with any stdio-based AI client. Provides persistent structured memory, semantic search, version tracking and reindexing using local embeddings and LanceDB.

## Stack

- **Vector DB**: [LanceDB](https://lancedb.github.io/lancedb/) (local, stored in `./vectorial/`)
- **Embeddings**: `nomic-embed-text` via [Ollama](https://ollama.com)
- **Protocol**: MCP over stdio
- **Runtime**: Node.js + TypeScript (`tsx`)

---

## Architecture

```
src/
├── types/      # Zod schemas + TypeScript types
├── functions/  # Business logic (pure functions)
└── tools/      # Tool registration (glue code)
```

All tools use the `data_*` prefix for a unified API.

---

## Memory System

### 1. Structured Memory (`memories` table)

CRUD entries with **semantic embeddings**, FTS indexing, automatic version tracking, and priority weights (1-10). Persists across sessions.

Each memory has:
- **Embedding** (`embeddings`): Semantic embedding of the full body text (768-dim via nomic-embed-text)
- **Full-text search**: BM25 index on body for keyword-based search
- **Weight** (1-10): Prioritizes critical memories in search results
  - Weight 8-10: Full body returned in search results
  - Weight 5-7: Full body or excerpt depending on mode
  - Weight 1-4: Excerpt only

| Type | Purpose |
|------|---------|
| `soul` | Agent identity, values and personality |
| `user` | User profile: role, expertise, preferences |
| `feedback` | Learned rules: corrections and confirmed approaches |
| `project` | Active work, decisions, project state |
| `reference` | Pointers to external systems, tools, docs |
| `pending` | Open tasks and follow-ups |

### 2. Indexed Sources (5 tables)

| Table | Source | Description |
|-------|--------|-------------|
| `memories` | `./memories/` | Structured entries with types |
| `codebase` | `./coding/` | Source code (.ts, .tsx, .js, .jsx) |
| `docs` | `./coding/` | Documentation (.md, .sql, .json) |
| `reference` | `./reference/` | User-provided code examples, guides, and learning materials |
| `chatlogs` | `./chatlogs/` | Conversation history |

Default directories are relative to the project root. Configure via environment variables or use defaults.

### Default Paths

If no `.env` is configured, the following defaults are used:
- `vectorial/` — LanceDB storage
- `memories/` — Markdown memory vault
- `coding/` — Code to index (you need to place your project here or configure `CODING_DIR`)
- `reference/` — User-provided code examples and learning materials
- `chatlogs/` — Conversation history

### 3. Version History (`memory_versions` table)

Automatic snapshot saved every time a memory is updated. Query with `data_versions(name)`.

---

## Unified API (14 tools)

All tools use the `data_*` prefix for consistency.

### Search

| Tool | Description |
|------|-------------|
| `data_search` | ⭐ Unified search. Use `source` param: `memories`, `codebase`, `docs`, `chatlogs`, or `all` for global search across all 4 sources. Supports `mode`: `critical`, `condensed`, `full`, `lite` |

### CRUD

| Tool | Description |
|------|-------------|
| `data_create` | Create new memory with auto-embedding. Params: `type`, `name`, `body`, `tags`, `weight` |
| `data_update` | Update memory by ID. Auto re-embeds body. Params: `id`, `body`, `tags`, `weight`, `name` |
| `data_delete` | Delete memory by ID. Params: `id` |
| `data_list` | List memories. Params: `type` (optional), `tag` (optional filter) |
| `data_count` | Count memories. Params: `type` (optional) |
| `data_get` | Get memory by exact name. Params: `name` |

### Context

| Tool | Description |
|------|-------------|
| `data_context` | ⭐ **RECOMMENDED** Session bootstrap. Params: `mode` (`minimal`/`compact`/`full`) OR `task` for smart context loading |
| `data_recent` | Recent memories by date. Params: `days`, `limit` |
| `data_stats` | Statistics: total count, breakdown by type, oldest/newest, avg body length |
| `data_versions` | Version history of a memory by name. Params: `name` |

### Files

| Tool | Description |
|------|-------------|
| `data_files` | List markdown files in vault. Params: `type` (optional) |
| `data_sync` | Sync vault files to vector DB. Params: `type`, `dry_run`, `import_missing` |
| `data_export` | Export memories to markdown files. Params: `type`, `overwrite` |

---

## Agent Usage Protocol

```
SESSION START (RECOMMENDED):
  1. data_context()                           ← minimal mode, ~50 tokens
  OR
  1. data_context(mode: "compact")            ← ~1.5k tokens with previews
  OR (smart)
  1. data_context(task: "what I'm doing")     ← semantic smart loading

DURING WORK — when you learn something new:
  → data_create(type, name, body, tags, weight)

FETCHING A KNOWN MEMORY:
  → data_get(name: "exact_name")              ← O(1), no embedding cost

FETCHING CRITICAL RULES:
  → data_list(tag: "CRITICAL")

SEARCHING:
  → data_search(source: "memories", query: "...")
  → data_search(source: "all", query: "...")  ← global search across all sources

HOUSEKEEPING:
  → data_stats()                              ← check totals
  → data_versions(name: "memory_name")        ← view history
```

---

## Setup

```bash
cp .env.example .env   # fill in your paths
pnpm install
pnpm test              # diagnostic: verify all connections and counts
pnpm index:all         # initial indexing
pnpm start             # start MCP server
```

---

## Indexing

### Upload (Markdown → Vector DB)

```bash
pnpm index               # code + docs + reference + chatlogs (all sources)
pnpm index:code          # source code only
pnpm index:docs          # documentation only
pnpm index:reference     # user-provided guides and examples
pnpm index:chatlogs      # conversation history only
```

### Download (Vector DB → Markdown)

```bash
pnpm download            # export all memories to markdown
pnpm download:memories   # export memories only
```

Indexers are incremental — only new or modified files are processed.

To reindex from scratch:

```bash
rm -rf ./vectorial/
pnpm index
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `OLLAMA_HOST` | Ollama server URL (default: `http://localhost:11434`) |
| `CODING_DIR` | Path to code repository to index (default: `../coding`) |
| `CHATLOG_DIR` | Path to chatlogs folder (default: `../_memory/chatlogs`) |
| `REFERENCE_DIR` | Path to user-provided guides and examples (default: `../_memory/reference`) |
| `LANCEDB_DIR` | Path to LanceDB storage (default: `../_memory/vectorial`) |
| `MEMORIES_DIR` | Path to memories vault (default: `../_memory/memories`) |
| `MEMORIES_WRITE_ENABLED` | Enable writing to vault (default: `true`) |

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