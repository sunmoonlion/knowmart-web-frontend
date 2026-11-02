'use client'

import { Dialog } from '@base-ui/react/dialog'
import { useTranslations } from 'next-intl'

import { DEMO_EXPERT_PLACEHOLDERS } from '@/components/knowbots/demo-expert-placeholders'
import type { CatalogFilters } from '@/lib/knowbots/catalog'

// Separate presentation data: never pass these IDs to detail, summon, or return-url APIs.
export function DemoExpertGallery({ filters }: { filters: CatalogFilters }) {
  const t = useTranslations('experts')
  // No publication dates or pagination are invented for unpublished examples.
  if (filters.page !== 1 || filters.updated !== 'any') return null
  if (filters.category && !['finance', 'finance.securities_advisory'].includes(filters.category)) {
    return null
  }
  const query = filters.q.trim().toLowerCase()
  const examples = DEMO_EXPERT_PLACEHOLDERS.filter((item) =>
    [item.name, item.tagline, item.category.name, item.details].some((text) =>
      text.toLowerCase().includes(query),
    ),
  )
  if (!examples.length) return null
  if (filters.sort === 'name') examples.sort((a, b) => a.name.localeCompare(b.name))

  return (
    <section aria-labelledby="demo-expert-gallery-title" className="space-y-4 border-t pt-6">
      <div>
        <h2 id="demo-expert-gallery-title" className="font-semibold">
          {t('demoGallery')}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {t('demoNotice', { count: examples.length })}
        </p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {examples.map((item) => (
          <li key={item.id}>
            <Dialog.Root>
              <article className="hover:border-primary/60 relative flex h-full flex-col gap-2 rounded-lg border p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold">
                    <Dialog.Trigger className="text-left after:absolute after:inset-0 hover:underline">
                      {item.name}
                    </Dialog.Trigger>
                  </h3>
                  <span className="text-muted-foreground bg-muted shrink-0 rounded px-1.5 py-0.5 text-xs">
                    {t('demoBadge')}
                  </span>
                </div>
                <p className="text-sm">{item.tagline}</p>
                <p className="text-muted-foreground mt-auto text-xs">{item.category.name}</p>
              </article>
              <Dialog.Portal>
                <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50" />
                <Dialog.Popup className="bg-background fixed top-1/2 left-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 space-y-4 overflow-auto rounded-lg border p-6 shadow-lg">
                  <Dialog.Title className="text-lg font-semibold">{item.name}</Dialog.Title>
                  <Dialog.Description className="text-muted-foreground text-sm">
                    {t('demoUnavailable')}
                  </Dialog.Description>
                  <p className="text-sm">{item.details}</p>
                  <Dialog.Close className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm">
                    {t('demoClose')}
                  </Dialog.Close>
                </Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
          </li>
        ))}
      </ul>
    </section>
  )
}
