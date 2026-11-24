import { redirect } from 'next/navigation'

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ kind?: string }>
}) {
  const { locale } = await params
  const { kind } = await searchParams
  redirect(`/${locale}/publish/${kind === 'knowledge' ? 'knowledge' : 'expert'}`)
}
