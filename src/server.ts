import 'dotenv/config'
import * as lancedb from '@lancedb/lancedb'
import { Ollama } from 'ollama'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { spawn } from 'child_process'
import { ensureOllama } from './ollama-utils.js'

const ollama = new Ollama({ host: process.env.OLLAMA_HOST ?? 'http://localhost:11434' })
const LANCEDB_DIR = process.env.LANCEDB_DIR!

// --- EMBED DIM for nomic-embed-text ---
const EMBED_DIM = 768

async function getTable(name: string) {
  const db = await lancedb.connect(LANCEDB_DIR)
  return db.openTable(name)
}

async function embed(text: string): Promise<number[]> {
  const res = await ollama.embeddings({ model: 'nomic-embed-text', prompt: text })
  return res.embedding
}

// --- MEMORIES TABLE: get or create ---
async function getMemoriesTable() {
  const db = await lancedb.connect(LANCEDB_DIR)
  const tables = await db.tableNames()
  if (!tables.includes('memories')) {
    return db.createTable('memories', [
      {
        id: '__init__',
        type: 'system',
        name: 'init',
        body: 'init',
        tags: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        vector: new Array(EMBED_DIM).fill(0) as number[],
      },
    ])
  }
  return db.openTable('memories')
}

const server = new McpServer({ name: 'mcp-memory', version: '1.0.0' })

// --- TOOL: search_codebase ---
// Table `codebase`: .ts .tsx .js .jsx .mjs — implementations, services, hooks, components
server.tool(
  'search_codebase',
  'Semantic search in source code (.ts .tsx .js .jsx). Use to find implementations, functions, services, hooks or components.',
  {
    query: z.string().describe('What to search for in the source code'),
    limit: z.number().default(5).describe('Number of results'),
  },
  async ({ query, limit }) => {
    try {
      const vector = await embed(query)
      const table = await getTable('codebase')
      const results = await table.search(vector).limit(limit).toArray()
      const formatted = results.map((r: { rel_path: string; text: string }) =>
        `### ${r.rel_path}\n\`\`\`\n${r.text}\n\`\`\``
      )
      return {
        content: [{ type: 'text', text: formatted.join('\n\n---\n\n') || 'Sin resultados.' }],
      }
    } catch {
      return { content: [{ type: 'text', text: 'Codebase no indexado aún. Corre pnpm index:code' }] }
    }
  }
)

// --- TOOL: search_docs ---
// Table `docs`: .md .sql .json .env.example — documentation, rules, schemas, configuration
server.tool(
  'search_docs',
  'Semantic search in documentation (.md .sql .json). Use to find rules, guides, SQL schemas or configuration.',
  {
    query: z.string().describe('What to search for in the documentation'),
    limit: z.number().default(5).describe('Number of results'),
  },
  async ({ query, limit }) => {
    try {
      const vector = await embed(query)
      const table = await getTable('docs')
      const results = await table.search(vector).limit(limit).toArray()
      const formatted = results.map((r: { rel_path: string; text: string }) =>
        `### ${r.rel_path}\n${r.text}`
      )
      return {
        content: [{ type: 'text', text: formatted.join('\n\n---\n\n') || 'Sin resultados.' }],
      }
    } catch {
      return { content: [{ type: 'text', text: 'Docs no indexados aún. Corre pnpm index:docs' }] }
    }
  }
)

// --- TOOL: search_memory ---
// Table `chatlogs`: conversation history
server.tool(
  'search_memory',
  'Semantic search in conversation history/chatlogs.',
  {
    query: z.string().describe('What to search for in the conversation history'),
    limit: z.number().default(5),
  },
  async ({ query, limit }) => {
    try {
      const vector = await embed(query)
      const table = await getTable('chatlogs')
      const results = await table.search(vector).limit(limit).toArray()
      const formatted = results.map((r: { date: string; rel_path: string; text: string }) =>
        `### ${r.rel_path} (${r.date})\n${r.text}`
      )
      return {
        content: [{ type: 'text', text: formatted.join('\n\n---\n\n') || 'Sin resultados.' }],
      }
    } catch {
      return { content: [{ type: 'text', text: 'Chatlogs no indexados aún. Corre pnpm index:chatlogs' }] }
    }
  }
)

// --- TOOL: save_memory ---
server.tool(
  'save_memory',
  'Saves a new memory entry (user, feedback, project, reference) to the persistent vector store.',
  {
    type: z.enum(['soul', 'user', 'feedback', 'project', 'reference', 'pending']).describe('Memory category'),
    name: z.string().describe('Short unique name for the memory (e.g. feedback_pnpm)'),
    body: z.string().describe('Full memory content'),
    tags: z.string().default('').describe('Comma-separated tags for filtering'),
  },
  async ({ type, name, body, tags }) => {
    try {
      const table = await getMemoriesTable()
      const vector = await embed(`${name} ${body}`)
      const now = new Date().toISOString()
      await table.add([{ id: randomUUID(), type, name, body, tags, created_at: now, updated_at: now, vector }])
      return { content: [{ type: 'text', text: `Memory "${name}" saved.` }] }
    } catch (e) {
      return { content: [{ type: 'text', text: `Error saving memory: ${String(e)}` }] }
    }
  }
)

// --- TOOL: update_memory ---
server.tool(
  'update_memory',
  'Updates an existing memory by its id. Re-embeds body automatically.',
  {
    id: z.string().describe('Memory id to update'),
    name: z.string().optional().describe('New name (optional)'),
    body: z.string().optional().describe('New content (optional)'),
    tags: z.string().optional().describe('New tags (optional)'),
  },
  async ({ id, name, body, tags }) => {
    try {
      const table = await getMemoriesTable()
      const rows = await table.query().where(`id = '${id}'`).toArray()
      if (!rows.length) return { content: [{ type: 'text', text: `Memory id "${id}" not found.` }] }
      const existing = rows[0] as { type: string; name: string; body: string; tags: string; created_at: string }
      const newName = name ?? existing.name
      const newBody = body ?? existing.body
      const newTags = tags ?? existing.tags
      const vector = await embed(`${newName} ${newBody}`)
      const updated_at = new Date().toISOString()
      // Delete + re-insert to avoid vector column type issues
      await table.delete(`id = '${id}'`)
      await table.add([{ id, type: existing.type, name: newName, body: newBody, tags: newTags, created_at: existing.created_at, updated_at, vector }])
      return { content: [{ type: 'text', text: `Memory "${id}" updated.` }] }
    } catch (e) {
      return { content: [{ type: 'text', text: `Error updating memory: ${String(e)}` }] }
    }
  }
)

// --- TOOL: delete_memory ---
server.tool(
  'delete_memory',
  'Deletes a memory entry by its id.',
  {
    id: z.string().describe('Memory id to delete'),
  },
  async ({ id }) => {
    try {
      const table = await getMemoriesTable()
      await table.delete(`id = '${id}'`)
      return { content: [{ type: 'text', text: `Memory "${id}" deleted.` }] }
    } catch (e) {
      return { content: [{ type: 'text', text: `Error deleting memory: ${String(e)}` }] }
    }
  }
)

// --- TOOL: list_memories ---
server.tool(
  'list_memories',
  'Lists all saved memories, optionally filtered by type.',
  {
    type: z.enum(['soul', 'user', 'feedback', 'project', 'reference', 'pending', 'all']).default('all').describe('Filter by type or "all"'),
  },
  async ({ type }) => {
    try {
      const table = await getMemoriesTable()
      const filter = type !== 'all'
        ? `id != '__init__' AND type = '${type}'`
        : `id != '__init__'`
      const rows = (await table.query().where(filter).toArray()) as Array<{
        id: string; type: string; name: string; body: string; tags: string; updated_at: string
      }>
      if (!rows.length) return { content: [{ type: 'text', text: 'No memories found.' }] }
      const formatted = rows.map(r =>
        `**[${r.id}]** \`${r.type}\` — **${r.name}** (${r.updated_at.slice(0, 10)})\n${r.body}${r.tags ? `\n_tags: ${r.tags}_` : ''}`
      )
      return { content: [{ type: 'text', text: formatted.join('\n\n---\n\n') }] }
    } catch (e) {
      return { content: [{ type: 'text', text: `Error listing memories: ${String(e)}` }] }
    }
  }
)

// --- TOOL: search_memories ---
server.tool(
  'search_memories',
  'Semantic search over saved memories (user, feedback, project, reference).',
  {
    query: z.string().describe('What to search for in memories'),
    limit: z.number().default(5).describe('Number of results'),
    type: z.enum(['soul', 'user', 'feedback', 'project', 'reference', 'pending', 'all']).default('all').describe('Filter by type or "all"'),
  },
  async ({ query, limit, type }) => {
    try {
      const table = await getMemoriesTable()
      const vector = await embed(query)
      let search = table.search(vector).limit(limit + 1) // +1 to exclude __init__
      if (type !== 'all') search = search.where(`type = '${type}'`)
      const rows = (await search.toArray()) as Array<{
        id: string; type: string; name: string; body: string; tags: string; updated_at: string
      }>
      const filtered = rows.filter(r => r.id !== '__init__').slice(0, limit)
      if (!filtered.length) return { content: [{ type: 'text', text: 'No memories found.' }] }
      const formatted = filtered.map(r =>
        `**[${r.id}]** \`${r.type}\` — **${r.name}** (${r.updated_at.slice(0, 10)})\n${r.body}`
      )
      return { content: [{ type: 'text', text: formatted.join('\n\n---\n\n') }] }
    } catch (e) {
      return { content: [{ type: 'text', text: `Error searching memories: ${String(e)}` }] }
    }
  }
)

// --- TOOL: upsert_memory ---
server.tool(
  'upsert_memory',
  'Creates or updates a memory by name (no UUID needed). If a memory with the same name exists, it is updated; otherwise a new one is created.',
  {
    type: z.enum(['soul', 'user', 'feedback', 'project', 'reference', 'pending']).describe('Memory category'),
    name: z.string().describe('Unique name for the memory (e.g. feedback_pnpm)'),
    body: z.string().describe('Full memory content'),
    tags: z.string().default('').describe('Comma-separated tags for filtering'),
  },
  async ({ type, name, body, tags }) => {
    try {
      const table = await getMemoriesTable()
      const vector = await embed(`${name} ${body}`)
      const now = new Date().toISOString()

      // Check if a memory with this name already exists
      const existing = (await table.query().where(`name = '${name}'`).toArray()) as Array<{
        id: string; created_at: string
      }>

      if (existing.length) {
        const { id, created_at } = existing[0]
        await table.delete(`id = '${id}'`)
        await table.add([{ id, type, name, body, tags, created_at, updated_at: now, vector }])
        return { content: [{ type: 'text', text: `Memory "${name}" updated (id: ${id}).` }] }
      }

      const id = randomUUID()
      await table.add([{ id, type, name, body, tags, created_at: now, updated_at: now, vector }])
      return { content: [{ type: 'text', text: `Memory "${name}" created (id: ${id}).` }] }
    } catch (e) {
      return { content: [{ type: 'text', text: `Error upserting memory: ${String(e)}` }] }
    }
  }
)

// --- TOOL: reindex ---
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

async function main() {
  await ensureOllama()
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('🧠 mcp-memory server running (tools: search_codebase, search_docs, search_memory, save_memory, update_memory, delete_memory, list_memories, search_memories, upsert_memory, reindex)')
}

main().catch(console.error)
