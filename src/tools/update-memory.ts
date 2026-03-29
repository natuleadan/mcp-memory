import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { embed, getMemoriesTable } from './utils.js'
import { writeMemoryMd, deleteMemoryMd } from './obsidian-vault-client.js'

export function registerUpdateMemoryTool(server: McpServer) {
  server.tool(
    'update_memory',
    'Updates an existing memory by its id. Re-embeds body automatically.',
    {
      id: z.string().describe('Memory id to update'),
      name: z.string().optional().describe('New name (optional)'),
      body: z.string().optional().describe('New content (optional)'),
      tags: z.string().optional().describe('New tags (optional)'),
      write_to_obsidian: z
        .boolean()
        .default(true)
        .describe('Update markdown file in Obsidian vault (default: true)'),
    },
    async ({ id, name, body, tags, write_to_obsidian }) => {
      try {
        const table = await getMemoriesTable()
        const rows = await table.query().where(`id = '${id}'`).toArray()
        if (!rows.length)
          return { content: [{ type: 'text', text: `Memory id "${id}" not found.` }] }
        const existing = rows[0] as {
          type: string
          name: string
          body: string
          tags: string
          created_at: string
        }
        const newName = name ?? existing.name
        const newBody = body ?? existing.body
        const newTags = tags ?? existing.tags
        const vector = await embed(`${newName} ${newBody}`)
        const updated_at = new Date().toISOString()
        // Delete + re-insert to avoid vector column type issues
        await table.delete(`id = '${id}'`)
        await table.add([
          {
            id,
            type: existing.type,
            name: newName,
            body: newBody,
            tags: newTags,
            created_at: existing.created_at,
            updated_at,
            vector,
          },
        ])
        if (write_to_obsidian) {
          // If name changed, delete the old MD file first
          if (name && name !== existing.name) deleteMemoryMd(existing.type, existing.name)
          writeMemoryMd({
            id,
            type: existing.type,
            name: newName,
            body: newBody,
            tags: newTags,
            created_at: existing.created_at,
            updated_at,
          })
        }
        return { content: [{ type: 'text', text: `Memory "${id}" updated.` }] }
      } catch (e) {
        return { content: [{ type: 'text', text: `Error updating memory: ${String(e)}` }] }
      }
    }
  )
}
