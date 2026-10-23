// knowmart 知识库（SDD 0042 第八节）：列出、上传、删；knowbase 的拒绝照实说
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LibraryScreen } from '@/components/library/library-screen'
import { ApiClientError } from '@/lib/common/api-client'
import { deleteFromLibrary, fetchLibrary, uploadToLibrary } from '@/lib/library/client'
import messages from '@/messages/zh-CN.json'

vi.mock('next/navigation', () => ({ usePathname: () => '/zh-CN/library' }))
vi.mock('@/lib/library/client', async (importActual) => ({
  ...(await importActual<typeof import('@/lib/library/client')>()),
  fetchLibrary: vi.fn(),
  uploadToLibrary: vi.fn(),
  deleteFromLibrary: vi.fn(),
}))

const ITEM = {
  item_id: 'i1',
  name: '行业数据 2024.xlsx',
  media_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  size_bytes: 2048,
  sha256: 'a'.repeat(64),
  origin: 'upload',
  created_at: '2026-10-23T12:00:00Z',
}

function page() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="zh-CN" messages={messages} timeZone="Asia/Shanghai">
        <LibraryScreen csrfToken="csrf" account={null} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.mocked(fetchLibrary).mockResolvedValue([ITEM])
  vi.mocked(uploadToLibrary).mockResolvedValue({ ...ITEM, item_id: 'i2', name: '样张.csv' })
  vi.mocked(deleteFromLibrary).mockResolvedValue()
})

describe('knowmart 知识库', () => {
  it('列出资料、栏目里标着知识库；上传、删除照实说', async () => {
    page()
    const list = within(await screen.findByRole('list', { name: '知识库' }))
    expect(list.getByText('行业数据 2024.xlsx')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '知识库' })).toHaveAttribute('aria-current', 'page')
    const file = new File(['a,b\n'], '样张.csv', { type: 'text/csv' })
    fireEvent.change(screen.getByLabelText('选择要上传的文件'), { target: { files: [file] } })
    expect(await screen.findByText('已上传「样张.csv」')).toBeInTheDocument()
    expect(uploadToLibrary).toHaveBeenCalledWith(file, 'csrf')
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    fireEvent.click(list.getByRole('button', { name: '删除「行业数据 2024.xlsx」' }))
    await waitFor(() => expect(deleteFromLibrary).toHaveBeenCalledWith('i1', 'csrf'))
  })

  it('knowbase 拒了：按码说人话', async () => {
    vi.mocked(fetchLibrary).mockRejectedValue(
      new ApiClientError(401, {
        code: 'reauth_required',
        message_key: 'x',
        retryable: false,
        correlation_id: 'c',
      }),
    )
    page()
    expect(await screen.findByText('登录过期了，请重新登录。')).toBeInTheDocument()
  })
})
