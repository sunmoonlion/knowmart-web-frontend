'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { PanelLeftCloseIcon, PanelLeftOpenIcon, XIcon, InfoIcon } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState, useSyncExternalStore } from 'react'

import { CrossAppLink } from '@/components/common/cross-app-link'
import { MarketNav } from '@/components/market/market-shell'
import { Button } from '@/components/ui/button'
import type { CategoryTree, ExpertItem } from '@/contracts/experts'
import { useCrossAppOrigin } from '@/lib/cross-app/use-cross-app'
import {
  DEFAULT_FILTERS,
  fetchExperts,
  filtersFrom,
  filtersTo,
  type CatalogFilters,
} from '@/lib/knowbots/catalog'
import { summonReturnUrl } from '@/lib/knowbots/client'
import { leaveTo } from '@/lib/leave-to'
import { cn } from '@/lib/utils'
import {
  DEMO_EXPERT_PLACEHOLDERS,
  type DemoExpertPlaceholder,
} from '@/components/knowbots/demo-expert-placeholders'

const COLLAPSED_KEY = 'knowmart.catalog.collapsed'
const COLLAPSED_EVENT = 'knowmart:catalog-collapsed'

// 左侧类目收没收起只记在这台浏览器；存不了就每次都展开
function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

function watchCollapsed(onChange: () => void): () => void {
  window.addEventListener('storage', onChange)
  window.addEventListener(COLLAPSED_EVENT, onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(COLLAPSED_EVENT, onChange)
  }
}

type Props = { csrfToken: string; account: React.ReactNode }

// 专家目录（SDD 0032）：页面照京东，菜单与筛选借鉴 tpl 的 Vue 版管理端——页头横排一级类目，
// 左侧可折叠的二级类目，卡片上方筛选条、已选条件、排序，底部分页。条件都在地址里。
// 不贴「自用 / 公开」标签；界面上不出现价格、购买、上架（C-L4、C-L5）。
export function ExpertCatalog({ csrfToken, account }: Props) {
  const t = useTranslations('experts')
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams()
  const filters = filtersFrom(new URLSearchParams(search.toString()))
  const list = useQuery({
    queryKey: ['web', 'experts', filters] as const,
    queryFn: () => fetchExperts(filters),
  })
  const origin = useCrossAppOrigin()
  const summoning = origin.data?.return_url ? origin.data : null
  const [failed, setFailed] = useState<string | null>(null)
  const collapsed = useSyncExternalStore(watchCollapsed, readCollapsed, () => false)
  const [words, setWords] = useState(filters.q)
  const [selectedDemo, setSelectedDemo] = useState<DemoExpertPlaceholder | null>(null)

  const go = (next: Partial<CatalogFilters>) => {
    // 换了条件就回到第一页，除非这次换的就是页码
    const merged = { ...filters, ...('page' in next ? {} : { page: 1 }), ...next }
    const query = filtersTo(merged, new URLSearchParams(search.toString()))
    router.replace(`${pathname}${query.size ? `?${query}` : ''}`)
  }
  const toggle = () => {
    try {
      window.localStorage.setItem(COLLAPSED_KEY, collapsed ? '0' : '1')
    } catch {
      // 不记也行
    }
    window.dispatchEvent(new Event(COLLAPSED_EVENT))
  }

  const summon = useMutation({
    mutationFn: ({ knowbotId, version }: { knowbotId: string; version: string }) =>
      summonReturnUrl(knowbotId, version, { app: summoning!.app, ref: summoning!.ref }, csrfToken),
    onSuccess: (url) => leaveTo(url),
    onError: () => setFailed(t('summonFailed')),
  })

  const tree: CategoryTree = list.data?.categories ?? []
  const group = groupOf(tree, filters.category)
  const sideGroups = group ? tree.filter((g) => g.group === group) : tree
  const chips = chipsOf(filters, tree, t)
  const detailQuery = new URLSearchParams()
  for (const key of ['from', 'ref']) {
    const value = search.get(key)
    if (value !== null) detailQuery.set(key, value)
  }

  // 融合纯前端演示占位专家列表（不调用后端）
  const actualItems = list.data?.items ?? []
  const filteredPlaceholders = DEMO_EXPERT_PLACEHOLDERS.filter((p) => {
    if (filters.q.trim()) {
      const query = filters.q.trim().toLowerCase()
      const hit =
        p.name.toLowerCase().includes(query) ||
        p.tagline.toLowerCase().includes(query) ||
        p.category.name.toLowerCase().includes(query) ||
        p.details.toLowerCase().includes(query)
      if (!hit) return false
    }
    if (filters.category) {
      if (filters.category === p.category.group) return true
      if (filters.category === p.category.code) return true
      return false
    }
    return true
  })
  const displayItems = actualItems.length > 0 ? [...actualItems, ...filteredPlaceholders] : []

  return (
    <div className="flex min-h-screen flex-col" data-route-class="authenticated-workspace">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-6 py-3">
        <Link href={`/${locale}/knowbots`} className="text-primary font-semibold">
          {t('brand')}
        </Link>
        <nav aria-label={t('categories')} className="flex gap-1 overflow-x-auto">
          <TopTab active={group === null} onClick={() => go({ category: null })}>
            {t('all')}
          </TopTab>
          {tree.map((g) => (
            <TopTab
              key={g.group}
              active={group === g.group}
              onClick={() => go({ category: g.group })}
            >
              {g.group_name}
            </TopTab>
          ))}
        </nav>
        <form
          role="search"
          className="min-w-48 flex-1"
          onSubmit={(event) => {
            event.preventDefault()
            go({ q: words })
          }}
        >
          <input
            id="catalog-search"
            type="search"
            value={words}
            onChange={(event) => setWords(event.target.value)}
            placeholder={t('search')}
            aria-label={t('search')}
            maxLength={100}
            className="w-full rounded-md border px-3 py-1.5 text-sm"
          />
        </form>
        <div className="flex items-center gap-4">{account}</div>
      </header>
      <MarketNav className="border-b px-6 py-1.5" />

      <div className="flex min-h-0 flex-1">
        {collapsed ? (
          <aside
            className="flex w-10 shrink-0 flex-col items-center border-r py-3"
            aria-label={t('categories')}
          >
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('expand')}
              title={t('expand')}
              onClick={toggle}
            >
              <PanelLeftOpenIcon className="size-4" />
            </Button>
          </aside>
        ) : (
          <aside className="w-56 shrink-0 border-r py-3 max-md:hidden" aria-label={t('categories')}>
            <button
              type="button"
              onClick={toggle}
              className="text-muted-foreground hover:text-foreground mb-2 flex items-center gap-1 px-4 text-xs"
            >
              <PanelLeftCloseIcon className="size-3.5" />
              {t('collapse')}
            </button>
            {sideGroups.map((g) => (
              <div key={g.group} className="mb-2">
                <p className="px-4 py-1 text-sm font-semibold">{g.group_name}</p>
                <ul>
                  {g.children.map((c) => (
                    <li key={c.code}>
                      <button
                        type="button"
                        aria-current={filters.category === c.code ? 'true' : undefined}
                        onClick={() => go({ category: c.code })}
                        className={cn(
                          'flex w-full items-baseline justify-between gap-2 px-4 py-1.5 pl-6 text-left text-sm',
                          filters.category === c.code
                            ? 'bg-muted border-primary border-l-2 font-semibold'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        <span>{c.name}</span>
                        <span className="tabular-nums">{c.count}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </aside>
        )}

        <main className="min-w-0 flex-1 space-y-4 p-6">
          <h1 className="sr-only">{t('title')}</h1>
          {summoning ? (
            <p className="bg-muted rounded-md px-3 py-2 text-sm">{t('fromWorkbench')}</p>
          ) : null}
          {failed ? (
            <p className="text-destructive text-sm" role="alert">
              {failed}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 text-sm" aria-label={t('filters')}>
            <Choice
              id="filter-updated"
              label={t('updated')}
              value={filters.updated}
              options={[
                ['any', t('updatedAny')],
                ['7d', t('updated7d')],
                ['30d', t('updated30d')],
              ]}
              onChange={(value) => go({ updated: value as CatalogFilters['updated'] })}
            />
            <span className="flex-1" />
            <Choice
              id="filter-sort"
              label={t('sort')}
              value={filters.sort}
              options={[
                ['updated', t('sortUpdated')],
                ['name', t('sortName')],
              ]}
              onChange={(value) => go({ sort: value as CatalogFilters['sort'] })}
            />
          </div>

          {chips.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">{t('chosen')}</span>
              {chips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  aria-label={t('remove', { label: chip.label })}
                  onClick={() => go(chip.clear)}
                  className="bg-muted flex items-center gap-1 rounded-full px-3 py-0.5"
                >
                  {chip.label}
                  <XIcon className="size-3" />
                </button>
              ))}
              <button
                type="button"
                className="text-primary"
                onClick={() => {
                  setWords('')
                  go({ ...DEFAULT_FILTERS })
                }}
              >
                {t('reset')}
              </button>
            </div>
          ) : null}

          {list.isPending ? (
            <p className="text-muted-foreground">{t('loading')}</p>
          ) : list.isError ? (
            <p className="text-destructive" role="alert">
              {t('loadFailed')}
            </p>
          ) : displayItems.length === 0 ? (
            chips.length > 0 ? (
              <p className="text-muted-foreground">{t('noMatch')}</p>
            ) : (
              <p className="text-muted-foreground">{t('empty')}</p>
            )
          ) : (
            <>
              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {displayItems.map((item) => (
                  <li key={item.knowbot_id}>
                    <ExpertCard
                      item={item}
                      href={`/${locale}/knowbots/${item.knowbot_id}${detailQuery.size ? `?${detailQuery}` : ''}`}
                      summoning={summoning !== null}
                      busy={summon.isPending}
                      onSummon={() => {
                        setFailed(null)
                        summon.mutate({ knowbotId: item.knowbot_id, version: item.version })
                      }}
                      onShowPlaceholder={(demo) => setSelectedDemo(demo)}
                    />
                  </li>
                ))}
              </ul>
              <Pager
                total={list.data.total}
                page={list.data.page}
                pageSize={list.data.page_size}
                onPage={(page) => go({ page })}
              />
            </>
          )}
        </main>
      </div>

      {/* 纯前端演示占位专家详情模态框 */}
      {selectedDemo ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelectedDemo(null)}
        >
          <div
            className="bg-background relative w-full max-w-lg rounded-lg border p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b pb-3">
              <div>
                <h3 className="text-lg font-bold">{selectedDemo.name}</h3>
                <p className="text-muted-foreground text-xs mt-1">
                  {selectedDemo.category.group_name} · {selectedDemo.category.name} · 第 {selectedDemo.version} 版 · 演示占位
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDemo(null)}
                className="text-muted-foreground hover:text-foreground p-1"
                aria-label="关闭"
              >
                <XIcon className="size-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <div>
                <span className="font-semibold text-foreground">一句话介绍：</span>
                <p className="text-muted-foreground mt-1">{selectedDemo.tagline}</p>
              </div>
              <div>
                <span className="font-semibold text-foreground">核心分析方法：</span>
                <code className="bg-muted block mt-1 rounded px-2 py-1 text-xs font-mono">
                  {selectedDemo.methodId}
                </code>
              </div>
              <div>
                <span className="font-semibold text-foreground">功能定位与说明：</span>
                <p className="text-muted-foreground mt-1 leading-relaxed">
                  {selectedDemo.details}
                </p>
              </div>
              <div className="bg-muted/50 rounded-md p-3 border text-xs text-muted-foreground flex items-center gap-2">
                <InfoIcon className="size-4 shrink-0 text-primary" />
                <span>此专家卡片为前端演示占位形态，仅用于演示视觉效果，不涉及后端调用。</span>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button onClick={() => setSelectedDemo(null)} size="sm">
                确定
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function TopTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-current={active ? 'true' : undefined}
      onClick={onClick}
      className={cn(
        'rounded-md px-3 py-1 text-sm whitespace-nowrap',
        active ? 'bg-muted font-semibold' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

function Choice({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string
  label: string
  value: string
  options: [string, string][]
  onChange: (value: string) => void
}) {
  return (
    <label htmlFor={id} className="text-muted-foreground flex items-center gap-1.5">
      {label}
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="text-foreground bg-background rounded-md border px-2 py-1"
      >
        {options.map(([key, text]) => (
          <option key={key} value={key}>
            {text}
          </option>
        ))}
      </select>
    </label>
  )
}

function ExpertCard({
  item,
  href,
  summoning,
  busy,
  onSummon,
  onShowPlaceholder,
}: {
  item: ExpertItem | DemoExpertPlaceholder
  href: string
  summoning: boolean
  busy: boolean
  onSummon: () => void
  onShowPlaceholder?: (demo: DemoExpertPlaceholder) => void
}) {
  const t = useTranslations('experts')
  const isPlaceholder = 'isPlaceholder' in item && Boolean(item.isPlaceholder)

  return (
    // 整张卡片都能点进详情（qwen-006 走查：只点得动标题）：标题链接铺满卡片，按钮浮在上层
    <article className="hover:border-primary/60 relative flex h-full flex-col gap-2 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-semibold text-base">
          {isPlaceholder ? (
            <button
              type="button"
              onClick={() => onShowPlaceholder?.(item as DemoExpertPlaceholder)}
              className="text-left font-semibold hover:underline after:absolute after:inset-0"
            >
              {item.name}
            </button>
          ) : (
            <Link href={href} className="after:absolute after:inset-0 hover:underline">
              {item.name}
            </Link>
          )}
        </h2>
        {isPlaceholder && (
          <span className="relative z-10 shrink-0 rounded bg-muted/80 border px-1.5 py-0.5 text-[11px] font-normal text-muted-foreground">
            演示占位
          </span>
        )}
      </div>
      {item.tagline ? <p className="text-sm">{item.tagline}</p> : null}
      <p className="text-muted-foreground text-xs tabular-nums">
        {item.category.name} · {t('version', { version: item.version })}
      </p>
      <div className="relative z-10 mt-auto pt-1 flex items-center justify-between">
        {isPlaceholder ? (
          <span className="text-muted-foreground text-xs">（演示占位）</span>
        ) : summoning ? (
          item.summonable ? (
            <Button size="sm" disabled={busy} onClick={onSummon}>
              {t('summon')}
            </Button>
          ) : null
        ) : (
          <CrossAppLink
            to="knowbench.expert"
            values={{ mode: 'expert' }}
            className="text-primary text-sm underline-offset-4 hover:underline"
          >
            {t('goWorkbench')}
          </CrossAppLink>
        )}
      </div>
    </article>
  )
}

function Pager({
  total,
  page,
  pageSize,
  onPage,
}: {
  total: number
  page: number
  pageSize: number
  onPage: (page: number) => void
}) {
  const t = useTranslations('experts')
  const pages = Math.max(1, Math.ceil(total / pageSize))
  // 总数不到一页时不显示
  if (pages <= 1) return null
  return (
    <nav
      className="text-muted-foreground flex items-center justify-end gap-3 text-sm"
      aria-label={t('page', { page })}
    >
      <span>{t('total', { count: total })}</span>
      <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        {t('prev')}
      </Button>
      <span className="text-foreground tabular-nums">{t('page', { page })}</span>
      <Button variant="ghost" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        {t('next')}
      </Button>
    </nav>
  )
}

// 当前选的类目属于哪个一级（选的是一级就是它自己）
function groupOf(tree: CategoryTree, category: string | null): string | null {
  if (!category) return null
  for (const g of tree) {
    if (g.group === category || g.children.some((c) => c.code === category)) return g.group
  }
  return category.split('.')[0] ?? null
}

type Chip = { key: string; label: string; clear: Partial<CatalogFilters> }

function chipsOf(
  filters: CatalogFilters,
  tree: CategoryTree,
  t: ReturnType<typeof useTranslations<'experts'>>,
): Chip[] {
  const chips: Chip[] = []
  if (filters.category) {
    const g = tree.find((x) => x.group === filters.category)
    const c = tree.flatMap((x) => x.children).find((x) => x.code === filters.category)
    chips.push({
      key: 'category',
      label: g?.group_name ?? c?.name ?? filters.category,
      clear: { category: null },
    })
  }
  if (filters.q.trim()) chips.push({ key: 'q', label: filters.q.trim(), clear: { q: '' } })
  if (filters.updated !== 'any')
    chips.push({
      key: 'updated',
      label: t(filters.updated === '7d' ? 'updated7d' : 'updated30d'),
      clear: { updated: 'any' },
    })
  return chips
}
