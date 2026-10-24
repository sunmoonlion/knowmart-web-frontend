'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { MARKET_CATEGORIES } from '@/lib/market/categories'
import { buyListing, fetchKnowledge, fetchListing } from '@/lib/market/client'

import { MarketShell } from './market-shell'
import { Badge, inputClass, Pager, Price, Problem, ReportButton, Reviews, Stars } from './parts'

type Props = { csrfToken: string; account: React.ReactNode }

// 市场里的知识（SDD 0018 第十一节）：上架的知识条目，按类目、关键词找
export function KnowledgeMarket({ account }: { account: React.ReactNode }) {
  const t = useTranslations('marketUi')
  const locale = useLocale()
  const [words, setWords] = useState('')
  const [filters, setFilters] = useState<{ q: string; category: string | null; page: number }>({
    q: '',
    category: null,
    page: 1,
  })
  const list = useQuery({
    queryKey: ['market', 'knowledge', filters] as const,
    queryFn: () => fetchKnowledge(filters),
  })
  return (
    <MarketShell account={account}>
      <div className="mx-auto w-full max-w-5xl space-y-6 px-6 py-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">{t('knowledge.title')}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t('knowledge.lead')}</p>
        </header>
        <form
          role="search"
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            setFilters({ ...filters, q: words, page: 1 })
          }}
        >
          <input
            type="search"
            className={`${inputClass} max-w-sm`}
            aria-label={t('search')}
            placeholder={t('search')}
            value={words}
            maxLength={100}
            onChange={(event) => setWords(event.target.value)}
          />
          <select
            className={`${inputClass} w-auto`}
            aria-label={t('category')}
            value={filters.category ?? ''}
            onChange={(event) =>
              setFilters({ ...filters, category: event.target.value || null, page: 1 })
            }
          >
            <option value="">{t('allCategories')}</option>
            {MARKET_CATEGORIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.group} · {c.name}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm">
            {t('find')}
          </Button>
        </form>
        {list.isPending ? (
          <p className="text-muted-foreground text-sm">{t('loading')}</p>
        ) : list.isError ? (
          <Problem error={list.error} />
        ) : list.data.items.length === 0 ? (
          <p className="text-muted-foreground rounded-xl border border-dashed px-4 py-8 text-center text-sm">
            {t('knowledge.empty')}
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2" aria-label={t('knowledge.title')}>
            {list.data.items.map((item) => (
              <li key={item.listing_id} className="rounded-xl border p-4">
                <Link
                  href={`/${locale}/knowledge/${item.listing_id}`}
                  className="font-medium hover:underline"
                >
                  {item.title}
                </Link>
                <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
                  {item.description}
                </p>
                <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  <Badge>{item.category.name}</Badge>
                  <Price value={item.price} />
                  <span className="text-muted-foreground text-xs">
                    {t('files', { count: item.items.length })}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        )}
        {list.data ? (
          <Pager
            page={list.data.page}
            total={list.data.total}
            size={list.data.page_size}
            onPage={(page) => setFilters({ ...filters, page })}
          />
        ) : null}
      </div>
    </MarketShell>
  )
}

// 一条知识：内容说明、几份、样张、权利声明、发布主体、评价；买下复制进你选的知识库
export function KnowledgeDetail({
  csrfToken,
  account,
  listingId,
  demandId,
}: Props & { listingId: string; demandId: string | null }) {
  const t = useTranslations('marketUi')
  const listing = useQuery({
    queryKey: ['market', 'listing', listingId] as const,
    queryFn: () => fetchListing(listingId),
  })
  const [target, setTarget] = useState<'knowbench' | 'knowlab'>('knowbench')
  // 这一次购买的幂等键：没成功再点沿用它，后端接着做原来那一笔；改了买进哪里就换一个
  const [requestId, setRequestId] = useState(() => crypto.randomUUID())
  const buy = useMutation({
    mutationFn: () =>
      buyListing(csrfToken, listingId, {
        request_id: requestId,
        target_app: target,
        ...(demandId ? { demand_id: demandId } : {}),
      }),
  })
  const item = listing.data
  return (
    <MarketShell account={account}>
      <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-8">
        {listing.isPending ? (
          <p className="text-muted-foreground text-sm">{t('loading')}</p>
        ) : listing.isError || !item ? (
          <Problem error={listing.error} />
        ) : (
          <>
            <header className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">{item.title}</h1>
              <p className="flex flex-wrap items-center gap-2 text-sm">
                <Badge>{item.category.name}</Badge>
                <Price value={item.price} />
                <Stars rating={item.rating} />
                {item.publisher ? (
                  <span className="text-muted-foreground text-xs">
                    {t('publishedBy', { name: item.publisher.name })}
                    {item.publisher.real_name_verified ? ` · ${t('verified')}` : ''}
                  </span>
                ) : null}
              </p>
            </header>
            <section className="space-y-2 text-sm">
              <h2 className="font-semibold">{t('knowledge.description')}</h2>
              <p className="whitespace-pre-wrap">{item.description}</p>
              <ul className="text-muted-foreground list-disc pl-5">
                {item.items.map((file, index) => (
                  <li key={index}>{file.name}</li>
                ))}
              </ul>
            </section>
            {item.sample ? (
              <section className="space-y-2 text-sm">
                <h2 className="font-semibold">{t('knowledge.sample')}</h2>
                <pre className="bg-muted overflow-x-auto rounded-lg p-3 text-xs whitespace-pre-wrap">
                  {item.sample}
                </pre>
              </section>
            ) : null}
            <section className="space-y-1 text-sm">
              <h2 className="font-semibold">{t('knowledge.rights')}</h2>
              <p className="whitespace-pre-wrap">{item.rights_statement}</p>
              <p className="text-muted-foreground text-xs">
                {item.resale_allowed
                  ? t('knowledge.resaleAllowed')
                  : t('knowledge.resaleNotAllowed')}
              </p>
            </section>
            {item.mine ? (
              <p className="text-muted-foreground text-sm">{t('knowledge.yours')}</p>
            ) : buy.isSuccess ? (
              <p role="status" className="rounded-lg border px-3 py-2 text-sm">
                {t('knowledge.bought', {
                  place: t(`place.${buy.data.trade.target_app ?? 'knowbench'}`),
                })}
              </p>
            ) : (
              <section className="space-y-3 rounded-xl border p-4 text-sm">
                <h2 className="font-semibold">{t('knowledge.buy')}</h2>
                <fieldset className="space-y-1">
                  <legend className="text-muted-foreground mb-1 text-xs">
                    {t('knowledge.into')}
                  </legend>
                  {(['knowbench', 'knowlab'] as const).map((place) => (
                    <label key={place} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="target"
                        checked={target === place}
                        onChange={() => {
                          setTarget(place)
                          setRequestId(crypto.randomUUID())
                        }}
                      />
                      {t(`place.${place}`)}
                    </label>
                  ))}
                </fieldset>
                <p className="text-muted-foreground text-xs">{t('knowledge.noPayment')}</p>
                <Button disabled={buy.isPending} onClick={() => buy.mutate()}>
                  {buy.isPending ? t('working') : t('knowledge.buyNow')}
                </Button>
                <Problem error={buy.error} />
              </section>
            )}
            <section className="space-y-2">
              <h2 className="text-sm font-semibold">{t('reviews')}</h2>
              <Reviews reviews={item.reviews ?? []} />
            </section>
            {!item.mine ? (
              <ReportButton csrfToken={csrfToken} kind="knowledge" targetId={item.listing_id} />
            ) : null}
          </>
        )}
      </div>
    </MarketShell>
  )
}
