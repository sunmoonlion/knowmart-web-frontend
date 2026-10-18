import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { LogoutButton } from '@/components/auth/logout-button'
import { SignedInAs, signedInName } from '@/components/auth/signed-in-as'
import { ExpertCatalog } from '@/components/knowbots/expert-catalog'
import { requireBrowserSession } from '@/lib/server/auth-session'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('experts')
  return { title: t('title'), robots: { index: false, follow: false } }
}

// 专家目录（SDD 0032）。路径沿用 /knowbots：工作台「请我的分身」与登录回跳都认它
export default async function ExpertsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale } = await params
  // 登录完回到这里，从工作台带来的 from、ref 不丢
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(await searchParams)) {
    if ((key === 'from' || key === 'ref') && typeof value === 'string') query.set(key, value)
  }
  const next = `/${locale}/knowbots${query.size ? `?${query.toString()}` : ''}`
  const session = await requireBrowserSession(locale, next)
  const tAuth = await getTranslations('auth')

  return (
    <ExpertCatalog
      csrfToken={session.csrf_token}
      account={
        <>
          <SignedInAs
            label={tAuth('signedInAs', { name: signedInName(session.user) })}
            email={session.user.email}
          />
          <LogoutButton
            csrfToken={session.csrf_token}
            locale={locale}
            label={tAuth('logout')}
            errorLabel={tAuth('logoutFailed')}
          />
        </>
      }
    />
  )
}
