import { getTranslations } from 'next-intl/server'

import { LogoutButton } from '@/components/auth/logout-button'
import { SignedInAs, signedInName } from '@/components/auth/signed-in-as'
import { requireBrowserSession } from '@/lib/server/auth-session'

// 市场各页共用：要登录（没登录跳登录，回到 next），给出 CSRF 与页头右边的「登录的人」
export async function marketSession(locale: string, next: string) {
  const session = await requireBrowserSession(locale, next)
  const tAuth = await getTranslations('auth')
  return {
    csrfToken: session.csrf_token,
    account: (
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
    ),
  }
}
