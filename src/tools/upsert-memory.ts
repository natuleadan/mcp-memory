import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { embed, getMemoriesTable, randomUUID } from './utils.js'

export function registerUpsertMemoryTool(server: McpServer) {
  server.tool(
    'upsert_memory',
    'Creates or updates a memory by name (no UUID needed). If a memory with the same name exists, it is updated; otherwise a new one is created.',
    {
      type: z.enum(['soul', 'user', 'feedback', 'project', 'reference', 'pending']).describe('Memory category'),
      name: z.string().describe('Unique name for the memory (e.g. feedback_pnpm)'),
      body: z.string().describe('Full memory content'),
      tags: z.string().default('').describe('Comma-separated tags for filtering'),
    },
    async ({ type, name, body, tags }) => {
      try {
        const table = await getMemoriesTable()
        const vector = await embed(`${name} ${body}`)
        const now = new Date().toISOString()

        // Check if a memory with this name already exists
        const existing = (await table.query().where(`name = '${name}'`).toArray()) as Array<{
          id: string; created_at: string
        }>

        if (existing.length) {
          const { id, created_at } = existing[0]
          await table.delete(`id = '${id}'`)
          await table.add([{ id, type, name, body, tags, created_at, updated_at: now, vector }])
          return { content: [{ type: 'text', text: `Memory "${name}" updated (id: ${id}).` }] }
        }

        const id = randomUUID()
        await table.add([{ id, type, name, body, tags, created_at: now, updated_at: now, vector }])
        return { content: [{ type: 'text', text: `Memory "${name}" created (id: ${id}).` }] }
      } catch (e) {
        return { content: [{ type: 'text', text: `Error upserting memory: ${String(e)}` }] }
      }
    }
  )
}
