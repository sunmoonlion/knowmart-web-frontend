'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import type { Knowbot, KnowbotVersion } from '@/contracts/knowbots'
import { useCrossAppOrigin } from '@/lib/cross-app/use-cross-app'
import { fetchMyKnowbots, stopKnowbotVersion, summonReturnUrl } from '@/lib/knowbots/client'
import { leaveTo } from '@/lib/leave-to'

const QUERY_KEY = ['web', 'knowbots'] as const

type MyKnowbotsProps = { csrfToken: string }

// 我的分身（SDD 0027）：只列当前用户自己的。从工作台带过来时（后端认得 from、登记了回跳地址），
// 每个可用的版本多一个「请这位」，点了回到工作台。界面上不出现市场、上架、购买、价格（C-L4、C-L5）。
export function MyKnowbots({ csrfToken }: MyKnowbotsProps) {
  const t = useTranslations('knowbots')
  const queryClient = useQueryClient()
  const list = useQuery({ queryKey: QUERY_KEY, queryFn: fetchMyKnowbots })
  const origin = useCrossAppOrigin()
  const summoning = origin.data?.return_url ? origin.data : null
  const [failed, setFailed] = useState<string | null>(null)

  const stop = useMutation({
    mutationFn: ({ knowbotId, version }: { knowbotId: string; version: string }) =>
      stopKnowbotVersion(knowbotId, version, csrfToken),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
    onError: () => setFailed(t('stopFailed')),
  })
  const summon = useMutation({
    mutationFn: ({ knowbotId, version }: { knowbotId: string; version: string }) =>
      summonReturnUrl(knowbotId, version, { app: summoning!.app, ref: summoning!.ref }, csrfToken),
    onSuccess: (url) => leaveTo(url),
    onError: () => setFailed(t('summonFailed')),
  })

  if (list.isPending) return <p className="text-muted-foreground mt-6">{t('loading')}</p>
  if (list.isError)
    return (
      <p className="text-destructive mt-6" role="alert">
        {t('loadFailed')}
      </p>
    )

  const knowbots = list.data.knowbots
  return (
    <section className="mt-6 space-y-4" aria-label={t('title')}>
      {summoning ? <p className="text-sm">{t('fromWorkbench')}</p> : null}
      {failed ? (
        <p className="text-destructive text-sm" role="alert">
          {failed}
        </p>
      ) : null}
      {knowbots.length === 0 ? (
        <p className="text-muted-foreground">{t('empty')}</p>
      ) : (
        knowbots.map((knowbot) => (
          <KnowbotCard
            key={knowbot.knowbot_id}
            knowbot={knowbot}
            canSummon={summoning !== null}
            busy={stop.isPending || summon.isPending}
            onStop={(version) => {
              setFailed(null)
              stop.mutate({ knowbotId: knowbot.knowbot_id, version })
            }}
            onSummon={(version) => {
              setFailed(null)
              summon.mutate({ knowbotId: knowbot.knowbot_id, version })
            }}
          />
        ))
      )}
    </section>
  )
}

type KnowbotCardProps = {
  knowbot: Knowbot
  canSummon: boolean
  busy: boolean
  onStop: (version: string) => void
  onSummon: (version: string) => void
}

function KnowbotCard({ knowbot, canSummon, busy, onStop, onSummon }: KnowbotCardProps) {
  const t = useTranslations('knowbots')
  const newestFirst = [...knowbot.versions].reverse()
  return (
    <article className="rounded-lg border p-4">
      <h2 className="font-medium">{knowbot.name}</h2>
      {knowbot.tagline ? <p className="text-muted-foreground text-sm">{knowbot.tagline}</p> : null}
      <ul className="mt-3 space-y-2">
        {newestFirst.map((v) => (
          <VersionRow
            key={v.version}
            version={v}
            current={v.version === knowbot.current_version}
            canSummon={canSummon}
            busy={busy}
            onStop={() => onStop(v.version)}
            onSummon={() => onSummon(v.version)}
            t={t}
          />
        ))}
      </ul>
    </article>
  )
}

type VersionRowProps = {
  version: KnowbotVersion
  current: boolean
  canSummon: boolean
  busy: boolean
  onStop: () => void
  onSummon: () => void
  t: ReturnType<typeof useTranslations<'knowbots'>>
}

function VersionRow({ version, current, canSummon, busy, onStop, onSummon, t }: VersionRowProps) {
  const active = version.status === 'active'
  return (
    <li className="flex items-center justify-between gap-3 text-sm">
      <span>
        {t('version', { version: version.version })}
        {current ? <span className="text-muted-foreground"> · {t('current')}</span> : null}
        <span className="text-muted-foreground"> · {t(active ? 'active' : 'stopped')}</span>
      </span>
      {active ? (
        <span className="flex gap-2">
          {canSummon ? (
            <Button size="sm" disabled={busy} onClick={onSummon}>
              {t('summon')}
            </Button>
          ) : null}
          <Button size="sm" variant="outline" disabled={busy} onClick={onStop}>
            {t('stop')}
          </Button>
        </span>
      ) : null}
    </li>
  )
}
