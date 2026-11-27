'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { MARKET_CATEGORIES } from '@/lib/market/categories'
import {
  classifyMethod,
  fetchOwnFormalListings,
  setIncubationPermission,
  submitFormalListing,
  withdrawFormalListing,
  type IncubationScope,
} from '@/lib/market/client'
import { Badge, Field, inputClass, Price, Problem } from './parts'

export function MyFormalMethods({
  csrfToken,
  platform = false,
}: {
  csrfToken: string
  platform?: boolean
}) {
  const t = useTranslations('marketUi.myShop')
  const locale = useLocale()
  const client = useQueryClient()
  const [pages, setPages] = useState<(string | null)[]>([null])
  const [regCategories, setRegCategories] = useState<Record<string, string>>({})
  const [prices, setPrices] = useState<Record<string, string>>({})
  const after = pages[pages.length - 1]

  const list = useQuery({
    queryKey: ['my-formal-listings', after],
    queryFn: () => fetchOwnFormalListings(after),
  })
  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: ['my-formal-listings'] }),
      client.invalidateQueries({ queryKey: ['incubation-permissions'] }),
      client.invalidateQueries({ queryKey: ['web', 'experts'] }),
      client.invalidateQueries({ queryKey: ['market', 'my-shop'] }),
    ])

  const classify = useMutation({
    mutationFn: ({ id, code }: { id: string; code: string }) => classifyMethod(csrfToken, id, code),
    onSuccess: refresh,
  })
  const publish = useMutation({
    mutationFn: (input: {
      reference: { method_id: string; version: number; digest: string }
      category: string
      directory_category?: string | null
      price: string | null
    }) => submitFormalListing(csrfToken, input),
    onSuccess: refresh,
  })
  const permit = useMutation({
    mutationFn: ({ id, scope }: { id: string; scope: IncubationScope }) =>
      setIncubationPermission(csrfToken, id, scope),
    onSuccess: refresh,
  })
  const withdraw = useMutation({
    mutationFn: (id: string) => withdrawFormalListing(csrfToken, id),
    onSettled: refresh,
  })

  return (
    <section className="space-y-3">
      <Problem error={list.error ?? withdraw.error ?? classify.error ?? publish.error ?? permit.error} />
      {list.isSuccess && !list.data.items.length && (
        <p className="text-muted-foreground text-sm">{t('noFormalListings')}</p>
      )}
      <div className="divide-y rounded-xl border">
        {list.data?.items.map((row) => {
          const categories = row.method_kind
            ? list.data.directory_categories?.[row.method_kind]
            : undefined
          const defaultReg =
            row.category && row.category !== 'uncategorized'
              ? row.category
              : row.method_kind === 'tool'
                ? 'tools.calculator'
                : ''
          const regCat = regCategories[row.listing_id] ?? defaultReg
          const priceVal = prices[row.listing_id] ?? row.price ?? ''
          return (
            <article key={row.listing_id} className="space-y-3 p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/${locale}/knowbots/formal/${row.listing_id}`}
                    className="font-medium hover:underline"
                  >
                    {`${row.title} · v${row.reference.version} · ${t(`formalScope.${row.scope}`)} · ${t(`formalStatus.${row.status}`)}`}
                  </Link>
                  {row.price !== undefined ? <Price value={row.price ?? null} /> : null}
                </p>
                {(row.status === 'pending' || row.status === 'listed') && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={withdraw.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          t('confirmWithdrawFormal', {
                            title: row.title,
                            version: row.reference.version,
                          }),
                        )
                      )
                        withdraw.mutate(row.listing_id)
                    }}
                  >
                    {t('withdrawFormal')}
                  </Button>
                )}
              </div>
              {row.review_note ? (
                <p className="text-muted-foreground text-xs">{row.review_note}</p>
              ) : null}
              <div className="flex flex-wrap items-end gap-3">
                {row.editable_category && categories && (
                  <div className="flex flex-wrap items-end gap-2">
                    <Field label={t('methodCategory')}>
                      <select
                        className={inputClass}
                        value={row.editable_category}
                        disabled={classify.isPending}
                        onChange={(event) =>
                          classify.mutate({ id: row.listing_id, code: event.target.value })
                        }
                      >
                        {categories.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.group_name === c.name ? c.name : `${c.group_name} / ${c.name}`}
                          </option>
                        ))}
                      </select>
                    </Field>
                    {row.suggested_category && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={classify.isPending}
                        onClick={() =>
                          classify.mutate({ id: row.listing_id, code: row.suggested_category! })
                        }
                      >
                        {t('adoptCategory', {
                          name:
                            categories.find((c) => c.code === row.suggested_category)?.name ??
                            row.suggested_category,
                        })}
                      </Button>
                    )}
                  </div>
                )}

                {row.scope === 'self' || row.status === 'withdrawn' ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <Field label={t('regulatedCategory')}>
                      <select
                        className={inputClass}
                        value={regCat}
                        onChange={(e) =>
                          setRegCategories({ ...regCategories, [row.listing_id]: e.target.value })
                        }
                      >
                        <option value="">{t('chooseRegulatedCategory')}</option>
                        {MARKET_CATEGORIES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.group} · {c.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label={t('formalPrice')}>
                      <input
                        inputMode="decimal"
                        className={`${inputClass} w-28`}
                        value={priceVal}
                        onChange={(e) => setPrices({ ...prices, [row.listing_id]: e.target.value })}
                      />
                    </Field>
                    <Button
                      size="sm"
                      disabled={publish.isPending || !regCat}
                      onClick={() =>
                        publish.mutate({
                          reference: row.reference,
                          category: regCat,
                          directory_category:
                            row.editable_category && row.editable_category !== 'uncategorized'
                              ? row.editable_category
                              : undefined,
                          price: priceVal.trim() || null,
                        })
                      }
                    >
                      {t('submitFormalPublic')}
                    </Button>
                  </div>
                ) : null}

                {row.scope === 'public' && row.method_kind === 'tool' ? (
                  <Field label={t('incubation')}>
                    <select
                      aria-label={`${row.title} · ${t('incubation')}`}
                      className={inputClass}
                      value={row.incubation_scope ?? 'none'}
                      disabled={permit.isPending}
                      onChange={(e) =>
                        permit.mutate({
                          id: row.listing_id,
                          scope: e.target.value as IncubationScope,
                        })
                      }
                    >
                      <option value="none">{t('scopeNone')}</option>
                      <option disabled={row.status !== 'listed'} value="acquired">
                        {t('scopeAcquired')}
                      </option>
                      {(platform || row.incubation_scope === 'platform') && (
                        <option disabled={row.status !== 'listed' || !platform} value="platform">
                          {t('scopePlatform')}
                        </option>
                      )}
                    </select>
                  </Field>
                ) : null}
              </div>
            </article>
          )
        })}
      </div>
      <div className="flex gap-2">
        {pages.length > 1 && (
          <Button size="sm" variant="outline" onClick={() => setPages(pages.slice(0, -1))}>
            {t('previousPage')}
          </Button>
        )}
        {list.data?.next && (
          <Button size="sm" variant="outline" onClick={() => setPages([...pages, list.data.next])}>
            {t('nextPage')}
          </Button>
        )}
      </div>
    </section>
  )
}
