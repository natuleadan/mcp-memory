import 'dotenv/config'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { ensureOllama } from './ollama-utils.js'
import { registerSearchCodebaseTool } from './tools/search-codebase.js'
import { registerSearchDocsTool } from './tools/search-docs.js'
import { registerSearchMemoryTool } from './tools/search-memory.js'
import { registerSearchMemoriesTool } from './tools/search-memories.js'
import { registerSaveMemoryTool } from './tools/save-memory.js'
import { registerUpdateMemoryTool } from './tools/update-memory.js'
import { registerDeleteMemoryTool } from './tools/delete-memory.js'
import { registerListMemoriesTool } from './tools/list-memories.js'
import { registerUpsertMemoryTool } from './tools/upsert-memory.js'
import { registerReindexTool } from './tools/reindex.js'

const server = new McpServer({ name: 'mcp-memory', version: '1.0.0' })

// Register all tools
registerSearchCodebaseTool(server)
registerSearchDocsTool(server)
registerSearchMemoryTool(server)
registerSearchMemoriesTool(server)
registerSaveMemoryTool(server)
registerUpdateMemoryTool(server)
registerDeleteMemoryTool(server)
registerListMemoriesTool(server)
registerUpsertMemoryTool(server)
registerReindexTool(server)

async function main() {
  await ensureOllama()
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('🧠 mcp-memory server running (tools: search_codebase, search_docs, search_memory, save_memory, update_memory, delete_memory, list_memories, search_memories, upsert_memory, reindex)')
}

main().catch(console.error)
