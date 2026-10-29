import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { ShopScreen } from '@/components/market/shops'
import { marketSession } from '@/lib/server/market-page'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('marketUi')
  return { title: t('shops.title'), robots: { index: false, follow: false } }
}

// 小店详情页（SDD 0018 第十一节第 7 之二小节）
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params
  const { account } = await marketSession(locale, `/${locale}/shops/${id}`)
  return <ShopScreen account={account} shopId={id} />
}
