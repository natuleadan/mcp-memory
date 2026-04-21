import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { getMemoryByName } from '../functions/index.js'

export function registerDataGetTool(server: McpServer) {
  server.tool(
    'data_get',
    'Direct O(1) lookup of a memory by its exact name.',
    {
      name: z.string().describe('Exact name of the memory to retrieve (e.g. "leo_profile")'),
    },
    async ({ name }) => {
      try {
        const memory = await getMemoryByName(name)
        if (!memory) return { content: [{ type: 'text', text: `Memory "${name}" not found.` }] }
        return {
          content: [{
            type: 'text',
            text: `**[${memory.id}]** \`${memory.type}\` — **${memory.name}** (w:${memory.weight})\n${memory.body}`,
          }],
        }
      } catch (e) {
        return { content: [{ type: 'text', text: `Error: ${String(e)}` }] }
      }
    }
  )
}