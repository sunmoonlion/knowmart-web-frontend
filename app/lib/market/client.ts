'use client'

// 供需市场的取数（SDD 0018 第十一节）：经 knowmart 后端 /api/web/v1/knowmart/market
import { z } from 'zod'

import {
  demandDetailSchema,
  demandSchema,
  documentSchema,
  expertListingSchema,
  expertMarketSchema,
  itemsOf,
  licenseSchema,
  listingSchema,
  messageSchema,
  myPublisherSchema,
  pageOf,
  responseSchema,
  reviewSchema,
  rulesSchema,
  tradeSchema,
} from '@/contracts/market'
import { ApiClientError, requestJson } from '@/lib/common/api-client'

const base = '/api/web/v1/knowmart/market'
const seg = encodeURIComponent

async function get<T extends z.ZodTypeAny>(schema: T, path: string): Promise<z.infer<T>> {
  return schema.parse(await requestJson(`${base}${path}`))
}

async function send<T extends z.ZodTypeAny>(
  schema: T,
  path: string,
  csrfToken: string,
  body?: unknown,
  method = 'POST',
): Promise<z.infer<T>> {
  return schema.parse(await requestJson(`${base}${path}`, { method, csrfToken, body }))
}

function query(params: Record<string, string | number | null | undefined>): string {
  const found = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') found.set(key, String(value))
  }
  return found.size ? `?${found}` : ''
}

// ---------- 驻场规则、举报 ----------
export const fetchRules = () => get(rulesSchema, '/rules')
export const report = (
  csrfToken: string,
  body: { target_kind: string; target_id: string; reason: string },
) => send(z.object({ report_id: z.string() }).loose(), '/reports', csrfToken, body)

// ---------- 发布主体与资质 ----------
export const fetchMyPublisher = () => get(myPublisherSchema, '/publisher')
export type PublisherForm = {
  kind: 'individual' | 'organization'
  name: string
  real_name?: string
  id_number?: string
  credit_code?: string
  legal_person?: string
  contact_name?: string
}
export const savePublisher = (csrfToken: string, body: PublisherForm) =>
  send(myPublisherSchema, '/publisher', csrfToken, body, 'PUT')

// 照片是请求体本身（不经 JSON）
export async function uploadDocument(file: File, kind: string, csrfToken: string) {
  const response = await fetch(`${base}/publisher/documents?kind=${seg(kind)}`, {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    redirect: 'manual',
    body: file,
    headers: {
      Accept: 'application/json',
      'Content-Type': file.type || 'application/octet-stream',
      'X-CSRF-Token': csrfToken,
    },
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ApiClientError(response.status, {
      code: typeof body?.code === 'string' ? body.code : 'request_failed',
      message_key: 'errors.requestFailed',
      retryable: false,
      correlation_id: '',
    })
  }
  return z.object({ document: documentSchema }).loose().parse(body).document
}

export const addLicense = (
  csrfToken: string,
  body: {
    category: string
    license_name: string
    license_no: string
    valid_until: string | null
    document_id: string
  },
) => send(z.object({ license: licenseSchema }).loose(), '/publisher/licenses', csrfToken, body)

// ---------- 专家条目 ----------
export const fetchMyExperts = () =>
  get(
    itemsOf(
      expertListingSchema.extend({
        category: z.object({ code: z.string(), name: z.string() }).loose(),
      }),
    ),
    '/experts/mine',
  )
export const setExpertListing = (
  csrfToken: string,
  knowbotId: string,
  body: { visibility: 'private' | 'public'; price: string | null; category?: string },
) =>
  send(
    z.object({ listing: expertListingSchema }).loose(),
    `/experts/${seg(knowbotId)}/listing`,
    csrfToken,
    body,
    'PUT',
  )
export const fetchExpertMarket = (knowbotId: string) =>
  get(expertMarketSchema, `/experts/${seg(knowbotId)}/market`)

// ---------- 知识条目 ----------
export type ListingForm = {
  title: string
  category: string
  description: string
  items: { item_id: string }[]
  sample: string
  rights_statement: string
  resale_allowed: boolean
  price: string | null
}
export const fetchKnowledge = (params: { q?: string; category?: string | null; page?: number }) =>
  get(pageOf(listingSchema), `/knowledge${query(params)}`)
export const fetchMyListings = () => get(itemsOf(listingSchema), '/knowledge/mine')
export const fetchListing = async (id: string) =>
  (await get(z.object({ listing: listingSchema }).loose(), `/knowledge/${seg(id)}`)).listing
export const createListing = (csrfToken: string, body: ListingForm) =>
  send(z.object({ listing: listingSchema }).loose(), '/knowledge', csrfToken, body)
export const updateListing = (csrfToken: string, id: string, body: ListingForm) =>
  send(
    z.object({ listing: listingSchema }).loose(),
    `/knowledge/${seg(id)}`,
    csrfToken,
    body,
    'PUT',
  )
export const submitListing = (csrfToken: string, id: string) =>
  send(z.object({ listing: listingSchema }).loose(), `/knowledge/${seg(id)}/submit`, csrfToken)
export const delistListing = (csrfToken: string, id: string) =>
  send(z.object({ listing: listingSchema }).loose(), `/knowledge/${seg(id)}/delist`, csrfToken)
export const buyListing = (
  csrfToken: string,
  id: string,
  body: { request_id: string; target_app: 'knowbench' | 'knowlab'; demand_id?: string },
) => send(z.object({ trade: tradeSchema }).loose(), `/knowledge/${seg(id)}/buy`, csrfToken, body)

// ---------- 需求与响应 ----------
export type DemandForm = {
  kind: 'expert' | 'knowledge'
  title: string
  problem: string
  data_wanted: string
  deadline: string
  budget: string | null
}
export const fetchDemandHall = (params: { kind?: string | null; q?: string; page?: number }) =>
  get(pageOf(demandSchema), `/demands${query(params)}`)
export const fetchMyDemands = () => get(itemsOf(demandSchema), '/demands/mine')
export const fetchDemand = async (id: string) =>
  (await get(z.object({ demand: demandDetailSchema }).loose(), `/demands/${seg(id)}`)).demand
export const createDemand = (csrfToken: string, body: DemandForm) =>
  send(z.object({ demand: demandSchema }).loose(), '/demands', csrfToken, body)
export const closeDemand = (csrfToken: string, id: string) =>
  send(z.object({ demand: demandDetailSchema }).loose(), `/demands/${seg(id)}/close`, csrfToken)
export const respond = (
  csrfToken: string,
  demandId: string,
  body: {
    listing_kind: 'expert' | 'knowledge' | null
    listing_ref: string | null
    proposal: string
    price: string | null
    days: number | null
  },
) =>
  send(
    z.object({ response: responseSchema }).loose(),
    `/demands/${seg(demandId)}/responses`,
    csrfToken,
    body,
  )
export const chooseResponse = (csrfToken: string, demandId: string, responseId: string) =>
  send(
    z.object({ demand: demandDetailSchema }).loose(),
    `/demands/${seg(demandId)}/choose/${seg(responseId)}`,
    csrfToken,
  )
export const fetchMyResponses = () => get(itemsOf(responseSchema), '/responses/mine')
export const withdrawResponse = (csrfToken: string, id: string) =>
  send(z.object({ response: responseSchema }).loose(), `/responses/${seg(id)}/withdraw`, csrfToken)
// 被选中的卖家补附条目（Fable 评审 P2-9）
export const attachOffer = (
  csrfToken: string,
  id: string,
  body: { listing_kind: 'knowledge' | 'expert'; listing_ref: string },
) =>
  send(
    z.object({ response: responseSchema }).loose(),
    `/responses/${seg(id)}/offer`,
    csrfToken,
    body,
  )

// ---------- 成交、评价 ----------
export const fetchTrades = (role: 'buyer' | 'seller') =>
  get(itemsOf(tradeSchema), `/trades?role=${role}`)
export const reviewTrade = (
  csrfToken: string,
  tradeId: string,
  body: { rating: number; text: string },
) =>
  send(
    z.object({ review: reviewSchema }).loose(),
    `/trades/${seg(tradeId)}/review`,
    csrfToken,
    body,
  )
export const replyTrade = (csrfToken: string, tradeId: string, body: { reply: string }) =>
  send(z.object({ review: reviewSchema }).loose(), `/trades/${seg(tradeId)}/reply`, csrfToken, body)

// ---------- 留言 ----------
export const fetchMessages = (kind: 'demand' | 'response', id: string) =>
  get(itemsOf(messageSchema), `/messages/${kind}/${seg(id)}`)
export const postMessage = (
  csrfToken: string,
  kind: 'demand' | 'response',
  id: string,
  body: string,
) =>
  send(z.object({ message: messageSchema }).loose(), `/messages/${kind}/${seg(id)}`, csrfToken, {
    body,
  })

export const problemCode = (error: unknown): string =>
  error instanceof ApiClientError ? error.problem.code : 'failed'
