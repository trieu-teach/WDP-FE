// Tests cho getUserFinancialTopSeries trong real.service.js.
// Verify:
//  - Service gửi đúng userId trên path.
//  - Service gửi đúng period/year/month/quarter.
//  - Service đọc đúng envelope { success, data } của BE — KHÔNG đọc trực tiếp root.
//  - Map đúng root data của BE: user / filter / summary / top_series.
//  - Empty top_series / empty summary không crash.
//  - Clamp limit 1..50 theo BE spec (default 10, max 50).
//  - Fallback đọc được payload không có envelope (backward compat).

import { test, mock } from 'node:test'
import assert from 'node:assert/strict'

const httpCalls = []
const httpResponses = new Map()

function setResponse(method, urlMatch, response) {
  httpResponses.set(`${method} ${urlMatch}`, response)
}

function reset() {
  httpCalls.length = 0
  httpResponses.clear()
}

const httpMock = {
  get: (url, config) => {
    httpCalls.push({ method: 'GET', url, config })
    const key = `GET ${url}`
    const res = httpResponses.get(key)
    if (!res) {
      throw new Error(`No mock response for ${key}. Known: ${[...httpResponses.keys()].join(', ')}`)
    }
    return Promise.resolve(res.payload)
  },
  patch: () => Promise.resolve(),
}

const httpStub = {
  http: httpMock,
  getApiErrorMessage: (err, fallback) => err?.message ?? fallback,
  API_BASE_URL: 'http://localhost',
  getBackendOrigin: () => 'http://localhost',
  resolveMediaUrl: (u) => u,
  isNetworkError: () => false,
  parseContentDispositionFilename: () => null,
  downloadAuthenticatedFile: () => Promise.resolve(),
}

const httpModuleUrl = new URL('../src/api/http.js', import.meta.url).href
await mock.module(httpModuleUrl, {
  namedExports: httpStub,
})

const { realService } = await import('../src/api/real.service.js')

/* ============================================================
 * Mock helpers — bám sát envelope BE thật 2026-08-05
 * ============================================================ */

function topSeriesEnvelope(overrides = {}) {
  return {
    payload: {
      success: true,
      data: {
        user: { id: 'u-42', full_name: 'Mangaka A', role: 'Mangaka' },
        filter: { period: 'month', year: 2026, month: 8 },
        summary: {
          creator_revenue_coin_display: '480.00',
          creator_revenue_coin: 480,
          chapters_sold: 12,
          series_count: 2,
        },
        top_series: [],
        ...overrides,
      },
    },
  }
}

// ============================================================
// getUserFinancialTopSeries — params & path
// ============================================================

test('getUserFinancialTopSeries gọi đúng path với userId', async () => {
  reset()
  setResponse(
    'GET',
    '/admin/users/u-42/financials/top-series',
    topSeriesEnvelope({
      top_series: [
        {
          rank: 1,
          series_id: 's1',
          series_name: 'Series One',
          chapters_sold: 10,
          gross_revenue_coin_display: '600.00',
          creator_revenue_coin_display: '480.00',
          platform_fee_coin_display: '120.00',
          platform_fee_vnd_display: '12000.00',
          platform_fee_vnd: 12000,
        },
      ],
    }),
  )

  const res = await realService.getUserFinancialTopSeries('u-42', {
    period: 'month',
    year: 2026,
    month: 8,
  })

  assert.equal(httpCalls.length, 1)
  assert.equal(httpCalls[0].url, '/admin/users/u-42/financials/top-series')

  // Service map đúng root envelope (từ data).
  assert.ok(res.user)
  assert.equal(res.user.id, 'u-42')
  assert.equal(res.user.role, 'Mangaka')
  assert.equal(res.filter.period, 'month')
  assert.equal(res.summary.chapters_sold, 12)
  assert.equal(res.summary.series_count, 2)
  assert.equal(res.summary.creator_revenue_coin_display, '480.00')
  assert.equal(res.top_series.length, 1)
  assert.equal(res.top_series[0].series_id, 's1')
  assert.equal(res.top_series[0].platform_fee_vnd, 12000)
})

test('getUserFinancialTopSeries gửi đúng period/year/month', async () => {
  reset()
  setResponse('GET', '/admin/users/u-1/financials/top-series', topSeriesEnvelope())

  await realService.getUserFinancialTopSeries('u-1', {
    period: 'month',
    year: 2026,
    month: 5,
  })

  const params = httpCalls[0].config?.params ?? {}
  assert.equal(params.period, 'month')
  assert.equal(params.year, 2026)
  assert.equal(params.month, 5)
  assert.equal(params.quarter, undefined)
})

test('getUserFinancialTopSeries gửi đúng quarter cho period=quarter', async () => {
  reset()
  setResponse('GET', '/admin/users/u-1/financials/top-series', topSeriesEnvelope())

  await realService.getUserFinancialTopSeries('u-1', {
    period: 'quarter',
    year: 2026,
    quarter: 3,
  })

  const params = httpCalls[0].config?.params ?? {}
  assert.equal(params.period, 'quarter')
  assert.equal(params.year, 2026)
  assert.equal(params.quarter, 3)
  assert.equal(params.month, undefined)
})

test('getUserFinancialTopSeries KHÔNG gửi month/quarter khi period=year', async () => {
  reset()
  setResponse('GET', '/admin/users/u-1/financials/top-series', topSeriesEnvelope())

  await realService.getUserFinancialTopSeries('u-1', { period: 'year', year: 2026 })

  const params = httpCalls[0].config?.params ?? {}
  assert.equal(params.period, 'year')
  assert.equal(params.year, 2026)
  assert.equal(params.month, undefined)
  assert.equal(params.quarter, undefined)
})

test('getUserFinancialTopSeries default period=month khi truyền invalid', async () => {
  reset()
  setResponse('GET', '/admin/users/u-1/financials/top-series', topSeriesEnvelope())

  await realService.getUserFinancialTopSeries('u-1', { period: 'whatever' })

  const params = httpCalls[0].config?.params ?? {}
  assert.equal(params.period, 'month')
})

// ============================================================
// Envelope { success, data } — KHÔNG trả null khi BE dùng envelope
// ============================================================

test('getUserFinancialTopSeries đọc đúng envelope { success, data } — KHÔNG trả null', async () => {
  reset()
  setResponse(
    'GET',
    '/admin/users/u-7/financials/top-series',
    {
      payload: {
        success: true,
        data: {
          user: { id: 'u-7', full_name: 'Assistant B', role: 'Assistant' },
          filter: { period: 'month', year: 2026, month: 8 },
          summary: { chapters_sold: 3, series_count: 1 },
          top_series: [
            {
              rank: 1,
              series_id: 's99',
              series_name: 'Big Series',
              chapters_sold: 3,
              gross_revenue_coin_display: '300.00',
              creator_revenue_coin_display: '240.00',
              platform_fee_coin_display: '60.00',
              platform_fee_vnd: 6000,
            },
          ],
        },
      },
    },
  )

  const res = await realService.getUserFinancialTopSeries('u-7', {
    period: 'month',
    year: 2026,
    month: 8,
  })

  // Map đúng từ data envelope — KHÔNG null.
  assert.notEqual(res.user, null)
  assert.equal(res.user.id, 'u-7')
  assert.notEqual(res.filter, null)
  assert.notEqual(res.summary, null)
  assert.equal(res.summary.chapters_sold, 3)
  assert.equal(res.top_series.length, 1)
  assert.equal(res.top_series[0].series_id, 's99')
  assert.equal(res.top_series[0].platform_fee_vnd, 6000)
})

test('getUserFinancialTopSeries KHÔNG map root success/data — chỉ trả shape đã map', async () => {
  reset()
  setResponse('GET', '/admin/users/u-1/financials/top-series', topSeriesEnvelope())

  const res = await realService.getUserFinancialTopSeries('u-1', { period: 'month' })
  assert.equal(res.success, undefined)
  assert.equal(res.data, undefined)
  assert.equal(typeof res.user, 'object')
  assert.equal(typeof res.filter, 'object')
  assert.equal(typeof res.summary, 'object')
})

test('getUserFinancialTopSeries fallback đọc payload KHÔNG có envelope (backward compat)', async () => {
  reset()
  setResponse('GET', '/admin/users/u-1/financials/top-series', {
    payload: {
      user: { id: 'u-1', full_name: 'Mangaka X', role: 'Mangaka' },
      filter: { period: 'month', year: 2026, month: 8 },
      summary: { chapters_sold: 5 },
      top_series: [
        { rank: 1, series_id: 's1', series_name: 'Old Series', chapters_sold: 5 },
      ],
    },
  })

  const res = await realService.getUserFinancialTopSeries('u-1', {
    period: 'month',
    year: 2026,
    month: 8,
  })
  assert.equal(res.user.id, 'u-1')
  assert.equal(res.summary.chapters_sold, 5)
  assert.equal(res.top_series.length, 1)
  assert.equal(res.top_series[0].series_name, 'Old Series')
})

// ============================================================
// Empty / robustness
// ============================================================

test('getUserFinancialTopSeries empty data không crash', async () => {
  reset()
  setResponse('GET', '/admin/users/u-1/financials/top-series', {
    payload: {
      success: true,
      data: {
        user: null,
        filter: null,
        summary: null,
        top_series: null,
      },
    },
  })

  const res = await realService.getUserFinancialTopSeries('u-1', { period: 'month' })
  assert.ok(Array.isArray(res.top_series))
  assert.equal(res.top_series.length, 0)
  assert.equal(res.user, null)
  assert.equal(res.summary, null)
  assert.equal(res.filter, null)
})

test('getUserFinancialTopSeries empty top_series array OK', async () => {
  reset()
  setResponse('GET', '/admin/users/u-1/financials/top-series', {
    payload: {
      success: true,
      data: {
        user: { id: 'u-1', full_name: 'Test', role: 'Mangaka' },
        filter: { period: 'month', year: 2026, month: 8 },
        summary: { chapters_sold: 0, series_count: 0 },
        top_series: [],
      },
    },
  })

  const res = await realService.getUserFinancialTopSeries('u-1', { period: 'month' })
  assert.ok(Array.isArray(res.top_series))
  assert.equal(res.top_series.length, 0)
})

// ============================================================
// limit clamp — BE: default 10, max 50
// ============================================================

test('getUserFinancialTopSeries clamp limit tối đa 50 theo BE spec', async () => {
  reset()
  setResponse('GET', '/admin/users/u-1/financials/top-series', topSeriesEnvelope())

  // Truyền 999 → clamp 50.
  await realService.getUserFinancialTopSeries('u-1', { period: 'month', limit: 999 })
  assert.equal(httpCalls[0].config.params.limit, 50)

  // Truyền 0 → clamp 1.
  await realService.getUserFinancialTopSeries('u-1', { period: 'month', limit: 0 })
  assert.equal(httpCalls[1].config.params.limit, 1)

  // Truyền 200 → clamp 50.
  await realService.getUserFinancialTopSeries('u-1', { period: 'month', limit: 200 })
  assert.equal(httpCalls[2].config.params.limit, 50)

  // Truyền đúng 50 → giữ nguyên.
  await realService.getUserFinancialTopSeries('u-1', { period: 'month', limit: 50 })
  assert.equal(httpCalls[3].config.params.limit, 50)

  // Truyền 10 → giữ nguyên.
  await realService.getUserFinancialTopSeries('u-1', { period: 'month', limit: 10 })
  assert.equal(httpCalls[4].config.params.limit, 10)
})

test('getUserFinancialTopSeries KHÔNG gửi limit khi caller không truyền (BE dùng default 10)', async () => {
  reset()
  setResponse('GET', '/admin/users/u-1/financials/top-series', topSeriesEnvelope())

  await realService.getUserFinancialTopSeries('u-1', { period: 'month' })
  const params = httpCalls[0].config.params
  assert.equal(params.limit, undefined)
})

// ============================================================
// platform_fee_vnd — map từng top_series entry
// ============================================================

test('getUserFinancialTopSeries map platform_fee_vnd cho từng top_series entry', async () => {
  reset()
  setResponse('GET', '/admin/users/u-1/financials/top-series', {
    payload: {
      success: true,
      data: {
        user: { id: 'u-1', full_name: 'Test', role: 'Mangaka' },
        filter: { period: 'month', year: 2026, month: 8 },
        summary: { chapters_sold: 2, series_count: 2 },
        top_series: [
          { rank: 1, series_name: 'A', platform_fee_vnd: 5000 },
          { rank: 2, series_name: 'B', platform_fee_vnd: 0 },
        ],
      },
    },
  })

  const res = await realService.getUserFinancialTopSeries('u-1', { period: 'month' })
  assert.equal(res.top_series[0].platform_fee_vnd, 5000)
  assert.equal(res.top_series[1].platform_fee_vnd, 0)
})
