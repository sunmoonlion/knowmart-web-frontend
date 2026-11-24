import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { DemandHall } from '@/components/market/demands'
import { marketSession } from '@/lib/server/market-page'

export const dynamic = 'force-dynamic'
type Props = { params: Promise<{ locale: string; kind: string }> }

function demandKind(segment: string) {
  if (segment === 'expert' || segment === 'knowledge') return segment
  notFound()
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const kind = demandKind((await params).kind)
  const t = await getTranslations('market.nav')
  return {
    title: t(kind === 'expert' ? 'publishExpert' : 'publishKnowledge'),
    robots: { index: false, follow: false },
  }
}

export default async function Page({ params }: Props) {
  const { locale, kind: segment } = await params
  const kind = demandKind(segment)
  const { csrfToken, account } = await marketSession(locale, `/${locale}/publish/${kind}`)
  return <DemandHall key={kind} kind={kind} csrfToken={csrfToken} account={account} />
}
