import { z } from 'zod'

export const CODEBASE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java'] as const
export type CodeBaseExtension = (typeof CODE_BASE_EXTENSIONS)[number]

export interface CodebaseRow {
  id: string
  rel_path: string
  text: string
  language: string
  created_at: string
  updated_at: string
  embeddings: number[]
}

export const codebaseRowSchema = z.object({
  id: z.string(),
  rel_path: z.string(),
  text: z.string(),
  language: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  embeddings: z.array(z.number()),
})