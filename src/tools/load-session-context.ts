import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { getMemoriesTable, getTable } from './utils.js'

export function registerLoadSessionContextTool(server: McpServer) {
  server.tool(
    'load_session_context',
    [
      '🎯 RECOMMENDED: Optimized context loader for session start. Uses minimal mode + smart fallback.',
      'Returns only memory names (~50 tokens) for fast session bootstrap.',
      'Then use search_memories_lite() for targeted lookups instead of loading full context.',
      'If you need more context after names load, call this again with include_previews=true.',
    ].join(' '),
    {
      include_previews: z
        .boolean()
        .default(false)
        .describe('Include 120-char previews (compact mode)?'),
      days: z.coerce
        .number()
        .default(7)
        .describe('Days of recent chatlogs to include (default: 7)'),
    },
    async ({ include_previews, days }) => {
      const sections: string[] = []

      try {
        const table = await getMemoriesTable()
        const rows = (await table
          .query()
          .where(
            `id != '__init__' AND (type = 'soul' OR type = 'user' OR type = 'feedback' OR type = 'project')`
          )
          .toArray()) as Array<{
          id: string
          type: string
          name: string
          body: string
          updated_at: string
        }>

        const grouped: Record<string, typeof rows> = {
          soul: [],
          user: [],
          feedback: [],
          project: [],
        }

        for (const r of rows) {
          if (grouped[r.type]) grouped[r.type].push(r)
        }

        if (!include_previews) {
          // Minimal: just names
          const lines: string[] = []
          for (const [type, entries] of Object.entries(grouped)) {
            if (entries.length) {
              lines.push(`${type} (${entries.length}): ${entries.map((r) => r.name).join(', ')}`)
            }
          }
          sections.push(`## Session Context — Memory Index\n${lines.join('\n')}`)
          sections.push(
            `_Total: ${rows.length} memories. Use search_memories_lite(query) for targeted lookups._`
          )
        } else {
          // Compact: names + preview
          const PREVIEW = 120
          const MAX_FEEDBACK = 10
          const MAX_PROJECTS = 5

          if (grouped.user.length) {
            sections.push(`## User\n${grouped.user.map((r) => r.body).join('\n')}`)
          }
          if (grouped.soul.length) {
            const lines = grouped.soul.map((r) => `- **${r.name}**: ${r.body.slice(0, PREVIEW)}…`)
            sections.push(`## Soul\n${lines.join('\n')}`)
          }
          if (grouped.feedback.length) {
            const byDate = (a: { updated_at: string }, b: { updated_at: string }) =>
              b.updated_at.localeCompare(a.updated_at)
            const sorted = grouped.feedback.sort(byDate).slice(0, MAX_FEEDBACK)
            const lines = sorted.map(
              (r) =>
                `- **${r.name}** (${r.updated_at.slice(0, 10)}): ${r.body.split('\n')[0].slice(0, PREVIEW)}`
            )
            const extra = grouped.feedback.length - MAX_FEEDBACK
            sections.push(
              `## Feedback (${grouped.feedback.length} total, ${sorted.length} shown)\n${lines.join('\n')}${extra > 0 ? `\n_+${extra} more — use search_memories(type:"feedback")_` : ''}`
            )
          }
          if (grouped.project.length) {
            const byDate = (a: { updated_at: string }, b: { updated_at: string }) =>
              b.updated_at.localeCompare(a.updated_at)
            const sorted = grouped.project.sort(byDate).slice(0, MAX_PROJECTS)
            const lines = sorted.map(
              (r) =>
                `- **${r.name}** (${r.updated_at.slice(0, 10)}): ${r.body.split('\n')[0].slice(0, PREVIEW)}`
            )
            const extra = grouped.project.length - MAX_PROJECTS
            sections.push(
              `## Projects (${grouped.project.length} total, ${sorted.length} shown)\n${lines.join('\n')}${extra > 0 ? `\n_+${extra} more — use list_memories(type:"project")_` : ''}`
            )
          }
        }

        // Recent chatlogs
        try {
          const table = await getTable('chatlogs')
          const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
          const rows = (await table.query().where(`date >= '${cutoff}'`).toArray()) as Array<{
            date: string
            rel_path: string
            text: string
          }>
          rows.sort((a, b) => b.date.localeCompare(a.date))
          const limit = include_previews ? 5 : 3
          const preview = include_previews ? 200 : 150
          const sliced = rows.slice(0, limit)
          if (sliced.length) {
            const lines = sliced.map(
              (r) =>
                `- **${r.date}** ${r.rel_path}: ${r.text.slice(0, preview).replace(/\n/g, ' ')}…`
            )
            sections.push(
              `## Recent Chatlogs (last ${days}d, ${sliced.length} entries)\n${lines.join('\n')}`
            )
          }
        } catch {
          // Chatlogs not indexed yet — silently skip
        }
      } catch (e) {
        // Fallback to minimal index listing
        console.error(`⚠️ Error loading session context: ${String(e)}, falling back to names only`)
        try {
          const table = await getMemoriesTable()
          const rows = (await table.query().where(`id != '__init__'`).toArray()) as Array<{
            type: string
            name: string
          }>

          const grouped: Record<string, string[]> = {
            soul: [],
            user: [],
            feedback: [],
            project: [],
            reference: [],
            pending: [],
          }
          for (const r of rows) {
            if (grouped[r.type]) grouped[r.type].push(r.name)
          }

          const lines: string[] = []
          for (const [type, names] of Object.entries(grouped)) {
            if (names.length) lines.push(`${type} (${names.length}): ${names.join(', ')}`)
          }
          sections.push(`## Session Context — Fallback Index\n${lines.join('\n')}`)
        } catch (fallbackError) {
          sections.push(`_Critical error: ${String(fallbackError)}_`)
        }
      }

      return { content: [{ type: 'text', text: sections.join('\n\n') || 'No context found.' }] }
    }
  )
}
