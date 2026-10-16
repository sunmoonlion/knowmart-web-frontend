import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MyKnowbots } from '@/components/knowbots/my-knowbots'
import { fetchMyKnowbots, stopKnowbotVersion, summonReturnUrl } from '@/lib/knowbots/client'
import { leaveTo } from '@/lib/leave-to'
import messages from '@/messages/zh-CN.json'

const origin = vi.hoisted(() => ({ data: null as null | Record<string, unknown> }))

vi.mock('@/lib/knowbots/client', () => ({
  fetchMyKnowbots: vi.fn(),
  stopKnowbotVersion: vi.fn(),
  summonReturnUrl: vi.fn(),
}))
vi.mock('@/lib/leave-to', () => ({ leaveTo: vi.fn() }))
vi.mock('@/lib/cross-app/use-cross-app', () => ({ useCrossAppOrigin: () => origin }))

const KNOWBOT = '0b8a6c3e-1f2d-4c5b-9a7e-6d5c4b3a2f10'
const list = {
  contract_version: 1 as const,
  knowbots: [
    {
      knowbot_id: KNOWBOT,
      name: '财务分析与预测',
      tagline: '按我的方法分析财报',
      current_version: '2',
      versions: [
        {
          version: '1',
          runtime: 'investment',
          digest: 'sha256:' + 'a'.repeat(64),
          status: 'stopped' as const,
          delivered_at: '2026-10-16T00:00:00Z',
        },
        {
          version: '2',
          runtime: 'investment',
          digest: 'sha256:' + 'b'.repeat(64),
          status: 'active' as const,
          delivered_at: '2026-10-16T01:00:00Z',
        },
      ],
    },
  ],
}

function renderList() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="zh-CN" messages={messages}>
        <MyKnowbots csrfToken="csrf-token-value-that-is-long-enough-1234" />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  )
}

describe('MyKnowbots', () => {
  beforeEach(() => {
    vi.mocked(fetchMyKnowbots).mockReset().mockResolvedValue(list)
    vi.mocked(stopKnowbotVersion).mockReset().mockResolvedValue(undefined)
    vi.mocked(summonReturnUrl).mockReset()
    vi.mocked(leaveTo).mockReset()
    origin.data = null
  })

  it('lists the owner knowbots without a summon button when not sent by the workbench', async () => {
    renderList()
    expect(await screen.findByText('财务分析与预测')).toBeInTheDocument()
    expect(screen.getByText(/第 2 版/)).toBeInTheDocument()
    expect(screen.getByText(/已停用/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '请这位' })).toBeNull()
    // 停用的版本没有任何按钮，可用的只有「停用」
    expect(screen.getAllByRole('button', { name: '停用' })).toHaveLength(1)
  })

  it('goes back to the workbench with the chosen version', async () => {
    origin.data = {
      app: 'investment',
      ref: 'task-42',
      return_url: 'https://investment.example.test/zh-CN/workbench?ref=task-42',
    }
    vi.mocked(summonReturnUrl).mockResolvedValue(
      'https://investment.example.test/zh-CN/workbench?ref=task-42&knowbot=x%401',
    )
    renderList()
    fireEvent.click(await screen.findByRole('button', { name: '请这位' }))
    await waitFor(() =>
      expect(leaveTo).toHaveBeenCalledWith(
        'https://investment.example.test/zh-CN/workbench?ref=task-42&knowbot=x%401',
      ),
    )
    expect(summonReturnUrl).toHaveBeenCalledWith(
      KNOWBOT,
      '2',
      { app: 'investment', ref: 'task-42' },
      'csrf-token-value-that-is-long-enough-1234',
    )
  })

  it('offers summon only for versions that run in the app the user came from', async () => {
    origin.data = {
      app: 'other-runtime',
      ref: 'x',
      return_url: 'https://other.example.test/back?ref=x',
    }
    renderList()
    await screen.findByText('财务分析与预测')
    expect(screen.queryByRole('button', { name: '请这位' })).toBeNull()
  })

  it('does not offer summon when the origin has no registered return', async () => {
    origin.data = { app: 'knowbase', ref: null, return_url: null }
    renderList()
    await screen.findByText('财务分析与预测')
    expect(screen.queryByRole('button', { name: '请这位' })).toBeNull()
  })

  it('stops a version and refreshes the list', async () => {
    renderList()
    fireEvent.click(await screen.findByRole('button', { name: '停用' }))
    await waitFor(() =>
      expect(stopKnowbotVersion).toHaveBeenCalledWith(
        KNOWBOT,
        '2',
        'csrf-token-value-that-is-long-enough-1234',
      ),
    )
    await waitFor(() => expect(fetchMyKnowbots).toHaveBeenCalledTimes(2))
  })

  it('shows an empty state and a load failure', async () => {
    vi.mocked(fetchMyKnowbots).mockResolvedValueOnce({ contract_version: 1, knowbots: [] })
    const { unmount } = renderList()
    expect(await screen.findByText('你还没有分身。')).toBeInTheDocument()
    unmount()
    vi.mocked(fetchMyKnowbots).mockRejectedValueOnce(new Error('down'))
    renderList()
    expect(await screen.findByRole('alert')).toHaveTextContent('读取失败')
  })
})
