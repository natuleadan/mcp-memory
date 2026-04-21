import 'dotenv/config'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { syncMemoryFiles } from '../functions/index.js'


export function registerDataSyncTool(server: McpServer) {
  server.tool(
    'data_sync',
    'Bidirectional sync between markdown files and vector DB. Compares timestamps, auto-resolves, warns on conflicts.',
{
        type: z.string().optional().describe('Sync only this type (omit to sync all)'),
        dry_run: z.boolean().describe('Preview changes without writing'),
        import_missing: z.boolean().describe('Only import MD→DB (skip DB→MD exports)'),
        export_missing: z.boolean().describe('Only export DB→MD (skip MD→DB imports)'),
        auto_resolve: z.enum(['newest', 'db', 'md', 'warn']).describe('Resolve conflicts: newest (latest wins), db, md, or warn (show conflicts)'),
      },
    async ({ type, dry_run, import_missing, export_missing, auto_resolve }) => {
      try {
        const { actions, conflicts } = await syncMemoryFiles(type, dry_run, import_missing, export_missing, auto_resolve)

        const lines: string[] = []
        if (conflicts.length > 0) {
          lines.push(`⚠️ ${conflicts.length} conflict(s) detected:`)
          for (const c of conflicts) {
            lines.push(`  ${c.name}: ${c.details}`)
          }
        }
        if (actions.length > 0) {
          lines.push(`${dry_run ? '[dry-run] ' : ''}${actions.length} action(s):`)
          for (const a of actions) {
            const symbol = a.type === 'import' ? '→' : a.type === 'export' ? '←' : '↔'
            lines.push(`  ${a.type} ${symbol} ${a.name}`)
          }
        }
        if (actions.length === 0 && conflicts.length === 0) {
          lines.push('No differences')
        }

        return { content: [{ type: 'text', text: lines.join('\n') }] }
      } catch (e) {
        return { content: [{ type: 'text', text: `Error: ${String(e)}` }] }
      }
    }
  )
}
