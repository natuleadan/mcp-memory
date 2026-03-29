import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { readMemoryMd } from './obsidian-vault-client.js'

export function registerReadObsidianMemoryTool(server: McpServer) {
  server.tool(
    'read_obsidian_memory',
    'Read a specific memory markdown file from the Obsidian vault by type and name.',
    {
      type: z
        .enum(['soul', 'user', 'feedback', 'project', 'reference', 'pending'])
        .describe('Memory type'),
      name: z.string().describe('Memory name (e.g. feedback_commit_convention)'),
    },
    async ({ type, name }) => {
      try {
        const result = readMemoryMd(type, name)
        if (!result) {
          return { content: [{ type: 'text', text: `Memory "${type}/${name}.md" not found in Obsidian vault.` }] }
        }
        const fm = Object.entries(result.frontmatter)
          .map(([k, v]) => `${k}: ${v}`)
          .join('\n')
        return {
          content: [
            {
              type: 'text',
              text: `# ${name}\n\n**Frontmatter:**\n${fm}\n\n**Body:**\n${result.body}`,
            },
          ],
        }
      } catch (e) {
        return { content: [{ type: 'text', text: `Error reading obsidian memory: ${String(e)}` }] }
      }
    }
  )
}
