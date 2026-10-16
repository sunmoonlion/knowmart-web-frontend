import type { Metadata } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { LogoutButton } from '@/components/auth/logout-button'
import { MyKnowbots } from '@/components/knowbots/my-knowbots'
import { requireBrowserSession } from '@/lib/server/auth-session'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('knowbots')
  return { title: t('title'), robots: { index: false, follow: false } }
}

export default async function KnowbotsPage({
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
  const t = await getTranslations('knowbots')
  const tAuth = await getTranslations('auth')
  const tNav = await getTranslations('nav')

  return (
    <div className="bg-background min-h-screen" data-route-class="authenticated-workspace">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <Link href={`/${locale}/dashboard`} className="text-muted-foreground text-sm">
          {tNav('dashboard')}
        </Link>
        <LogoutButton
          csrfToken={session.csrf_token}
          locale={locale}
          label={tAuth('logout')}
          errorLabel={tAuth('logoutFailed')}
        />
      </header>
      <main className="p-8">
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-2">{t('intro')}</p>
        <MyKnowbots csrfToken={session.csrf_token} />
      </main>
    </div>
  )
}
