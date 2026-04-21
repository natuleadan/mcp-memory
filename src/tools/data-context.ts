import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { loadMemoriesContext, getContextForTask } from '../functions/index.js'
import { contextModeSchema } from '../types/index.js'

export function registerDataContextTool(server: McpServer) {
  server.tool(
    'data_context',
    {
      mode: contextModeSchema.optional().describe('Output verbosity: minimal (~50 tokens), compact (~1-2k), full (complete bodies)'),
      task: z.string().optional().describe('Smart context loader: given a task, retrieves most relevant feedback/project/reference memories'),
      limit: z.coerce.number().default(5).describe('Max memories for task mode'),
    },
    async ({ mode, task, limit }) => {
      try {
        if (task) {
          const context = await getContextForTask(task, limit)
          return { content: [{ type: 'text', text: context.join('\n\n---\n\n') || 'No context found.' }] }
        }
        const context = await loadMemoriesContext(mode ?? 'minimal')
        return { content: [{ type: 'text', text: context }] }
      } catch (e) {
        return { content: [{ type: 'text', text: `Error: ${String(e)}` }] }
      }
    }
  )
}