# mcp-memory — Installation Guide

How to connect `mcp-memory` to different AI clients as an MCP server.

---

## Quick start (recommended)

If you have Node.js and pnpm already installed, a single command handles Ollama installation, model download, and verification:

```bash
git clone https://github.com/natuleadan/mcp-memory
cd mcp-memory
pnpm install
pnpm bootstrap
```

`pnpm bootstrap` detects your OS (macOS, Linux, Windows) and:
- Installs Ollama if not present
- Starts Ollama in the background
- Downloads the `nomic-embed-text` embedding model

Then skip to [step 4](#4-configure-environment-variables).

---

## 1. Install Ollama (manual)

Ollama runs the local embedding model (`nomic-embed-text`) used to index and search.

### macOS

```bash
# Option A — installer script
curl -fsSL https://ollama.com/install.sh | sh

# Option B — Homebrew
brew install ollama
```

Ollama installs as a background app and starts automatically at login.
No need to run `ollama serve` manually after the first install.

### Linux

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

Start as a systemd service (recommended):
```bash
sudo systemctl enable ollama
sudo systemctl start ollama
```

Or run manually in a terminal:
```bash
ollama serve
```

### Windows

1. Download the installer from [ollama.com/download](https://ollama.com/download)
2. Run `OllamaSetup.exe` — installs and starts automatically
3. Ollama runs as a background process in the system tray

Open **PowerShell** or **CMD** to run the commands below.

> Ollama on Windows requires Windows 10 22H2 or later.

---

**Pull the embedding model** (all platforms):
```bash
ollama pull nomic-embed-text
```

**Verify Ollama is running:**
```bash
ollama list   # should show nomic-embed-text in the list
```

> Default host: `http://localhost:11434` — set `OLLAMA_HOST` in `.env` if you change it.

---

## 2. Install Node.js and pnpm

Requires **Node.js 18+** and **pnpm**.

### macOS
```bash
brew install node        # installs Node.js
npm install -g pnpm      # installs pnpm globally
```

### Linux
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
npm install -g pnpm
```

### Windows (PowerShell as Administrator)
```powershell
winget install OpenJS.NodeJS
npm install -g pnpm
```

Or use [nvm-windows](https://github.com/coreybutler/nvm-windows) for version management.

---

## 3. Install mcp-memory

```bash
git clone https://github.com/natuleadan/mcp-memory
cd mcp-memory
pnpm install
```

---

## 4. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` with your paths:

```env
OLLAMA_HOST=http://localhost:11434
FULLSTACK_DIR=/absolute/path/to/your/project   # repo to index for search_codebase / search_docs
CHATLOG_DIR=/absolute/path/to/your/chatlogs    # folder to index for search_memory
LANCEDB_DIR=/absolute/path/to/mcp-memory/data  # where LanceDB stores vector indexes
```

> All paths must be **absolute**. LanceDB stores its data locally — no external DB needed.

---

## 5. Run initial indexing

```bash
pnpm index:all
```

This indexes your codebase, documentation and chatlogs into LanceDB. Re-run after major changes or use the `reindex` MCP tool from within your AI client.

---

## 6. Connect to your AI client

Copy `.mcp.json` and replace `/absolute/path/to/mcp-memory` with your actual path:

```json
{
  "mcpServers": {
    "mcp-memory": {
      "type": "stdio",
      "command": "pnpm",
      "args": ["--dir", "/absolute/path/to/mcp-memory", "start"],
      "env": {}
    }
  }
}
```

> The `env` block is empty — variables are loaded from `.env` via `dotenv`.

---

## Client-specific setup

### Claude Code

Place `.mcp.json` at the **root of your workspace** (where you run `claude`):

```bash
cp .mcp.json /your/workspace/.mcp.json
# edit the path inside the file
```

Verify the connection:
```
/mcp
```
You should see `mcp-memory` listed with all 10 tools available.

---

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "mcp-memory": {
      "command": "pnpm",
      "args": ["--dir", "/absolute/path/to/mcp-memory", "start"]
    }
  }
}
```

If `pnpm` is not in PATH, use the full path:
```bash
which pnpm   # use this output as the "command" value
```

Restart Claude Desktop. Check **Settings → Developer → MCP Servers** to confirm.

---

### Kilo Code (VS Code extension)

Open VS Code → Command Palette → `Kilo Code: Open Settings` → **MCP Servers** → **Add Server**:

```json
{
  "name": "mcp-memory",
  "transport": "stdio",
  "command": "pnpm",
  "args": ["--dir", "/absolute/path/to/mcp-memory", "start"]
}
```

Or add to VS Code `settings.json` directly:

```json
{
  "kilocode.mcpServers": {
    "mcp-memory": {
      "transport": "stdio",
      "command": "pnpm",
      "args": ["--dir", "/absolute/path/to/mcp-memory", "start"]
    }
  }
}
```

---

### Cursor

Edit `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project-level):

```json
{
  "mcpServers": {
    "mcp-memory": {
      "command": "pnpm",
      "args": ["--dir", "/absolute/path/to/mcp-memory", "start"],
      "env": {}
    }
  }
}
```

Restart Cursor → **Settings → Features → MCP** to confirm.

---

### Windsurf (Codeium)

Edit `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "mcp-memory": {
      "command": "pnpm",
      "args": ["--dir", "/absolute/path/to/mcp-memory", "start"],
      "env": {}
    }
  }
}
```

---

### Zed

Edit `~/.config/zed/settings.json`:

```json
{
  "context_servers": {
    "mcp-memory": {
      "command": {
        "path": "pnpm",
        "args": ["--dir", "/absolute/path/to/mcp-memory", "start"]
      }
    }
  }
}
```

---

### Any stdio-compatible MCP client

```
command:  pnpm
args:     ["--dir", "/absolute/path/to/mcp-memory", "start"]
```

The server communicates over stdin/stdout using MCP JSON-RPC. No network port needed.

---

## Available tools (after connecting)

| Tool | Description |
|------|-------------|
| `search_codebase` | Semantic search in source code |
| `search_docs` | Semantic search in documentation |
| `search_memory` | Semantic search in chatlogs |
| `upsert_memory` | Create or update a memory by name |
| `save_memory` | Create a new memory entry |
| `update_memory` | Update memory by UUID |
| `delete_memory` | Delete memory by UUID |
| `list_memories` | List all memories with optional type filter |
| `search_memories` | Semantic search in structured memories |
| `reindex` | Trigger re-indexing: `code \| docs \| chatlogs \| all` |

---

## Troubleshooting

**`nomic-embed-text` model not found:**
```bash
ollama pull nomic-embed-text
# or re-run bootstrap:
pnpm bootstrap
```

**Ollama not running:**
```bash
ollama serve   # or open the Ollama app on macOS
# or re-run bootstrap (detects and starts automatically):
pnpm bootstrap
```

**`pnpm` not found in PATH:**
```bash
which pnpm   # use the full path as the command value
```

**Tables not indexed yet:**
```bash
cd /path/to/mcp-memory && pnpm index:all
```

**Server starts but tools return errors:** check that all paths in `.env` are absolute and the directories exist.
