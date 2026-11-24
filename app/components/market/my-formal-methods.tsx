'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { classifyMethod, fetchOwnFormalListings, withdrawFormalListing } from '@/lib/market/client'
import { Problem } from './parts'

export function MyFormalMethods({ csrfToken }: { csrfToken: string }) {
  const t = useTranslations('marketUi.myShop')
  const client = useQueryClient()
  const [pages, setPages] = useState<(string | null)[]>([null])
  const after = pages[pages.length - 1]
  const list = useQuery({
    queryKey: ['my-formal-listings', after],
    queryFn: () => fetchOwnFormalListings(after),
  })
  const classify = useMutation({
    mutationFn: ({ id, code }: { id: string; code: string }) => classifyMethod(csrfToken, id, code),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: ['my-formal-listings'] }),
        client.invalidateQueries({ queryKey: ['web', 'experts'] }),
      ]),
  })
  const withdraw = useMutation({
    mutationFn: (id: string) => withdrawFormalListing(csrfToken, id),
    onSettled: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: ['my-formal-listings'] }),
        client.invalidateQueries({ queryKey: ['incubation-permissions'] }),
      ]),
  })
  return (
    <section className="space-y-3">
      <Problem error={list.error ?? withdraw.error ?? classify.error} />
      {list.isSuccess && !list.data.items.length && <p>{t('noFormalListings')}</p>}
      {list.data?.items.map((row) => {
        const categories = row.method_kind
          ? list.data.directory_categories?.[row.method_kind]
          : undefined
        return (
          <article
            key={row.listing_id}
            className="flex flex-wrap items-center justify-between gap-2"
          >
            <span>
              {row.title} · v{row.reference.version} · {t(`formalScope.${row.scope}`)} ·{' '}
              {t(`formalStatus.${row.status}`)}
            </span>
            {row.editable_category && categories && (
              <div>
                <label>
                  {t('methodCategory')}
                  <select
                    value={row.editable_category}
                    disabled={classify.isPending}
                    onChange={(event) =>
                      classify.mutate({ id: row.listing_id, code: event.target.value })
                    }
                  >
                    {categories.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.group_name === c.name ? c.name : c.group_name + ' / ' + c.name}
                      </option>
                    ))}
                  </select>
                </label>
                {row.suggested_category && (
                  <Button
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
            {(row.status === 'pending' || row.status === 'listed') && (
              <Button
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
          </article>
        )
      })}
      {pages.length > 1 && (
        <Button onClick={() => setPages(pages.slice(0, -1))}>{t('previousPage')}</Button>
      )}
      {list.data?.next && (
        <Button onClick={() => setPages([...pages, list.data.next])}>{t('nextPage')}</Button>
      )}
    </section>
  )
}
