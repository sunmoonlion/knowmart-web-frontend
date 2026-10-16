import { z } from 'zod'

import { isPlainWebAddress } from '@/contracts/cross-app'

// 「我的分身」的约定（后端 app/interfaces/endpoints/knowbot_routes.py，SDD 0027）。
// 列表不带清单原文；分身只归当前用户。

const versionSchema = z
  .object({
    version: z.string().regex(/^[1-9][0-9]{0,5}$/),
    digest: z.string().regex(/^sha256:[0-9a-f]{64}$/),
    status: z.enum(['active', 'stopped']),
    delivered_at: z.string().min(1),
  })
  .strict()

const knowbotSchema = z
  .object({
    knowbot_id: z.string().uuid(),
    name: z.string().min(1).max(80),
    tagline: z.string().max(200),
    current_version: z.string().nullable(),
    versions: z.array(versionSchema),
  })
  .strict()

export const myKnowbotsSchema = z
  .object({ contract_version: z.literal(1), knowbots: z.array(knowbotSchema) })
  .strict()

export const summonReturnSchema = z
  .object({
    contract_version: z.literal(1),
    // 回工作台的地址：后端按 from 只从自己的配置里查，再带上 knowbot=分身@版本
    return_url: z
      .string()
      .max(2048)
      .refine((value) => isPlainWebAddress(value), 'must be an absolute http(s) URL'),
  })
  .strict()

export type MyKnowbots = z.infer<typeof myKnowbotsSchema>
export type Knowbot = z.infer<typeof knowbotSchema>
export type KnowbotVersion = z.infer<typeof versionSchema>
