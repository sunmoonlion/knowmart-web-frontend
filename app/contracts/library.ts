import { z } from 'zod'

// knowmart 知识库（SDD 0042 第八节）：卖家放上架出售的资料，真源在 knowbase
export const libraryItemSchema = z
  .object({
    item_id: z.string(),
    name: z.string(),
    media_type: z.string(),
    size_bytes: z.number().int(),
    sha256: z.string(),
    origin: z.string(),
    created_at: z.string(),
  })
  .loose()
export type LibraryItem = z.infer<typeof libraryItemSchema>
export const libraryListSchema = z.object({ items: z.array(libraryItemSchema) }).loose()
export const libraryCreatedSchema = z.object({ item: libraryItemSchema }).loose()
