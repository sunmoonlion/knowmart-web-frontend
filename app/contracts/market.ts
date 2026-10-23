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
    review_status: z.enum(['pending', 'approved', 'rejected']),
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
    review_status: z.enum(['pending', 'approved', 'rejected']),
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
    publisher: z
      .object({ name: z.string(), kind: z.string(), real_name_verified: z.boolean() })
      .loose()
      .nullable()
      .optional(),
    reviews: z.array(reviewSchema).optional(),
    rating: rating.optional(),
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
  })
  .loose()
export type DemandResponse = z.infer<typeof responseSchema>

export const demandDetailSchema = demandSchema.extend({
  response_count: z.number(),
  responses: z.array(responseSchema),
})
export type DemandDetail = z.infer<typeof demandDetailSchema>

export const tradeSchema = z
  .object({
    trade_id: z.string(),
    kind: z.enum(['expert', 'knowledge']),
    listing_ref: z.string(),
    title: z.string(),
    price: money,
    target_app: z.enum(['knowbench', 'knowlab']).nullable(),
    copied: z.array(
      z.object({ name: z.string().nullable(), item_id: z.string().nullable() }).loose(),
    ),
    demand_id: z.string().nullable(),
    created_at: z.string().nullable(),
    role: z.enum(['buyer', 'seller']).optional(),
    review: reviewSchema.nullable().optional(),
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
  })
  .loose()
export type ExpertMarket = z.infer<typeof expertMarketSchema>

export const itemsOf = <T extends z.ZodTypeAny>(item: T) =>
  z.object({ items: z.array(item) }).loose()
