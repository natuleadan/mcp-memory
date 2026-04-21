import { z } from 'zod'

export interface ChatlogRow {
  id: string
  session_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  model?: string
  created_at: string
  embeddings: number[]
}

export const chatlogRowSchema = z.object({
  id: z.string(),
  session_id: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  model: z.string().optional(),
  created_at: z.string(),
  embeddings: z.array(z.number()),
})