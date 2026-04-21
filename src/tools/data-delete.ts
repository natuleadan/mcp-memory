import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { deleteMemory } from '../functions/index.js'

export function registerDataDeleteTool(server: McpServer) {
  server.tool(
    'data_delete',
    'Deletes a memory entry by its id.',
    {
      id: z.string().describe('Memory id to delete'),
    },
    async ({ id }) => {
      try {
        const result = await deleteMemory(id)
        return { content: [{ type: 'text', text: `✅ Deleted: ${result.deleted}` }] }
      } catch (e) {
        return { content: [{ type: 'text', text: `Error: ${String(e)}` }] }
      }
    }
  )
}