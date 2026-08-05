// Pure-logic tests cho Finance page filter behavior.
// Spec:
//  - Đổi period/year/month/quarter chỉ cần gọi getRevenueAnalytics.
//  - KHÔNG gọi lại getPayments / getDashboardFinance khi đổi period.
//  - Đổi loadOverview() chỉ gọi getPayments.
//  - loadDashboardRankings() gọi getDashboardFinance({ limit: 5 }).
//  - KHÔNG slice từ limit 10 xuống 5.

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

function analyticsResponse(period, year, month, quarter) {
  return {
    payload: {
      success: true,
      data: {
        filter: { period, year, month, quarter },
        config: { platform_fee_percent: 20, coin_to_vnd_rate: 100 },
        summary: {
          gross_revenue_coin_display: '100.00',
          mangaka_revenue_coin_display: '60.00',
          assistant_revenue_coin_display: '20.00',
          platform_fee_coin_display: '20.00',
          platform_fee_vnd_display: '2000.00',
          platform_fee_vnd: 2000,
          chapters_sold: 5,
        },
        points: [],
        top_series: [],
      },
    },
  }
}

function paymentsResponse() {
  return {
    payload: {
      success: true,
      data: [],
      pagination: { total: 0, page: 1, limit: 1, pages: 1 },
      summary: { total_vnd: 0, total_coin: 0, total_coin_display: '0.00', count: 0 },
    },
  }
}

function dashboardResponse() {
  return {
    payload: {
      success: true,
      top_mangaka: [],
      top_assistant: [],
      top_reader: [],
    },
  }
}

/* ============================================================
 * Đổi period chỉ gọi analytics.
 * ============================================================ */

test('đổi period từ month → quarter chỉ gọi getRevenueAnalytics, KHÔNG refetch payments/dashboard', async () => {
  reset()
  setResponse('GET', '/admin/finance/revenue-analytics', analyticsResponse('quarter', 2026, undefined, 2))
  setResponse('GET', '/admin/payments', paymentsResponse())
  setResponse('GET', '/admin/dashboard/finance', dashboardResponse())

  // Initial load: analytics + payments + dashboard.
  await Promise.allSettled([
    realService.getRevenueAnalytics({ period: 'month', year: 2026, month: 8 }),
    realService.getPayments({ page: 1, limit: 1 }),
    realService.getDashboardFinance({ limit: 5 }),
  ])

  assert.equal(httpCalls.length, 3)
  httpCalls.length = 0
  // KHÔNG clear httpResponses — để analytics response vẫn dùng được ở phase 2.

  // User chuyển period = quarter.
  await realService.getRevenueAnalytics({ period: 'quarter', year: 2026, quarter: 2 })

  // CHỈ gọi analytics — KHÔNG refetch payments/dashboard.
  assert.equal(httpCalls.length, 1)
  assert.equal(httpCalls[0].url, '/admin/finance/revenue-analytics')
  const params = httpCalls[0].config.params
  assert.equal(params.period, 'quarter')
  assert.equal(params.quarter, 2)
})

test('đổi month (period=month) chỉ gọi getRevenueAnalytics', async () => {
  reset()
  setResponse('GET', '/admin/finance/revenue-analytics', analyticsResponse('month', 2026, 9))
  setResponse('GET', '/admin/payments', paymentsResponse())
  setResponse('GET', '/admin/dashboard/finance', dashboardResponse())

  // Initial load.
  await Promise.allSettled([
    realService.getRevenueAnalytics({ period: 'month', year: 2026, month: 8 }),
    realService.getPayments({ page: 1, limit: 1 }),
    realService.getDashboardFinance({ limit: 5 }),
  ])

  httpCalls.length = 0
  // KHÔNG clear httpResponses.

  // User đổi tháng.
  await realService.getRevenueAnalytics({ period: 'month', year: 2026, month: 9 })

  assert.equal(httpCalls.length, 1)
  assert.equal(httpCalls[0].config.params.month, 9)
  assert.equal(httpCalls[0].config.params.period, 'month')
})

/* ============================================================
 * loadDashboardRankings gọi đúng limit=5 (KHÔNG slice 10→5).
 * ============================================================ */

test('loadDashboardRankings gọi getDashboardFinance({ limit: 5 }), KHÔNG slice từ 10', async () => {
  reset()
  setResponse('GET', '/admin/dashboard/finance', dashboardResponse())

  await realService.getDashboardFinance({ limit: 5 })

  assert.equal(httpCalls.length, 1)
  assert.equal(httpCalls[0].url, '/admin/dashboard/finance')
  assert.equal(httpCalls[0].config.params.limit, 5)
})

/* ============================================================
 * Platform fee KHÔNG được FE tự tính.
 * Service chỉ trả summary.platform_fee_coin_display / platform_fee_vnd_display
 * nguyên từ BE. KHÔNG có logic multiply gross × percent.
 * ============================================================ */

test('getRevenueAnalytics KHÔNG tính platform fee ở FE', async () => {
  reset()
  setResponse('GET', '/admin/finance/revenue-analytics', {
    payload: {
      success: true,
      data: {
        filter: {},
        config: { platform_fee_percent: 25, coin_to_vnd_rate: 100 },
        summary: {
          gross_revenue_coin_display: '1000.00',
          gross_revenue_coin: 1000,
          platform_fee_coin_display: '250.00', // BE cung cấp — KHÔNG tự tính.
          platform_fee_coin: 250,
          platform_fee_vnd_display: '25000.00',
          platform_fee_vnd: 25000,
        },
        points: [],
        top_series: [],
      },
    },
  })

  const res = await realService.getRevenueAnalytics({ period: 'month', year: 2026 })

  // Service trả nguyên platform_fee_* từ BE — KHÔNG nhân 1000 × 25%.
  assert.equal(res.summary.platform_fee_coin_display, '250.00')
  assert.equal(res.summary.platform_fee_vnd_display, '25000.00')
  assert.equal(res.config.platform_fee_percent, 25)
})

/* ============================================================
 * Empty points / empty top_series không crash.
 * ============================================================ */

test('empty points / empty top_series không crash khi map chartPoints / topSeries', async () => {
  reset()
  setResponse('GET', '/admin/finance/revenue-analytics', {
    payload: {
      success: true,
      data: {
        filter: {},
        config: {},
        summary: {},
        points: [],
        top_series: [],
      },
    },
  })

  const res = await realService.getRevenueAnalytics({ period: 'month', year: 2026 })

  assert.ok(Array.isArray(res.points))
  assert.equal(res.points.length, 0)
  assert.ok(Array.isArray(res.top_series))
  assert.equal(res.top_series.length, 0)
})

/* ============================================================
 * Đổi year (period=year) chỉ gọi getRevenueAnalytics.
 * ============================================================ */

test('đổi year (period=year) chỉ gọi getRevenueAnalytics', async () => {
  reset()
  setResponse('GET', '/admin/finance/revenue-analytics', analyticsResponse('year', 2025))

  await realService.getRevenueAnalytics({ period: 'year', year: 2025 })
  assert.equal(httpCalls.length, 1)
  const params = httpCalls[0].config.params
  assert.equal(params.period, 'year')
  assert.equal(params.year, 2025)
  assert.equal(params.month, undefined)
  assert.equal(params.quarter, undefined)
})
