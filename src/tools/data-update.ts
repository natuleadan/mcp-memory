import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { updateMemory } from '../functions/index.js'

export function registerDataUpdateTool(server: McpServer) {
  server.tool(
    'data_update',
    'Updates an existing memory by its id. Re-embeds body automatically.',
    {
      id: z.string().describe('Memory id to update'),
      name: z.string().optional().describe('New name (optional)'),
      body: z.string().optional().describe('New content (optional)'),
      tags: z.string().optional().describe('New tags (optional)'),
      weight: z.coerce.number().optional().describe('New weight (optional)'),
    },
    async ({ id, name, body, tags, weight }) => {
      try {
        const result = await updateMemory(id, { name, body, tags, weight })
        return { content: [{ type: 'text', text: `✅ Updated: ${result.id}` }] }
      } catch (e) {
        return { content: [{ type: 'text', text: `Error: ${String(e)}` }] }
      }
    }
  )
}