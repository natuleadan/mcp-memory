import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { embed, getMemoriesTable, randomUUID } from './utils.js'

export function registerSaveMemoryTool(server: McpServer) {
  server.tool(
    'save_memory',
    'Saves a new memory entry (user, feedback, project, reference) to the persistent vector store.',
    {
      type: z.enum(['soul', 'user', 'feedback', 'project', 'reference', 'pending']).describe('Memory category'),
      name: z.string().describe('Short unique name for the memory (e.g. feedback_pnpm)'),
      body: z.string().describe('Full memory content'),
      tags: z.string().default('').describe('Comma-separated tags for filtering'),
    },
    async ({ type, name, body, tags }) => {
      try {
        const table = await getMemoriesTable()
        const vector = await embed(`${name} ${body}`)
        const now = new Date().toISOString()
        await table.add([{ id: randomUUID(), type, name, body, tags, created_at: now, updated_at: now, vector }])
        return { content: [{ type: 'text', text: `Memory "${name}" saved.` }] }
      } catch (e) {
        return { content: [{ type: 'text', text: `Error saving memory: ${String(e)}` }] }
      }
    }
  )
}
