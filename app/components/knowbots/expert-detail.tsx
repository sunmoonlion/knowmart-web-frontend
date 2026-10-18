'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useFormatter, useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useState } from 'react'

import { CrossAppLink } from '@/components/common/cross-app-link'
import { Button } from '@/components/ui/button'
import type { ExpertDetail as Detail } from '@/contracts/experts'
import { useCrossAppOrigin } from '@/lib/cross-app/use-cross-app'
import { fetchExpert } from '@/lib/knowbots/catalog'
import { stopKnowbotVersion, summonReturnUrl } from '@/lib/knowbots/client'
import { leaveTo } from '@/lib/leave-to'
import { cn } from '@/lib/utils'

type Tab = 'canDo' | 'data' | 'delivers' | 'versions' | 'publisher'

type Props = { knowbotId: string; csrfToken: string; account: React.ReactNode }

// 专家详情（SDD 0032）：头部像京东的商品主区（名字、介绍、类目、版本选择像选规格、主按钮），
// 下面页签像「商品介绍 / 规格参数」。发布主体页签只有公开专家才有；方法步骤只有所有者自己看得到。
export function ExpertDetail({ knowbotId, csrfToken, account }: Props) {
  const t = useTranslations('experts')
  const format = useFormatter()
  const locale = useLocale()
  const search = useSearchParams()
  const queryClient = useQueryClient()
  const [version, setVersion] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('canDo')
  const [failed, setFailed] = useState<string | null>(null)
  const expert = useQuery({
    queryKey: ['web', 'experts', knowbotId, version] as const,
    queryFn: () => fetchExpert(knowbotId, version),
  })
  const origin = useCrossAppOrigin()
  const summoning = origin.data?.return_url ? origin.data : null
  const summon = useMutation({
    mutationFn: (chosen: string) =>
      summonReturnUrl(knowbotId, chosen, { app: summoning!.app, ref: summoning!.ref }, csrfToken),
    onSuccess: (url) => leaveTo(url),
    onError: () => setFailed(t('summonFailed')),
  })
  const stop = useMutation({
    mutationFn: (chosen: string) => stopKnowbotVersion(knowbotId, chosen, csrfToken),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['web', 'experts', knowbotId] }),
    onError: () => setFailed(t('stopFailed')),
  })
  const back = new URLSearchParams()
  for (const key of ['from', 'ref']) {
    const value = search.get(key)
    if (value !== null) back.set(key, value)
  }
  const date = (value: string) => format.dateTime(new Date(value), { dateStyle: 'medium' })

  return (
    <div className="flex min-h-screen flex-col" data-route-class="authenticated-workspace">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b px-6 py-3">
        <Link
          href={`/${locale}/knowbots${back.size ? `?${back}` : ''}`}
          className="text-primary font-semibold"
        >
          {t('back')}
        </Link>
        <div className="flex items-center gap-4">{account}</div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 p-6">
        {expert.isPending ? (
          <p className="text-muted-foreground">{t('loading')}</p>
        ) : expert.isError ? (
          <p className="text-muted-foreground" role="alert">
            {t('notFound')}
          </p>
        ) : (
          <Body
            expert={expert.data}
            tab={expert.data.publisher === null && tab === 'publisher' ? 'canDo' : tab}
            onTab={setTab}
            onVersion={setVersion}
            date={date}
            failed={failed}
            action={
              summoning ? (
                expert.data.summonable ? (
                  <Button
                    disabled={summon.isPending}
                    onClick={() => {
                      setFailed(null)
                      summon.mutate(expert.data.version)
                    }}
                  >
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
              )
            }
            onStop={(chosen) => {
              setFailed(null)
              stop.mutate(chosen)
            }}
            stopping={stop.isPending}
          />
        )}
      </main>
    </div>
  )
}

function Body({
  expert,
  tab,
  onTab,
  onVersion,
  date,
  failed,
  action,
  onStop,
  stopping,
}: {
  expert: Detail
  tab: Tab
  onTab: (tab: Tab) => void
  onVersion: (version: string) => void
  date: (value: string) => string
  failed: string | null
  action: React.ReactNode
  onStop: (version: string) => void
  stopping: boolean
}) {
  const t = useTranslations('experts')
  const tabs: Tab[] = ['canDo', 'data', 'delivers', 'versions']
  if (expert.publisher) tabs.push('publisher')
  const { sections } = expert
  return (
    <article>
      <section className="grid gap-2 border-b pb-5 sm:grid-cols-[1fr_auto]">
        <h1 className="text-2xl font-semibold tracking-tight">{expert.name}</h1>
        <div className="sm:row-span-2 sm:self-start">{action}</div>
        {expert.tagline ? <p>{expert.tagline}</p> : null}
        <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-sm sm:col-span-2">
          <span>{t('categoryLabel', { name: expert.category.name })}</span>
          <label htmlFor="expert-version" className="flex items-center gap-1.5">
            {t('versionLabel')}
            <select
              id="expert-version"
              value={expert.version}
              onChange={(event) => onVersion(event.target.value)}
              className="text-foreground bg-background rounded-md border px-2 py-0.5"
            >
              {expert.versions.map((v) => (
                <option key={v.version} value={v.version}>
                  {t('version', { version: v.version })}
                  {v.status === 'stopped' ? ` · ${t('stopped')}` : ''}
                </option>
              ))}
            </select>
          </label>
          <span>{t('updatedAt', { date: date(expert.updated_at) })}</span>
        </div>
        {failed ? (
          <p className="text-destructive text-sm sm:col-span-2" role="alert">
            {failed}
          </p>
        ) : null}
      </section>

      <div role="tablist" className="flex flex-wrap gap-1 border-b">
        {tabs.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`tab-${key}`}
            aria-selected={tab === key}
            aria-controls="expert-tab-panel"
            onClick={() => onTab(key)}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm',
              tab === key
                ? 'border-primary font-semibold'
                : 'text-muted-foreground border-transparent',
            )}
          >
            {t(`tabs.${key}`)}
          </button>
        ))}
      </div>

      <section
        id="expert-tab-panel"
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        className="space-y-4 py-5 text-sm"
      >
        {tab === 'canDo' ? (
          <>
            <Pairs
              rows={(
                [
                  ...sections.can_do.map((row) => [row.label, row.text]),
                  [t('scopeDoes'), sections.scope.does],
                  [t('scopeDoesNot'), sections.scope.does_not],
                  [t('scopeElsewhere'), sections.scope.elsewhere],
                ] as [string, string][]
              ).filter(([, text]) => text)}
              empty={t('nothingWritten')}
            />
            {sections.steps ? (
              <div>
                <h2 className="mb-2 font-semibold">{t('steps')}</h2>
                <ol className="list-decimal space-y-1 pl-5">
                  {sections.steps.map((step, index) => (
                    <li key={index}>
                      {step.title}
                      {step.summary ? (
                        <span className="text-muted-foreground"> · {step.summary}</span>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </>
        ) : tab === 'data' ? (
          <>
            <div>
              <h2 className="mb-2 font-semibold">{t('bundled')}</h2>
              {sections.data.bundled.length === 0 ? (
                <p className="text-muted-foreground">{t('noBundled')}</p>
              ) : (
                <ul className="space-y-1">
                  {sections.data.bundled.map((d) => (
                    <li key={d.dataset_id} className="font-mono text-xs">
                      {d.dataset_id} · {t('version', { version: d.version })}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p>{sections.data.accepts_user_data ? t('acceptsUserData') : t('ownDataOnly')}</p>
          </>
        ) : tab === 'delivers' ? (
          sections.delivers.length === 0 ? (
            <p className="text-muted-foreground">{t('nothingWritten')}</p>
          ) : (
            <ul className="space-y-1">
              {sections.delivers.map((d, index) => (
                <li key={index}>
                  <span className="font-medium">{d.step}</span>
                  <span className="text-muted-foreground">
                    {' · '}
                    {d.file ? t('deliverFile', { file: d.file }) : t('deliverResult')}
                  </span>
                </li>
              ))}
            </ul>
          )
        ) : tab === 'versions' ? (
          <ul className="space-y-2">
            {expert.versions.map((v) => (
              <li key={v.version} className="flex flex-wrap items-center justify-between gap-3">
                <span>
                  {t('version', { version: v.version })}
                  <span className="text-muted-foreground">
                    {' · '}
                    {t(v.status === 'active' ? 'active' : 'stopped')}
                    {' · '}
                    {t('deliveredAt', { date: date(v.delivered_at) })}
                  </span>
                </span>
                {expert.owned && v.status === 'active' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={stopping}
                    onClick={() => onStop(v.version)}
                  >
                    {t('stop')}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : expert.publisher ? (
          <div className="space-y-2">
            <p className="font-semibold">
              {expert.publisher.name}
              <span className="text-muted-foreground font-normal">
                {' · '}
                {t(`publisherKind.${expert.publisher.kind}`)}
                {expert.publisher.real_name_verified ? ` · ${t('realName')}` : ''}
              </span>
            </p>
            <ul className="space-y-1">
              {expert.publisher.licenses.map((license) => (
                <li key={license.number}>
                  {t('license', { name: license.name, number: license.number })}
                  <span className="text-muted-foreground">
                    {' · '}
                    {license.valid_until
                      ? t('validUntil', { date: date(license.valid_until) })
                      : t('longTerm')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </article>
  )
}

function Pairs({ rows, empty }: { rows: [string, string][]; empty: string }) {
  if (rows.length === 0) return <p className="text-muted-foreground">{empty}</p>
  return (
    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[8rem_1fr]">
      {rows.map(([label, text]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd>{text}</dd>
        </div>
      ))}
    </dl>
  )
}
