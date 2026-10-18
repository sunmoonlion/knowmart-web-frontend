'use client'

import {
  expertDetailSchema,
  expertListSchema,
  type ExpertDetail,
  type ExpertList,
} from '@/contracts/experts'
import { requestJson } from '@/lib/common/api-client'
import { KnowbotContractError } from '@/lib/knowbots/client'

// 专家目录（SDD 0032）的筛选条件。写进页面地址，刷新、分享、从详情页返回都不丢。
export type CatalogFilters = {
  category: string | null
  q: string
  data: 'all' | 'own' | 'user'
  updated: 'any' | '7d' | '30d'
  sort: 'updated' | 'name'
  page: number
}

export const DEFAULT_FILTERS: CatalogFilters = {
  category: null,
  q: '',
  data: 'all',
  updated: 'any',
  sort: 'updated',
  page: 1,
}

const DATA = new Set(['all', 'own', 'user'])
const UPDATED = new Set(['any', '7d', '30d'])
const SORT = new Set(['updated', 'name'])
const CATEGORY = /^[a-z_.]{1,64}$/

// 地址里不认识的值当作没写，用默认
export function filtersFrom(search: URLSearchParams): CatalogFilters {
  const category = search.get('category')
  const page = Number.parseInt(search.get('page') ?? '1', 10)
  const pick = <T extends string>(key: string, allowed: Set<string>, fallback: T): T => {
    const value = search.get(key)
    return value && allowed.has(value) ? (value as T) : fallback
  }
  return {
    category: category && CATEGORY.test(category) ? category : null,
    q: (search.get('q') ?? '').slice(0, 100),
    data: pick('data', DATA, 'all'),
    updated: pick('updated', UPDATED, 'any'),
    sort: pick('sort', SORT, 'updated'),
    page: Number.isFinite(page) && page >= 1 ? page : 1,
  }
}

// 只写和默认不同的；from、ref（从工作台来）原样保留
export function filtersTo(filters: CatalogFilters, keep: URLSearchParams): URLSearchParams {
  const out = new URLSearchParams()
  for (const key of ['from', 'ref']) {
    const value = keep.get(key)
    if (value !== null) out.set(key, value)
  }
  if (filters.category) out.set('category', filters.category)
  if (filters.q.trim()) out.set('q', filters.q.trim())
  if (filters.data !== 'all') out.set('data', filters.data)
  if (filters.updated !== 'any') out.set('updated', filters.updated)
  if (filters.sort !== 'updated') out.set('sort', filters.sort)
  if (filters.page > 1) out.set('page', String(filters.page))
  return out
}

export async function fetchExperts(filters: CatalogFilters): Promise<ExpertList> {
  const query = filtersTo(filters, new URLSearchParams())
  const parsed = expertListSchema.safeParse(
    await requestJson(`/api/web/v1/knowmart/experts${query.size ? `?${query}` : ''}`),
  )
  if (!parsed.success) throw new KnowbotContractError({ cause: parsed.error })
  return parsed.data
}

export async function fetchExpert(
  knowbotId: string,
  version: string | null,
): Promise<ExpertDetail> {
  const query = version ? `?version=${encodeURIComponent(version)}` : ''
  const parsed = expertDetailSchema.safeParse(
    await requestJson(`/api/web/v1/knowmart/experts/${encodeURIComponent(knowbotId)}${query}`),
  )
  if (!parsed.success) throw new KnowbotContractError({ cause: parsed.error })
  return parsed.data.expert
}
