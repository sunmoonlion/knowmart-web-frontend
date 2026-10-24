import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ExpertCatalog } from '@/components/knowbots/expert-catalog'
import { ExpertDetail } from '@/components/knowbots/expert-detail'
import type { ExpertDetail as Detail, ExpertList } from '@/contracts/experts'
import { fetchExpert, fetchExperts } from '@/lib/knowbots/catalog'
import { stopKnowbotVersion, summonReturnUrl } from '@/lib/knowbots/client'
import { leaveTo } from '@/lib/leave-to'
import messages from '@/messages/zh-CN.json'

const nav = vi.hoisted(() => ({ search: '', replace: vi.fn() }))
const origin = vi.hoisted(() => ({ data: null as null | Record<string, unknown> }))
const links = vi.hoisted(() => ({ data: null as null | Record<string, unknown> }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace, push: vi.fn() }),
  usePathname: () => '/zh-CN/knowbots',
  useSearchParams: () => new URLSearchParams(nav.search),
}))
vi.mock('@/lib/knowbots/catalog', async (importActual) => ({
  ...(await importActual<typeof import('@/lib/knowbots/catalog')>()),
  fetchExperts: vi.fn(),
  fetchExpert: vi.fn(),
}))
vi.mock('@/lib/knowbots/client', () => ({
  summonReturnUrl: vi.fn(),
  stopKnowbotVersion: vi.fn(),
}))
vi.mock('@/lib/leave-to', () => ({ leaveTo: vi.fn() }))
vi.mock('@/lib/cross-app/use-cross-app', () => ({
  useCrossAppOrigin: () => origin,
  useCrossAppLinks: () => links,
}))

const CSRF = 'csrf-token-value-that-is-long-enough-1234'
const ID = '0b8a6c3e-1f2d-4c5b-9a7e-6d5c4b3a2f10'
const category = {
  code: 'finance.securities_advisory',
  name: '证券 / 期货投资咨询',
  group: 'finance',
  group_name: '金融',
}
const tree = [
  {
    group: 'finance',
    group_name: '金融',
    count: 1,
    children: [{ code: 'finance.securities_advisory', name: '证券 / 期货投资咨询', count: 1 }],
  },
]
const list: ExpertList = {
  contract_version: 1,
  items: [
    {
      knowbot_id: ID,
      name: '财务分析与预测',
      tagline: '看清收入、成本、现金流的走势',
      category,
      version: '1',
      summonable: true,
      updated_at: '2026-10-18T00:00:00Z',
      owned: true,
    },
  ],
  total: 1,
  page: 1,
  page_size: 24,
  categories: tree,
}
const detail: Detail = {
  knowbot_id: ID,
  name: '财务分析与预测',
  tagline: '看清收入、成本、现金流的走势',
  category,
  owned: true,
  version: '1',
  summonable: true,
  updated_at: '2026-10-18T00:00:00Z',
  versions: [{ version: '1', status: 'active', delivered_at: '2026-10-18T00:00:00Z' }],
  unlisted: [],
  stop_in: 'here',
  sections: {
    can_do: [{ label: '解决什么', text: '看清走势与结构' }],
    scope: { does: '', does_not: '估值、评级、买卖建议', elsewhere: '' },
    data: {
      bundled: [{ dataset_id: 'ds-600519', version: '3' }],
      needs: [],
      accepts_user_data: false,
    },
    delivers: [{ step: '成稿', file: '底稿/成稿.md' }],
    steps: [{ title: '取数', summary: '按口径取数' }],
  },
  publisher: null,
}

function page(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="zh-CN" messages={messages} timeZone="Asia/Shanghai">
        {node}
      </NextIntlClientProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  nav.search = ''
  nav.replace.mockReset()
  origin.data = null
  links.data = null
  vi.mocked(fetchExperts).mockReset().mockResolvedValue(list)
  vi.mocked(fetchExpert).mockReset().mockResolvedValue(detail)
  vi.mocked(summonReturnUrl).mockReset()
  vi.mocked(stopKnowbotVersion).mockReset().mockResolvedValue(undefined)
  vi.mocked(leaveTo).mockReset()
})

describe('专家目录首页', () => {
  it('页头一级类目、左侧二级类目、卡片；不贴自用或公开的标签', async () => {
    page(<ExpertCatalog csrfToken={CSRF} account={<span>当前用户：sig-am</span>} />)
    const card = (await screen.findByText('财务分析与预测')).closest('article')!
    expect(within(card).getByText(/证券 \/ 期货投资咨询 · 第 1 版/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '金融' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /证券 \/ 期货投资咨询\s*1/ })).toBeInTheDocument()
    expect(screen.getByText('当前用户：sig-am')).toBeInTheDocument()
    expect(screen.queryByText(/自用|公开/)).toBeNull()
    // 不是从工作台来，也没配去工作台的链接：卡片上没有「请这位」
    expect(screen.queryByRole('button', { name: '请这位' })).toBeNull()
  })

  it('筛选、类目、搜索都写进地址；换条件回到第一页；from 与 ref 保留', async () => {
    nav.search = 'from=knowbench&ref=expert&page=2'
    page(<ExpertCatalog csrfToken={CSRF} account={null} />)
    await screen.findByText('财务分析与预测')
    fireEvent.change(screen.getByLabelText('更新时间'), { target: { value: '30d' } })
    expect(nav.replace).toHaveBeenLastCalledWith(
      '/zh-CN/knowbots?from=knowbench&ref=expert&updated=30d',
    )
    fireEvent.click(screen.getByRole('button', { name: /证券 \/ 期货投资咨询\s*1/ }))
    expect(nav.replace).toHaveBeenLastCalledWith(
      '/zh-CN/knowbots?from=knowbench&ref=expert&category=finance.securities_advisory',
    )
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '预测' } })
    fireEvent.submit(screen.getByRole('search'))
    expect(nav.replace).toHaveBeenLastCalledWith(
      '/zh-CN/knowbots?from=knowbench&ref=expert&q=%E9%A2%84%E6%B5%8B',
    )
  })

  it('已选条件排成小标签，可单独去掉，也可一起重置', async () => {
    nav.search = 'category=finance&updated=7d&q=预测'
    page(<ExpertCatalog csrfToken={CSRF} account={null} />)
    await screen.findByText('财务分析与预测')
    expect(vi.mocked(fetchExperts)).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'finance', updated: '7d', q: '预测' }),
    )
    fireEvent.click(screen.getByRole('button', { name: '去掉「近 7 天」' }))
    expect(nav.replace).toHaveBeenLastCalledWith(
      '/zh-CN/knowbots?category=finance&q=%E9%A2%84%E6%B5%8B',
    )
    fireEvent.click(screen.getByRole('button', { name: '重置筛选' }))
    expect(nav.replace).toHaveBeenLastCalledWith('/zh-CN/knowbots')
  })

  it('从工作台来：卡片上「请这位」，点了带着这一版回工作台', async () => {
    nav.search = 'from=knowbench&ref=expert'
    origin.data = { app: 'knowbench', ref: 'expert', return_url: 'https://knowbench.example' }
    vi.mocked(summonReturnUrl).mockResolvedValue(
      'https://knowbench.example/zh-CN/workbench?knowbot=x',
    )
    page(<ExpertCatalog csrfToken={CSRF} account={null} />)
    expect(await screen.findByText(messages.experts.fromWorkbench)).toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: '请这位' }))
    await waitFor(() => expect(leaveTo).toHaveBeenCalled())
    expect(summonReturnUrl).toHaveBeenCalledWith(ID, '1', { app: 'knowbench', ref: 'expert' }, CSRF)
  })

  it('一个专家都没有：说去 knowlab 做；筛选后没有：说没有符合条件的', async () => {
    vi.mocked(fetchExperts).mockResolvedValue({ ...list, items: [], total: 0, categories: [] })
    const view = page(<ExpertCatalog csrfToken={CSRF} account={null} />)
    expect(await screen.findByText(messages.experts.empty)).toBeInTheDocument()
    view.unmount()
    nav.search = 'updated=7d'
    page(<ExpertCatalog csrfToken={CSRF} account={null} />)
    expect(await screen.findByText(messages.experts.noMatch)).toBeInTheDocument()
  })

  it('左侧类目能收起，再展开', async () => {
    page(<ExpertCatalog csrfToken={CSRF} account={null} />)
    await screen.findByText('财务分析与预测')
    fireEvent.click(screen.getByRole('button', { name: /收起/ }))
    expect(screen.queryByRole('button', { name: /证券 \/ 期货投资咨询\s*1/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '展开类目' }))
    expect(screen.getByRole('button', { name: /证券 \/ 期货投资咨询\s*1/ })).toBeInTheDocument()
  })
})

describe('专家详情', () => {
  it('五个页签里有内容；所有者看得到方法步骤；没有发布主体页签', async () => {
    page(<ExpertDetail knowbotId={ID} csrfToken={CSRF} account={null} />)
    expect(await screen.findByRole('heading', { name: '财务分析与预测' })).toBeInTheDocument()
    expect(screen.getByText('看清走势与结构')).toBeInTheDocument()
    expect(screen.getByText('估值、评级、买卖建议')).toBeInTheDocument()
    expect(screen.getByText(messages.experts.steps)).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: '发布主体' })).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: '需要的数据' }))
    expect(screen.getByText(/ds-600519/)).toBeInTheDocument()
    expect(screen.getByText(messages.experts.ownDataOnly)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: '交回什么' }))
    expect(screen.getByText(/底稿\/成稿\.md/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: '版本记录' }))
    fireEvent.click(screen.getByRole('button', { name: '停用' }))
    await waitFor(() => expect(stopKnowbotVersion).toHaveBeenCalledWith(ID, '1', CSRF))
  })

  it('knowlab 交来的：空号写明结局，停用到 knowlab 去（SDD 0037）', async () => {
    vi.mocked(fetchExpert).mockResolvedValue({
      ...detail,
      version: '3',
      versions: [{ version: '3', status: 'active', delivered_at: '2026-10-25T00:00:00Z' }],
      unlisted: [
        { version: '2', outcome: 'rejected' },
        { version: '1', outcome: 'declined' },
      ],
      stop_in: 'knowlab',
    })
    page(<ExpertDetail knowbotId={ID} csrfToken={CSRF} account={null} />)
    fireEvent.click(await screen.findByRole('tab', { name: '版本记录' }))
    const rows = screen.getAllByRole('listitem').map((li) => li.textContent)
    expect(rows[0]).toMatch(/^第 3 版/)
    expect(rows[1]).toBe('第 2 版 · 没有上架：运营审核没通过')
    expect(rows[2]).toBe('第 1 版 · 没有上架：你没要这一版')
    // 没配 knowlab 的去处：照说去哪里停，不给停用按钮
    expect(screen.queryByRole('button', { name: '停用' })).toBeNull()
    expect(screen.getByText('到 knowlab 的「专家」里停用')).toBeInTheDocument()
  })

  it('写了数据需求声明的：列出要你提供的几样，不再列自带的数据（SDD 0042）', async () => {
    vi.mocked(fetchExpert).mockResolvedValue({
      ...detail,
      sections: {
        ...detail.sections,
        data: {
          bundled: [],
          needs: [
            {
              key: 'statements',
              name: '三张报表',
              description: '最近三年',
              formats: ['excel', 'csv'],
              required: true,
              min_count: 1,
              max_count: 3,
              tables: [{ sheet: '利润表', columns: ['营业收入', '营业成本'] }],
            },
          ],
          accepts_user_data: true,
        },
      },
    })
    page(<ExpertDetail knowbotId={ID} csrfToken={CSRF} account={null} />)
    await screen.findByRole('heading', { name: '财务分析与预测' })
    fireEvent.click(screen.getByRole('tab', { name: '需要的数据' }))
    expect(screen.getByText('需要你提供的数据')).toBeInTheDocument()
    expect(screen.getByText(/必填 · 1～3 份 · Excel \/ CSV/)).toBeInTheDocument()
    expect(screen.getByText('要有：利润表 营业收入, 营业成本')).toBeInTheDocument()
    expect(screen.queryByText(messages.experts.bundled)).toBeNull()
    expect(screen.getByText(messages.experts.acceptsUserData)).toBeInTheDocument()
  })

  it('公开专家：有发布主体页签，看不到方法步骤', async () => {
    vi.mocked(fetchExpert).mockResolvedValue({
      ...detail,
      owned: false,
      sections: { ...detail.sections, steps: null },
      publisher: {
        name: '某某证券',
        kind: 'organization',
        real_name_verified: true,
        licenses: [{ name: '经营证券期货业务许可证', number: '000000001', valid_until: null }],
      },
    })
    page(<ExpertDetail knowbotId={ID} csrfToken={CSRF} account={null} />)
    await screen.findByRole('heading', { name: '财务分析与预测' })
    expect(screen.queryByText(messages.experts.steps)).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: '发布主体' }))
    expect(screen.getByText(/经营证券期货业务许可证（编号 000000001）/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: '版本记录' }))
    expect(screen.queryByRole('button', { name: '停用' })).toBeNull()
  })

  it('换版本就按那一版取；看不到的说没有这位专家', async () => {
    page(<ExpertDetail knowbotId={ID} csrfToken={CSRF} account={null} />)
    await screen.findByRole('heading', { name: '财务分析与预测' })
    fireEvent.change(screen.getByLabelText('版本'), { target: { value: '1' } })
    await waitFor(() => expect(fetchExpert).toHaveBeenLastCalledWith(ID, '1'))
    vi.mocked(fetchExpert).mockRejectedValue(new Error('not found'))
    page(<ExpertDetail knowbotId={'1' + ID.slice(1)} csrfToken={CSRF} account={null} />)
    expect(await screen.findByText(messages.experts.notFound)).toBeInTheDocument()
  })
})
