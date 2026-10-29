'use client'

import { useQuery } from '@tanstack/react-query'
import { useFormatter, useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { useState } from 'react'

import type { ShopHeader } from '@/contracts/market'
import { MARKET_CATEGORIES } from '@/lib/market/categories'
import { fetchShop, fetchShops } from '@/lib/market/client'

import { MarketShell } from './market-shell'
import { Badge, inputClass, Pager, Price, Problem, Stars } from './parts'

// 类目筛选只给一级（按组）：小店的供给类目可能有好几个
const GROUPS = [...new Map(MARKET_CATEGORIES.map((c) => [c.code.split('.')[0], c.group])).entries()]

// 首页：小店列表（SDD 0018 第十一节第 7 之二小节）。只列有在架供给或公开需求的店；按店名、类目找；
// 只按时间或店名排，不做推荐、榜单、销量排序
export function ShopList({ account }: { account: React.ReactNode }) {
  const t = useTranslations('marketUi')
  const locale = useLocale()
  const [words, setWords] = useState('')
  const [filters, setFilters] = useState<{
    q: string
    category: string | null
    sort: 'time' | 'name'
    page: number
  }>({ q: '', category: null, sort: 'time', page: 1 })
  const list = useQuery({
    queryKey: ['market', 'shops', filters] as const,
    queryFn: () => fetchShops(filters),
  })
  return (
    <MarketShell account={account}>
      <div className="mx-auto w-full max-w-5xl space-y-6 px-6 py-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">{t('shops.title')}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t('shops.lead')}</p>
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
            aria-label={t('shops.search')}
            placeholder={t('shops.search')}
            value={words}
            maxLength={40}
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
            {GROUPS.map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
          <select
            className={`${inputClass} w-auto`}
            aria-label={t('shops.sort')}
            value={filters.sort}
            onChange={(event) =>
              setFilters({ ...filters, sort: event.target.value as 'time' | 'name', page: 1 })
            }
          >
            <option value="time">{t('shops.sortTime')}</option>
            <option value="name">{t('shops.sortName')}</option>
          </select>
          <button type="submit" className="sr-only">
            {t('find')}
          </button>
        </form>
        {list.isPending ? (
          <p className="text-muted-foreground text-sm">{t('loading')}</p>
        ) : list.isError ? (
          <Problem error={list.error} />
        ) : list.data.items.length === 0 ? (
          <p className="text-muted-foreground rounded-xl border border-dashed px-4 py-8 text-center text-sm">
            {t('shops.empty')}
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2" aria-label={t('shops.title')}>
            {list.data.items.map((shop) => (
              <li key={shop.shop_id} className="space-y-2 rounded-xl border p-4">
                <Link
                  href={`/${locale}/shops/${shop.shop_id}`}
                  className="font-medium hover:underline"
                >
                  {shop.name}
                </Link>
                <OwnerLine shop={shop} />
                <p className="text-muted-foreground text-xs">
                  {t('shops.counts', {
                    experts: shop.experts,
                    knowledge: shop.knowledge,
                    demands: shop.demands,
                  })}
                </p>
                {shop.categories.length > 0 ? (
                  <p className="flex flex-wrap gap-1">
                    {shop.categories.map((c) => (
                      <Badge key={c.code}>{c.name}</Badge>
                    ))}
                  </p>
                ) : null}
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

// 店主一行：平台店标（看发布主体）、发布主体（审过才有）、资质标识
function OwnerLine({ shop }: { shop: ShopHeader }) {
  const t = useTranslations('marketUi')
  return (
    <p className="flex flex-wrap items-center gap-2 text-xs">
      {shop.platform ? <Badge tone="ok">{t('shops.platform')}</Badge> : null}
      {shop.publisher ? (
        <span className="text-muted-foreground">
          {t('publishedBy', { name: shop.publisher.name })}
          {shop.publisher.real_name_verified ? ` · ${t('verified')}` : ''}
        </span>
      ) : (
        <span className="text-muted-foreground">{t('shops.noPublisher')}</span>
      )}
      {shop.qualifications.map((c) => (
        <Badge key={c.code} tone="ok">
          {c.name}
        </Badge>
      ))}
    </p>
  )
}

// 小店详情页（对外）：店主、在架的专家与知识、店主勾了公开的需求、评价；从这里买、请、响应需求
export function ShopScreen({ account, shopId }: { account: React.ReactNode; shopId: string }) {
  const t = useTranslations('marketUi')
  const locale = useLocale()
  const format = useFormatter()
  const page = useQuery({
    queryKey: ['market', 'shop', shopId] as const,
    queryFn: () => fetchShop(shopId),
  })
  const data = page.data
  return (
    <MarketShell account={account}>
      <div className="mx-auto w-full max-w-4xl space-y-8 px-6 py-8">
        {page.isPending ? (
          <p className="text-muted-foreground text-sm">{t('loading')}</p>
        ) : page.isError || !data ? (
          <Problem error={page.error} />
        ) : (
          <>
            <header className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">{data.shop.name}</h1>
              <OwnerLine shop={data.shop} />
              <Stars rating={data.rating} />
              {data.shop.status === 'suspended' ? (
                <p role="status" className="text-destructive text-sm">
                  {t('shops.suspended')}
                </p>
              ) : null}
            </header>
            {data.shop.status === 'open' ? (
              <>
                <Section title={t('shops.experts')} empty={data.experts.length === 0}>
                  {data.experts.map((bot) => (
                    <li key={bot.knowbot_id} className="space-y-1 px-4 py-3">
                      <Link
                        href={`/${locale}/knowbots/${bot.knowbot_id}`}
                        className="font-medium hover:underline"
                      >
                        {bot.name}
                      </Link>
                      <p className="text-muted-foreground text-sm">{bot.tagline}</p>
                      <p className="flex flex-wrap items-center gap-2 text-xs">
                        <Badge>{bot.category.name}</Badge>
                        {bot.price === null ? (
                          <Price value={null} />
                        ) : (
                          <span>
                            {t('shops.perAsk', { price: t('price', { value: bot.price }) })}
                          </span>
                        )}
                      </p>
                    </li>
                  ))}
                </Section>
                <Section title={t('shops.knowledge')} empty={data.knowledge.length === 0}>
                  {data.knowledge.map((item) => (
                    <li key={item.listing_id} className="space-y-1 px-4 py-3">
                      <Link
                        href={`/${locale}/knowledge/${item.listing_id}`}
                        className="font-medium hover:underline"
                      >
                        {item.title}
                      </Link>
                      <p className="text-muted-foreground line-clamp-2 text-sm">
                        {item.description}
                      </p>
                      <p className="flex flex-wrap items-center gap-2 text-xs">
                        <Badge>{item.category.name}</Badge>
                        <Price value={item.price} />
                      </p>
                    </li>
                  ))}
                </Section>
                <Section title={t('shops.demands')} empty={data.demands.length === 0}>
                  {data.demands.map((d) => (
                    <li key={d.demand_id} className="space-y-1 px-4 py-3">
                      <Link
                        href={`/${locale}/demands/${d.demand_id}`}
                        className="font-medium hover:underline"
                      >
                        {d.title}
                      </Link>
                      <p className="flex flex-wrap items-center gap-2 text-xs">
                        <Badge>{t(`kind.${d.kind}`)}</Badge>
                        {d.deadline ? (
                          <span className="text-muted-foreground">
                            {t('deadline', {
                              date: format.dateTime(new Date(d.deadline), { dateStyle: 'medium' }),
                            })}
                          </span>
                        ) : null}
                      </p>
                    </li>
                  ))}
                </Section>
                <Section title={t('shops.reviews')} empty={data.reviews.length === 0}>
                  {data.reviews.map((review, index) => (
                    <li key={index} className="space-y-1 px-4 py-3 text-sm">
                      <p>
                        {t('stars', { rating: review.rating })}
                        <span className="text-muted-foreground ml-2 text-xs">{review.title}</span>
                      </p>
                      {review.text ? <p>{review.text}</p> : null}
                      {review.reply ? (
                        <p className="text-muted-foreground border-l-2 pl-2">
                          {t('sellerReply', { reply: review.reply })}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </Section>
              </>
            ) : null}
          </>
        )}
      </div>
    </MarketShell>
  )
}

function Section({
  title,
  empty,
  children,
}: {
  title: string
  empty: boolean
  children: React.ReactNode
}) {
  const t = useTranslations('marketUi')
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      {empty ? (
        <p className="text-muted-foreground text-sm">{t('shops.none')}</p>
      ) : (
        <ul className="divide-y rounded-xl border" aria-label={title}>
          {children}
        </ul>
      )}
    </section>
  )
}
