import { z } from 'zod'

// 专家目录的约定（后端 app/interfaces/endpoints/expert_routes.py，SDD 0032）。
// 谁看得到哪个专家只由后端判；这里只核形状。

const categorySchema = z
  .object({
    code: z.string().min(1).max(64),
    name: z.string().min(1).max(64),
    group: z.string().min(1).max(32),
    group_name: z.string().min(1).max(32),
  })
  .strict()

const itemSchema = z
  .object({
    knowbot_id: z.string().uuid(),
    name: z.string().min(1).max(80),
    tagline: z.string().max(200),
    category: categorySchema,
    version: z.string().regex(/^[1-9][0-9]{0,5}$/),
    summonable: z.boolean(),
    updated_at: z.string().min(1),
    owned: z.boolean(),
  })
  .strict()

const treeSchema = z.array(
  z
    .object({
      group: z.string().min(1).max(32),
      group_name: z.string().min(1).max(32),
      count: z.number().int().nonnegative(),
      children: z.array(
        z
          .object({
            code: z.string().min(1).max(64),
            name: z.string().min(1).max(64),
            count: z.number().int().nonnegative(),
          })
          .strict(),
      ),
    })
    .strict(),
)

export const expertListSchema = z
  .object({
    contract_version: z.literal(1),
    items: z.array(itemSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    page_size: z.number().int().positive(),
    categories: treeSchema,
  })
  .strict()

const labelled = z.object({ label: z.string(), text: z.string() }).strict()

export const expertDetailSchema = z
  .object({
    contract_version: z.literal(1),
    expert: z
      .object({
        knowbot_id: z.string().uuid(),
        name: z.string().min(1).max(80),
        tagline: z.string().max(200),
        category: categorySchema,
        owned: z.boolean(),
        version: z.string().regex(/^[1-9][0-9]{0,5}$/),
        summonable: z.boolean(),
        updated_at: z.string().min(1),
        versions: z.array(
          z
            .object({
              version: z.string().regex(/^[1-9][0-9]{0,5}$/),
              status: z.enum(['active', 'stopped']),
              delivered_at: z.string().min(1),
            })
            .strict(),
        ),
        sections: z
          .object({
            can_do: z.array(labelled),
            scope: z
              .object({ does: z.string(), does_not: z.string(), elsewhere: z.string() })
              .strict(),
            data: z
              .object({
                bundled: z.array(
                  z.object({ dataset_id: z.string(), version: z.string() }).strict(),
                ),
                // 数据需求声明（SDD 0042）：请它时要你从自己的知识库选的几样
                needs: z
                  .array(
                    z
                      .object({
                        key: z.string(),
                        name: z.string(),
                        description: z.string(),
                        formats: z.array(z.string()),
                        required: z.boolean(),
                        min_count: z.number().int(),
                        max_count: z.number().int(),
                        tables: z.array(
                          z
                            .object({ sheet: z.string().nullable(), columns: z.array(z.string()) })
                            .strict(),
                        ),
                      })
                      .strict(),
                  )
                  .default([]),
                accepts_user_data: z.boolean(),
              })
              .strict(),
            delivers: z.array(z.object({ step: z.string(), file: z.string().nullable() }).strict()),
            // 只有所有者自己拿得到方法的步骤
            steps: z
              .array(z.object({ title: z.string(), summary: z.string() }).strict())
              .nullable(),
          })
          .strict(),
        // 公开专家才有
        publisher: z
          .object({
            name: z.string(),
            kind: z.enum(['individual', 'organization']),
            real_name_verified: z.boolean(),
            licenses: z.array(
              z
                .object({
                  name: z.string(),
                  number: z.string(),
                  valid_until: z.string().nullable(),
                })
                .strict(),
            ),
          })
          .strict()
          .nullable(),
      })
      .strict(),
  })
  .strict()

export type ExpertList = z.infer<typeof expertListSchema>
export type ExpertItem = z.infer<typeof itemSchema>
export type CategoryTree = z.infer<typeof treeSchema>
export type ExpertDetail = z.infer<typeof expertDetailSchema>['expert']
