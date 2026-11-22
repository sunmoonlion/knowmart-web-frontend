'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { fetchOwnFormalListings, withdrawFormalListing } from '@/lib/market/client'
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
      <Problem error={list.error ?? withdraw.error} />
      {list.isSuccess && !list.data.items.length && <p>{t('noFormalListings')}</p>}
      {list.data?.items.map((row) => (
        <article key={row.listing_id} className="flex flex-wrap items-center justify-between gap-2">
          <span>
            {row.title} · v{row.reference.version} · {t(`formalScope.${row.scope}`)} ·{' '}
            {t(`formalStatus.${row.status}`)}
          </span>
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
      ))}
      {pages.length > 1 && (
        <Button onClick={() => setPages(pages.slice(0, -1))}>{t('previousPage')}</Button>
      )}
      {list.data?.next && (
        <Button onClick={() => setPages([...pages, list.data.next])}>{t('nextPage')}</Button>
      )}
    </section>
  )
}
