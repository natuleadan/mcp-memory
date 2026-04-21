import { z } from 'zod'

export const DOCS_EXTENSIONS = ['.md', '.sql', '.json', '.yaml', '.yml'] as const
export type DocsExtension = (typeof DOCS_EXTENSIONS)[number]

export interface DocsRow {
  id: string
  rel_path: string
  text: string
  category: string
  created_at: string
  updated_at: string
  embeddings: number[]
}

export const docsRowSchema = z.object({
  id: z.string(),
  rel_path: z.string(),
  text: z.string(),
  category: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  embeddings: z.array(z.number()),
})