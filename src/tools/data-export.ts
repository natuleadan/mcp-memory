import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { exportToMemories } from '../functions/index.js'
import { memoryTypeSchema } from '../types/index.js'

export function registerDataExportTool(server: McpServer) {
  server.tool(
    'data_export',
    'Export all memories from the vector DB to markdown files.',
    {
      type: memoryTypeSchema.optional().describe('Export only this type (omit for all)'),
      overwrite: z.boolean().default(true).describe('Overwrite existing MD files'),
    },
    async ({ type, overwrite }) => {
      try {
        const result = await exportToMemories(type, overwrite)
        if (result.error) return { content: [{ type: 'text', text: `❌ ${result.error}` }] }
        return { content: [{ type: 'text', text: `✅ Exported ${result.exported}/${result.total} memories` }] }
      } catch (e) {
        return { content: [{ type: 'text', text: `Error: ${String(e)}` }] }
      }
    }
  )
}