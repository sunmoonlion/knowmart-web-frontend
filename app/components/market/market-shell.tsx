'use client'

import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import type { DemandDetail } from '@/contracts/market'
import { cn } from '@/lib/utils'

export const MARKET_SECTIONS = [
  { key: 'home', path: '' },
  { key: 'market', path: 'knowbots' },
  { key: 'knowledge', path: 'knowledge' },
  { key: 'publishExpert', path: 'publish/expert' },
  { key: 'publishKnowledge', path: 'publish/knowledge' },
  { key: 'shop', path: 'shop' },
  { key: 'rules', path: 'rules' },
] as const

type DemandKind = DemandDetail['kind']

export function MarketNav({
  className,
  demandKind,
}: {
  className?: string
  demandKind?: DemandKind
}) {
  const t = useTranslations('market')
  const locale = useLocale()
  const pathname = usePathname()
  return (
    <nav aria-label={t('sections')} className={cn('flex gap-1 overflow-x-auto', className)}>
      {MARKET_SECTIONS.map((section) => {
        const href = section.path ? `/${locale}/${section.path}` : `/${locale}`
        // 首页只认它自己；小店详情页（/shops/…）算在首页下面
        const active = demandKind
          ? section.path === `publish/${demandKind}`
          : section.path
            ? pathname === href || pathname.startsWith(`${href}/`)
            : pathname === href || pathname.startsWith(`${href}/shops/`)
        return (
          <Link
            key={section.key}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'hover:bg-muted rounded-md px-3 py-1.5 text-sm whitespace-nowrap',
              active && 'bg-muted font-medium',
            )}
          >
            {t(`nav.${section.key}`)}
          </Link>
        )
      })}
    </nav>
  )
}

// knowmart web端的外框：页头一行栏目，右边是登录的人
export function MarketShell({
  account,
  children,
  demandKind,
}: {
  account: React.ReactNode
  children: React.ReactNode
  demandKind?: DemandKind
}) {
  const t = useTranslations('market')
  const locale = useLocale()
  return (
    <div className="flex min-h-screen flex-col" data-route-class="authenticated-workspace">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-6 py-3">
        <Link href={`/${locale}`} className="text-primary font-semibold">
          {t('brand')}
        </Link>
        <MarketNav className="flex-1" demandKind={demandKind} />
        <div className="flex items-center gap-3">{account}</div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  )
}
