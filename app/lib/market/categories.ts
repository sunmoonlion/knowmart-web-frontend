// 类目（与后端 app/domain/knowbots/catalog.py 的 CATEGORIES 一致）：license 为真的公开要证照
export const MARKET_CATEGORIES = [
  {
    code: 'finance.securities_advisory',
    group: '金融',
    name: '证券 / 期货投资咨询',
    license: true,
  },
  { code: 'finance.public_fund', group: '金融', name: '公募基金', license: true },
  { code: 'finance.private_fund', group: '金融', name: '私募基金', license: true },
  { code: 'tools.office', group: '工具', name: '办公', license: false },
  { code: 'tools.lookup', group: '工具', name: '信息查询', license: false },
  { code: 'tools.calculator', group: '工具', name: '计算器', license: false },
  { code: 'business.management', group: '商业服务', name: '企业管理', license: false },
] as const

export const LICENSED_CATEGORIES = MARKET_CATEGORIES.filter((c) => c.license)
