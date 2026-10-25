'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import type { Listing } from '@/contracts/market'
import { fetchLibrary } from '@/lib/library/client'
import { MARKET_CATEGORIES } from '@/lib/market/categories'
import {
  createListing,
  delistListing,
  fetchMyDemands,
  fetchMyExperts,
  fetchMyListings,
  fetchMyResponses,
  fetchTrades,
  replyTrade,
  reviewTrade,
  setExpertListing,
  submitListing,
  updateListing,
  type ListingForm,
} from '@/lib/market/client'

import { MarketShell } from './market-shell'
import { Badge, Field, inputClass, Price, Problem } from './parts'

type Props = { csrfToken: string; account: React.ReactNode }
type Tab = 'knowledge' | 'experts' | 'demands' | 'responses'

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

// 我发布的（SDD 0018 第十一节第 7 小节）：知识条目、专家的公开与价格、需求、响应
export function MyPublished({ csrfToken, account }: Props) {
  const t = useTranslations('marketUi')
  const [tab, setTab] = useState<Tab>('knowledge')
  return (
    <MarketShell account={account}>
      <div className="mx-auto w-full max-w-4xl space-y-6 px-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">{t('mine.title')}</h1>
        <Tabs
          tabs={['knowledge', 'experts', 'demands', 'responses'] as const}
          value={tab}
          onChange={setTab}
          label={(x) => t(`mine.${x}`)}
        />
        {tab === 'knowledge' ? <MyListings csrfToken={csrfToken} /> : null}
        {tab === 'experts' ? <MyExperts csrfToken={csrfToken} /> : null}
        {tab === 'demands' ? <MyDemands /> : null}
        {tab === 'responses' ? <MyResponses /> : null}
      </div>
    </MarketShell>
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
      <ul className="divide-y rounded-xl border" aria-label={t('mine.knowledge')}>
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
  const library = useQuery({
    queryKey: ['web', 'library'] as const,
    queryFn: fetchLibrary,
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
        {library.isError ? <Problem error={library.error} /> : null}
        {(library.data ?? []).length === 0 && !library.isPending ? (
          <p className="text-muted-foreground text-xs">{t('mine.noFiles')}</p>
        ) : null}
        {(library.data ?? []).map((file) => (
          <label key={file.item_id} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={chosen.has(file.item_id)}
              onChange={() =>
                setForm({
                  ...form,
                  items: chosen.has(file.item_id)
                    ? form.items.filter((i) => i.item_id !== file.item_id)
                    : [...form.items, { item_id: file.item_id }],
                })
              }
            />
            {file.name}
          </label>
        ))}
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
  const save = useMutation({
    mutationFn: (input: { id: string; visibility: 'private' | 'public'; price: string | null }) =>
      setExpertListing(csrfToken, input.id, { visibility: input.visibility, price: input.price }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['market', 'my-experts'] }),
  })
  return (
    <section className="space-y-3">
      <p className="text-muted-foreground text-sm">{t('mine.expertsLead')}</p>
      <Problem error={experts.error ?? save.error} />
      <ul className="divide-y rounded-xl border" aria-label={t('mine.experts')}>
        {(experts.data?.items ?? []).map((bot) => {
          const price = prices[bot.knowbot_id] ?? bot.price ?? ''
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
                <Button
                  size="sm"
                  disabled={save.isPending || bot.listing_status === 'taken_down'}
                  onClick={() =>
                    save.mutate({ id: bot.knowbot_id, visibility: 'public', price: price || null })
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
    <ul className="divide-y rounded-xl border" aria-label={t('mine.demands')}>
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
    <ul className="divide-y rounded-xl border" aria-label={t('mine.responses')}>
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

// 我买到的、我卖出的：成交记录；买家评分，卖家回复一次
export function MyTrades({ csrfToken, account }: Props) {
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
    <MarketShell account={account}>
      <div className="mx-auto w-full max-w-4xl space-y-6 px-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">{t('bought.title')}</h1>
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
                  {trade.status === 'failed' ? (
                    <span className="text-destructive text-xs">{t('bought.failed')}</span>
                  ) : null}
                </p>
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
      </div>
    </MarketShell>
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
