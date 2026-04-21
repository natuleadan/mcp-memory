import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { ensureOllama } from './ollama-utils.js'
import { registerDataSearchTool } from './tools/data-search.js'
import { registerDataListTool } from './tools/data-list.js'
import { registerDataCountTool } from './tools/data-count.js'
import { registerDataCreateTool } from './tools/data-create.js'
import { registerDataUpdateTool } from './tools/data-update.js'
import { registerDataDeleteTool } from './tools/data-delete.js'
import { registerDataGetTool } from './tools/data-get.js'
import { registerDataContextTool } from './tools/data-context.js'
import { registerDataRecentTool } from './tools/data-recent.js'
import { registerDataStatsTool } from './tools/data-stats.js'
import { registerDataFilesTool } from './tools/data-files.js'
import { registerDataSyncTool } from './tools/data-sync.js'
import { registerDataExportTool } from './tools/data-export.js'
import { registerDataVersionsTool } from './tools/data-versions.js'

export const VERBOSE = process.argv.includes('-v') || process.argv.includes('--verbose')

function logTool(name: string, args?: Record<string, unknown>) {
  if (!VERBOSE) return
  const params = args && Object.keys(args).length > 0 
    ? ` ${JSON.stringify(args)}` 
    : ''
  console.error(`\n🔧 ${name}${params}`)
}

const server = new McpServer({ name: 'mcp-memory', version: '1.0.0' })

const origConnect = server.connect.bind(server)
server.connect = async function(transport: StdioServerTransport) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const origHandle = (transport as any).handleRequest?.bind(transport)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(transport as any).handleRequest = async function(request: { method: string; params?: { name?: string; arguments?: Record<string, unknown> } }) {
    if (request.method === 'tools/call' && request.params?.name) {
      logTool(request.params.name, request.params.arguments)
    }
    return origHandle?.(request)
  }
  return origConnect(transport)
}

registerDataSearchTool(server)
registerDataListTool(server)
registerDataCountTool(server)
registerDataCreateTool(server)
registerDataUpdateTool(server)
registerDataDeleteTool(server)
registerDataGetTool(server)
registerDataContextTool(server)
registerDataRecentTool(server)
registerDataStatsTool(server)
registerDataFilesTool(server)
registerDataSyncTool(server)
registerDataExportTool(server)
registerDataVersionsTool(server)

async function main() {
  await ensureOllama()
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error(VERBOSE ? '🧠 mcp-memory ready (verbose)' : '🧠 mcp-memory ready')
}

main().catch(console.error)