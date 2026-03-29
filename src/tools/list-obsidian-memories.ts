import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { listMemoryMds } from './obsidian-vault-client.js'

export function registerListObsidianMemoriesTool(server: McpServer) {
  server.tool(
    'list_obsidian_memories',
    'List all markdown memory files in the Obsidian vault, optionally filtered by type.',
    {
      type: z
        .enum(['soul', 'user', 'feedback', 'project', 'reference', 'pending'])
        .optional()
        .describe('Filter by memory type (omit for all)'),
    },
    async ({ type }) => {
      try {
        const files = listMemoryMds(type)
        if (!files.length) {
          return { content: [{ type: 'text', text: `No markdown memories found${type ? ` for type "${type}"` : ''}.` }] }
        }
        const lines = files.map((f) => `[${f.type}] ${f.name}`)
        return {
          content: [
            {
              type: 'text',
              text: `Found ${files.length} memories in Obsidian vault:\n${lines.join('\n')}`,
            },
          ],
        }
      } catch (e) {
        return { content: [{ type: 'text', text: `Error listing obsidian memories: ${String(e)}` }] }
      }
    }
  )
}
