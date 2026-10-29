import { getTranslations } from 'next-intl/server'

import { LogoutButton } from '@/components/auth/logout-button'
import { SignedInAs, signedInName } from '@/components/auth/signed-in-as'
import { getBrowserSession, requireBrowserSession } from '@/lib/server/auth-session'

type Session = NonNullable<Awaited<ReturnType<typeof getBrowserSession>>>

// 页头右边的「登录的人」与退出
async function signedIn(locale: string, session: Session) {
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

// 市场各页共用：要登录（没登录跳登录，回到 next），给出 CSRF 与页头右边的「登录的人」
export async function marketSession(locale: string, next: string) {
  return signedIn(locale, await requireBrowserSession(locale, next))
}

// 站点首页用：登录了同上，没登录回 null（首页给没登录的人看公开介绍）
export async function optionalMarketSession(locale: string) {
  const session = await getBrowserSession()
  return session ? signedIn(locale, session) : null
}
