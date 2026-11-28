// 供需市场的页面（SDD 0018 第十一节）：买知识、需求的响应与选择、入驻、专家申请公开、评价；
// 小店（第 7 之二小节）：首页小店列表、小店详情、我的小店、交易记录的直达链接
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DemandScreen, Thread } from '@/components/market/demands'
import { KnowledgeDetail } from '@/components/market/knowledge-market'
import { MyShopScreen } from '@/components/market/my-shop'
import { ShopList, ShopScreen } from '@/components/market/shops'
import type { DemandDetail, Listing, MyShop, ShopPage } from '@/contracts/market'
import * as crossApp from '@/lib/cross-app/client'
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
vi.mock('@/lib/cross-app/client', () => ({ fetchCrossAppLinks: vi.fn() }))

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

const SHOP = { shop_id: 's1', name: '张三的数据铺' }
const MY_SHOP: MyShop = {
  shop: {
    ...SHOP,
    status: 'open',
    mine: true,
    platform: false,
    publisher: null,
    qualifications: [],
    status_note: null,
    status_at: null,
    listed: false,
  },
  rating: { count: 0, average: null },
  history: [],
}

beforeEach(() => {
  vi.mocked(client.fetchMessages).mockResolvedValue({ items: [] })
  vi.mocked(client.fetchMyShop).mockResolvedValue(MY_SHOP)
  vi.mocked(crossApp.fetchCrossAppLinks).mockResolvedValue({
    app: 'knowmart',
    targets: {
      knowbase: { web_base_url: 'https://knowbase.example.test' },
      knowbench: { web_base_url: 'https://knowbench.example.test' },
    },
  })
})

describe('供需市场', () => {
  it('店主可撤回待审的自用正式方法并回看状态', async () => {
    const labels = messages.marketUi.myShop
    const row = {
      listing_id: '123e4567-e89b-42d3-a456-426614174001',
      title: '核对',
      reference: {
        method_id: '123e4567-e89b-42d3-a456-426614174002',
        version: 1,
        digest: 'sha256:' + '0'.repeat(64),
      },
      scope: 'self' as const,
    }
    let status: 'pending' | 'withdrawn' = 'pending'
    vi.mocked(client.fetchMyExperts).mockResolvedValue({ items: [] })
    vi.mocked(client.fetchOwnFormalListings).mockImplementation(async () => ({
      items: [{ ...row, status }],
      next: null,
    }))
    vi.mocked(client.withdrawFormalListing).mockImplementation(async () => {
      status = 'withdrawn'
      return { listing_id: row.listing_id, status }
    })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    try {
      page(<MyShopScreen csrfToken={CSRF} account={null} />)
      fireEvent.click(screen.getByRole('tab', { name: labels.formalMethods }))
      fireEvent.click(await screen.findByRole('button', { name: labels.withdrawFormal }))
      await screen.findByText(/核对.*已撤回/)
      expect(client.withdrawFormalListing).toHaveBeenCalledWith(CSRF, row.listing_id)
      expect(screen.queryByRole('button', { name: labels.withdrawFormal })).not.toBeInTheDocument()
    } finally {
      confirm.mockRestore()
    }
  })
  it('店主按版本开放和撤回已获取者的孵化引用许可（仅限公开在架工具方法）', async () => {
    const ref = {
      method_id: '123e4567-e89b-42d3-a456-426614174000',
      version: 2,
      digest: 'sha256:' + 'a'.repeat(64),
    }
    const listing = '123e4567-e89b-42d3-a456-426614174001'
    let scope: client.IncubationScope = 'none'
    vi.mocked(client.fetchMyExperts).mockResolvedValue({ items: [] })
    vi.mocked(client.fetchOwnFormalListings).mockImplementation(async () => ({
      items: [
        {
          listing_id: listing,
          reference: ref,
          title: '核对',
          scope: 'public' as const,
          status: 'listed' as const,
          method_kind: 'tool' as const,
          incubation_scope: scope,
        },
      ],
      next: null,
    }))
    vi.mocked(client.setIncubationPermission).mockImplementation(async (_csrf, id, value) => {
      scope = value
      return { listing_id: id, reference: ref, scope }
    })
    page(<MyShopScreen csrfToken={CSRF} account={null} />)
    const select = await screen.findByRole('combobox', { name: /核对/ })
    expect(
      within(select).queryByRole('option', { name: messages.marketUi.myShop.scopePlatform }),
    ).toBeNull()
    for (const value of ['acquired', 'none']) {
      fireEvent.change(select, { target: { value } })
      await waitFor(() => expect(select).toHaveValue(value))
      expect(client.setIncubationPermission).toHaveBeenCalledWith(CSRF, listing, value)
    }
  })
  it('买知识：买好进 knowbase 的「买来的」，照实说', async () => {
    vi.mocked(client.fetchListing).mockResolvedValue(LISTING)
    vi.mocked(client.buyListing).mockResolvedValue({
      trade: {
        trade_id: 't1',
        kind: 'knowledge',
        listing_ref: 'l1',
        title: LISTING.title,
        price: '50.00',
        target_app: null,
        granted: [],
        demand_id: 'd1',
        created_at: null,
      },
    })
    page(<KnowledgeDetail csrfToken={CSRF} account={null} listingId="l1" demandId="d1" />)
    expect(await screen.findByRole('heading', { name: '2024 行业数据' })).toBeInTheDocument()
    expect(screen.getByText('¥50.00')).toBeInTheDocument()
    expect(screen.getByText(/发布主体：张三工作室/)).toBeInTheDocument()
    // 资料不分应用（user-data/v2）：不用选放进哪里
    expect(screen.queryByLabelText('knowlab 知识库')).toBeNull()
    vi.mocked(client.buyListing).mockRejectedValueOnce(new Error('网断了'))
    fireEvent.click(screen.getByRole('button', { name: '买下这份' }))
    await waitFor(() => expect(client.buyListing).toHaveBeenCalledTimes(1))
    fireEvent.click(await screen.findByRole('button', { name: '买下这份' }))
    expect(
      await screen.findByText('买好了，在你 knowbase 总栏的「买来的」里。'),
    ).toBeInTheDocument()
    const [first, second] = vi.mocked(client.buyListing).mock.calls
    expect(second).toEqual([CSRF, 'l1', { request_id: expect.any(String), demand_id: 'd1' }])
    expect(first![2].request_id).toBe(second![2].request_id) // 重试沿用同一个键
  })

  it('卖家那份没了：照说没买成，不说买好了', async () => {
    vi.mocked(client.fetchListing).mockResolvedValue(LISTING)
    vi.mocked(client.buyListing).mockResolvedValue({
      trade: {
        trade_id: 't1',
        kind: 'knowledge',
        listing_ref: 'l1',
        title: LISTING.title,
        price: '50.00',
        target_app: null,
        granted: [],
        demand_id: null,
        status: 'failed',
        failure: 'item_gone',
        created_at: null,
      },
    })
    page(<KnowledgeDetail csrfToken={CSRF} account={null} listingId="l1" demandId={null} />)
    fireEvent.click(await screen.findByRole('button', { name: '买下这份' }))
    expect(await screen.findByText(/没买成：卖家那份资料已经不在了/)).toBeInTheDocument()
    expect(screen.queryByText(/买好了/)).toBeNull()
  })

  it('卖家上架后不再出售：照说没买成', async () => {
    vi.mocked(client.fetchListing).mockResolvedValue(LISTING)
    vi.mocked(client.buyListing).mockResolvedValue({
      trade: {
        trade_id: 't2',
        kind: 'knowledge',
        listing_ref: 'l1',
        title: LISTING.title,
        price: '50.00',
        target_app: null,
        granted: [],
        demand_id: null,
        status: 'failed',
        failure: 'item_not_for_sale',
        created_at: null,
      },
    })
    page(<KnowledgeDetail csrfToken={CSRF} account={null} listingId="l1" demandId={null} />)
    fireEvent.click(await screen.findByRole('button', { name: '买下这份' }))
    expect(await screen.findByText(/没买成：卖家不再出售这份资料/)).toBeInTheDocument()
  })

  it('我的小店：写知识条目从交给 knowmart 的资料里选，不能卖的不让勾', async () => {
    vi.mocked(client.fetchMyListings).mockResolvedValue({ items: [] })
    const material = {
      version_no: 1,
      media_type: 'text/csv',
      size_bytes: 4,
      sha256: 'a'.repeat(64),
      mine: true,
    }
    vi.mocked(client.fetchMyMaterials).mockResolvedValue({
      items: [
        { ...material, material_id: 'm1', name: '行业数据.csv', license: 'sale', sellable: true },
        { ...material, material_id: 'm2', name: '草稿.csv', license: 'self', sellable: false },
      ],
    })
    vi.mocked(client.createListing).mockResolvedValue({} as never)
    page(<MyShopScreen csrfToken={CSRF} account={null} />)
    fireEvent.click(screen.getByRole('tab', { name: '我的知识' }))
    fireEvent.click(await screen.findByRole('button', { name: '写一条' }))
    const form = within(await screen.findByRole('form', { name: '知识条目' }))
    expect(await form.findByLabelText(/草稿\.csv/)).toBeDisabled()
    expect(form.getByText('（许可不是「可以出售」，去 knowbase 改）')).toBeInTheDocument()
    fireEvent.click(form.getByLabelText(/行业数据\.csv/))
    fireEvent.change(form.getByLabelText('名称'), { target: { value: '2024 行业数据' } })
    fireEvent.change(form.getByLabelText(/^内容说明/), { target: { value: '一份表' } })
    fireEvent.change(form.getByLabelText(/^来源与权利声明/), { target: { value: '自己整理' } })
    fireEvent.click(form.getByRole('button', { name: '保存' }))
    await waitFor(() =>
      expect(client.createListing).toHaveBeenCalledWith(
        CSRF,
        expect.objectContaining({ title: '2024 行业数据', items: [{ item_id: 'm1' }] }),
      ),
    )
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

  it('需求选中了我、我当初没附条目：做好上架后补附（Fable 评审 P2-9）', async () => {
    const response = {
      response_id: 'r1',
      demand_id: 'd1',
      listing_kind: null,
      listing_ref: null,
      proposal: '我来整理',
      price: null,
      days: null,
      status: 'chosen' as const,
      mine: true,
      to_me: false,
      created_at: null,
    }
    vi.mocked(client.fetchDemand).mockResolvedValue(
      demand({
        status: 'chosen',
        taking_responses: false,
        response_count: 1,
        responses: [response],
      }),
    )
    vi.mocked(client.attachOffer).mockResolvedValue({} as never)
    page(<DemandScreen csrfToken={CSRF} account={null} demandId="d1" />)
    fireEvent.change(await screen.findByLabelText(/附上你已上架的知识条目编号/), {
      target: { value: 'l9' },
    })
    fireEvent.click(screen.getByRole('button', { name: '补附条目' }))
    await waitFor(() =>
      expect(client.attachOffer).toHaveBeenCalledWith(CSRF, 'r1', {
        listing_kind: 'knowledge',
        listing_ref: 'l9',
      }),
    )
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
    page(<MyShopScreen csrfToken={CSRF} account={null} />)
    fireEvent.click(screen.getByRole('tab', { name: '店主资料' }))
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

  it('我的小店：专家申请公开，带每次请的价格', async () => {
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
          held: [],
        },
      ],
    })
    vi.mocked(client.fetchOwnFormalListings).mockResolvedValue({ items: [], next: null })
    vi.mocked(client.setExpertListing).mockResolvedValue({} as never)
    page(<MyShopScreen csrfToken={CSRF} account={null} />)
    fireEvent.click(screen.getByText('我的专家'))
    fireEvent.change(await screen.findByLabelText(/每次请/), { target: { value: '9.9' } })
    fireEvent.click(screen.getByRole('button', { name: '申请公开' }))
    await waitFor(() =>
      expect(client.setExpertListing).toHaveBeenCalledWith(CSRF, 'k1', {
        visibility: 'public',
        price: '9.9',
        category: 'tools.office',
      }),
    )
  })

  it('我的小店：没有类目的专家先选类目才能申请公开（Fable 评审 P2-1）', async () => {
    vi.mocked(client.fetchMyListings).mockResolvedValue({ items: [] })
    vi.mocked(client.fetchOwnFormalListings).mockResolvedValue({ items: [], next: null })
    vi.mocked(client.fetchMyExperts).mockResolvedValue({
      items: [
        {
          knowbot_id: 'k2',
          name: '财务分析与预测',
          visibility: 'private',
          listing_status: 'self',
          price: null,
          review_note: null,
          category: { code: 'uncategorized', name: '未分类' },
          held: [],
        },
      ],
    })
    vi.mocked(client.setExpertListing).mockResolvedValue({} as never)
    page(<MyShopScreen csrfToken={CSRF} account={null} />)
    fireEvent.click(screen.getByText('我的专家'))
    const ask = await screen.findByRole('button', { name: '申请公开' })
    expect(ask).toBeDisabled()
    fireEvent.change(screen.getByLabelText('类目'), { target: { value: 'tools.lookup' } })
    fireEvent.click(ask)
    await waitFor(() =>
      expect(client.setExpertListing).toHaveBeenCalledWith(CSRF, 'k2', {
        visibility: 'public',
        price: null,
        category: 'tools.lookup',
      }),
    )
  })

  it('我的小店：所绑数据失效的那一版待处理，写明原因（0043 第 4.3 节）', async () => {
    vi.mocked(client.fetchMyListings).mockResolvedValue({ items: [] })
    vi.mocked(client.fetchOwnFormalListings).mockResolvedValue({ items: [], next: null })
    vi.mocked(client.fetchMyExperts).mockResolvedValue({
      items: [
        {
          knowbot_id: 'k3',
          name: '财务分析与预测',
          visibility: 'public',
          listing_status: 'public',
          price: null,
          review_note: null,
          category: { code: 'tools.lookup', name: '信息查询' },
          held: [{ version: '2', reason: 'binding_deleted', at: '2026-10-30T00:00:00Z' }],
        },
      ],
    })
    page(<MyShopScreen csrfToken={CSRF} account={null} />)
    fireEvent.click(screen.getByText('我的专家'))
    expect(
      await screen.findByText(/第 2 版待处理，别人现在请不了：你绑给这位专家的数据有一份删了/),
    ).toBeInTheDocument()
  })

  it('交易记录：退役专家标不可请，买家可评价成交', async () => {
    vi.mocked(client.fetchTrades).mockResolvedValue({
      items: [
        {
          trade_id: 't1',
          kind: 'expert',
          listing_ref: 'k1@1',
          title: '财务分析与预测 第 1 版',
          price: '9.90',
          target_app: null,
          granted: [],
          demand_id: null,
          created_at: null,
          role: 'buyer',
          review: null,
          seller_publisher: { name: '张三工作室', kind: 'individual' },
          shop: SHOP,
          listing_state: 'off',
          expert_link_available: false,
        },
      ],
    })
    vi.mocked(client.reviewTrade).mockResolvedValue({} as never)
    page(<MyShopScreen csrfToken={CSRF} account={null} />)
    fireEvent.click(screen.getByRole('tab', { name: '交易记录' }))
    expect(await screen.findByText('不可请')).toBeInTheDocument()
    expect(screen.getByText('卖的主体：张三工作室')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '卖家的小店：张三的数据铺' })).toHaveAttribute(
      'href',
      '/zh-CN/shops/s1',
    )
    expect(screen.queryByRole('link', { name: '去 knowbench「专家」请' })).toBeNull()
    const form = within(await screen.findByRole('form', { name: '评价' }))
    fireEvent.change(form.getByLabelText('评分'), { target: { value: '4' } })
    fireEvent.change(form.getByLabelText('说一句'), { target: { value: '好用' } })
    fireEvent.click(form.getByRole('button', { name: '评价' }))
    await waitFor(() =>
      expect(client.reviewTrade).toHaveBeenCalledWith(CSRF, 't1', { rating: 4, text: '好用' }),
    )
  })

  it('交易记录：买来的知识直达 knowbase「买来的」那一份', async () => {
    vi.mocked(client.fetchTrades).mockResolvedValue({
      items: [
        {
          trade_id: 't2',
          kind: 'knowledge',
          listing_ref: 'l1',
          title: '2024 行业数据',
          price: '50.00',
          target_app: null,
          granted: [{ name: '行业数据.xlsx', item_id: 'm1' }],
          demand_id: null,
          status: 'done',
          created_at: null,
          role: 'buyer',
          review: null,
          listing_state: 'on',
        },
      ],
    })
    page(<MyShopScreen csrfToken={CSRF} account={null} />)
    fireEvent.click(screen.getByRole('tab', { name: '交易记录' }))
    const link = await screen.findByRole('link', { name: '行业数据.xlsx' })
    expect(link.getAttribute('href')).toBe(
      'https://knowbase.example.test/zh-CN/library?category=purchased&material=m1&from=knowmart',
    )
    expect(screen.getByText('在架')).toBeInTheDocument()
  })

  it.each(['expert', 'knowledge'] as const)(
    '从 %s 栏目发布同类需求，公开到小店需勾选',
    async (kind) => {
      vi.mocked(client.fetchDemandHall).mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        page_size: 24,
      })
      vi.mocked(client.createDemand).mockResolvedValue({} as never)
      const { DemandHall } = await import('@/components/market/demands')
      page(<DemandHall kind={kind} csrfToken={CSRF} account={null} />)
      expect(client.fetchDemandHall).toHaveBeenCalledWith({ kind, page: 1 })
      fireEvent.click(screen.getByRole('button', { name: '发布需求' }))
      const form = within(await screen.findByRole('form', { name: '发布需求' }))
      const tick = form.getByLabelText(/公开到我的小店/)
      expect(tick).not.toBeChecked()
      fireEvent.change(form.getByLabelText('标题'), { target: { value: '要行业数据' } })
      fireEvent.change(form.getByLabelText('要解决什么'), { target: { value: '做对比' } })
      fireEvent.change(form.getByLabelText('期限'), { target: { value: '2026-12-31' } })
      fireEvent.click(tick)
      fireEvent.click(form.getByRole('button', { name: '发布' }))
      await waitFor(() =>
        expect(client.createDemand).toHaveBeenCalledWith(
          CSRF,
          expect.objectContaining({ kind, title: '要行业数据', public_to_shop: true }),
        ),
      )
    },
  )

  it('需求方看得到响应的卖家的店', async () => {
    const response = {
      response_id: 'r1',
      demand_id: 'd1',
      listing_kind: null,
      listing_ref: null,
      proposal: '我来整理',
      price: null,
      days: null,
      status: 'open' as const,
      mine: false,
      to_me: true,
      created_at: null,
      shop: SHOP,
    }
    vi.mocked(client.fetchDemand).mockResolvedValue(
      demand({ mine: true, response_count: 1, responses: [response] }),
    )
    page(<DemandScreen csrfToken={CSRF} account={null} demandId="d1" />)
    expect(await screen.findByRole('link', { name: '卖家的小店：张三的数据铺' })).toHaveAttribute(
      'href',
      '/zh-CN/shops/s1',
    )
  })

  it('首页：小店列表按店名找、按店名排，不做推荐', async () => {
    vi.mocked(client.fetchShops).mockResolvedValue({
      items: [
        {
          ...SHOP,
          status: 'open',
          mine: false,
          platform: true,
          publisher: { name: '日月数据', kind: 'organization', real_name_verified: true },
          qualifications: [],
          experts: 1,
          knowledge: 2,
          demands: 0,
          categories: [category],
          updated_at: null,
        },
      ],
      total: 1,
      page: 1,
      page_size: 24,
    })
    page(<ShopList account={null} />)
    expect(await screen.findByRole('link', { name: '张三的数据铺' })).toHaveAttribute(
      'href',
      '/zh-CN/shops/s1',
    )
    expect(screen.getByText('平台')).toBeInTheDocument()
    expect(screen.getByText('专家 1 · 知识 2 · 需求 0')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('排序'), { target: { value: 'name' } })
    fireEvent.change(screen.getByLabelText('按店名找'), { target: { value: '张三' } })
    fireEvent.submit(screen.getByRole('search'))
    await waitFor(() =>
      expect(client.fetchShops).toHaveBeenLastCalledWith({
        q: '张三',
        category: null,
        sort: 'name',
        page: 1,
      }),
    )
    expect(screen.queryByRole('option', { name: /推荐|热门|销量/ })).toBeNull()
  })

  it('小店详情页：停了的店只说停了', async () => {
    const closed: ShopPage = {
      shop: {
        ...SHOP,
        status: 'suspended',
        mine: false,
        platform: false,
        publisher: null,
        qualifications: [],
      },
      experts: [],
      knowledge: [],
      demands: [],
      reviews: [],
      rating: { count: 0, average: null },
    }
    vi.mocked(client.fetchShop).mockResolvedValue(closed)
    page(<ShopScreen account={null} shopId="s1" />)
    expect(await screen.findByText('这家小店已暂停营业。')).toBeInTheDocument()
    expect(screen.queryByText('在架的知识')).toBeNull()
  })

  it('我的小店：改店名；被平台暂停时照实说', async () => {
    vi.mocked(client.fetchMyShop).mockResolvedValue({
      ...MY_SHOP,
      shop: { ...MY_SHOP.shop, status: 'suspended', status_note: '屡次违规' },
    })
    vi.mocked(client.fetchMyPublisher).mockResolvedValue({
      publisher: null,
      documents: [],
      licenses: [],
    })
    vi.mocked(client.renameShop).mockResolvedValue({
      ...MY_SHOP,
      shop: { ...MY_SHOP.shop, name: '甲店' },
    })
    page(<MyShopScreen csrfToken={CSRF} account={null} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('小店已被平台暂停：屡次违规')
    fireEvent.click(screen.getByRole('tab', { name: '店主资料' }))
    const name = await screen.findByLabelText(/^店名/)
    fireEvent.change(name, { target: { value: '甲店' } })
    fireEvent.click(screen.getByRole('button', { name: '改店名' }))
    await waitFor(() => expect(client.renameShop).toHaveBeenCalledWith(CSRF, '甲店'))
  })
})

it('retains a newer unsent message and reports a failed read or send', async () => {
  let done!: () => void
  vi.mocked(client.fetchMessages).mockRejectedValue(new Error('read'))
  vi.mocked(client.postMessage)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          done = () => resolve({} as never)
        }),
    )
    .mockRejectedValueOnce(new Error('send'))
  page(<Thread csrfToken={CSRF} kind="demand" id="d1" title="留言" />)
  expect(await screen.findByRole('alert')).toBeVisible()
  const input = screen.getByRole('textbox', { name: messages.marketUi.message })
  const send = screen.getByRole('button', { name: messages.marketUi.send })
  fireEvent.change(input, { target: { value: '第一条' } })
  fireEvent.click(send)
  await waitFor(() =>
    expect(client.postMessage).toHaveBeenCalledWith(CSRF, 'demand', 'd1', '第一条'),
  )
  fireEvent.change(input, { target: { value: '下一条' } })
  done()
  await waitFor(() => expect(send).toBeEnabled())
  expect(input).toHaveValue('下一条')
  fireEvent.click(send)
  await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(2))
  expect(input).toHaveValue('下一条')
})
it('shows a failed demand closure', async () => {
  vi.mocked(client.fetchDemand).mockResolvedValue(demand({ mine: true }))
  vi.mocked(client.closeDemand).mockRejectedValue(new Error('temporarily unavailable'))
  page(<DemandScreen csrfToken={CSRF} account={null} demandId="d1" />)
  fireEvent.click(await screen.findByRole('button', { name: messages.marketUi.demands.close }))
  expect(await screen.findByRole('alert')).toBeVisible()
})
it('rejects invalid delivery times and preserves the number for a valid offer', async () => {
  vi.mocked(client.fetchDemand).mockResolvedValue(demand())
  page(<DemandScreen csrfToken={CSRF} account={null} demandId="d1" />)
  const form = within(await screen.findByRole('form', { name: '响应这条需求' }))
  fireEvent.change(form.getByLabelText(messages.marketUi.proposal), { target: { value: '可交付' } })
  const input = form.getByLabelText(messages.marketUi.offerDays)
  const send = form.getByRole('button', { name: messages.marketUi.sendResponse })
  for (const invalid of ['七天', '0', '366', '1.5']) {
    fireEvent.change(input, { target: { value: invalid } })
    expect(send).toBeDisabled()
    expect(form.getByRole('alert')).toHaveTextContent(messages.marketUi.invalidOfferDays)
  }
  fireEvent.change(input, { target: { value: '7' } })
  fireEvent.click(send)
  await waitFor(() =>
    expect(client.respond).toHaveBeenCalledWith(CSRF, 'd1', expect.objectContaining({ days: 7 })),
  )
})
it('opens the exact expert version attached by the seller', async () => {
  vi.mocked(client.fetchDemand).mockResolvedValue(
    demand({
      mine: true,
      responses: [
        {
          response_id: 'r',
          demand_id: 'd1',
          listing_kind: 'expert',
          listing_ref: 'expert-id@4',
          proposal: '具体版本',
          price: null,
          days: null,
          status: 'open',
          mine: false,
          to_me: true,
          created_at: null,
        },
      ],
    }),
  )
  page(<DemandScreen csrfToken={CSRF} account={null} demandId="d1" />)
  const article = (await screen.findByText('具体版本')).closest('article')!
  expect(within(article).getByRole('link')).toHaveAttribute(
    'href',
    '/zh-CN/knowbots/expert-id?version=4',
  )
})

it('switches listing drafts by id and allows removing a file no longer shared', async () => {
  const rows: Listing[] = ['A', 'B'].map((id) => ({
    ...LISTING,
    listing_id: id,
    title: id,
    status: 'draft',
    items: [{ item_id: 'file-' + id, name: id + '资料', media_type: 'text/plain', size_bytes: 4 }],
  }))
  const file = {
    material_id: 'file-C',
    name: '补充资料',
    mine: true,
    sellable: true,
    license: 'sale' as const,
    version_no: 1,
    media_type: 'text/plain',
    size_bytes: 4,
    sha256: 'c'.repeat(64),
  }
  vi.mocked(client.fetchMyListings).mockResolvedValue({ items: rows })
  vi.mocked(client.fetchMyMaterials).mockResolvedValue({ items: [file] })
  vi.mocked(client.updateListing).mockResolvedValue({ listing: rows[1] })
  page(<MyShopScreen csrfToken={CSRF} account={null} />)
  fireEvent.click(screen.getByRole('tab', { name: messages.marketUi.myShop.knowledge }))
  const buttons = await screen.findAllByRole('button', { name: messages.marketUi.edit })
  fireEvent.click(buttons[0])
  fireEvent.click(buttons[1])
  const form = within(screen.getByRole('form', { name: messages.marketUi.mine.listingForm }))
  expect(form.getByLabelText(messages.marketUi.mine.listingTitle)).toHaveValue('B')
  fireEvent.click(await form.findByLabelText(/B资料/))
  const save = form.getByRole('button', { name: messages.marketUi.save })
  expect(save).toBeDisabled()
  fireEvent.click(form.getByLabelText('补充资料'))
  fireEvent.click(save)
  await waitFor(() =>
    expect(client.updateListing).toHaveBeenCalledWith(
      CSRF,
      'B',
      expect.objectContaining({ title: 'B', items: [{ item_id: 'file-C' }] }),
    ),
  )
})
it('binds a qualification to the chosen photo and resets document kind after a change of identity', async () => {
  const identity = {
    publisher_id: 'p',
    kind: 'individual' as const,
    name: '工作室',
    review_status: 'approved' as const,
    review_note: null,
    real_name_verified: true,
    reviewed_at: null,
  }
  const photos = ['photo-1', 'photo-2'].map((document_id) => ({
    document_id,
    kind: 'license' as const,
    purged: false,
    media_type: 'image/png',
    size_bytes: 4,
    created_at: null,
  }))
  vi.mocked(client.fetchMyPublisher).mockResolvedValue({
    publisher: identity,
    documents: photos,
    licenses: [],
  })
  page(<MyShopScreen csrfToken={CSRF} account={null} />)
  fireEvent.click(screen.getByRole('tab', { name: messages.marketUi.myShop.owner }))
  const ui = messages.marketUi.publisher
  const select = await screen.findByLabelText(ui.licensePhoto)
  fireEvent.change(screen.getByLabelText(ui.licenseName), { target: { value: '第二张资质' } })
  fireEvent.change(screen.getByLabelText(ui.licenseNo), { target: { value: '2' } })
  const add = within(screen.getByRole('region', {name:ui.licenses})).getByRole('button', { name: ui.addLicense })
  expect(add).toBeDisabled()
  fireEvent.change(select, { target: { value: 'photo-2' } })
  fireEvent.change(screen.getByLabelText(ui.documentKind), { target: { value: 'id_back' } })
  vi.mocked(client.fetchMyPublisher).mockResolvedValue({
    publisher: { ...identity, kind: 'organization' },
    documents: photos,
    licenses: [],
  })
  vi.mocked(client.addLicense).mockResolvedValue({} as never)
  fireEvent.click(add)
  await waitFor(() =>
    expect(client.addLicense).toHaveBeenCalledWith(
      CSRF,
      expect.objectContaining({ document_id: 'photo-2' }),
    ),
  )
  await waitFor(() =>
    expect(screen.getByLabelText(ui.documentKind)).toHaveValue('business_license'),
  )
  const file = new File(['test'], 'example.png', { type: 'image/png' })
  fireEvent.change(screen.getByLabelText(ui.choosePhoto), { target: { files: [file] } })
  await waitFor(() =>
    expect(client.uploadDocument).toHaveBeenCalledWith(file, 'business_license', CSRF),
  )
})
it.each(['demands', 'responses'] as const)(
  'shows the failure to read the owner’s %s',
  async (tab) => {
    const query = tab === 'demands' ? client.fetchMyDemands : client.fetchMyResponses
    vi.mocked(query).mockRejectedValue(new Error('temporarily unavailable'))
    page(<MyShopScreen csrfToken={CSRF} account={null} />)
    fireEvent.click(screen.getByRole('tab', { name: messages.marketUi.myShop[tab] }))
    expect(screen.getByText(messages.marketUi.loading)).toBeInTheDocument()
    expect(await screen.findByRole('alert')).toHaveTextContent(messages.marketUi.problem.failed)
  },
)
