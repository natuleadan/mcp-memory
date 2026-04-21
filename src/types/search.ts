import { z } from 'zod'

export const SEARCH_MODES = ['critical', 'condensed', 'full', 'lite'] as const
export const FTS_MODES = ['exact', 'fuzzy'] as const
export const CONTEXT_MODES = ['minimal', 'compact', 'full'] as const
export const GLOBAL_MODES = ['compact', 'full'] as const
export const DATA_SOURCES = ['codebase', 'docs', 'chatlogs', 'memories', 'all'] as const
export const REINDEX_TARGETS = ['code', 'docs', 'chatlogs', 'all'] as const

export type SearchMode = (typeof SEARCH_MODES)[number]
export type FtsMode = (typeof FTS_MODES)[number]
export type ContextMode = (typeof CONTEXT_MODES)[number]
export type GlobalMode = (typeof GLOBAL_MODES)[number]
export type DataSource = (typeof DATA_SOURCES)[number]
export type ReindexTarget = (typeof REINDEX_TARGETS)[number]

export const searchModeSchema = z.enum(SEARCH_MODES)
export const ftsModeSchema = z.enum(FTS_MODES)
export const contextModeSchema = z.enum(CONTEXT_MODES)
export const globalModeSchema = z.enum(GLOBAL_MODES)
export const dataSourceSchema = z.enum(DATA_SOURCES)
export const reindexTargetSchema = z.enum(REINDEX_TARGETS)