'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useFormatter, useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import type { DemandDetail, DemandResponse } from '@/contracts/market'
import {
  chooseResponse,
  closeDemand,
  createDemand,
  fetchDemand,
  fetchDemandHall,
  fetchMessages,
  postMessage,
  respond,
  withdrawResponse,
  attachOffer,
  type DemandForm,
} from '@/lib/market/client'

import { MarketShell } from './market-shell'
import { Badge, Field, inputClass, Pager, Price, Problem, ReportButton } from './parts'

type Props = { csrfToken: string; account: React.ReactNode }

// 需求大厅（SDD 0018 第十一节）：买家发需求，卖家响应，买家选一家
export function DemandHall({ csrfToken, account }: Props) {
  const t = useTranslations('marketUi')
  const locale = useLocale()
  const format = useFormatter()
  const client = useQueryClient()
  const [filters, setFilters] = useState<{ kind: string | null; q: string; page: number }>({
    kind: null,
    q: '',
    page: 1,
  })
  const [writing, setWriting] = useState(false)
  const hall = useQuery({
    queryKey: ['market', 'demands', filters] as const,
    queryFn: () => fetchDemandHall(filters),
  })
  return (
    <MarketShell account={account}>
      <div className="mx-auto w-full max-w-4xl space-y-6 px-6 py-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{t('demands.title')}</h1>
            <p className="text-muted-foreground mt-1 text-sm">{t('demands.lead')}</p>
          </div>
          <Button size="sm" onClick={() => setWriting(!writing)}>
            {t('demands.post')}
          </Button>
        </header>
        {writing ? (
          <DemandEditor
            csrfToken={csrfToken}
            onDone={() => {
              setWriting(false)
              void client.invalidateQueries({ queryKey: ['market', 'demands'] })
            }}
          />
        ) : null}
        <div className="flex gap-2" role="group" aria-label={t('demands.kind')}>
          {[null, 'expert', 'knowledge'].map((kind) => (
            <Button
              key={kind ?? 'all'}
              size="sm"
              variant={filters.kind === kind ? 'default' : 'outline'}
              onClick={() => setFilters({ ...filters, kind, page: 1 })}
            >
              {kind ? t(`kind.${kind}`) : t('all')}
            </Button>
          ))}
        </div>
        {hall.isPending ? (
          <p className="text-muted-foreground text-sm">{t('loading')}</p>
        ) : hall.isError ? (
          <Problem error={hall.error} />
        ) : hall.data.items.length === 0 ? (
          <p className="text-muted-foreground rounded-xl border border-dashed px-4 py-8 text-center text-sm">
            {t('demands.empty')}
          </p>
        ) : (
          <ul className="divide-y rounded-xl border" aria-label={t('demands.title')}>
            {hall.data.items.map((demand) => (
              <li key={demand.demand_id} className="space-y-1 px-4 py-3">
                <Link
                  href={`/${locale}/demands/${demand.demand_id}`}
                  className="font-medium hover:underline"
                >
                  {demand.title}
                </Link>
                <p className="text-muted-foreground line-clamp-2 text-sm">{demand.problem}</p>
                <p className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge>{t(`kind.${demand.kind}`)}</Badge>
                  {demand.budget ? <span>{t('budget', { value: demand.budget })}</span> : null}
                  {demand.deadline ? (
                    <span className="text-muted-foreground">
                      {t('deadline', {
                        date: format.dateTime(new Date(demand.deadline), { dateStyle: 'medium' }),
                      })}
                    </span>
                  ) : null}
                  {demand.mine ? <Badge tone="ok">{t('yours')}</Badge> : null}
                </p>
              </li>
            ))}
          </ul>
        )}
        {hall.data ? (
          <Pager
            page={hall.data.page}
            total={hall.data.total}
            size={hall.data.page_size}
            onPage={(page) => setFilters({ ...filters, page })}
          />
        ) : null}
      </div>
    </MarketShell>
  )
}

function DemandEditor({ csrfToken, onDone }: { csrfToken: string; onDone: () => void }) {
  const t = useTranslations('marketUi')
  const [form, setForm] = useState<DemandForm>({
    kind: 'expert',
    title: '',
    problem: '',
    data_wanted: '',
    deadline: '',
    budget: null,
  })
  const save = useMutation({ mutationFn: () => createDemand(csrfToken, form), onSuccess: onDone })
  const ready = form.title.trim() && form.problem.trim() && form.deadline
  return (
    <form
      className="space-y-3 rounded-xl border p-4"
      aria-label={t('demands.post')}
      onSubmit={(event) => {
        event.preventDefault()
        if (ready) save.mutate()
      }}
    >
      <fieldset className="flex gap-4 text-sm">
        <legend className="mb-1 font-medium">{t('demands.want')}</legend>
        {(['expert', 'knowledge'] as const).map((kind) => (
          <label key={kind} className="flex items-center gap-1">
            <input
              type="radio"
              checked={form.kind === kind}
              onChange={() => setForm({ ...form, kind })}
            />
            {t(`kind.${kind}`)}
          </label>
        ))}
      </fieldset>
      <Field label={t('demands.titleField')}>
        <input
          className={inputClass}
          maxLength={120}
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
      </Field>
      <Field label={t('demands.problem')}>
        <textarea
          className={inputClass}
          rows={3}
          maxLength={4000}
          value={form.problem}
          onChange={(e) => setForm({ ...form, problem: e.target.value })}
        />
      </Field>
      <Field label={t('demands.dataWanted')}>
        <textarea
          className={inputClass}
          rows={2}
          maxLength={4000}
          value={form.data_wanted}
          onChange={(e) => setForm({ ...form, data_wanted: e.target.value })}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('demands.deadline')}>
          <input
            type="date"
            className={inputClass}
            value={form.deadline}
            onChange={(e) => setForm({ ...form, deadline: e.target.value })}
          />
        </Field>
        <Field label={t('demands.budget')} hint={t('demands.budgetHint')}>
          <input
            inputMode="decimal"
            className={inputClass}
            value={form.budget ?? ''}
            onChange={(e) => setForm({ ...form, budget: e.target.value || null })}
          />
        </Field>
      </div>
      <Button type="submit" size="sm" disabled={!ready || save.isPending}>
        {save.isPending ? t('working') : t('demands.publish')}
      </Button>
      <Problem error={save.error} />
    </form>
  )
}

// 一条需求：需求方看到所有响应、能选一家、能关；卖家能响应、能撤；留言在平台内
export function DemandScreen({ csrfToken, account, demandId }: Props & { demandId: string }) {
  const t = useTranslations('marketUi')
  const format = useFormatter()
  const client = useQueryClient()
  const key = ['market', 'demand', demandId] as const
  const demand = useQuery({ queryKey: key, queryFn: () => fetchDemand(demandId) })
  const changed = () => client.invalidateQueries({ queryKey: key })
  const close = useMutation({
    mutationFn: () => closeDemand(csrfToken, demandId),
    onSuccess: changed,
  })
  const d = demand.data
  return (
    <MarketShell account={account}>
      <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-8">
        {demand.isPending ? (
          <p className="text-muted-foreground text-sm">{t('loading')}</p>
        ) : demand.isError || !d ? (
          <Problem error={demand.error} />
        ) : (
          <>
            <header className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">{d.title}</h1>
              <p className="flex flex-wrap items-center gap-2 text-xs">
                <Badge>{t(`kind.${d.kind}`)}</Badge>
                <Badge tone={d.taking_responses ? 'ok' : 'muted'}>
                  {t(`demandStatus.${d.taking_responses ? 'taking' : d.status}`)}
                </Badge>
                {d.budget ? <span>{t('budget', { value: d.budget })}</span> : null}
                {d.deadline ? (
                  <span className="text-muted-foreground">
                    {t('deadline', {
                      date: format.dateTime(new Date(d.deadline), { dateStyle: 'medium' }),
                    })}
                  </span>
                ) : null}
              </p>
            </header>
            <section className="space-y-1 text-sm">
              <p className="whitespace-pre-wrap">{d.problem}</p>
              {d.data_wanted ? (
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {t('dataWanted', { text: d.data_wanted })}
                </p>
              ) : null}
            </section>
            {d.mine && (d.status === 'open' || d.status === 'chosen') ? (
              <Button
                size="sm"
                variant="outline"
                disabled={close.isPending}
                onClick={() => close.mutate()}
              >
                {t('demands.close')}
              </Button>
            ) : null}
            <section className="space-y-3">
              <h2 className="text-sm font-semibold">
                {t('responses', { count: d.response_count })}
              </h2>
              {d.responses.map((r) => (
                <ResponseCard
                  key={r.response_id}
                  csrfToken={csrfToken}
                  demand={d}
                  response={r}
                  onChanged={changed}
                />
              ))}
              {!d.mine && d.taking_responses && !d.responses.some((r) => r.mine) ? (
                <ResponseEditor csrfToken={csrfToken} demand={d} onDone={changed} />
              ) : null}
            </section>
            <Thread
              csrfToken={csrfToken}
              kind="demand"
              id={d.demand_id}
              title={t('demandMessages')}
            />
            {!d.mine ? (
              <ReportButton csrfToken={csrfToken} kind="demand" targetId={d.demand_id} />
            ) : null}
          </>
        )}
      </div>
    </MarketShell>
  )
}

function ResponseCard({
  csrfToken,
  demand,
  response,
  onChanged,
}: {
  csrfToken: string
  demand: DemandDetail
  response: DemandResponse
  onChanged: () => void
}) {
  const t = useTranslations('marketUi')
  const locale = useLocale()
  const choose = useMutation({
    mutationFn: () => chooseResponse(csrfToken, demand.demand_id, response.response_id),
    onSuccess: onChanged,
  })
  const withdraw = useMutation({
    mutationFn: () => withdrawResponse(csrfToken, response.response_id),
    onSuccess: onChanged,
  })
  // 选中了、当初没附条目：做好上架再补附（Fable 评审 P2-9）
  const [ref, setRef] = useState('')
  const attach = useMutation({
    mutationFn: () =>
      attachOffer(csrfToken, response.response_id, {
        listing_kind: demand.kind,
        listing_ref: ref.trim(),
      }),
    onSuccess: onChanged,
  })
  const offered =
    response.listing_kind === 'knowledge' && response.listing_ref
      ? `/${locale}/knowledge/${response.listing_ref}${response.status === 'chosen' && demand.mine ? `?demand=${demand.demand_id}` : ''}`
      : response.listing_kind === 'expert' && response.listing_ref
        ? `/${locale}/knowbots/${response.listing_ref.split('@')[0]}`
        : null
  return (
    <article className="space-y-2 rounded-xl border p-4 text-sm" aria-label={t('responseFrom')}>
      <p className="flex flex-wrap items-center gap-2">
        <Badge tone={response.status === 'chosen' ? 'ok' : 'muted'}>
          {t(`responseStatus.${response.status}`)}
        </Badge>
        {response.price ? <Price value={response.price} /> : null}
        {response.days ? (
          <span className="text-muted-foreground text-xs">
            {t('days', { days: response.days })}
          </span>
        ) : null}
        {response.mine ? <Badge tone="ok">{t('yours')}</Badge> : null}
      </p>
      <p className="whitespace-pre-wrap">{response.proposal}</p>
      {offered ? (
        <Link href={offered} className="text-primary text-sm underline">
          {response.status === 'chosen' && demand.mine && response.listing_kind === 'knowledge'
            ? t('buyChosen')
            : t('seeOffer')}
        </Link>
      ) : null}
      {response.mine && response.status === 'chosen' && !response.listing_ref ? (
        <div className="flex flex-wrap items-end gap-2">
          <Field
            label={demand.kind === 'knowledge' ? t('attachKnowledge') : t('attachExpert')}
            hint={t('attachLater')}
          >
            <input
              className={inputClass}
              maxLength={128}
              value={ref}
              onChange={(e) => setRef(e.target.value)}
            />
          </Field>
          <Button
            size="sm"
            disabled={!ref.trim() || attach.isPending}
            onClick={() => attach.mutate()}
          >
            {t('attachOffer')}
          </Button>
          <Problem error={attach.error} />
        </div>
      ) : null}
      <div className="flex gap-2">
        {demand.mine && demand.status === 'open' && response.status === 'open' ? (
          <Button size="sm" disabled={choose.isPending} onClick={() => choose.mutate()}>
            {t('choose')}
          </Button>
        ) : null}
        {response.mine && response.status === 'open' ? (
          <Button
            size="sm"
            variant="outline"
            disabled={withdraw.isPending}
            onClick={() => withdraw.mutate()}
          >
            {t('withdraw')}
          </Button>
        ) : null}
      </div>
      <Problem error={choose.error ?? withdraw.error} />
      <Thread
        csrfToken={csrfToken}
        kind="response"
        id={response.response_id}
        title={t('privateMessages')}
      />
    </article>
  )
}

function ResponseEditor({
  csrfToken,
  demand,
  onDone,
}: {
  csrfToken: string
  demand: DemandDetail
  onDone: () => void
}) {
  const t = useTranslations('marketUi')
  const [proposal, setProposal] = useState('')
  const [price, setPrice] = useState('')
  const [days, setDays] = useState('')
  const [ref, setRef] = useState('')
  const send = useMutation({
    mutationFn: () =>
      respond(csrfToken, demand.demand_id, {
        listing_kind: ref ? demand.kind : null,
        listing_ref: ref || null,
        proposal,
        price: price || null,
        days: days ? Number(days) : null,
      }),
    onSuccess: onDone,
  })
  return (
    <form
      className="space-y-3 rounded-xl border p-4"
      aria-label={t('respond')}
      onSubmit={(event) => {
        event.preventDefault()
        if (proposal.trim()) send.mutate()
      }}
    >
      <h3 className="text-sm font-semibold">{t('respond')}</h3>
      <Field label={t('proposal')}>
        <textarea
          className={inputClass}
          rows={3}
          maxLength={4000}
          value={proposal}
          onChange={(e) => setProposal(e.target.value)}
        />
      </Field>
      <Field
        label={demand.kind === 'knowledge' ? t('attachKnowledge') : t('attachExpert')}
        hint={t('attachHint')}
      >
        <input
          className={inputClass}
          maxLength={128}
          value={ref}
          onChange={(e) => setRef(e.target.value)}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('offerPrice')}>
          <input
            inputMode="decimal"
            className={inputClass}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </Field>
        <Field label={t('offerDays')}>
          <input
            inputMode="numeric"
            className={inputClass}
            value={days}
            onChange={(e) => setDays(e.target.value)}
          />
        </Field>
      </div>
      <Button type="submit" size="sm" disabled={!proposal.trim() || send.isPending}>
        {send.isPending ? t('working') : t('sendResponse')}
      </Button>
      <Problem error={send.error} />
    </form>
  )
}

// 平台内留言：不显示联系方式；需求下的大家都能看，响应下的只有需求方与那位卖家
export function Thread({
  csrfToken,
  kind,
  id,
  title,
}: {
  csrfToken: string
  kind: 'demand' | 'response'
  id: string
  title: string
}) {
  const t = useTranslations('marketUi')
  const client = useQueryClient()
  const key = ['market', 'messages', kind, id] as const
  const messages = useQuery({ queryKey: key, queryFn: () => fetchMessages(kind, id) })
  const [body, setBody] = useState('')
  const send = useMutation({
    mutationFn: () => postMessage(csrfToken, kind, id, body),
    onSuccess: () => {
      setBody('')
      void client.invalidateQueries({ queryKey: key })
    },
  })
  return (
    <section className="space-y-2" aria-label={title}>
      <h3 className="text-muted-foreground text-xs font-medium">{title}</h3>
      <ul className="space-y-1 text-sm">
        {(messages.data?.items ?? []).map((m) => (
          <li key={m.message_id} className={m.mine ? 'text-right' : ''}>
            <span className="text-muted-foreground mr-1 text-xs">
              {t(`role.${m.mine ? 'me' : m.role}`)}
            </span>
            {m.body}
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (body.trim()) send.mutate()
        }}
      >
        <input
          className={inputClass}
          aria-label={t('message')}
          maxLength={2000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <Button type="submit" size="sm" variant="outline" disabled={!body.trim() || send.isPending}>
          {t('send')}
        </Button>
      </form>
    </section>
  )
}
