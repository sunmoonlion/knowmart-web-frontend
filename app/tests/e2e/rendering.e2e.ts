import { expect, test } from '@playwright/test'

test('runtime health endpoint is dynamic and non-cacheable', async ({ request }) => {
  const response = await request.get('/healthz')

  expect(response.status()).toBe(200)
  expect(response.headers()['cache-control']).toContain('no-store')
  expect(response.headers()['x-deployment-id']).toBe('arch-v2-r2-web-e2e')
  expect(await response.json()).toMatchObject({
    status: 'ok',
    surface: 'web',
    deployment_id: 'arch-v2-r2-web-e2e',
  })
})

test('public route is rendered and indexable', async ({ page }) => {
  const response = await page.goto('/en')

  expect(response?.status()).toBe(200)
  await expect(
    page.getByRole('heading', {
      name: 'A dependable foundation for product web applications',
    }),
  ).toBeVisible()
  await expect(page.locator('[data-route-class="public-content"]')).toBeVisible()
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0)
})

test('anonymous workspace request is redirected by the SSR authorization boundary', async ({
  page,
}) => {
  // Stop at the provider entry: this test covers the real SSR redirect chain,
  // without depending on an external identity provider or its login state.
  await page.route('**/api/auth/web/login?**', (route) =>
    route.fulfill({ contentType: 'text/plain', body: 'SSO authorization started' }),
  )
  await page.goto('/en/dashboard')

  await expect(page).toHaveURL(/\/api\/auth\/web\/login\?return_to=%2Fen%2Fdashboard$/)
  await expect(page.getByText('SSO authorization started')).toBeVisible()
  await expect(page.locator('[data-route-class="login"]')).toHaveCount(0)
})

test('workspace route renders only after the paired backend validates its opaque session', async ({
  context,
  page,
}) => {
  await context.addCookies([
    {
      name: 'sunmoonai_knowmart_web_sid',
      value: 'e2e-session',
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
  const response = await page.goto('/en/dashboard')

  expect(response?.status()).toBe(200)
  expect(response?.headers()['cache-control']).toContain('no-store')
  await expect(page.locator('[data-route-class="authenticated-workspace"]')).toBeVisible()
  await expect(page.getByText('Signed in as Paired E2E User')).toBeVisible()
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
})

test('paired unified Backend contract streams, cites, reconciles and accepts HITL', async ({
  context,
  page,
  request,
}) => {
  await context.addCookies([
    {
      name: 'sunmoonai_knowmart_web_sid',
      value: 'e2e-session',
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
  await page.goto('/en/dashboard')

  await expect(page.getByText('A streamed FastAPI response fragment.')).toBeVisible()
  const source = page.getByRole('link', { name: 'FastAPI authorized reference' })
  await expect(source).toBeVisible()
  await expect(page.getByTestId('run-status')).toHaveText('Waiting for input')

  const sourceHref = await source.getAttribute('href')
  if (!sourceHref) throw new Error('citation source href is missing')
  const anonymousSource = await request.get(sourceHref, { maxRedirects: 0 })
  expect(anonymousSource.status()).toBe(401)
  const sourceResponse = await request.get(sourceHref, {
    headers: { Cookie: 'sunmoonai_knowmart_web_sid=e2e-session' },
    maxRedirects: 0,
  })
  expect(sourceResponse.status()).toBe(302)
  expect(sourceResponse.headers().location).toContain('/api/web/v1/reference/sources/')

  await page.getByRole('button', { name: 'Confirm and continue' }).click()
  await expect(page.getByTestId('run-status')).toHaveText('Succeeded')
})

test('unknown route renders a not-found boundary', async ({ page }) => {
  const response = await page.goto('/en/route-that-does-not-exist')

  expect(response?.status()).toBe(404)
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
})

test('sitemap uses the runtime application origin', async ({ request, baseURL }) => {
  const response = await request.get('/sitemap.xml')

  expect(response.status()).toBe(200)
  expect(await response.text()).toContain(`${baseURL}/en`)
})

test('opens each publishing section from the marketplace and preserves old demand bookmarks', async ({
  context,
  page,
}) => {
  await context.addCookies([
    {
      name: 'sunmoonai_knowmart_web_sid',
      value: 'e2e-session',
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
  await page.route('**/api/web/v1/knowmart/market/demands?**', (route) =>
    route.fulfill({ json: { items: [], total: 0, page: 1, page_size: 24 } }),
  )
  await page.goto('/zh-CN/demands?kind=knowledge')
  await expect(page).toHaveURL(/\/zh-CN\/publish\/knowledge$/)
  const nav = page.getByRole('navigation', { name: '栏目' })
  await expect(nav.getByRole('link')).toHaveText([
    '搜寻小店',
    '搜寻专家',
    '搜寻知识',
    '发布专家',
    '发布知识',
    '我的小店',
    '驻场规则',
  ])
  await expect(nav.getByRole('link', { name: '发布知识' })).toHaveAttribute('aria-current', 'page')
  await page.getByRole('button', { name: '发布需求' }).click()
  await page.getByLabel('标题', { exact: true }).fill('知识资料请求')
  await nav.getByRole('link', { name: '发布专家' }).click()
  await expect(page).toHaveURL(/\/zh-CN\/publish\/expert$/)
  await expect(page.getByRole('heading', { name: '发布专家' })).toBeVisible()
  await page.reload()
  await expect(nav.getByRole('link', { name: '发布专家' })).toHaveAttribute('aria-current', 'page')
  await page.getByRole('button', { name: '发布需求' }).click()
  await expect(page.getByLabel('标题', { exact: true })).toHaveValue('')
})

test('market navigation comes before method types, and only expert methods offer business categories', async ({
  context,
  page,
}) => {
  await context.addCookies([
    {
      name: 'sunmoonai_knowmart_web_sid',
      value: 'e2e-session',
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
  await page.route('**/api/web/v1/knowmart/method-directory?**', (route) => {
    const query = new URL(route.request().url()).searchParams
    const tool = query.get('kind') === 'tool'
    const cat = {
      group: 'finance',
      group_name: '金融',
      code: 'finance.private_fund',
      name: '私募基金',
    }
    return route.fulfill({
      json: {
        contract_version: 1,
        total: 1,
        page: 1,
        page_size: 24,
        categories: tool
          ? []
          : [
              {
                group: 'finance',
                group_name: '金融',
                count: 1,
                children: [{ code: cat.code, name: cat.name, count: 1 }],
              },
            ],
        items: [
          {
            listing_id: '487a3543-e970-4a7b-ae67-57785c918c44',
            method_kind: tool ? 'tool' : 'expert',
            reference: {
              method_id: 'ec4a5858-0bd2-5a3e-8211-e0e3f0d882a6',
              version: 1,
              digest: 'sha256:' + 'a'.repeat(64),
            },
            name: tool ? '核验结果汇总' : '样例专家',
            tagline: '测试',
            category: cat,
            updated_at: '2026-11-24T08:00:00Z',
          },
        ],
      },
    })
  })
  await page.goto('/zh-CN/knowbots')
  const nav = page.getByRole('navigation', { name: '栏目' })
  const kinds = page.getByRole('navigation', { name: '方法类型' })
  await expect(nav.getByRole('link', { name: '搜寻专家' })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('button', { name: '金融', exact: true })).toBeVisible()
  expect((await nav.boundingBox())!.y).toBeLessThan((await kinds.boundingBox())!.y)
  await kinds.getByRole('button', { name: '工具方法' }).click()
  await expect(page.getByRole('heading', { name: '核验结果汇总' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: '类目' })).toHaveCount(0)
  await expect(page.getByText('专家方向演示')).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('heading', { name: '核验结果汇总' })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await kinds.getByRole('button', { name: '专家方法' }).click()
  await page.getByLabel('业务细类').selectOption('finance.private_fund')
  await expect(page).toHaveURL(/category=finance.private_fund/)
})
