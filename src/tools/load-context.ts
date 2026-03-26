import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { getMemoriesTable, getTable } from './utils.js'

export function registerLoadContextTool(server: McpServer) {
  server.tool(
    'load_context',
    [
      'Loads critical context at session start. Three modes:',
      '- minimal: only memory names list (~200 tokens)',
      '- compact (default): names + 120-char preview (~1-2k tokens)',
      '- full: complete body for soul+user, previews for feedback+project',
      'Use get_memory_by_name() or search_memories() to fetch full body of specific entries.',
    ].join(' '),
    {
      mode: z.enum(['minimal', 'compact', 'full']).default('compact').describe('Output verbosity: minimal | compact (default) | full'),
      days: z.coerce.number().default(7).describe('Days of recent chatlogs to include (default: 7)'),
    },
    async ({ mode, days }) => {
      const sections: string[] = []

      try {
        const table = await getMemoriesTable()
        const rows = (await table.query()
          .where(`id != '__init__' AND (type = 'soul' OR type = 'user' OR type = 'feedback' OR type = 'project')`)
          .toArray()) as Array<{ id: string; type: string; name: string; body: string; updated_at: string }>

        const grouped: Record<string, typeof rows> = { soul: [], user: [], feedback: [], project: [] }
        for (const r of rows) {
          if (grouped[r.type]) grouped[r.type].push(r)
        }
        const byDate = (a: { updated_at: string }, b: { updated_at: string }) => b.updated_at.localeCompare(a.updated_at)

        if (mode === 'minimal') {
          // Only names grouped by type — minimal token usage
          const lines: string[] = []
          for (const [type, entries] of Object.entries(grouped)) {
            if (entries.length) lines.push(`${type}: ${entries.map(r => r.name).join(', ')}`)
          }
          sections.push(`## Memory Index\n${lines.join('\n')}`)

        } else if (mode === 'compact') {
          // Name + 120-char first line — default
          const PREVIEW = 120
          const MAX_FEEDBACK = 10
          const MAX_PROJECTS = 5

          if (grouped.user.length) {
            sections.push(`## User\n${grouped.user.map(r => r.body).join('\n')}`)
          }
          if (grouped.soul.length) {
            const lines = grouped.soul.map(r => `- **${r.name}**: ${r.body.slice(0, PREVIEW)}…`)
            sections.push(`## Soul\n${lines.join('\n')}`)
          }
          if (grouped.feedback.length) {
            const sorted = grouped.feedback.sort(byDate).slice(0, MAX_FEEDBACK)
            const lines = sorted.map(r => `- **${r.name}** (${r.updated_at.slice(0, 10)}): ${r.body.split('\n')[0].slice(0, PREVIEW)}`)
            const extra = grouped.feedback.length - MAX_FEEDBACK
            sections.push(`## Feedback (${grouped.feedback.length} total, ${sorted.length} shown)\n${lines.join('\n')}${extra > 0 ? `\n_+${extra} more — use search_memories(type:"feedback")_` : ''}`)
          }
          if (grouped.project.length) {
            const sorted = grouped.project.sort(byDate).slice(0, MAX_PROJECTS)
            const lines = sorted.map(r => `- **${r.name}** (${r.updated_at.slice(0, 10)}): ${r.body.split('\n')[0].slice(0, PREVIEW)}`)
            const extra = grouped.project.length - MAX_PROJECTS
            sections.push(`## Projects (${grouped.project.length} total, ${sorted.length} shown)\n${lines.join('\n')}${extra > 0 ? `\n_+${extra} more — use list_memories(type:"project")_` : ''}`)
          }

        } else {
          // full — complete body for soul+user, 400-char preview for feedback+project
          const PREVIEW = 400
          if (grouped.user.length) sections.push(`## User\n${grouped.user.map(r => r.body).join('\n')}`)
          if (grouped.soul.length) sections.push(`## Soul\n${grouped.soul.map(r => `**${r.name}**\n${r.body}`).join('\n\n---\n\n')}`)
          if (grouped.feedback.length) {
            const lines = grouped.feedback.sort(byDate).map(r =>
              `- **${r.name}** (${r.updated_at.slice(0, 10)}): ${r.body.slice(0, PREVIEW).replace(/\n/g, ' ')}${r.body.length > PREVIEW ? '…' : ''}`
            )
            sections.push(`## Feedback (${grouped.feedback.length})\n${lines.join('\n')}`)
          }
          if (grouped.project.length) {
            const lines = grouped.project.sort(byDate).map(r =>
              `- **${r.name}** (${r.updated_at.slice(0, 10)}): ${r.body.slice(0, PREVIEW).replace(/\n/g, ' ')}${r.body.length > PREVIEW ? '…' : ''}`
            )
            sections.push(`## Projects (${grouped.project.length})\n${lines.join('\n')}`)
          }
        }
      } catch (e) {
        sections.push(`_Error loading memories: ${String(e)}_`)
      }

      // Recent chatlogs — always compact regardless of mode
      try {
        const table = await getTable('chatlogs')
        const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
        const rows = (await table.query().where(`date >= '${cutoff}'`).toArray()) as Array<{
          date: string; rel_path: string; text: string
        }>
        rows.sort((a, b) => b.date.localeCompare(a.date))
        const limit = mode === 'minimal' ? 3 : mode === 'compact' ? 5 : 10
        const preview = mode === 'full' ? 400 : 200
        const sliced = rows.slice(0, limit)
        if (sliced.length) {
          const lines = sliced.map(r => `- **${r.date}** ${r.rel_path}: ${r.text.slice(0, preview).replace(/\n/g, ' ')}…`)
          sections.push(`## Recent Chatlogs (last ${days}d, ${sliced.length} entries)\n${lines.join('\n')}`)
        }
      } catch {
        sections.push(`## Recent Chatlogs\n_Not indexed — run pnpm index:chatlogs_`)
      }

      return { content: [{ type: 'text', text: sections.join('\n\n') || 'No context found.' }] }
    }
  )
}
