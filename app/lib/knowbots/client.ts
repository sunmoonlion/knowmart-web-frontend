'use client'

import { myKnowbotsSchema, summonReturnSchema, type MyKnowbots } from '@/contracts/knowbots'
import { requestJson } from '@/lib/common/api-client'

export class KnowbotContractError extends Error {
  constructor(options?: { cause?: unknown }) {
    super('knowbot_contract_invalid')
    this.name = 'KnowbotContractError'
    if (options?.cause !== undefined) this.cause = options.cause
  }
}

const base = '/api/web/v1/knowbots'

export async function fetchMyKnowbots(): Promise<MyKnowbots> {
  const parsed = myKnowbotsSchema.safeParse(await requestJson(base))
  if (!parsed.success) throw new KnowbotContractError({ cause: parsed.error })
  return parsed.data
}

function versionPath(knowbotId: string, version: string, action: string): string {
  return `${base}/${encodeURIComponent(knowbotId)}/versions/${encodeURIComponent(version)}/${action}`
}

export async function stopKnowbotVersion(
  knowbotId: string,
  version: string,
  csrfToken: string,
): Promise<void> {
  await requestJson(versionPath(knowbotId, version, 'stop'), { method: 'POST', csrfToken })
}

// 「请这位」：后端核验是自己的、未停用的这一版，给回工作台的地址
export async function summonReturnUrl(
  knowbotId: string,
  version: string,
  origin: { app: string; ref: string | null },
  csrfToken: string,
): Promise<string> {
  const parsed = summonReturnSchema.safeParse(
    await requestJson(versionPath(knowbotId, version, 'summon-return'), {
      method: 'POST',
      csrfToken,
      body: origin.ref === null ? { from: origin.app } : { from: origin.app, ref: origin.ref },
    }),
  )
  if (!parsed.success) throw new KnowbotContractError({ cause: parsed.error })
  return parsed.data.return_url
}
