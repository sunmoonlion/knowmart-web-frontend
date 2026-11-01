'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useFormatter, useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { useState } from 'react'

import { CrossAppLink } from '@/components/common/cross-app-link'
import { Button } from '@/components/ui/button'
import type { Listing, MyShop, Trade } from '@/contracts/market'
import { MARKET_CATEGORIES } from '@/lib/market/categories'
import {
  createListing,
  delistListing,
  fetchMyDemands,
  fetchMyExperts,
  fetchMyListings,
  fetchMyMaterials,
  fetchMyResponses,
  fetchMyShop,
  fetchTrades,
  renameShop,
  replyTrade,
  reviewTrade,
  setExpertListing,
  submitListing,
  updateListing,
  type ListingForm,
} from '@/lib/market/client'

import { MarketShell } from './market-shell'
import { Badge, Field, inputClass, Price, Problem, Stars } from './parts'
import { PublisherPanel } from './publisher'

type Props = { csrfToken: string; account: React.ReactNode }
const TABS = ['experts', 'knowledge', 'demands', 'responses', 'trades', 'owner'] as const
type Tab = (typeof TABS)[number]

const TONE: Record<string, 'muted' | 'ok' | 'warn' | 'bad'> = {
  draft: 'muted',
  pending: 'warn',
  listed: 'ok',
  public: 'ok',
  rejected: 'bad',
  delisted: 'muted',
  taken_down: 'bad',
  self: 'muted',
}

function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: readonly T[]
  value: T
  onChange: (tab: T) => void
  label: (tab: T) => string
}) {
  return (
    <div role="tablist" className="flex flex-wrap gap-1 border-b">
      {tabs.map((tab) => (
        <button
          key={tab}
          role="tab"
          type="button"
          aria-selected={value === tab}
          onClick={() => onChange(tab)}
          className={`-mb-px border-b-2 px-3 py-2 text-sm ${value === tab ? 'border-foreground font-medium' : 'text-muted-foreground border-transparent'}`}
        >
          {label(tab)}
        </button>
      ))}
    </div>
  )
}

// 我的小店（SDD 0018 第十一节第 7 之二小节，取代原来的「我发布的」「我买到的」「发布主体」）：
// 供给（我的专家、我的知识）、需求（我的需求、我给别人的响应）、交易记录、店主资料
export function MyShopScreen({ csrfToken, account }: Props) {
  const t = useTranslations('marketUi')
  const [tab, setTab] = useState<Tab>('experts')
  const shop = useQuery({ queryKey: ['market', 'my-shop'] as const, queryFn: fetchMyShop })
  return (
    <MarketShell account={account}>
      <div className="mx-auto w-full max-w-4xl space-y-6 px-6 py-8">
        <ShopHead shop={shop.data} error={shop.error} />
        <Tabs tabs={TABS} value={tab} onChange={setTab} label={(x) => t(`myShop.${x}`)} />
        {tab === 'experts' ? <MyExperts csrfToken={csrfToken} /> : null}
        {tab === 'knowledge' ? <MyListings csrfToken={csrfToken} /> : null}
        {tab === 'demands' ? <MyDemands /> : null}
        {tab === 'responses' ? <MyResponses /> : null}
        {tab === 'trades' ? <MyTrades csrfToken={csrfToken} /> : null}
        {tab === 'owner' ? (
          <div className="space-y-10">
            {shop.data ? <ShopOwner csrfToken={csrfToken} shop={shop.data} /> : null}
            <PublisherPanel csrfToken={csrfToken} />
          </div>
        ) : null}
      </div>
    </MarketShell>
  )
}

// 店名、在不在首页列表上、处置状态
function ShopHead({ shop, error }: { shop: MyShop | undefined; error: unknown }) {
  const t = useTranslations('marketUi')
  const locale = useLocale()
  if (!shop) return <Problem error={error} />
  return (
    <header className="space-y-2">
      <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
        {shop.shop.name}
        {shop.shop.platform ? <Badge tone="ok">{t('shops.platform')}</Badge> : null}
      </h1>
      {shop.shop.status === 'suspended' ? (
        <p role="alert" className="text-destructive text-sm">
          {t('myShop.suspended', { note: shop.shop.status_note ?? '' })}
        </p>
      ) : (
        <p className="text-muted-foreground text-sm">
          {t(shop.shop.listed ? 'myShop.listed' : 'myShop.notListed')}
        </p>
      )}
      <p className="flex flex-wrap items-center gap-3 text-sm">
        <Stars rating={shop.rating} />
        <Link
          href={`/${locale}/shops/${shop.shop.shop_id}`}
          className="text-primary hover:underline"
        >
          {t('myShop.view')}
        </Link>
      </p>
    </header>
  )
}

// 店主资料：店名（默认昵称，可改、留痕，受驻场规则禁止词约束）与留痕；发布主体在下面
function ShopOwner({ csrfToken, shop }: { csrfToken: string; shop: MyShop }) {
  const t = useTranslations('marketUi')
  const format = useFormatter()
  const client = useQueryClient()
  const [name, setName] = useState(shop.shop.name)
  const rename = useMutation({
    mutationFn: () => renameShop(csrfToken, name.trim()),
    onSuccess: (saved) => client.setQueryData(['market', 'my-shop'], saved),
  })
  return (
    <section className="space-y-4">
      <form
        className="flex flex-wrap items-end gap-2"
        aria-label={t('myShop.rename')}
        onSubmit={(event) => {
          event.preventDefault()
          if (name.trim()) rename.mutate()
        }}
      >
        <div className="min-w-64 flex-1">
          <Field label={t('myShop.name')} hint={t('myShop.nameHint')}>
            <input
              className={inputClass}
              maxLength={40}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
        </div>
        <Button type="submit" size="sm" disabled={!name.trim() || rename.isPending}>
          {t('myShop.rename')}
        </Button>
      </form>
      <Problem error={rename.error} />
      {shop.history.length > 0 ? (
        <div className="space-y-1 text-sm">
          <h2 className="font-semibold">{t('myShop.history')}</h2>
          <ul className="text-muted-foreground space-y-1 text-xs">
            {shop.history.map((event, index) => (
              <li key={index}>
                {event.at ? `${format.dateTime(new Date(event.at), { dateStyle: 'medium' })} ` : ''}
                {event.kind === 'renamed'
                  ? t('myShop.renamed', { old: event.old_name ?? '', new: event.new_name ?? '' })
                  : t(
                      event.kind === 'suspended' ? 'myShop.suspendedEvent' : 'myShop.restoredEvent',
                      {
                        note: event.note ?? '',
                      },
                    )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}

function MyListings({ csrfToken }: { csrfToken: string }) {
  const t = useTranslations('marketUi')
  const client = useQueryClient()
  const listings = useQuery({
    queryKey: ['market', 'my-listings'] as const,
    queryFn: fetchMyListings,
  })
  const [editing, setEditing] = useState<Listing | 'new' | null>(null)
  const changed = () => client.invalidateQueries({ queryKey: ['market', 'my-listings'] })
  const submit = useMutation({
    mutationFn: (id: string) => submitListing(csrfToken, id),
    onSuccess: changed,
  })
  const delist = useMutation({
    mutationFn: (id: string) => delistListing(csrfToken, id),
    onSuccess: changed,
  })
  return (
    <section className="space-y-4">
      <div className="flex justify-between gap-2">
        <p className="text-muted-foreground text-sm">{t('mine.knowledgeLead')}</p>
        <Button size="sm" onClick={() => setEditing('new')}>
          {t('mine.newListing')}
        </Button>
      </div>
      {editing ? (
        <ListingEditor
          csrfToken={csrfToken}
          listing={editing === 'new' ? null : editing}
          onDone={() => {
            setEditing(null)
            void changed()
          }}
        />
      ) : null}
      <Problem error={listings.error ?? submit.error ?? delist.error} />
      <ul className="divide-y rounded-xl border" aria-label={t('myShop.knowledge')}>
        {(listings.data?.items ?? []).map((item) => (
          <li key={item.listing_id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
            <span className="min-w-0 flex-1 truncate font-medium">{item.title}</span>
            <Price value={item.price} />
            <Badge tone={TONE[item.status ?? 'draft']}>
              {t(`listingStatus.${item.status ?? 'draft'}`)}
            </Badge>
            {item.review_note ? (
              <span className="text-muted-foreground w-full text-xs">
                {t('reviewNote', { note: item.review_note })}
              </span>
            ) : null}
            {item.status === 'delisted' && item.delist_reason ? (
              <span className="text-destructive w-full text-xs">
                {t(`delistReason.${item.delist_reason}`)}
              </span>
            ) : null}
            <span className="flex gap-1">
              {['draft', 'rejected', 'delisted'].includes(item.status ?? '') ? (
                <>
                  <Button size="sm" variant="outline" onClick={() => setEditing(item)}>
                    {t('edit')}
                  </Button>
                  <Button
                    size="sm"
                    disabled={submit.isPending}
                    onClick={() => submit.mutate(item.listing_id)}
                  >
                    {t('mine.submit')}
                  </Button>
                </>
              ) : null}
              {['pending', 'listed'].includes(item.status ?? '') ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={delist.isPending}
                  onClick={() => delist.mutate(item.listing_id)}
                >
                  {t('mine.delist')}
                </Button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ListingEditor({
  csrfToken,
  listing,
  onDone,
}: {
  csrfToken: string
  listing: Listing | null
  onDone: () => void
}) {
  const t = useTranslations('marketUi')
  // 资料从 knowbase 来：用户在 knowbase 总栏交给 knowmart 的（user-data/v2 的 knowmart 栏）
  const materials = useQuery({
    queryKey: ['market', 'materials'] as const,
    queryFn: fetchMyMaterials,
    retry: false,
  })
  const [form, setForm] = useState<ListingForm>({
    title: listing?.title ?? '',
    category: listing?.category.code ?? MARKET_CATEGORIES[3].code,
    description: listing?.description ?? '',
    items: (listing?.items ?? []).flatMap((i) => (i.item_id ? [{ item_id: i.item_id }] : [])),
    sample: listing?.sample ?? '',
    rights_statement: listing?.rights_statement ?? '',
    resale_allowed: listing?.resale_allowed ?? false,
    price: listing?.price ?? null,
  })
  const save = useMutation({
    mutationFn: () =>
      listing ? updateListing(csrfToken, listing.listing_id, form) : createListing(csrfToken, form),
    onSuccess: onDone,
  })
  const chosen = new Set(form.items.map((i) => i.item_id))
  const ready =
    form.title.trim() &&
    form.description.trim() &&
    form.rights_statement.trim() &&
    form.items.length > 0
  return (
    <form
      className="space-y-3 rounded-xl border p-4"
      aria-label={t('mine.listingForm')}
      onSubmit={(event) => {
        event.preventDefault()
        if (ready) save.mutate()
      }}
    >
      <Field label={t('mine.listingTitle')}>
        <input
          className={inputClass}
          maxLength={120}
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
      </Field>
      <Field label={t('category')}>
        <select
          className={inputClass}
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
        >
          {MARKET_CATEGORIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.group} · {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t('knowledge.description')} hint={t('mine.descriptionHint')}>
        <textarea
          className={inputClass}
          rows={3}
          maxLength={4000}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </Field>
      <fieldset className="space-y-1 text-sm">
        <legend className="font-medium">{t('mine.files')}</legend>
        {materials.isError ? <Problem error={materials.error} /> : null}
        {(materials.data?.items ?? []).length === 0 && !materials.isPending ? (
          <p className="text-muted-foreground text-xs">{t('mine.noFiles')}</p>
        ) : null}
        {(materials.data?.items ?? []).map((file) => (
          <label key={file.material_id} className="flex items-center gap-2">
            <input
              type="checkbox"
              // 不能卖的不让勾；已经选在条目里的（后来许可改低了）留着能去掉
              disabled={!file.sellable && !chosen.has(file.material_id)}
              checked={chosen.has(file.material_id)}
              onChange={() =>
                setForm({
                  ...form,
                  items: chosen.has(file.material_id)
                    ? form.items.filter((i) => i.item_id !== file.material_id)
                    : [...form.items, { item_id: file.material_id }],
                })
              }
            />
            {file.name}
            {file.sellable ? null : (
              <span className="text-muted-foreground text-xs">
                {t(file.mine ? 'mine.notForSale' : 'mine.notYours')}
              </span>
            )}
          </label>
        ))}
        <p className="text-muted-foreground text-xs">{t('mine.filesHint')}</p>
      </fieldset>
      <Field label={t('knowledge.sample')} hint={t('mine.sampleHint')}>
        <textarea
          className={inputClass}
          rows={3}
          maxLength={5000}
          value={form.sample}
          onChange={(e) => setForm({ ...form, sample: e.target.value })}
        />
      </Field>
      <Field label={t('knowledge.rights')} hint={t('mine.rightsHint')}>
        <textarea
          className={inputClass}
          rows={2}
          maxLength={2000}
          value={form.rights_statement}
          onChange={(e) => setForm({ ...form, rights_statement: e.target.value })}
        />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.resale_allowed}
          onChange={(e) => setForm({ ...form, resale_allowed: e.target.checked })}
        />
        {t('mine.resale')}
      </label>
      <Field label={t('mine.priceField')} hint={t('mine.priceHint')}>
        <input
          inputMode="decimal"
          className={inputClass}
          value={form.price ?? ''}
          onChange={(e) => setForm({ ...form, price: e.target.value || null })}
        />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!ready || save.isPending}>
          {save.isPending ? t('working') : t('save')}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onDone}>
          {t('cancel')}
        </Button>
      </div>
      <Problem error={save.error} />
    </form>
  )
}

function MyExperts({ csrfToken }: { csrfToken: string }) {
  const t = useTranslations('marketUi')
  const client = useQueryClient()
  const experts = useQuery({ queryKey: ['market', 'my-experts'] as const, queryFn: fetchMyExperts })
  const [prices, setPrices] = useState<Record<string, string>>({})
  // 申请公开要选类目；knowlab 交来的起初没有类目（Fable 评审 P2-1）
  const [categories, setCategories] = useState<Record<string, string>>({})
  const save = useMutation({
    mutationFn: (input: {
      id: string
      visibility: 'private' | 'public'
      price: string | null
      category?: string
    }) =>
      setExpertListing(csrfToken, input.id, {
        visibility: input.visibility,
        price: input.price,
        ...(input.category ? { category: input.category } : {}),
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['market', 'my-experts'] }),
  })
  return (
    <section className="space-y-3">
      <p className="text-muted-foreground text-sm">{t('mine.expertsLead')}</p>
      <Problem error={experts.error ?? save.error} />
      <ul className="divide-y rounded-xl border" aria-label={t('myShop.experts')}>
        {(experts.data?.items ?? []).map((bot) => {
          const price = prices[bot.knowbot_id] ?? bot.price ?? ''
          const category =
            categories[bot.knowbot_id] ??
            (bot.category.code === 'uncategorized' ? '' : bot.category.code)
          return (
            <li key={bot.knowbot_id} className="space-y-2 px-4 py-3 text-sm">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{bot.name}</span>
                <Badge>{bot.category.name}</Badge>
                <Badge tone={TONE[bot.listing_status]}>
                  {t(`expertStatus.${bot.listing_status}`)}
                </Badge>
              </p>
              {bot.review_note ? (
                <p className="text-muted-foreground text-xs">
                  {t('reviewNote', { note: bot.review_note })}
                </p>
              ) : null}
              {/* 待处理：在售那一版所绑的数据失效（删、禁用、许可改低），别人请不了；
                  数据好了自动恢复（0043 第 4.3 节；数据拓扑第十节第 5 条） */}
              {bot.held.map((h) => (
                <p key={h.version} className="text-destructive text-xs" role="status">
                  {t('held', {
                    version: h.version,
                    reason: t.has(`heldReason.${h.reason}`)
                      ? t(`heldReason.${h.reason}`)
                      : h.reason,
                  })}
                </p>
              ))}
              <div className="flex flex-wrap items-end gap-2">
                <Field label={t('mine.pricePerAsk')}>
                  <input
                    inputMode="decimal"
                    className={`${inputClass} w-32`}
                    value={price}
                    onChange={(e) => setPrices({ ...prices, [bot.knowbot_id]: e.target.value })}
                  />
                </Field>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={save.isPending}
                  onClick={() =>
                    save.mutate({ id: bot.knowbot_id, visibility: 'private', price: price || null })
                  }
                >
                  {t('mine.keepPrivate')}
                </Button>
                <Field label={t('category')}>
                  <select
                    className={inputClass}
                    value={category}
                    onChange={(e) =>
                      setCategories({ ...categories, [bot.knowbot_id]: e.target.value })
                    }
                  >
                    <option value="">{t('mine.chooseCategory')}</option>
                    {MARKET_CATEGORIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.group} · {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Button
                  size="sm"
                  disabled={save.isPending || bot.listing_status === 'taken_down' || !category}
                  onClick={() =>
                    save.mutate({
                      id: bot.knowbot_id,
                      visibility: 'public',
                      price: price || null,
                      category,
                    })
                  }
                >
                  {bot.visibility === 'public' ? t('mine.updatePrice') : t('mine.askPublic')}
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function MyDemands() {
  const t = useTranslations('marketUi')
  const locale = useLocale()
  const demands = useQuery({ queryKey: ['market', 'my-demands'] as const, queryFn: fetchMyDemands })
  return (
    <ul className="divide-y rounded-xl border" aria-label={t('myShop.demands')}>
      {(demands.data?.items ?? []).map((d) => (
        <li key={d.demand_id} className="flex items-center gap-3 px-4 py-3 text-sm">
          <Link
            href={`/${locale}/demands/${d.demand_id}`}
            className="min-w-0 flex-1 truncate font-medium hover:underline"
          >
            {d.title}
          </Link>
          <Badge tone={d.taking_responses ? 'ok' : 'muted'}>
            {t(`demandStatus.${d.taking_responses ? 'taking' : d.status}`)}
          </Badge>
        </li>
      ))}
    </ul>
  )
}

function MyResponses() {
  const t = useTranslations('marketUi')
  const locale = useLocale()
  const responses = useQuery({
    queryKey: ['market', 'my-responses'] as const,
    queryFn: fetchMyResponses,
  })
  return (
    <ul className="divide-y rounded-xl border" aria-label={t('myShop.responses')}>
      {(responses.data?.items ?? []).map((r) => (
        <li key={r.response_id} className="flex items-center gap-3 px-4 py-3 text-sm">
          <Link
            href={`/${locale}/demands/${r.demand_id}`}
            className="min-w-0 flex-1 truncate font-medium hover:underline"
          >
            {r.demand?.title ?? r.demand_id}
          </Link>
          <Badge tone={r.status === 'chosen' ? 'ok' : 'muted'}>
            {t(`responseStatus.${r.status}`)}
          </Badge>
        </li>
      ))}
    </ul>
  )
}

// 交易记录：买入的、卖出的；每行带直达链接（知识去 knowbase，专家去 knowbench）、条目现在的
// 状态；买家评分，卖家回复一次（SDD 0018 第十一节第 7 之二小节）
function MyTrades({ csrfToken }: { csrfToken: string }) {
  const t = useTranslations('marketUi')
  const client = useQueryClient()
  const [role, setRole] = useState<'buyer' | 'seller'>('buyer')
  const trades = useQuery({
    queryKey: ['market', 'trades', role] as const,
    queryFn: () => fetchTrades(role),
  })
  const [drafts, setDrafts] = useState<Record<string, { rating: number; text: string }>>({})
  const changed = () => client.invalidateQueries({ queryKey: ['market', 'trades'] })
  const review = useMutation({
    mutationFn: (input: { id: string; rating: number; text: string }) =>
      reviewTrade(csrfToken, input.id, { rating: input.rating, text: input.text }),
    onSuccess: changed,
  })
  const reply = useMutation({
    mutationFn: (input: { id: string; reply: string }) =>
      replyTrade(csrfToken, input.id, { reply: input.reply }),
    onSuccess: changed,
  })
  return (
    <section className="space-y-4">
      <Tabs
        tabs={['buyer', 'seller'] as const}
        value={role}
        onChange={setRole}
        label={(x) => t(`bought.${x}`)}
      />
      <Problem error={trades.error ?? review.error ?? reply.error} />
      {trades.data && trades.data.items.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('bought.empty')}</p>
      ) : null}
      <ul className="space-y-3" aria-label={t(`bought.${role}`)}>
        {(trades.data?.items ?? []).map((trade) => {
          const draft = drafts[trade.trade_id] ?? { rating: 5, text: '' }
          return (
            <li key={trade.trade_id} className="space-y-2 rounded-xl border p-4 text-sm">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{trade.title}</span>
                <Badge>{t(`kind.${trade.kind}`)}</Badge>
                <Price value={trade.price} />
                {trade.target_app ? (
                  <span className="text-muted-foreground text-xs">
                    {t('bought.into', { place: t(`place.${trade.target_app}`) })}
                  </span>
                ) : null}
                <TradeState trade={trade} role={role} />
                {trade.status === 'failed' ? (
                  <span className="text-destructive text-xs">
                    {t(
                      trade.failure === 'item_not_for_sale' ? 'bought.notForSale' : 'bought.failed',
                    )}
                  </span>
                ) : null}
              </p>
              <TradeLinks trade={trade} role={role} />
              {trade.review ? (
                <div className="text-muted-foreground">
                  <p>
                    {t('stars', { rating: trade.review.rating })} {trade.review.text}
                  </p>
                  {trade.review.reply ? (
                    <p className="border-l-2 pl-2">
                      {t('sellerReply', { reply: trade.review.reply })}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {role === 'buyer' && !trade.review ? (
                <form
                  className="flex flex-wrap items-end gap-2"
                  aria-label={t('bought.review')}
                  onSubmit={(event) => {
                    event.preventDefault()
                    review.mutate({ id: trade.trade_id, ...draft })
                  }}
                >
                  <Field label={t('bought.rating')}>
                    <select
                      className={`${inputClass} w-20`}
                      value={draft.rating}
                      onChange={(e) =>
                        setDrafts({
                          ...drafts,
                          [trade.trade_id]: { ...draft, rating: Number(e.target.value) },
                        })
                      }
                    >
                      {[5, 4, 3, 2, 1].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t('bought.words')}>
                    <input
                      className={inputClass}
                      maxLength={1000}
                      value={draft.text}
                      onChange={(e) =>
                        setDrafts({
                          ...drafts,
                          [trade.trade_id]: { ...draft, text: e.target.value },
                        })
                      }
                    />
                  </Field>
                  <Button type="submit" size="sm" disabled={review.isPending}>
                    {t('bought.sendReview')}
                  </Button>
                </form>
              ) : null}
              {role === 'seller' && trade.review && !trade.review.reply ? (
                <ReplyForm
                  onSend={(text) => reply.mutate({ id: trade.trade_id, reply: text })}
                  busy={reply.isPending}
                />
              ) : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function ReplyForm({ onSend, busy }: { onSend: (text: string) => void; busy: boolean }) {
  const t = useTranslations('marketUi')
  const [text, setText] = useState('')
  return (
    <form
      className="flex gap-2"
      aria-label={t('bought.reply')}
      onSubmit={(event) => {
        event.preventDefault()
        if (text.trim()) onSend(text)
      }}
    >
      <input
        className={inputClass}
        aria-label={t('bought.reply')}
        maxLength={1000}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <Button type="submit" size="sm" disabled={!text.trim() || busy}>
        {t('bought.sendReply')}
      </Button>
    </form>
  )
}

// 条目现在的状态：知识在架 / 已下架；专家这一版别人还请不请得到（已下架的标「不可请」）
function TradeState({ trade, role }: { trade: Trade; role: 'buyer' | 'seller' }) {
  const t = useTranslations('marketUi')
  return (
    <>
      {trade.listing_state ? (
        <Badge tone={trade.listing_state === 'on' ? 'ok' : 'muted'}>
          {t(
            trade.listing_state === 'on'
              ? 'bought.on'
              : trade.kind === 'expert'
                ? 'bought.expertOff'
                : 'bought.off',
          )}
        </Badge>
      ) : null}
      {trade.seller_publisher ? (
        <span className="text-muted-foreground text-xs">
          {t('bought.soldAs', { name: trade.seller_publisher.name })}
        </span>
      ) : null}
      {role === 'buyer' ? <ShopLinkInline trade={trade} /> : null}
    </>
  )
}

function ShopLinkInline({ trade }: { trade: Trade }) {
  const t = useTranslations('marketUi')
  const locale = useLocale()
  if (!trade.shop) return null
  return (
    <Link
      href={`/${locale}/shops/${trade.shop.shop_id}`}
      className="text-primary text-xs hover:underline"
    >
      {t('shops.sellerShop', { name: trade.shop.name })}
    </Link>
  )
}

// 直达链接：买来的知识在 knowbase 总栏「买来的」，卖出的在卖家自己的 knowbase；请过的专家在
// knowbench「专家」照旧能请，卖出的专家看 knowmart 里的详情（目标应用没配就不显示）
function TradeLinks({ trade, role }: { trade: Trade; role: 'buyer' | 'seller' }) {
  const t = useTranslations('marketUi')
  const locale = useLocale()
  if (trade.kind === 'expert') {
    if (role === 'seller') {
      return (
        <Link
          href={`/${locale}/knowbots/${trade.listing_ref.split('@')[0]}`}
          className="text-primary text-xs hover:underline"
        >
          {t('bought.openOwnExpert')}
        </Link>
      )
    }
    return (
      <CrossAppLink to="knowbench.experts" className="text-primary text-xs hover:underline">
        {t('bought.openExpert')}
      </CrossAppLink>
    )
  }
  const files = trade.granted.filter((item) => item.item_id)
  if (files.length === 0) return null
  return (
    <ul className="space-y-1 text-xs">
      {files.map((item) => (
        <li key={item.item_id}>
          <CrossAppLink
            to="knowbase.library"
            values={{
              category: role === 'buyer' ? 'purchased' : 'uploaded',
              material: item.item_id,
            }}
            className="text-primary hover:underline"
          >
            {item.name ?? item.item_id}
          </CrossAppLink>{' '}
          <span className="text-muted-foreground">
            {t(role === 'buyer' ? 'bought.openPurchased' : 'bought.openUploaded')}
          </span>
        </li>
      ))}
    </ul>
  )
}
