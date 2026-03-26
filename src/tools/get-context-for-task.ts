import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { embed, getMemoriesTable } from './utils.js'

export function registerGetContextForTaskTool(server: McpServer) {
  server.tool(
    'get_context_for_task',
    'Smart context loader: given a task description, automatically retrieves the most relevant feedback rules, project state, and references — without loading unrelated memories. Ideal replacement for list_memories("all") at task start.',
    {
      task: z.string().describe('Description of the task you are about to perform (e.g. "commit changes to mcp-memory repo")'),
      limit: z.coerce.number().default(5).describe('Max relevant memories to return per category (default: 5)'),
    },
    async ({ task, limit }) => {
      try {
        const table = await getMemoriesTable()
        const vector = await embed(task)

        // Always load soul + user (compact, always relevant)
        const coreRows = (await table.query()
          .where(`id != '__init__' AND (type = 'soul' OR type = 'user')`)
          .toArray()) as Array<{ id: string; type: string; name: string; body: string; updated_at: string }>

        // Semantically load relevant feedback + project + reference
        const searchRows = (await table.search(vector).limit(limit * 3 + 1).toArray()) as Array<{
          id: string; type: string; name: string; body: string; updated_at: string
        }>
        const relevant = searchRows
          .filter(r => r.id !== '__init__' && !['soul', 'user'].includes(r.type))
          .slice(0, limit)

        const format = (rows: typeof coreRows, truncate = 0) =>
          rows.map(r => {
            const body = truncate && r.body.length > truncate
              ? r.body.slice(0, truncate) + '…'
              : r.body
            return `**${r.name}** [\`${r.type}\`] (${r.updated_at.slice(0, 10)})\n${body}`
          }).join('\n\n---\n\n')

        const sections: string[] = []

        if (coreRows.length) {
          sections.push(`## Identity & Profile\n\n${format(coreRows, 300)}`)
        }
        if (relevant.length) {
          sections.push(`## Relevant Rules & Context (for: "${task}")\n\n${format(relevant)}`)
        }

        return { content: [{ type: 'text', text: sections.join('\n\n===\n\n') || 'No context found.' }] }
      } catch (e) {
        return { content: [{ type: 'text', text: `Error loading context: ${String(e)}` }] }
      }
    }
  )
}
