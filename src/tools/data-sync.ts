import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { syncMemoryFiles } from '../functions/index.js'
import { memoryTypeSchema } from '../types/index.js'

export function registerDataSyncTool(server: McpServer) {
  server.tool(
    'data_sync',
    'Sync memories markdown files back into the vector DB. Use this after editing memory files directly.',
    {
      type: memoryTypeSchema.optional().describe('Sync only this type (omit to sync all)'),
      dry_run: z.boolean().default(false).describe('Preview changes without writing to DB'),
      import_missing: z.boolean().default(false).describe('Import files missing in DB'),
    },
    async ({ type, dry_run, import_missing }) => {
      try {
        const result = await syncMemoryFiles(type, dry_run, import_missing)
        return { content: [{ type: 'text', text: String(result) }] }
      } catch (e) {
        return { content: [{ type: 'text', text: `Error: ${String(e)}` }] }
      }
    }
  )
}