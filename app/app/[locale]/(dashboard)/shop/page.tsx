import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { MyShopScreen } from '@/components/market/my-shop'
import { marketSession } from '@/lib/server/market-page'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('marketUi')
  return { title: t('myShop.title'), robots: { index: false, follow: false } }
}

// 我的小店（SDD 0018 第十一节第 7 之二小节）
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const { csrfToken, account } = await marketSession(locale, `/${locale}/shop`)
  return <MyShopScreen csrfToken={csrfToken} account={account} />
}
