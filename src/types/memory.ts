import { z } from 'zod'

export const MEMORY_TYPES = ['soul', 'user', 'feedback', 'project', 'reference', 'pending'] as const
export const MEMORY_TYPES_ALL = [...MEMORY_TYPES, 'all'] as const

export type MemoryType = (typeof MEMORY_TYPES)[number]
export type MemoryTypeAll = (typeof MEMORY_TYPES_ALL)[number]

export const memoryTypeSchema = z.enum(MEMORY_TYPES)
export const memoryTypeAllSchema = z.enum(MEMORY_TYPES_ALL)

export interface MemoryRow {
  id: string
  type: MemoryType
  name: string
  body: string
  tags: string
  weight: number
  created_at: string
  updated_at: string
  embeddings: number[]
}

export interface MemoryFrontmatter {
  id: string
  type: MemoryType
  name: string
  tags: string
  weight?: number
  created_at: string
  updated_at: string
}