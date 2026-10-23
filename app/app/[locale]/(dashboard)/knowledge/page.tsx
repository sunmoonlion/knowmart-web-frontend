import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { KnowledgeMarket } from '@/components/market/knowledge-market'
import { marketSession } from '@/lib/server/market-page'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('marketUi')
  return { title: t('knowledge.title'), robots: { index: false, follow: false } }
}

// 供需市场（SDD 0018 第十一节）
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const { account } = await marketSession(locale, `/${locale}/knowledge`)
  return <KnowledgeMarket account={account} />
}
