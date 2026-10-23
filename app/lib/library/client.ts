'use client'

import { libraryCreatedSchema, libraryListSchema, type LibraryItem } from '@/contracts/library'
import { ApiClientError, requestJson } from '@/lib/common/api-client'

const base = '/api/web/v1/knowmart/library'

export async function fetchLibrary(): Promise<LibraryItem[]> {
  return libraryListSchema.parse(await requestJson(base)).items
}

// 请求体就是文件本身（不经 JSON）
export async function uploadToLibrary(file: File, csrfToken: string): Promise<LibraryItem> {
  const response = await fetch(`${base}?name=${encodeURIComponent(file.name)}`, {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    redirect: 'manual',
    body: file,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/octet-stream',
      'X-CSRF-Token': csrfToken,
    },
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ApiClientError(response.status, {
      code: typeof body?.code === 'string' ? body.code : 'request_failed',
      message_key: 'errors.requestFailed',
      retryable: false,
      correlation_id: '',
    })
  }
  return libraryCreatedSchema.parse(body).item
}

export async function deleteFromLibrary(itemId: string, csrfToken: string): Promise<void> {
  await requestJson(`${base}/${encodeURIComponent(itemId)}`, { method: 'DELETE', csrfToken })
}

export function downloadHref(itemId: string): string {
  return `${base}/${encodeURIComponent(itemId)}/content`
}
