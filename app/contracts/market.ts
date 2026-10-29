import { z } from 'zod'

// 供需市场（SDD 0018 第十一节）。字段与后端 market_routes / services/market 的「给页面的样子」一致。
const category = z
  .object({ code: z.string(), name: z.string(), group: z.string(), group_name: z.string() })
  .loose()
const money = z.string().nullable()

export const publisherSchema = z
  .object({
    publisher_id: z.string(),
    kind: z.enum(['individual', 'organization']),
    name: z.string(),
    review_status: z.enum(['pending', 'approved', 'rejected', 'revoked']),
    review_note: z.string().nullable(),
    real_name_verified: z.boolean(),
    reviewed_at: z.string().nullable(),
    real_name: z.string().nullable().optional(),
    id_number_masked: z.string().nullable().optional(),
    credit_code: z.string().nullable().optional(),
    legal_person: z.string().nullable().optional(),
    contact_name: z.string().nullable().optional(),
  })
  .loose()
export type Publisher = z.infer<typeof publisherSchema>

export const documentSchema = z
  .object({
    document_id: z.string(),
    kind: z.enum(['id_front', 'id_back', 'business_license', 'license']),
    media_type: z.string(),
    size_bytes: z.number(),
    created_at: z.string().nullable(),
    purged: z.boolean(),
  })
  .loose()
export type MarketDocument = z.infer<typeof documentSchema>

export const licenseSchema = z
  .object({
    license_id: z.string(),
    category,
    license_name: z.string(),
    license_no: z.string(),
    valid_until: z.string().nullable(),
    review_status: z.enum(['pending', 'approved', 'rejected', 'revoked']),
    review_note: z.string().nullable().optional(),
    expiring: z.boolean(),
    expired: z.boolean(),
  })
  .loose()
export type License = z.infer<typeof licenseSchema>

export const myPublisherSchema = z
  .object({
    publisher: publisherSchema.nullable(),
    documents: z.array(documentSchema),
    licenses: z.array(licenseSchema),
  })
  .loose()
export type MyPublisher = z.infer<typeof myPublisherSchema>

export const reviewSchema = z
  .object({
    rating: z.number(),
    text: z.string(),
    reply: z.string().nullable(),
    created_at: z.string().nullable(),
    replied_at: z.string().nullable(),
  })
  .loose()
export type Review = z.infer<typeof reviewSchema>
const rating = z.object({ count: z.number(), average: z.number().nullable() }).loose()

// 小店（SDD 0018 第十一节第 7 之二小节）：一个用户一家；页面上链过去只要编号与店名
export const shopRefSchema = z.object({ shop_id: z.string(), name: z.string() }).loose()
export type ShopRef = z.infer<typeof shopRefSchema>
const publicPublisher = z
  .object({ name: z.string(), kind: z.string(), real_name_verified: z.boolean() })
  .loose()

export const listingSchema = z
  .object({
    listing_id: z.string(),
    title: z.string(),
    category,
    description: z.string(),
    items: z.array(
      z
        .object({
          name: z.string().nullable(),
          media_type: z.string().nullable(),
          size_bytes: z.number().nullable(),
          item_id: z.string().nullable().optional(),
        })
        .loose(),
    ),
    sample: z.string(),
    rights_statement: z.string(),
    resale_allowed: z.boolean(),
    price: money,
    mine: z.boolean(),
    updated_at: z.string().nullable(),
    status: z.enum(['draft', 'pending', 'listed', 'rejected', 'delisted', 'taken_down']).optional(),
    review_note: z.string().nullable().optional(),
    delist_reason: z.enum(['item_gone', 'item_not_for_sale']).nullable().optional(),
    publisher: publicPublisher.nullable().optional(),
    reviews: z.array(reviewSchema).optional(),
    rating: rating.optional(),
    shop: shopRefSchema.nullable().optional(),
  })
  .loose()
export type Listing = z.infer<typeof listingSchema>

export const pageOf = <T extends z.ZodTypeAny>(item: T) =>
  z
    .object({ items: z.array(item), total: z.number(), page: z.number(), page_size: z.number() })
    .loose()

export const demandSchema = z
  .object({
    demand_id: z.string(),
    kind: z.enum(['expert', 'knowledge']),
    title: z.string(),
    problem: z.string(),
    data_wanted: z.string(),
    deadline: z.string().nullable(),
    budget: money,
    status: z.enum(['open', 'chosen', 'closed', 'taken_down']),
    taking_responses: z.boolean(),
    mine: z.boolean(),
    chosen_response_id: z.string().nullable(),
    created_at: z.string().nullable(),
  })
  .loose()
export type Demand = z.infer<typeof demandSchema>

export const responseSchema = z
  .object({
    response_id: z.string(),
    demand_id: z.string(),
    listing_kind: z.enum(['expert', 'knowledge']).nullable(),
    listing_ref: z.string().nullable(),
    proposal: z.string(),
    price: money,
    days: z.number().nullable(),
    status: z.enum(['open', 'chosen', 'not_chosen', 'withdrawn', 'taken_down']),
    mine: z.boolean(),
    to_me: z.boolean(),
    created_at: z.string().nullable(),
    demand: demandSchema.optional(),
    // 需求方看得到响应的卖家的店
    shop: shopRefSchema.nullable().optional(),
  })
  .loose()
export type DemandResponse = z.infer<typeof responseSchema>

export const demandDetailSchema = demandSchema.extend({
  response_count: z.number(),
  responses: z.array(responseSchema),
  // 需求在大厅里匿名：响应了的卖家才见到买家的店
  shop: shopRefSchema.nullable().optional(),
})
export type DemandDetail = z.infer<typeof demandDetailSchema>

// 写知识条目时选的资料：卖家在 knowbase 总栏交给 knowmart 的（user-data/v2 的 knowmart 栏）。
// 能卖 = 自己的、许可是「可以出售」；不能卖的照样列出来，说明去 knowbase 改
export const materialSchema = z
  .object({
    material_id: z.string(),
    name: z.string(),
    version_no: z.number().int(),
    media_type: z.string(),
    size_bytes: z.number().int(),
    sha256: z.string(),
    license: z.string(),
    mine: z.boolean(),
    sellable: z.boolean(),
  })
  .loose()
export type Material = z.infer<typeof materialSchema>

export const tradeSchema = z
  .object({
    trade_id: z.string(),
    kind: z.enum(['expert', 'knowledge']),
    listing_ref: z.string(),
    title: z.string(),
    price: money,
    // v1 时买知识复制进的应用；user-data/v2 不分区，新成交为空，旧的留作历史
    target_app: z.enum(['knowbench', 'knowlab']).nullable(),
    granted: z.array(
      z.object({ name: z.string().nullable(), item_id: z.string().nullable() }).loose(),
    ),
    demand_id: z.string().nullable(),
    status: z.enum(['granting', 'done', 'failed']).optional(),
    // 没买成的原因：卖家那份没了（item_gone）、上架后不再出售（item_not_for_sale）
    failure: z.string().nullable().optional(),
    created_at: z.string().nullable(),
    role: z.enum(['buyer', 'seller']).optional(),
    review: reviewSchema.nullable().optional(),
    // 成交那一刻卖的发布主体；卖家的店；那一条现在还在不在架（专家：还请不请得到）
    seller_publisher: z
      .object({ name: z.string(), kind: z.string() })
      .loose()
      .nullable()
      .optional(),
    shop: shopRefSchema.nullable().optional(),
    listing_state: z.enum(['on', 'off']).optional(),
  })
  .loose()
export type Trade = z.infer<typeof tradeSchema>

export const messageSchema = z
  .object({
    message_id: z.string(),
    body: z.string(),
    role: z.enum(['buyer', 'seller', 'user']),
    mine: z.boolean(),
    created_at: z.string().nullable(),
  })
  .loose()
export type MarketMessage = z.infer<typeof messageSchema>

export const rulesSchema = z
  .object({ version: z.number(), body: z.string(), created_at: z.string().nullable() })
  .loose()
export type Rules = z.infer<typeof rulesSchema>

export const expertListingSchema = z
  .object({
    knowbot_id: z.string(),
    name: z.string(),
    visibility: z.enum(['private', 'public']),
    listing_status: z.enum(['self', 'pending', 'public', 'rejected', 'taken_down']),
    price: money,
    review_note: z.string().nullable(),
  })
  .loose()
export type ExpertListing = z.infer<typeof expertListingSchema>

export const expertMarketSchema = z
  .object({
    price: money,
    listing_status: z.string(),
    reviews: z.array(reviewSchema),
    rating,
    shop: shopRefSchema.nullable().optional(),
  })
  .loose()
export type ExpertMarket = z.infer<typeof expertMarketSchema>

export const itemsOf = <T extends z.ZodTypeAny>(item: T) =>
  z.object({ items: z.array(item) }).loose()

// 店主那一块：店名、发布主体（审过才有）、资质标识、平台店标、处置状态
export const shopHeaderSchema = z
  .object({
    shop_id: z.string(),
    name: z.string(),
    status: z.enum(['open', 'suspended']),
    mine: z.boolean(),
    platform: z.boolean(),
    publisher: publicPublisher.nullable(),
    qualifications: z.array(category),
  })
  .loose()
export type ShopHeader = z.infer<typeof shopHeaderSchema>

// 首页的一家店：在架专家、在架知识、公开需求各几样，供给的类目，最近一次改动
export const shopCardSchema = shopHeaderSchema.extend({
  experts: z.number(),
  knowledge: z.number(),
  demands: z.number(),
  categories: z.array(category),
  updated_at: z.string().nullable(),
})
export type ShopCard = z.infer<typeof shopCardSchema>

// 小店详情页（对外）：只放别人看得到的
export const shopPageSchema = z
  .object({
    shop: shopHeaderSchema,
    experts: z.array(
      z
        .object({
          knowbot_id: z.string(),
          name: z.string(),
          tagline: z.string(),
          category,
          version: z.string().nullable(),
          price: money,
        })
        .loose(),
    ),
    knowledge: z.array(listingSchema),
    demands: z.array(demandSchema),
    reviews: z.array(
      reviewSchema.extend({ title: z.string(), kind: z.enum(['expert', 'knowledge']) }),
    ),
    rating,
  })
  .loose()
export type ShopPage = z.infer<typeof shopPageSchema>

export const shopEventSchema = z
  .object({
    kind: z.enum(['renamed', 'suspended', 'restored']),
    old_name: z.string().nullable(),
    new_name: z.string().nullable(),
    note: z.string().nullable(),
    at: z.string().nullable(),
  })
  .loose()

// 我的小店（自己管）：店名、处置状态与说明、在不在首页列表上、评分、留痕
export const myShopSchema = z
  .object({
    shop: shopHeaderSchema.extend({
      status_note: z.string().nullable(),
      status_at: z.string().nullable(),
      listed: z.boolean(),
    }),
    rating,
    history: z.array(shopEventSchema),
  })
  .loose()
export type MyShop = z.infer<typeof myShopSchema>
