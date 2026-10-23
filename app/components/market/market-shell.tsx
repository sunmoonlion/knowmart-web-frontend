'use client'

import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'

// 供需市场的栏目（SDD 0018 第十一节第 7 小节）：专家、知识、需求大厅、我发布的、我买到的、知识库、发布主体、驻场规则
export const MARKET_SECTIONS = [
  { key: 'market', path: 'knowbots' },
  { key: 'knowledge', path: 'knowledge' },
  { key: 'demands', path: 'demands' },
  { key: 'mine', path: 'mine' },
  { key: 'bought', path: 'bought' },
  { key: 'library', path: 'library' },
  { key: 'publisher', path: 'publisher' },
  { key: 'rules', path: 'rules' },
] as const

// 一行栏目：市场各页的页头里，专家目录与详情页的页头下面也放一行
export function MarketNav({ className }: { className?: string }) {
  const t = useTranslations('market')
  const locale = useLocale()
  const pathname = usePathname()
  return (
    <nav aria-label={t('sections')} className={cn('flex gap-1 overflow-x-auto', className)}>
      {MARKET_SECTIONS.map((section) => {
        const href = `/${locale}/${section.path}`
        const active = pathname === href || pathname.startsWith(`${href}/`)
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
}: {
  account: React.ReactNode
  children: React.ReactNode
}) {
  const t = useTranslations('market')
  const locale = useLocale()
  return (
    <div className="flex min-h-screen flex-col" data-route-class="authenticated-workspace">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-6 py-3">
        <Link href={`/${locale}/knowbots`} className="text-primary font-semibold">
          {t('brand')}
        </Link>
        <MarketNav className="flex-1" />
        <div className="flex items-center gap-3">{account}</div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  )
}
