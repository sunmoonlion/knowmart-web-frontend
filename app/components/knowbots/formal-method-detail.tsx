'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useFormatter, useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

import { CrossAppLink } from '@/components/common/cross-app-link'
import { MarketHeader } from '@/components/market/market-shell'
import { Badge, Price, Reviews, ShopLink, Stars } from '@/components/market/parts'
import { Button } from '@/components/ui/button'
import type { FormalMethodDetail as Detail } from '@/contracts/experts'
import { useCrossAppOrigin } from '@/lib/cross-app/use-cross-app'
import { leaveTo } from '@/lib/leave-to'
import {
  acquireFormalListing,
  fetchFormalListingDetail,
  formalSummonReturnUrl,
} from '@/lib/market/client'
import { ApiClientError } from '@/lib/common/api-client'
import { filtersTo, filtersFrom } from '@/lib/knowbots/catalog'
import { cn } from '@/lib/utils'

type Tab = 'canDo' | 'inputs' | 'delivers' | 'versions' | 'publisher'

type Props = { listingId: string; csrfToken: string; account: React.ReactNode }

export function FormalMethodDetail({ listingId, csrfToken, account }: Props) {
  const t = useTranslations('experts')
  const format = useFormatter()
  const locale = useLocale()
  const router = useRouter()
  const search = useSearchParams()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('canDo')
  const [failed, setFailed] = useState<string | null>(null)
  const demandId = search.get('demand') ?? undefined

  const detail = useQuery({
    queryKey: ['market', 'formal-listing', listingId] as const,
    queryFn: () => fetchFormalListingDetail(listingId),
  })
  const origin = useCrossAppOrigin()
  const summoning = origin.data?.return_url ? origin.data : null

  const summon = useMutation({
    mutationFn: () =>
      formalSummonReturnUrl(csrfToken, listingId, { app: summoning!.app, ref: summoning!.ref }),
    onSuccess: (url) => leaveTo(url),
    onError: () => setFailed(t('summonFailed')),
  })
  const acquire = useMutation({
    mutationFn: () => acquireFormalListing(csrfToken, listingId, demandId),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['market', 'formal-listing', listingId] }),
        queryClient.invalidateQueries({ queryKey: ['web', 'experts'] }),
      ]),
    onError: () => setFailed(t('acquireFailed')),
  })

  const catalogParams = new URLSearchParams(search.toString())
  const back = filtersTo(filtersFrom(catalogParams), catalogParams)
  const common = useTranslations('common')
  const date = (value: string) =>
    value ? format.dateTime(new Date(value), { dateStyle: 'medium' }) : '—'

  const item: Detail | undefined = detail.data
  const formalParam = item ? `${item.reference.method_id}@${item.reference.version}` : ''
  const ready = Boolean(item && (item.owned || item.acquired))

  return (
    <div className="flex min-h-screen flex-col" data-route-class="authenticated-workspace">
      <MarketHeader account={account} />
      <div className="px-6 pt-3">
        <Link
          href={`/${locale}/knowbots${back.size ? `?${back}` : ''}`}
          className="text-primary font-semibold"
        >
          {t('back')}
        </Link>
      </div>
      <main className="mx-auto w-full max-w-5xl flex-1 p-6">
        {detail.isPending ? (
          <p className="text-muted-foreground">{t('loading')}</p>
        ) : detail.isError || !item ? (
          <div role="alert">
            {detail.error instanceof ApiClientError && detail.error.status === 404 ? (
              t('notFound')
            ) : (
              <>
                <p>{t('loadFailed')}</p>
                <Button variant="outline" onClick={() => void detail.refetch()}>
                  {common('retry')}
                </Button>
              </>
            )}
          </div>
        ) : (
          <article className="space-y-6">
            <section className="grid gap-3 border-b pb-5 sm:grid-cols-[1fr_auto]">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight">{item.title}</h1>
                  <Badge>{t(item.method_kind === 'tool' ? 'toolMethod' : 'expertMethod')}</Badge>
                  <Badge>{item.category.name}</Badge>
                </div>
                <p className="text-sm">{item.purpose}</p>
                <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-sm">
                  <Price value={item.price} />
                  <Stars rating={item.rating} />
                  <ShopLink shop={item.shop} />
                  {item.versions.length > 1 ? (
                    <label htmlFor="formal-version" className="flex items-center gap-1.5">
                      {t('versionLabel')}
                      <select
                        id="formal-version"
                        value={item.listing_id}
                        onChange={(e) => {
                          const qs = search.toString()
                          router.replace(
                            `/${locale}/knowbots/formal/${e.target.value}${qs ? `?${qs}` : ''}`,
                          )
                        }}
                        className="text-foreground bg-background rounded-md border px-2 py-0.5"
                      >
                        {item.versions.map((v) => (
                          <option key={v.listing_id} value={v.listing_id}>
                            {t('version', { version: v.version })}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <span>{t('version', { version: item.reference.version })}</span>
                  )}
                  {item.updated_at ? (
                    <span>{t('updatedAt', { date: date(item.updated_at) })}</span>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap items-start gap-2">
                {summoning && item.method_kind === 'expert' ? (
                  <Button
                    disabled={summon.isPending}
                    onClick={() => {
                      setFailed(null)
                      summon.mutate()
                    }}
                  >
                    {t('summon')}
                  </Button>
                ) : ready ? (
                  <>
                    {item.method_kind === 'expert' ? (
                      <CrossAppLink
                        to="knowbench.summonFormal"
                        values={{ mode: 'expert', formal_method: formalParam }}
                        className="text-primary text-sm font-medium underline-offset-4 hover:underline"
                      >
                        {t('goWorkbench')}
                      </CrossAppLink>
                    ) : (
                      <CrossAppLink
                        to="knowbench.methods"
                        className="text-primary text-sm font-medium underline-offset-4 hover:underline"
                      >
                        {t('useInWorkbench')}
                      </CrossAppLink>
                    )}
                    <CrossAppLink
                      to="knowlab.methods"
                      values={{
                        method_id: item.reference.method_id,
                        version: String(item.reference.version),
                      }}
                      className="text-primary text-sm underline-offset-4 hover:underline"
                    >
                      {t(item.owned ? 'manageInKnowlab' : 'useInKnowlab')}
                    </CrossAppLink>
                  </>
                ) : (
                  <Button
                    disabled={acquire.isPending}
                    onClick={() => {
                      setFailed(null)
                      acquire.mutate()
                    }}
                  >
                    {t(item.method_kind === 'tool' ? 'acquireTool' : 'acquireExpert')}
                  </Button>
                )}
              </div>
              {failed ? (
                <p className="text-destructive text-sm sm:col-span-2" role="alert">
                  {failed}
                </p>
              ) : null}
            </section>

            <div role="tablist" className="flex flex-wrap gap-1 border-b">
              {(['canDo', 'inputs', 'delivers', 'versions', 'publisher'] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => setTab(key)}
                  className={cn(
                    '-mb-px border-b-2 px-3 py-2 text-sm',
                    tab === key
                      ? 'border-primary font-semibold'
                      : 'text-muted-foreground border-transparent',
                  )}
                >
                  {t(`formalTabs.${key}`)}
                </button>
              ))}
            </div>

            <section role="tabpanel" className="space-y-4 text-sm">
              {tab === 'canDo' ? (
                <div className="space-y-4">
                  <div>
                    <h2 className="mb-1 font-semibold">{t('formalContract.promises')}</h2>
                    {Object.keys(item.public_contract.promises).length === 0 ? (
                      <p className="text-muted-foreground">{t('nothingWritten')}</p>
                    ) : (
                      <ul className="list-disc space-y-1 pl-5">
                        {Object.entries(item.public_contract.promises).map(([pid, text]) => (
                          <li key={pid}>
                            <span className="font-medium">{pid}</span>：{text}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {item.public_contract.applies_when.length > 0 ? (
                    <div>
                      <h2 className="mb-1 font-semibold">{t('formalContract.appliesWhen')}</h2>
                      <ul className="list-disc space-y-1 pl-5">
                        {item.public_contract.applies_when.map((line, i) => (
                          <li key={i}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {item.public_contract.excludes.length > 0 ? (
                    <div>
                      <h2 className="mb-1 font-semibold">{t('formalContract.excludes')}</h2>
                      <ul className="list-disc space-y-1 pl-5">
                        {item.public_contract.excludes.map((line, i) => (
                          <li key={i}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : tab === 'inputs' ? (
                <div className="space-y-4">
                  <div>
                    <h2 className="mb-2 font-semibold">{t('formalContract.publicInputs')}</h2>
                    {item.public_contract.public_inputs.length === 0 ? (
                      <p className="text-muted-foreground">{t('formalContract.noInputs')}</p>
                    ) : (
                      <ul className="divide-y rounded-lg border">
                        {item.public_contract.public_inputs.map((slot) => (
                          <li key={slot.name} className="space-y-1 px-4 py-3">
                            <p className="flex flex-wrap items-center gap-2 font-medium">
                              <span>{slot.name}</span>
                              <Badge>{slot.domain_label ?? slot.schema_type}</Badge>
                              {slot.required ? (
                                <Badge tone="warn">{t('formalContract.required')}</Badge>
                              ) : null}
                            </p>
                            <p className="text-muted-foreground">{slot.description}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <h2 className="mb-2 font-semibold">{t('formalContract.accessAndApproval')}</h2>
                    <p className="text-muted-foreground mb-2">
                      {item.public_contract.per_action_approval_count > 0
                        ? t('formalContract.perActionApproval', {
                            count: item.public_contract.per_action_approval_count,
                          })
                        : t('formalContract.envelopeApproval')}
                    </p>
                    {item.public_contract.access_summary.length > 0 ? (
                      <ul className="space-y-1">
                        {item.public_contract.access_summary.map((acc, idx) => (
                          <li key={idx} className="text-muted-foreground text-xs">
                            {acc.capability_ref} ({acc.operations.join(', ')})
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>
              ) : tab === 'delivers' ? (
                <div className="space-y-4">
                  <div>
                    <h2 className="mb-2 font-semibold">{t('formalContract.whatToReturn')}</h2>
                    {item.public_contract.what_to_return.length === 0 ? (
                      <p className="text-muted-foreground">{t('nothingWritten')}</p>
                    ) : (
                      <ul className="divide-y rounded-lg border">
                        {item.public_contract.what_to_return.map((slot) => (
                          <li key={slot.name} className="space-y-1 px-4 py-3">
                            <p className="flex flex-wrap items-center gap-2 font-medium">
                              <span>{slot.name}</span>
                              <Badge>{slot.domain_label ?? slot.schema_type}</Badge>
                            </p>
                            <p className="text-muted-foreground">{slot.description}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {item.public_contract.v0_check_kinds.map((kind) => (
                      <Badge key={kind} tone="ok">
                        V0 · {kind}
                      </Badge>
                    ))}
                    {item.public_contract.has_blind_review ? (
                      <Badge tone="ok">{t('formalContract.blindReview')}</Badge>
                    ) : null}
                  </div>
                </div>
              ) : tab === 'versions' ? (
                <ul className="space-y-2">
                  {item.versions.map((v) => (
                    <li
                      key={v.listing_id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2"
                    >
                      <span>
                        {t('version', { version: v.version })} · {v.status} ·{' '}
                        {v.updated_at ? date(v.updated_at) : ''}
                      </span>
                      {v.listing_id !== item.listing_id ? (
                        <Link
                          href={`/${locale}/knowbots/formal/${v.listing_id}`}
                          className="text-primary underline"
                        >
                          {t('formalContract.switchVersion')}
                        </Link>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="space-y-6">
                  {item.publisher ? (
                    <div className="space-y-2">
                      <p className="font-semibold">
                        {item.publisher.name} · {t(`publisherKind.${item.publisher.kind}`)}
                        {item.publisher.real_name_verified ? ` · ${t('realName')}` : ''}
                      </p>
                      <ul className="space-y-1">
                        {item.publisher.licenses.map((lic) => (
                          <li key={lic.number}>
                            {t('license', { name: lic.name, number: lic.number })} ·{' '}
                            {lic.valid_until
                              ? t('validUntil', { date: date(lic.valid_until) })
                              : t('longTerm')}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <Reviews reviews={item.reviews} />
                </div>
              )}
            </section>
          </article>
        )}
      </main>
    </div>
  )
}
