import 'dotenv/config'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { ensureOllama } from './ollama-utils.js'
import { registerSearchCodebaseTool } from './tools/search-codebase.js'
import { registerSearchDocsTool } from './tools/search-docs.js'
import { registerSearchMemoryTool } from './tools/search-memory.js'
import { registerSearchMemoriesTool } from './tools/search-memories.js'
import { registerSearchMemoriesLiteTool } from './tools/search-memories-lite.js'
import { registerSaveMemoryTool } from './tools/save-memory.js'
import { registerUpdateMemoryTool } from './tools/update-memory.js'
import { registerDeleteMemoryTool } from './tools/delete-memory.js'
import { registerListMemoriesTool } from './tools/list-memories.js'
import { registerUpsertMemoryTool } from './tools/upsert-memory.js'
import { registerReindexTool } from './tools/reindex.js'
// Optimization tools
import { registerLoadContextTool } from './tools/load-context.js'
import { registerGetMemoryByNameTool } from './tools/get-memory-by-name.js'
import { registerGetRecentChatslogsTool } from './tools/get-recent-chatlogs.js'
import { registerGetMemoriesByTagTool } from './tools/get-memories-by-tag.js'
import { registerGetMemoryStatsTool } from './tools/get-memory-stats.js'
import { registerPurgeOldMemoriesTool } from './tools/purge-old-memories.js'
import { registerBatchSearchMemoriesTool } from './tools/batch-search-memories.js'
import { registerMemoryVersionsTool } from './tools/memory-versions.js'
import { registerGetContextForTaskTool } from './tools/get-context-for-task.js'
import { registerSearchGlobalTool } from './tools/search-global.js'

const server = new McpServer({ name: 'mcp-memory', version: '1.0.0' })

// Core search tools
registerSearchCodebaseTool(server)
registerSearchDocsTool(server)
registerSearchMemoryTool(server)
registerSearchMemoriesTool(server)
registerSearchMemoriesLiteTool(server)
registerSearchGlobalTool(server)
// Core memory CRUD
registerSaveMemoryTool(server)
registerUpdateMemoryTool(server)
registerDeleteMemoryTool(server)
registerListMemoriesTool(server)
registerUpsertMemoryTool(server)
registerReindexTool(server)
// Optimization & context tools
registerLoadContextTool(server)
registerGetMemoryByNameTool(server)
registerGetRecentChatslogsTool(server)
registerGetMemoriesByTagTool(server)
registerGetMemoryStatsTool(server)
registerPurgeOldMemoriesTool(server)
registerBatchSearchMemoriesTool(server)
registerMemoryVersionsTool(server)
registerGetContextForTaskTool(server)

async function main() {
  await ensureOllama()
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('🧠 mcp-memory server running (21 tools: core CRUD + search + global search + context optimization)')
}

main().catch(console.error)
