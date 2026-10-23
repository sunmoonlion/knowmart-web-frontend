// 供需市场的页面（SDD 0018 第十一节）：买知识、需求的响应与选择、入驻、专家申请公开、评价
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DemandScreen } from '@/components/market/demands'
import { KnowledgeDetail } from '@/components/market/knowledge-market'
import { MyPublished, MyTrades } from '@/components/market/mine'
import { PublisherScreen } from '@/components/market/publisher'
import type { DemandDetail, Listing } from '@/contracts/market'
import * as client from '@/lib/market/client'
import messages from '@/messages/zh-CN.json'

vi.mock('next/navigation', () => ({ usePathname: () => '/zh-CN/knowledge' }))
vi.mock('@/lib/market/client', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/market/client')>()
  const mocked: Record<string, unknown> = { ...actual }
  for (const [name, value] of Object.entries(actual)) {
    if (typeof value === 'function' && name !== 'problemCode') mocked[name] = vi.fn()
  }
  return mocked
})
vi.mock('@/lib/library/client', () => ({ fetchLibrary: vi.fn(async () => []) }))

const CSRF = 'csrf'
const category = { code: 'tools.lookup', name: '信息查询', group: 'tools', group_name: '工具' }
const LISTING: Listing = {
  listing_id: 'l1',
  title: '2024 行业数据',
  category,
  description: '一份表',
  items: [{ name: '行业数据.xlsx', media_type: 'x', size_bytes: 10 }],
  sample: '月份,销量',
  rights_statement: '我自己整理',
  resale_allowed: false,
  price: '50.00',
  mine: false,
  updated_at: null,
  publisher: { name: '张三工作室', kind: 'individual', real_name_verified: true },
  reviews: [],
  rating: { count: 0, average: null },
}
const demand = (over: Partial<DemandDetail> = {}): DemandDetail => ({
  demand_id: 'd1',
  kind: 'knowledge',
  title: '要 2024 行业数据',
  problem: '做行业对比',
  data_wanted: '',
  deadline: '2026-11-30',
  budget: '80.00',
  status: 'open',
  taking_responses: true,
  mine: false,
  chosen_response_id: null,
  created_at: null,
  response_count: 0,
  responses: [],
  ...over,
})

function page(node: React.ReactNode) {
  const query = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={query}>
      <NextIntlClientProvider locale="zh-CN" messages={messages} timeZone="Asia/Shanghai">
        {node}
      </NextIntlClientProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.mocked(client.fetchMessages).mockResolvedValue({ items: [] })
})

describe('供需市场', () => {
  it('买知识：选进哪个知识库，买好照实说', async () => {
    vi.mocked(client.fetchListing).mockResolvedValue(LISTING)
    vi.mocked(client.buyListing).mockResolvedValue({
      trade: {
        trade_id: 't1',
        kind: 'knowledge',
        listing_ref: 'l1',
        title: LISTING.title,
        price: '50.00',
        target_app: 'knowlab',
        copied: [],
        demand_id: 'd1',
        created_at: null,
      },
    })
    page(<KnowledgeDetail csrfToken={CSRF} account={null} listingId="l1" demandId="d1" />)
    expect(await screen.findByRole('heading', { name: '2024 行业数据' })).toBeInTheDocument()
    expect(screen.getByText('¥50.00')).toBeInTheDocument()
    expect(screen.getByText(/发布主体：张三工作室/)).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('knowlab 知识库'))
    fireEvent.click(screen.getByRole('button', { name: '买下这份' }))
    expect(await screen.findByText('买好了，已复制进你的 knowlab 知识库。')).toBeInTheDocument()
    expect(client.buyListing).toHaveBeenCalledWith(CSRF, 'l1', {
      target_app: 'knowlab',
      demand_id: 'd1',
    })
  })

  it('需求：卖家响应；需求方选一家', async () => {
    vi.mocked(client.fetchDemand).mockResolvedValue(demand())
    vi.mocked(client.respond).mockResolvedValue({} as never)
    page(<DemandScreen csrfToken={CSRF} account={null} demandId="d1" />)
    const form = within(await screen.findByRole('form', { name: '响应这条需求' }))
    fireEvent.change(form.getByLabelText('能做什么、怎么做'), { target: { value: '现成的' } })
    fireEvent.change(form.getByLabelText(/附上你已上架的知识条目编号/), { target: { value: 'l1' } })
    fireEvent.click(form.getByRole('button', { name: '交上响应' }))
    await waitFor(() =>
      expect(client.respond).toHaveBeenCalledWith(CSRF, 'd1', {
        listing_kind: 'knowledge',
        listing_ref: 'l1',
        proposal: '现成的',
        price: null,
        days: null,
      }),
    )
  })

  it('需求方看到所有响应，选一家', async () => {
    const response = {
      response_id: 'r1',
      demand_id: 'd1',
      listing_kind: 'knowledge' as const,
      listing_ref: 'l1',
      proposal: '现成的',
      price: '50.00',
      days: null,
      status: 'open' as const,
      mine: false,
      to_me: true,
      created_at: null,
    }
    vi.mocked(client.fetchDemand).mockResolvedValue(
      demand({ mine: true, response_count: 1, responses: [response] }),
    )
    vi.mocked(client.chooseResponse).mockResolvedValue({} as never)
    page(<DemandScreen csrfToken={CSRF} account={null} demandId="d1" />)
    expect(await screen.findByText('响应（1）')).toBeInTheDocument()
    expect(screen.queryByRole('form', { name: '响应这条需求' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '选这一家' }))
    await waitFor(() => expect(client.chooseResponse).toHaveBeenCalledWith(CSRF, 'd1', 'r1'))
  })

  it('入驻：个人填实名，交审核', async () => {
    vi.mocked(client.fetchMyPublisher).mockResolvedValue({
      publisher: null,
      documents: [],
      licenses: [],
    })
    vi.mocked(client.savePublisher).mockResolvedValue({
      publisher: null,
      documents: [],
      licenses: [],
    })
    page(<PublisherScreen csrfToken={CSRF} account={null} />)
    fireEvent.change(await screen.findByLabelText(/对外显示的名称/), {
      target: { value: '张三工作室' },
    })
    fireEvent.change(screen.getByLabelText('姓名'), { target: { value: '张三' } })
    fireEvent.change(screen.getByLabelText(/身份证号/), { target: { value: '11010519491231002X' } })
    fireEvent.click(screen.getByRole('button', { name: '交审核' }))
    await waitFor(() =>
      expect(client.savePublisher).toHaveBeenCalledWith(CSRF, {
        kind: 'individual',
        name: '张三工作室',
        real_name: '张三',
        id_number: '11010519491231002X',
      }),
    )
  })

  it('我发布的：专家申请公开，带每次请的价格', async () => {
    vi.mocked(client.fetchMyListings).mockResolvedValue({ items: [] })
    vi.mocked(client.fetchMyExperts).mockResolvedValue({
      items: [
        {
          knowbot_id: 'k1',
          name: '财务分析与预测',
          visibility: 'private',
          listing_status: 'self',
          price: null,
          review_note: null,
          category: { code: 'tools.office', name: '办公' },
        },
      ],
    })
    vi.mocked(client.setExpertListing).mockResolvedValue({} as never)
    page(<MyPublished csrfToken={CSRF} account={null} />)
    fireEvent.click(screen.getByRole('tab', { name: '专家' }))
    fireEvent.change(await screen.findByLabelText(/每次请/), { target: { value: '9.9' } })
    fireEvent.click(screen.getByRole('button', { name: '申请公开' }))
    await waitFor(() =>
      expect(client.setExpertListing).toHaveBeenCalledWith(CSRF, 'k1', {
        visibility: 'public',
        price: '9.9',
      }),
    )
  })

  it('我买到的：评分', async () => {
    vi.mocked(client.fetchTrades).mockResolvedValue({
      items: [
        {
          trade_id: 't1',
          kind: 'expert',
          listing_ref: 'k1@1',
          title: '财务分析与预测 第 1 版',
          price: '9.90',
          target_app: null,
          copied: [],
          demand_id: null,
          created_at: null,
          role: 'buyer',
          review: null,
        },
      ],
    })
    vi.mocked(client.reviewTrade).mockResolvedValue({} as never)
    page(<MyTrades csrfToken={CSRF} account={null} />)
    const form = within(await screen.findByRole('form', { name: '评价' }))
    fireEvent.change(form.getByLabelText('评分'), { target: { value: '4' } })
    fireEvent.change(form.getByLabelText('说一句'), { target: { value: '好用' } })
    fireEvent.click(form.getByRole('button', { name: '评价' }))
    await waitFor(() =>
      expect(client.reviewTrade).toHaveBeenCalledWith(CSRF, 't1', { rating: 4, text: '好用' }),
    )
  })
})
