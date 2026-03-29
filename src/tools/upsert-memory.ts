import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import * as lancedb from '@lancedb/lancedb'
import { embed, getMemoriesTable, randomUUID, LANCEDB_DIR, EMBED_DIM } from './utils.js'
import { writeMemoryMd } from './obsidian-vault-client.js'

// Ensures the memory_versions table exists for version tracking
async function getVersionsTable() {
  const db = await lancedb.connect(LANCEDB_DIR)
  const tables = await db.tableNames()
  if (!tables.includes('memory_versions')) {
    return db.createTable('memory_versions', [
      {
        id: '__init__',
        memory_id: '__init__',
        name: 'init',
        type: 'system',
        body: 'init',
        tags: '',
        version: 0,
        changed_at: new Date().toISOString(),
        vector: new Array(EMBED_DIM).fill(0) as number[],
      },
    ])
  }
  return db.openTable('memory_versions')
}

export function registerUpsertMemoryTool(server: McpServer) {
  server.tool(
    'upsert_memory',
    'Creates or updates a memory by name (no UUID needed). If a memory with the same name exists, it is updated and a version snapshot is saved automatically. Otherwise a new memory is created.',
    {
      type: z
        .enum(['soul', 'user', 'feedback', 'project', 'reference', 'pending'])
        .describe('Memory category'),
      name: z.string().describe('Unique name for the memory (e.g. feedback_pnpm)'),
      body: z.string().describe('Full memory content'),
      tags: z.string().default('').describe('Comma-separated lowercase tags for filtering'),
      write_to_obsidian: z
        .boolean()
        .default(true)
        .describe('Write memory as markdown file to Obsidian vault (default: true)'),
    },
    async ({ type, name, body, tags, write_to_obsidian }) => {
      try {
        const table = await getMemoriesTable()
        const vector = await embed(`${name} ${body}`)
        const now = new Date().toISOString()

        // Normalize tags to lowercase
        const normalizedTags = tags.toLowerCase().trim()

        // Check if memory with this name already exists
        const existing = (await table.query().where(`name = '${name}'`).toArray()) as Array<{
          id: string
          type: string
          body: string
          tags: string
          created_at: string
          version?: number
        }>

        if (existing.length) {
          const { id, created_at, body: oldBody, version } = existing[0]
          const nextVersion = (version ?? 0) + 1

          // Save version snapshot before overwriting
          try {
            const versionsTable = await getVersionsTable()
            const versionVector = await embed(`${name} ${oldBody}`)
            await versionsTable.add([
              {
                id: randomUUID(),
                memory_id: id,
                name,
                type,
                body: oldBody,
                tags: existing[0].tags,
                version: nextVersion - 1,
                changed_at: now,
                vector: versionVector,
              },
            ])
          } catch {
            // Version tracking failure is non-fatal
          }

          await table.delete(`id = '${id}'`)
          await table.add([
            {
              id,
              type,
              name,
              body,
              tags: normalizedTags,
              created_at,
              updated_at: now,
              version: nextVersion,
              vector,
            },
          ])
          if (write_to_obsidian) {
            writeMemoryMd({ id, type, name, body, tags: normalizedTags, created_at, updated_at: now })
          }
          return {
            content: [
              { type: 'text', text: `Memory "${name}" updated to v${nextVersion} (id: ${id}).` },
            ],
          }
        }

        const id = randomUUID()
        await table.add([
          {
            id,
            type,
            name,
            body,
            tags: normalizedTags,
            created_at: now,
            updated_at: now,
            version: 1,
            vector,
          },
        ])
        if (write_to_obsidian) {
          writeMemoryMd({ id, type, name, body, tags: normalizedTags, created_at: now, updated_at: now })
        }
        return { content: [{ type: 'text', text: `Memory "${name}" created v1 (id: ${id}).` }] }
      } catch (e) {
        return { content: [{ type: 'text', text: `Error upserting memory: ${String(e)}` }] }
      }
    }
  )
}
