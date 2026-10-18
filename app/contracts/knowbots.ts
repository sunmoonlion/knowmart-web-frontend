import { z } from 'zod'

import { isPlainWebAddress } from '@/contracts/cross-app'

// 「请这位」的约定（后端 app/interfaces/endpoints/knowbot_routes.py，SDD 0027）。
// 目录与详情见 contracts/experts.ts（SDD 0032）。

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
