import { getTranslations, setRequestLocale } from 'next-intl/server'

import { ShopList } from '@/components/market/shops'
import { PublicHome } from '@/components/platform/public-home'
import { optionalMarketSession } from '@/lib/server/market-page'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// 站点首页：登录了是小店列表（SDD 0018 第十一节第 7 之二小节，市场各页都要登录）；
// 没登录是公开的介绍页，从那里登录
export default async function LocaleHomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const session = await optionalMarketSession(locale)
  if (session) return <ShopList account={session.account} />
  const t = await getTranslations('public')

  return (
    <PublicHome
      locale={locale}
      title={t('title')}
      description={t('description')}
      loginLabel={t('login')}
      workspaceLabel={t('workspace')}
    />
  )
}
