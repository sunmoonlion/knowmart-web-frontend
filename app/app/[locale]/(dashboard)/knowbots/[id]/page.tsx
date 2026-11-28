import { marketDetailPath } from '@/lib/auth/next-path'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { LogoutButton } from '@/components/auth/logout-button'
import { SignedInAs, signedInName } from '@/components/auth/signed-in-as'
import { ExpertDetail } from '@/components/knowbots/expert-detail'
import { requireBrowserSession } from '@/lib/server/auth-session'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('experts')
  return { title: t('title'), robots: { index: false, follow: false } }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// 专家详情（SDD 0032）。看不看得到由后端判；这里只挡明显不是编号的地址
export default async function ExpertPage({
  params,
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params
  const knowbotId = UUID.test(id) ? id : '00000000-0000-0000-0000-000000000000'
  const session = await requireBrowserSession(
    locale,
    marketDetailPath(`/${locale}/knowbots/${knowbotId}`, await searchParams),
  )
  const tAuth = await getTranslations('auth')

  return (
    <ExpertDetail
      knowbotId={knowbotId}
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
