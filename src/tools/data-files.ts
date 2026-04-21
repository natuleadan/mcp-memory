import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import { listMemoryFiles } from '../functions/index.js'
import { memoryTypeSchema } from '../types/index.js'

export function registerDataFilesTool(server: McpServer) {
  server.tool(
    'data_files',
    'List all markdown memory files in the memories folder, optionally filtered by type.',
    {
      type: memoryTypeSchema.optional().describe('Filter by memory type (omit for all)'),
    },
    async ({ type }) => {
      try {
        const files = listMemoryFiles(type)
        const formatted = files.map(f => `${f.type}/${f.name}.md`)
        return { content: [{ type: 'text', text: `${formatted.length} files:\n${formatted.join('\n')}` }] }
      } catch (e) {
        return { content: [{ type: 'text', text: `Error: ${String(e)}` }] }
      }
    }
  )
}