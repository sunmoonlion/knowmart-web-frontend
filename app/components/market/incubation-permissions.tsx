'use client'
import { useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import {
  fetchIncubationPermissions,
  setIncubationPermission,
  type IncubationScope,
} from '@/lib/market/client'
import { Problem } from './parts'

export function IncubationPermissions({
  csrfToken,
  platform,
}: {
  csrfToken: string
  platform: boolean
}) {
  const t = useTranslations('marketUi.myShop')
  const client = useQueryClient()
  const [cursor, setCursor] = useState<(string | null)[]>([null])
  const after = cursor[cursor.length - 1]
  const list = useQuery({
    queryKey: ['incubation-permissions', after],
    queryFn: () => fetchIncubationPermissions(after),
  })
  const change = useMutation({
    mutationFn: ({ id, scope }: { id: string; scope: IncubationScope }) =>
      setIncubationPermission(csrfToken, id, scope),
    onSuccess: () => client.invalidateQueries({ queryKey: ['incubation-permissions'] }),
  })
  return (
    <section className="space-y-3">
      <p>{t('incubationHint')}</p>
      <Problem error={list.error ?? change.error} />
      {list.isSuccess && !list.data.items.length && <p>{t('noIncubationListings')}</p>}
      {list.data?.items.map((row) => (
        <label key={row.listing_id} className="flex items-center justify-between gap-3">
          <span>
            {row.title} · v{row.reference.version}
          </span>
          <select
            value={row.scope}
            disabled={change.isPending}
            onChange={(e) =>
              change.mutate({ id: row.listing_id, scope: e.target.value as IncubationScope })
            }
          >
            <option value="none">{t('scopeNone')}</option>
            <option disabled={!row.listed} value="acquired">
              {t('scopeAcquired')}
            </option>
            {(platform || row.scope === 'platform') && (
              <option disabled={!row.listed || !platform} value="platform">
                {t('scopePlatform')}
              </option>
            )}
          </select>
        </label>
      ))}
      {cursor.length > 1 && (
        <Button onClick={() => setCursor(cursor.slice(0, -1))}>{t('previousPage')}</Button>
      )}
      {list.data?.next && (
        <Button onClick={() => setCursor([...cursor, list.data.next])}>{t('nextPage')}</Button>
      )}
    </section>
  )
}
