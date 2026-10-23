'use client'

import { useMutation } from '@tanstack/react-query'
import { useFormatter, useTranslations } from 'next-intl'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import type { Review } from '@/contracts/market'
import { problemCode, report } from '@/lib/market/client'
import { cn } from '@/lib/utils'

export const inputClass =
  'w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint ? <span className="text-muted-foreground block text-xs">{hint}</span> : null}
    </label>
  )
}

export function Price({ value }: { value: string | null }) {
  const t = useTranslations('marketUi')
  return <span className="font-medium">{value === null ? t('free') : t('price', { value })}</span>
}

export function Stars({
  rating,
}: {
  rating: { count: number; average: number | null } | undefined
}) {
  const t = useTranslations('marketUi')
  if (!rating || rating.count === 0)
    return <span className="text-muted-foreground text-xs">{t('noReviews')}</span>
  return (
    <span className="text-xs">
      {t('rating', { average: rating.average ?? 0, count: rating.count })}
    </span>
  )
}

export function Badge({
  children,
  tone = 'muted',
}: {
  children: React.ReactNode
  tone?: 'muted' | 'ok' | 'warn' | 'bad'
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs',
        tone === 'muted' && 'bg-muted text-muted-foreground',
        tone === 'ok' &&
          'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
        tone === 'warn' && 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
        tone === 'bad' && 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
      )}
    >
      {children}
    </span>
  )
}

export function Problem({ error }: { error: unknown }) {
  const t = useTranslations('marketUi')
  if (!error) return null
  const code = problemCode(error)
  return (
    <p role="alert" className="text-destructive text-sm">
      {t.has(`problem.${code}`) ? t(`problem.${code}`) : t('problem.failed')}
    </p>
  )
}

export function Reviews({ reviews }: { reviews: Review[] }) {
  const t = useTranslations('marketUi')
  const format = useFormatter()
  if (reviews.length === 0) return <p className="text-muted-foreground text-sm">{t('noReviews')}</p>
  return (
    <ul className="space-y-3">
      {reviews.map((review, index) => (
        <li key={index} className="rounded-lg border p-3 text-sm">
          <p>
            {t('stars', { rating: review.rating })}
            {review.created_at ? (
              <span className="text-muted-foreground ml-2 text-xs">
                {format.dateTime(new Date(review.created_at), { dateStyle: 'medium' })}
              </span>
            ) : null}
          </p>
          {review.text ? <p className="mt-1">{review.text}</p> : null}
          {review.reply ? (
            <p className="text-muted-foreground mt-2 border-l-2 pl-2">
              {t('sellerReply', { reply: review.reply })}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

// 举报：写一句理由交给运营（核实后下架）
export function ReportButton({
  csrfToken,
  kind,
  targetId,
}: {
  csrfToken: string
  kind: 'expert' | 'knowledge' | 'demand' | 'response' | 'message'
  targetId: string
}) {
  const t = useTranslations('marketUi')
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const sent = useMutation({
    mutationFn: () => report(csrfToken, { target_kind: kind, target_id: targetId, reason }),
  })
  if (sent.isSuccess) return <p className="text-muted-foreground text-xs">{t('reported')}</p>
  if (!open) {
    return (
      <button
        type="button"
        className="text-muted-foreground text-xs underline"
        onClick={() => setOpen(true)}
      >
        {t('report')}
      </button>
    )
  }
  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault()
        if (reason.trim()) sent.mutate()
      }}
    >
      <Field label={t('reportReason')}>
        <textarea
          className={inputClass}
          rows={2}
          maxLength={2000}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!reason.trim() || sent.isPending}>
          {t('reportSend')}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
          {t('cancel')}
        </Button>
      </div>
      <Problem error={sent.error} />
    </form>
  )
}

export function Pager({
  page,
  total,
  size,
  onPage,
}: {
  page: number
  total: number
  size: number
  onPage: (page: number) => void
}) {
  const t = useTranslations('marketUi')
  const pages = Math.max(1, Math.ceil(total / size))
  if (pages <= 1) return null
  return (
    <nav aria-label={t('pages')} className="flex items-center justify-center gap-3 text-sm">
      <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        {t('prev')}
      </Button>
      <span>{t('pageOf', { page, pages })}</span>
      <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        {t('next')}
      </Button>
    </nav>
  )
}
