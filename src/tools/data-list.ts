import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { listMemories, getMemoriesByTag } from '../functions/index.js'
import { memoryTypeAllSchema } from '../types/index.js'

export function registerDataListTool(server: McpServer) {
  server.tool(
    'data_list',
    'List all memories, optionally filtered by type or tag.',
    {
      type: memoryTypeAllSchema.optional().describe('Filter by memory type (omit for all)'),
      tag: z.string().optional().describe('Filter by tag (e.g. "CRITICAL", "commits")'),
    },
    async ({ type, tag }) => {
      try {
        if (tag) {
          const rows = await getMemoriesByTag(tag, type)
          if (!rows.length) return { content: [{ type: 'text', text: `No memories found with tag "${tag}".` }] }
          const formatted = rows.map(r => `**${r.name}** (\`${r.type}\`, tags: ${r.tags})`)
          return { content: [{ type: 'text', text: formatted.join('\n') }] }
        }
        const rows = await listMemories(type)
        if (!rows.length) return { content: [{ type: 'text', text: 'No memories found.' }] }
        const formatted = rows.map(r => `**${r.name}** (\`${r.type}\`, w:${r.weight}, ${r.updated_at.slice(0, 10)})`)
        return { content: [{ type: 'text', text: formatted.join('\n') }] }
      } catch (e) {
        return { content: [{ type: 'text', text: `Error: ${String(e)}` }] }
      }
    }
  )
}