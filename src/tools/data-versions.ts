import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { getMemoryVersions } from '../functions/index.js'

export function registerDataVersionsTool(server: McpServer) {
  server.tool(
    'data_versions',
    'Lists all historical versions of a memory by name. Useful to track how a rule or project entry evolved over time. Note: Version history is only created when memory is updated (via data_update).',
    {
      name: z.string().describe('Exact name of the memory to inspect history for'),
    },
    async ({ name }) => {
      try {
        const versions = await getMemoryVersions(name)
        if (!versions.length) {
          return { content: [{ type: 'text', text: `No version history found for memory "${name}".\n\nNote: Versions are only created when a memory is updated (not on initial create).` }] }
        }
        const formatted = versions.map(r =>
          `**v${r.version}** — ${r.changed_at.slice(0, 16)}\n${r.body.slice(0, 400)}${r.body.length > 400 ? '…' : ''}`
        )
        return { content: [{ type: 'text', text: `History for **${name}** (${versions.length} versions):\n\n${formatted.join('\n\n---\n\n')}` }] }
      } catch (e) {
        return { content: [{ type: 'text', text: `Error: ${String(e)}` }] }
      }
    }
  )
}