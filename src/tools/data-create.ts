import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { createMemory } from '../functions/index.js'
import { memoryTypeSchema } from '../types/index.js'

export function registerDataCreateTool(server: McpServer) {
  server.tool(
    'data_create',
    'Creates a new memory entry to the persistent vector store.',
    {
      type: memoryTypeSchema.describe('Memory category'),
      name: z.string().describe('Unique name for the memory (e.g. feedback_pnpm)'),
      body: z.string().describe('Full memory content'),
      tags: z.string().default('').describe('Comma-separated lowercase tags for filtering'),
      weight: z.coerce.number().default(5).describe('Priority weight 1-10 (10=critical, 5=default, 1=archive)'),
    },
    async ({ type, name, body, tags, weight }) => {
      try {
        const result = await createMemory(type, name, body, tags, weight)
        return {
          content: [{ type: 'text', text: `✅ Created: ${result.id}\nName: ${result.name}\nType: ${result.type}` }],
        }
      } catch (e) {
        return { content: [{ type: 'text', text: `Error: ${String(e)}` }] }
      }
    }
  )
}