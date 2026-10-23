'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DownloadIcon, Trash2Icon, UploadIcon } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { useRef, useState } from 'react'

import { MarketShell } from '@/components/market/market-shell'
import { Button } from '@/components/ui/button'
import { ApiClientError } from '@/lib/common/api-client'
import {
  deleteFromLibrary,
  downloadHref,
  fetchLibrary,
  uploadToLibrary,
} from '@/lib/library/client'

const KEY = ['web', 'library'] as const
// 与 knowbase 收的一致：PDF、Excel、CSV、文本、Markdown，单份 50 MB
const ACCEPT = '.pdf,.xlsx,.xls,.csv,.txt,.md'
const MAX_BYTES = 50 * 1024 * 1024
// knowbase 回的 code → 页面上的说法；没列的一律「没有成功」
const SAID: Record<string, string> = {
  in_use: 'inUse',
  type_not_allowed: 'typeNotAllowed',
  content_mismatch: 'contentMismatch',
  not_utf8: 'notUtf8',
  too_large: 'tooLarge',
  quota_exceeded: 'quotaExceeded',
  empty: 'emptyFile',
  item_not_found: 'gone',
  reauth_required: 'reauth',
  knowbase_unconfigured: 'unavailable',
  knowbase_unavailable: 'unavailable',
}
const said = (error: unknown) =>
  (error instanceof ApiClientError && SAID[error.problem.code]) || 'failed'

function sizeText(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// knowmart 知识库（SDD 0042 第八节）：卖家放上架出售的资料。真源在 knowbase，经 knowmart 后端读写。
// 知识条目从这里选资料；卖出时复制一份给买家，这里删了不影响已卖出的。
export function LibraryScreen({
  csrfToken,
  account,
}: {
  csrfToken: string
  account: React.ReactNode
}) {
  const t = useTranslations('library')
  const format = useFormatter()
  const client = useQueryClient()
  const items = useQuery({ queryKey: KEY, queryFn: fetchLibrary, retry: false })
  const picker = useRef<HTMLInputElement>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const changed = () => client.invalidateQueries({ queryKey: KEY })
  const upload = useMutation({
    mutationFn: (file: File) => uploadToLibrary(file, csrfToken),
    onSuccess: (item) => {
      setNotice(t('uploaded', { name: item.name }))
      void changed()
    },
    onError: (error) => setNotice(t(`error.${said(error)}`)),
  })
  const remove = useMutation({
    mutationFn: (item: { id: string; name: string }) => deleteFromLibrary(item.id, csrfToken),
    onSuccess: (_, item) => {
      setNotice(t('removed', { name: item.name }))
      void changed()
    },
    onError: (error) => setNotice(t(`error.${said(error)}`)),
  })

  function pick(files: FileList | null) {
    const file = files?.[0]
    if (picker.current) picker.current.value = ''
    if (!file) return
    if (file.size > MAX_BYTES) {
      setNotice(t('error.tooLarge'))
      return
    }
    setNotice(null)
    upload.mutate(file)
  }

  return (
    <MarketShell account={account}>
      <div className="mx-auto w-full max-w-4xl space-y-6 px-6 py-10">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
            <p className="text-muted-foreground mt-1 text-sm">{t('lead')}</p>
          </div>
          <div>
            <input
              ref={picker}
              type="file"
              accept={ACCEPT}
              className="hidden"
              aria-label={t('pick')}
              onChange={(event) => pick(event.target.files)}
            />
            <Button
              type="button"
              size="sm"
              disabled={upload.isPending}
              onClick={() => picker.current?.click()}
            >
              <UploadIcon className="size-4" />
              {upload.isPending ? t('uploading') : t('upload')}
            </Button>
          </div>
        </header>

        {notice ? (
          <p role="status" className="rounded-lg border px-3 py-2 text-sm">
            {notice}
          </p>
        ) : null}

        {items.isPending ? (
          <p className="text-muted-foreground text-sm">{t('loading')}</p>
        ) : items.isError ? (
          <p role="alert" className="text-destructive text-sm">
            {t(`error.${said(items.error)}`)}
          </p>
        ) : items.data.length === 0 ? (
          <div className="rounded-xl border border-dashed px-4 py-8 text-center">
            <p className="text-base font-medium">{t('empty')}</p>
            <p className="text-muted-foreground mt-1 text-sm">{t('emptyHint')}</p>
          </div>
        ) : (
          <ul className="divide-y rounded-xl border" aria-label={t('title')}>
            {items.data.map((item) => (
              <li
                key={item.item_id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3"
              >
                <span className="min-w-0 flex-1 truncate font-medium">{item.name}</span>
                <span className="text-muted-foreground shrink-0 text-right text-[13px]">
                  {sizeText(item.size_bytes)} ·{' '}
                  {format.dateTime(new Date(item.created_at), {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </span>
                <span className="flex shrink-0 gap-1">
                  <a
                    href={downloadHref(item.item_id)}
                    download={item.name}
                    aria-label={t('download', { name: item.name })}
                    className="hover:bg-muted inline-flex size-8 items-center justify-center rounded-md"
                  >
                    <DownloadIcon className="size-4" />
                  </a>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={t('remove', { name: item.name })}
                    disabled={remove.isPending}
                    onClick={() => {
                      if (window.confirm(t('confirmRemove', { name: item.name }))) {
                        remove.mutate({ id: item.item_id, name: item.name })
                      }
                    }}
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <p className="text-muted-foreground border-t pt-4 text-xs leading-5">{t('note')}</p>
      </div>
    </MarketShell>
  )
}
