import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { LogoutButton } from '@/components/auth/logout-button'
import { SignedInAs, signedInName } from '@/components/auth/signed-in-as'
import { LibraryScreen } from '@/components/library/library-screen'
import { requireBrowserSession } from '@/lib/server/auth-session'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('library')
  return { title: t('title'), robots: { index: false, follow: false } }
}

// knowmart 知识库（SDD 0042 第八节）：卖家放上架出售的资料
export default async function LibraryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const session = await requireBrowserSession(locale, `/${locale}/library`)
  const tAuth = await getTranslations('auth')
  return (
    <LibraryScreen
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
