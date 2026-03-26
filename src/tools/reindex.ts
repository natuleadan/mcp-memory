import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { spawn } from 'child_process'

export function registerReindexTool(server: McpServer) {
  server.tool(
    'reindex',
    'Re-indexes the codebase, docs, chatlogs, or all into LanceDB. Use after adding new files or when search results feel stale.',
    {
      target: z.enum(['code', 'docs', 'chatlogs', 'all']).default('all').describe('What to reindex'),
    },
    ({ target }) => new Promise((resolve) => {
      const script = target === 'chatlogs'
        ? 'index:chatlogs'
        : target === 'all'
          ? 'index:all'
          : `index:${target}`

      const child = spawn('pnpm', [script], {
        cwd: process.env.MCP_MEMORY_DIR ?? process.cwd(),
        env: process.env,
      })

      const lines: string[] = []
      child.stdout.on('data', (d: Buffer) => lines.push(d.toString().trim()))
      child.stderr.on('data', (d: Buffer) => lines.push(d.toString().trim()))

      child.on('close', (code) => {
        const output = lines.filter(Boolean).join('\n')
        if (code === 0) {
          resolve({ content: [{ type: 'text', text: `Reindex "${target}" completed.\n\n${output}` }] })
        } else {
          resolve({ content: [{ type: 'text', text: `Reindex "${target}" failed (exit ${code}).\n\n${output}` }] })
        }
      })
    })
  )
}
