import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { getMemoriesTable, getTable } from './utils.js'

// Compact limits to keep token count low (~1-2k tokens max)
const BODY_PREVIEW = 120  // chars per memory body
const MAX_FEEDBACK = 10   // only most recent feedback rules
const MAX_PROJECTS = 5    // only most recent active projects
const MAX_CHATLOGS = 5    // only most recent chatlog entries
const CHATLOG_PREVIEW = 200 // chars per chatlog excerpt

export function registerLoadContextTool(server: McpServer) {
  server.tool(
    'load_context',
    'Loads a COMPACT summary of critical context: soul, user profile, recent feedback rules (name + 120-char preview), active projects (name only), and recent chatlog excerpts. Designed to stay under ~2k tokens. Use get_memory_by_name() or search_memories() to fetch full body of specific entries.',
    {
      days: z.coerce.number().default(7).describe('How many days of recent chatlogs to include (default: 7)'),
    },
    async ({ days }) => {
      const sections: string[] = []
      const errors: string[] = []

      try {
        const table = await getMemoriesTable()
        const rows = (await table.query()
          .where(`id != '__init__' AND (type = 'soul' OR type = 'user' OR type = 'feedback' OR type = 'project')`)
          .toArray()) as Array<{ id: string; type: string; name: string; body: string; updated_at: string }>

        const grouped: Record<string, typeof rows> = { soul: [], user: [], feedback: [], project: [] }
        for (const r of rows) {
          if (grouped[r.type]) grouped[r.type].push(r)
        }

        // Soul — full body (usually short)
        if (grouped.soul.length) {
          const lines = grouped.soul.map(r => `- **${r.name}**: ${r.body.slice(0, BODY_PREVIEW)}${r.body.length > BODY_PREVIEW ? '…' : ''}`)
          sections.push(`## Soul\n${lines.join('\n')}`)
        }

        // User — full body (always short)
        if (grouped.user.length) {
          sections.push(`## User\n${grouped.user.map(r => r.body).join('\n')}`)
        }

        // Feedback — name + short preview, sorted by newest, capped
        if (grouped.feedback.length) {
          const sorted = grouped.feedback.sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, MAX_FEEDBACK)
          const lines = sorted.map(r => `- **${r.name}** (${r.updated_at.slice(0, 10)}): ${r.body.split('\n')[0].slice(0, BODY_PREVIEW)}`)
          const remaining = grouped.feedback.length - MAX_FEEDBACK
          sections.push(`## Feedback Rules (${grouped.feedback.length} total, showing ${sorted.length})\n${lines.join('\n')}${remaining > 0 ? `\n_…${remaining} more — use search_memories(type: "feedback") to see all_` : ''}`)
        }

        // Projects — name + one-line status only
        if (grouped.project.length) {
          const sorted = grouped.project.sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, MAX_PROJECTS)
          const lines = sorted.map(r => `- **${r.name}** (${r.updated_at.slice(0, 10)}): ${r.body.split('\n')[0].slice(0, BODY_PREVIEW)}`)
          const remaining = grouped.project.length - MAX_PROJECTS
          sections.push(`## Active Projects (${grouped.project.length} total, showing ${sorted.length})\n${lines.join('\n')}${remaining > 0 ? `\n_…${remaining} more — use list_memories(type: "project")_` : ''}`)
        }
      } catch (e) {
        errors.push(`memories: ${String(e)}`)
      }

      // Recent chatlogs — short excerpts only
      try {
        const table = await getTable('chatlogs')
        const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
        const rows = (await table.query().where(`date >= '${cutoff}'`).toArray()) as Array<{
          date: string; rel_path: string; text: string
        }>
        rows.sort((a, b) => b.date.localeCompare(a.date))
        const sliced = rows.slice(0, MAX_CHATLOGS)
        if (sliced.length) {
          const lines = sliced.map(r => `- **${r.date}** ${r.rel_path}: ${r.text.slice(0, CHATLOG_PREVIEW).replace(/\n/g, ' ')}…`)
          sections.push(`## Recent Chatlogs (last ${days}d)\n${lines.join('\n')}`)
        }
      } catch {
        sections.push(`## Recent Chatlogs\n_Not indexed yet — run pnpm index:chatlogs_`)
      }

      if (errors.length) sections.push(`## Errors\n${errors.map(e => `- ${e}`).join('\n')}`)

      return { content: [{ type: 'text', text: sections.join('\n\n') || 'No context found.' }] }
    }
  )
}
