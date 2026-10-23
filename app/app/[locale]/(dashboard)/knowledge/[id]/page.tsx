import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { KnowledgeDetail } from '@/components/market/knowledge-market'
import { marketSession } from '@/lib/server/market-page'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('marketUi')
  return { title: t('knowledge.title'), robots: { index: false, follow: false } }
}

// 供需市场（SDD 0018 第十一节）
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale, id } = await params
  const demand = (await searchParams).demand
  const { csrfToken, account } = await marketSession(locale, `/${locale}/knowledge/${id}`)
  return (
    <KnowledgeDetail
      csrfToken={csrfToken}
      account={account}
      listingId={id}
      demandId={typeof demand === 'string' ? demand : null}
    />
  )
}
