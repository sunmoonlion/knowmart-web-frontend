'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import type { MyPublisher } from '@/contracts/market'
import { LICENSED_CATEGORIES } from '@/lib/market/categories'
import {
  addLicense,
  fetchMyPublisher,
  fetchRules,
  savePublisher,
  uploadDocument,
  type PublisherForm,
} from '@/lib/market/client'

import { MarketShell } from './market-shell'
import { Badge, Field, inputClass, Problem } from './parts'

type Props = { csrfToken: string; account: React.ReactNode }
const KEY = ['market', 'publisher'] as const
const STATUS_TONE = { pending: 'warn', approved: 'ok', rejected: 'bad', revoked: 'bad' } as const

// 发布主体与资质（SDD 0018 第十一节第 5 小节）：个人实名或营业执照；照片只给运营审核看，审过后留一年；
// 公开专家、上架知识都要先审过，要证照的类目还要证照
export function PublisherScreen({ csrfToken, account }: Props) {
  const t = useTranslations('marketUi')
  const mine = useQuery({ queryKey: KEY, queryFn: fetchMyPublisher })
  return (
    <MarketShell account={account}>
      <div className="mx-auto w-full max-w-3xl space-y-8 px-6 py-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">{t('publisher.title')}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t('publisher.lead')}</p>
        </header>
        {mine.isPending ? (
          <p className="text-muted-foreground text-sm">{t('loading')}</p>
        ) : mine.isError ? (
          <Problem error={mine.error} />
        ) : (
          <>
            <Identity csrfToken={csrfToken} mine={mine.data} />
            {mine.data.publisher ? <Documents csrfToken={csrfToken} mine={mine.data} /> : null}
            {mine.data.publisher ? <Licenses csrfToken={csrfToken} mine={mine.data} /> : null}
          </>
        )}
      </div>
    </MarketShell>
  )
}

function Identity({ csrfToken, mine }: { csrfToken: string; mine: MyPublisher }) {
  const t = useTranslations('marketUi')
  const client = useQueryClient()
  const p = mine.publisher
  const [form, setForm] = useState<PublisherForm>({
    kind: p?.kind ?? 'individual',
    name: p?.name ?? '',
    real_name: p?.real_name ?? '',
    id_number: '',
    credit_code: p?.credit_code ?? '',
    legal_person: p?.legal_person ?? '',
    contact_name: p?.contact_name ?? '',
  })
  const save = useMutation({
    mutationFn: () =>
      savePublisher(
        csrfToken,
        form.kind === 'individual'
          ? {
              kind: form.kind,
              name: form.name,
              real_name: form.real_name,
              id_number: form.id_number,
            }
          : {
              kind: form.kind,
              name: form.name,
              credit_code: form.credit_code,
              legal_person: form.legal_person,
              contact_name: form.contact_name,
            },
      ),
    onSuccess: (data) => client.setQueryData(KEY, data),
  })
  return (
    <section className="space-y-3" aria-label={t('publisher.identity')}>
      <h2 className="flex items-center gap-2 font-semibold">
        {t('publisher.identity')}
        {p ? (
          <Badge tone={STATUS_TONE[p.review_status]}>{t(`reviewStatus.${p.review_status}`)}</Badge>
        ) : null}
      </h2>
      {p?.review_note ? (
        <p className="text-muted-foreground text-sm">{t('reviewNote', { note: p.review_note })}</p>
      ) : null}
      {p?.id_number_masked ? (
        <p className="text-muted-foreground text-xs">
          {t('publisher.idOnFile', { masked: p.id_number_masked })}
        </p>
      ) : null}
      <form
        className="space-y-3 rounded-xl border p-4"
        onSubmit={(event) => {
          event.preventDefault()
          save.mutate()
        }}
      >
        <fieldset className="flex gap-4 text-sm">
          <legend className="mb-1 font-medium">{t('publisher.kind')}</legend>
          {(['individual', 'organization'] as const).map((kind) => (
            <label key={kind} className="flex items-center gap-1">
              <input
                type="radio"
                checked={form.kind === kind}
                onChange={() => setForm({ ...form, kind })}
              />
              {t(`publisher.${kind}`)}
            </label>
          ))}
        </fieldset>
        <Field label={t('publisher.name')} hint={t('publisher.nameHint')}>
          <input
            className={inputClass}
            maxLength={200}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        {form.kind === 'individual' ? (
          <>
            <Field label={t('publisher.realName')}>
              <input
                className={inputClass}
                maxLength={100}
                value={form.real_name}
                onChange={(e) => setForm({ ...form, real_name: e.target.value })}
              />
            </Field>
            <Field label={t('publisher.idNumber')} hint={t('publisher.idHint')}>
              <input
                className={inputClass}
                maxLength={18}
                autoComplete="off"
                value={form.id_number}
                onChange={(e) => setForm({ ...form, id_number: e.target.value })}
              />
            </Field>
          </>
        ) : (
          <>
            <Field label={t('publisher.creditCode')}>
              <input
                className={inputClass}
                maxLength={18}
                value={form.credit_code}
                onChange={(e) => setForm({ ...form, credit_code: e.target.value })}
              />
            </Field>
            <Field label={t('publisher.legalPerson')}>
              <input
                className={inputClass}
                maxLength={100}
                value={form.legal_person}
                onChange={(e) => setForm({ ...form, legal_person: e.target.value })}
              />
            </Field>
            <Field label={t('publisher.contactName')}>
              <input
                className={inputClass}
                maxLength={100}
                value={form.contact_name}
                onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
              />
            </Field>
          </>
        )}
        <p className="text-muted-foreground text-xs">{t('publisher.reReview')}</p>
        <Button type="submit" size="sm" disabled={save.isPending || !form.name.trim()}>
          {save.isPending ? t('working') : t('publisher.save')}
        </Button>
        <Problem error={save.error} />
      </form>
    </section>
  )
}

function Documents({ csrfToken, mine }: { csrfToken: string; mine: MyPublisher }) {
  const t = useTranslations('marketUi')
  const client = useQueryClient()
  const individual = mine.publisher?.kind === 'individual'
  const kinds = individual
    ? (['id_front', 'id_back', 'license'] as const)
    : (['business_license', 'license'] as const)
  const [kind, setKind] = useState<string>(kinds[0])
  const upload = useMutation({
    mutationFn: (file: File) => uploadDocument(file, kind, csrfToken),
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  })
  return (
    <section className="space-y-3" aria-label={t('publisher.documents')}>
      <h2 className="font-semibold">{t('publisher.documents')}</h2>
      <p className="text-muted-foreground text-xs">{t('publisher.documentsLead')}</p>
      <ul className="space-y-1 text-sm">
        {mine.documents.map((d) => (
          <li key={d.document_id} className="flex items-center gap-2">
            <Badge>{t(`documentKind.${d.kind}`)}</Badge>
            <span className="text-muted-foreground text-xs">
              {d.purged ? t('publisher.purged') : d.media_type}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-end gap-2">
        <Field label={t('publisher.documentKind')}>
          <select
            className={`${inputClass} w-auto`}
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            {kinds.map((k) => (
              <option key={k} value={k}>
                {t(`documentKind.${k}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('publisher.choosePhoto')}>
          <input
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            className="text-sm"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) upload.mutate(file)
            }}
          />
        </Field>
      </div>
      <Problem error={upload.error} />
    </section>
  )
}

function Licenses({ csrfToken, mine }: { csrfToken: string; mine: MyPublisher }) {
  const t = useTranslations('marketUi')
  const client = useQueryClient()
  const photos = mine.documents.filter((d) => d.kind === 'license' && !d.purged)
  const [form, setForm] = useState({
    category: LICENSED_CATEGORIES[0].code as string,
    license_name: '',
    license_no: '',
    valid_until: '',
    document_id: '',
  })
  const add = useMutation({
    mutationFn: () =>
      addLicense(csrfToken, {
        ...form,
        valid_until: form.valid_until || null,
        document_id: form.document_id || photos[0]?.document_id || '',
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  })
  return (
    <section className="space-y-3" aria-label={t('publisher.licenses')}>
      <h2 className="font-semibold">{t('publisher.licenses')}</h2>
      <p className="text-muted-foreground text-xs">{t('publisher.licensesLead')}</p>
      <ul className="space-y-2 text-sm">
        {mine.licenses.map((lic) => (
          <li key={lic.license_id} className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{lic.category.name}</span>
            <span>{lic.license_name}</span>
            <Badge tone={STATUS_TONE[lic.review_status]}>
              {t(`reviewStatus.${lic.review_status}`)}
            </Badge>
            {lic.expired ? (
              <Badge tone="bad">{t('publisher.expired')}</Badge>
            ) : lic.expiring ? (
              <Badge tone="warn">{t('publisher.expiring')}</Badge>
            ) : null}
          </li>
        ))}
      </ul>
      {photos.length === 0 ? (
        <p className="text-muted-foreground text-xs">{t('publisher.licensePhotoFirst')}</p>
      ) : (
        <form
          className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault()
            add.mutate()
          }}
        >
          <Field label={t('category')}>
            <select
              className={inputClass}
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {LICENSED_CATEGORIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('publisher.licenseName')}>
            <input
              className={inputClass}
              maxLength={200}
              value={form.license_name}
              onChange={(e) => setForm({ ...form, license_name: e.target.value })}
            />
          </Field>
          <Field label={t('publisher.licenseNo')}>
            <input
              className={inputClass}
              maxLength={100}
              value={form.license_no}
              onChange={(e) => setForm({ ...form, license_no: e.target.value })}
            />
          </Field>
          <Field label={t('publisher.validUntil')}>
            <input
              type="date"
              className={inputClass}
              value={form.valid_until}
              onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
            />
          </Field>
          <div className="sm:col-span-2">
            <Button
              type="submit"
              size="sm"
              disabled={add.isPending || !form.license_name.trim() || !form.license_no.trim()}
            >
              {t('publisher.addLicense')}
            </Button>
            <Problem error={add.error} />
          </div>
        </form>
      )}
    </section>
  )
}

// 驻场规则（平台定）：当前这一版
export function RulesScreen({ account }: { account: React.ReactNode }) {
  const t = useTranslations('marketUi')
  const rules = useQuery({ queryKey: ['market', 'rules'] as const, queryFn: fetchRules })
  return (
    <MarketShell account={account}>
      <div className="mx-auto w-full max-w-3xl space-y-4 px-6 py-8">
        {rules.isPending ? (
          <p className="text-muted-foreground text-sm">{t('loading')}</p>
        ) : rules.isError ? (
          <Problem error={rules.error} />
        ) : (
          <>
            <p className="text-muted-foreground text-xs">
              {t('rulesVersion', { version: rules.data.version || 1 })}
            </p>
            <article className="text-sm leading-7 whitespace-pre-wrap">{rules.data.body}</article>
          </>
        )}
      </div>
    </MarketShell>
  )
}
