import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { embed, getMemoriesTable, getTable } from './utils.js'

export function registerSearchGlobalTool(server: McpServer) {
  server.tool(
    'search_global',
    'Unified search across all 4 memory layers (memories, codebase, docs, chatlogs) in parallel. Compact mode returns excerpts with source location (~2-3k tokens). Full mode returns complete bodies.',
    {
      query: z.string().describe('What to search for across all memory layers'),
      limit: z.coerce.number().default(3).describe('Max results per table (default: 3)'),
      mode: z
        .enum(['compact', 'full'])
        .default('compact')
        .describe('compact (excerpts + location) | full (complete bodies)'),
    },
    async ({ query, limit, mode }) => {
      try {
        const vector = await embed(query)
        const sections: string[] = []

        // Parallel searches across all 4 tables
        const [memoriesResults, codebaseResults, docsResults, chatlogsResults] = await Promise.all([
          (async () => {
            try {
              const table = await getMemoriesTable()
              const rows = (await table.search(vector).limit(limit).toArray()) as Array<{
                id: string
                type: string
                name: string
                body: string
                updated_at: string
              }>
              return rows.filter((r) => r.id !== '__init__')
            } catch {
              return []
            }
          })(),
          (async () => {
            try {
              const table = await getTable('codebase')
              return (await table.search(vector).limit(limit).toArray()) as Array<{
                rel_path: string
                ext: string
                text: string
              }>
            } catch {
              return []
            }
          })(),
          (async () => {
            try {
              const table = await getTable('docs')
              return (await table.search(vector).limit(limit).toArray()) as Array<{
                rel_path: string
                ext: string
                text: string
              }>
            } catch {
              return []
            }
          })(),
          (async () => {
            try {
              const table = await getTable('chatlogs')
              return (await table.search(vector).limit(limit).toArray()) as Array<{
                rel_path: string
                date: string
                text: string
              }>
            } catch {
              return []
            }
          })(),
        ])

        // Format results by source_type
        if (memoriesResults.length) {
          const lines = memoriesResults.map((r) => {
            const excerpt =
              r.body.slice(0, 200).replace(/\n/g, ' ') + (r.body.length > 200 ? '…' : '')
            const body = mode === 'full' ? `\n${r.body}` : ''
            return `  - **${r.name}** (\`${r.type}\`) [${r.id}]\n    📍 Memory\n    ${excerpt}${body}`
          })
          sections.push(`## Memories (${memoriesResults.length})\n${lines.join('\n')}`)
        }

        if (codebaseResults.length) {
          const lines = codebaseResults.map((r) => {
            const excerpt =
              r.text.slice(0, 200).replace(/\n/g, ' ') + (r.text.length > 200 ? '…' : '')
            const body = mode === 'full' ? `\n\`\`\`${r.ext.slice(1)}\n${r.text}\n\`\`\`` : ''
            return `  - **${r.rel_path}**\n    📍 ${r.rel_path}\n    ${excerpt}${body}`
          })
          sections.push(`## Codebase (${codebaseResults.length})\n${lines.join('\n')}`)
        }

        if (docsResults.length) {
          const lines = docsResults.map((r) => {
            const excerpt =
              r.text.slice(0, 200).replace(/\n/g, ' ') + (r.text.length > 200 ? '…' : '')
            const body = mode === 'full' ? `\n${r.text}` : ''
            return `  - **${r.rel_path}**\n    📍 ${r.rel_path}\n    ${excerpt}${body}`
          })
          sections.push(`## Docs (${docsResults.length})\n${lines.join('\n')}`)
        }

        if (chatlogsResults.length) {
          const lines = chatlogsResults.map((r) => {
            const excerpt =
              r.text.slice(0, 200).replace(/\n/g, ' ') + (r.text.length > 200 ? '…' : '')
            const body = mode === 'full' ? `\n${r.text}` : ''
            return `  - **${r.rel_path}** (${r.date})\n    📍 ${r.rel_path}\n    ${excerpt}${body}`
          })
          sections.push(`## Chatlogs (${chatlogsResults.length})\n${lines.join('\n')}`)
        }

        const totalResults =
          memoriesResults.length +
          codebaseResults.length +
          docsResults.length +
          chatlogsResults.length
        if (totalResults === 0) {
          return { content: [{ type: 'text', text: 'No results found across any memory layer.' }] }
        }

        const tokenWarning =
          mode === 'full' && totalResults > 10
            ? '\n⚠️ **Full mode with many results may exceed token limits.** Consider using `mode: "compact"` instead.'
            : ''

        return {
          content: [
            {
              type: 'text',
              text: `**Global Search:** "${query}" (${totalResults} total results)${tokenWarning}\n\n${sections.join('\n\n')}`,
            },
          ],
        }
      } catch (e) {
        return { content: [{ type: 'text', text: `Error in global search: ${String(e)}` }] }
      }
    }
  )
}
