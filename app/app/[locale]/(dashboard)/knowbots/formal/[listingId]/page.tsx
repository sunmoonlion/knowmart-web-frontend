import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { LogoutButton } from '@/components/auth/logout-button'
import { SignedInAs, signedInName } from '@/components/auth/signed-in-as'
import { FormalMethodDetail } from '@/components/knowbots/formal-method-detail'
import { requireBrowserSession } from '@/lib/server/auth-session'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('experts')
  return { title: t('title'), robots: { index: false, follow: false } }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function FormalMethodDetailPage({
  params,
}: {
  params: Promise<{ locale: string; listingId: string }>
}) {
  const { locale, listingId } = await params
  const validId = UUID.test(listingId) ? listingId : '00000000-0000-0000-0000-000000000000'
  const session = await requireBrowserSession(locale, `/${locale}/knowbots`)
  const tAuth = await getTranslations('auth')

  return (
    <FormalMethodDetail
      listingId={validId}
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
