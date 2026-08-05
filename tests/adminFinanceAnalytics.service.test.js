// Tests cho getRevenueAnalytics trong real.service.js.
// Verify:
//  - Service KHÔNG dùng generic unwrap() ra mảng — trả nguyên root envelope.
//  - Service đọc đúng envelope { success, data } của BE (filter/config/summary/points/top_series).
//  - Service gửi đúng period/year/month/quarter theo filter.
//  - Service clamp limit 1..50 (BE: default 10, max 50) — KHÔNG phải 200.
//  - Map đúng config.platform_fee_percent vào label (KHÔNG hard-code "20%" ở service).
//  - Empty points / empty top_series không crash.
//  - Mangaka/Assistant/platform fee map đúng từ summary.
//  - Fallback vẫn đọc được payload không có envelope (backward compat).

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

function analyticsEnvelope(overrides = {}) {
  return {
    payload: {
      success: true,
      data: {
        filter: { period: 'month', year: 2026, month: 8, limit: 10 },
        config: { platform_fee_percent: 20, coin_to_vnd_rate: 100 },
        summary: {
          gross_revenue_coin_display: '1000.00',
          mangaka_revenue_coin_display: '500.00',
          assistant_revenue_coin_display: '300.00',
          platform_fee_coin_display: '200.00',
          platform_fee_vnd_display: '20000.00',
          platform_fee_vnd: 20000,
          chapters_sold: 25,
        },
        points: [],
        top_series: [],
        ...overrides,
      },
    },
  }
}

// ============================================================
// getRevenueAnalytics — params
// ============================================================

test('getRevenueAnalytics gửi đúng period/year/month cho month', async () => {
  reset()
  setResponse('GET', '/admin/finance/revenue-analytics', analyticsEnvelope())

  await realService.getRevenueAnalytics({ period: 'month', year: 2026, month: 8 })

  assert.equal(httpCalls.length, 1)
  const call = httpCalls[0]
  assert.equal(call.url, '/admin/finance/revenue-analytics')
  const params = call.config?.params ?? {}
  assert.equal(params.period, 'month')
  assert.equal(params.year, 2026)
  assert.equal(params.month, 8)
  assert.equal(params.quarter, undefined)
})

test('getRevenueAnalytics gửi đúng quarter cho period=quarter', async () => {
  reset()
  setResponse('GET', '/admin/finance/revenue-analytics', analyticsEnvelope({
    filter: { period: 'quarter', year: 2026, quarter: 2 },
  }))

  await realService.getRevenueAnalytics({ period: 'quarter', year: 2026, quarter: 2 })

  const params = httpCalls[0].config?.params ?? {}
  assert.equal(params.period, 'quarter')
  assert.equal(params.year, 2026)
  assert.equal(params.quarter, 2)
  assert.equal(params.month, undefined)
})

test('getRevenueAnalytics KHÔNG gửi month khi period=year', async () => {
  reset()
  setResponse('GET', '/admin/finance/revenue-analytics', analyticsEnvelope({
    filter: { period: 'year', year: 2026 },
  }))

  await realService.getRevenueAnalytics({ period: 'year', year: 2026 })

  const params = httpCalls[0].config?.params ?? {}
  assert.equal(params.period, 'year')
  assert.equal(params.year, 2026)
  assert.equal(params.month, undefined)
  assert.equal(params.quarter, undefined)
})

test('getRevenueAnalytics default period=month khi truyền invalid', async () => {
  reset()
  setResponse('GET', '/admin/finance/revenue-analytics', analyticsEnvelope({ filter: {} }))

  await realService.getRevenueAnalytics({ period: 'invalid', year: 2026 })

  const params = httpCalls[0].config?.params ?? {}
  assert.equal(params.period, 'month')
})

// ============================================================
// getRevenueAnalytics — envelope { success, data } của BE
// ============================================================

test('getRevenueAnalytics đọc đúng envelope { success, data } — KHÔNG trả null khi BE dùng envelope', async () => {
  reset()
  setResponse('GET', '/admin/finance/revenue-analytics', {
    payload: {
      success: true,
      data: {
        filter: { period: 'month', year: 2026, month: 8, limit: 10 },
        config: { platform_fee_percent: 15.5, coin_to_vnd_rate: 100 },
        summary: {
          gross_revenue_coin_display: '5000.00',
          gross_revenue_coin: 5000,
          mangaka_revenue_coin_display: '3500.00',
          mangaka_revenue_coin: 3500,
          assistant_revenue_coin_display: '500.00',
          assistant_revenue_coin: 500,
          platform_fee_coin_display: '1000.00',
          platform_fee_coin: 1000,
          platform_fee_vnd_display: '100000.00',
          platform_fee_vnd: 100000,
          chapters_sold: 100,
        },
        points: [
          {
            label: 'T1',
            date: '2026-01-01',
            gross_revenue_coin_display: '1000.00',
            mangaka_revenue_coin_display: '700.00',
            assistant_revenue_coin_display: '100.00',
            platform_fee_coin_display: '200.00',
            platform_fee_vnd_display: '20000.00',
            platform_fee_vnd: 20000,
            chapters_sold: 20,
          },
        ],
        top_series: [
          {
            rank: 1,
            series_id: 's1',
            series_name: 'Top Series 1',
            thumbnail: '/uploads/series-1.jpg',
            author_name: 'Author 1',
            chapters_sold: 12,
            gross_revenue_coin_display: '600.00',
            creator_revenue_coin_display: '480.00',
            platform_fee_coin_display: '120.00',
            platform_fee_vnd_display: '12000.00',
            platform_fee_vnd: 12000,
          },
        ],
      },
    },
  })

  const res = await realService.getRevenueAnalytics({
    period: 'month',
    year: 2026,
    month: 8,
  })

  // Service map đúng từ `data` envelope — KHÔNG null.
  assert.notEqual(res.filter, null)
  assert.notEqual(res.config, null)
  assert.notEqual(res.summary, null)
  assert.equal(res.filter.period, 'month')
  assert.equal(res.config.platform_fee_percent, 15.5)
  assert.equal(res.summary.gross_revenue_coin_display, '5000.00')
  assert.equal(res.summary.platform_fee_coin_display, '1000.00')
  assert.equal(res.summary.platform_fee_vnd_display, '100000.00')
  assert.equal(res.summary.platform_fee_vnd, 100000)
  assert.equal(res.points.length, 1)
  assert.equal(res.points[0].platform_fee_vnd, 20000)
  assert.equal(res.top_series.length, 1)
  assert.equal(res.top_series[0].series_id, 's1')
  assert.equal(res.top_series[0].rank, 1)
  assert.equal(res.top_series[0].platform_fee_vnd, 12000)
})

test('getRevenueAnalytics KHÔNG map filter/config/summary từ root khi BE wrap envelope', async () => {
  // Đảm bảo service KHÔNG nhầm: filter/config/summary nằm dưới `data`, không ở root.
  reset()
  setResponse('GET', '/admin/finance/revenue-analytics', {
    payload: {
      success: true,
      // Không có root filter/config — chỉ có trong data.
      data: {
        filter: { period: 'month', year: 2026, month: 8, limit: 10 },
        config: { platform_fee_percent: 10 },
        summary: { chapters_sold: 5 },
        points: [],
        top_series: [],
      },
    },
  })

  const res = await realService.getRevenueAnalytics({ period: 'month', year: 2026, month: 8 })
  assert.equal(res.filter.period, 'month')
  assert.equal(res.config.platform_fee_percent, 10)
  assert.equal(res.summary.chapters_sold, 5)
})

test('getRevenueAnalytics fallback vẫn đọc được payload KHÔNG có envelope (backward compat)', async () => {
  // Nếu BE trả root thẳng (không wrap) → service vẫn đọc được.
  reset()
  setResponse('GET', '/admin/finance/revenue-analytics', {
    payload: {
      filter: { period: 'month', year: 2026, month: 8, limit: 10 },
      config: { platform_fee_percent: 25 },
      summary: { chapters_sold: 3 },
      points: [],
      top_series: [],
    },
  })

  const res = await realService.getRevenueAnalytics({ period: 'month', year: 2026, month: 8 })
  assert.equal(res.filter.period, 'month')
  assert.equal(res.config.platform_fee_percent, 25)
  assert.equal(res.summary.chapters_sold, 3)
})

test('getRevenueAnalytics KHÔNG dùng generic unwrap() — không trả root success field', async () => {
  reset()
  setResponse('GET', '/admin/finance/revenue-analytics', analyticsEnvelope())

  const res = await realService.getRevenueAnalytics({ period: 'month', year: 2026 })
  // Service không trả envelope nguyên — chỉ trả shape đã map.
  assert.equal(res.success, undefined)
  assert.equal(res.data, undefined)
  assert.equal(typeof res.filter, 'object')
  assert.equal(typeof res.config, 'object')
  assert.equal(typeof res.summary, 'object')
})

// ============================================================
// Empty / robustness
// ============================================================

test('getRevenueAnalytics empty data không crash', async () => {
  reset()
  setResponse('GET', '/admin/finance/revenue-analytics', {
    payload: {
      success: true,
      data: {
        filter: null,
        config: null,
        summary: null,
        points: null,
        top_series: null,
      },
    },
  })

  const res = await realService.getRevenueAnalytics({ period: 'month', year: 2026 })
  assert.equal(res.filter, null)
  assert.equal(res.config, null)
  assert.equal(res.summary, null)
  assert.ok(Array.isArray(res.points))
  assert.equal(res.points.length, 0)
  assert.ok(Array.isArray(res.top_series))
  assert.equal(res.top_series.length, 0)
})

test('getRevenueAnalytics empty data KHÔNG phải array không crash (summary null)', async () => {
  reset()
  setResponse('GET', '/admin/finance/revenue-analytics', {
    payload: { success: true, data: {} },
  })

  const res = await realService.getRevenueAnalytics({ period: 'month', year: 2026 })
  assert.ok(Array.isArray(res.points))
  assert.ok(Array.isArray(res.top_series))
  assert.equal(res.points.length, 0)
  assert.equal(res.top_series.length, 0)
})

// ============================================================
// limit clamp — BE spec: default 10, max 50
// ============================================================

test('getRevenueAnalytics clamp limit tối đa 50 (không phải 200) theo BE spec', async () => {
  reset()
  setResponse('GET', '/admin/finance/revenue-analytics', analyticsEnvelope())

  // Truyền 500 → clamp 50.
  await realService.getRevenueAnalytics({ period: 'month', year: 2026, limit: 500 })
  assert.equal(httpCalls[0].config.params.limit, 50)

  // Truyền 0 → clamp 1.
  await realService.getRevenueAnalytics({ period: 'month', year: 2026, limit: 0 })
  assert.equal(httpCalls[1].config.params.limit, 1)

  // Truyền đúng 50 → giữ nguyên.
  await realService.getRevenueAnalytics({ period: 'month', year: 2026, limit: 50 })
  assert.equal(httpCalls[2].config.params.limit, 50)

  // Truyền 25 → giữ nguyên.
  await realService.getRevenueAnalytics({ period: 'month', year: 2026, limit: 25 })
  assert.equal(httpCalls[3].config.params.limit, 25)

  // Truyền 100 → clamp 50 (KHÔNG phải 200).
  await realService.getRevenueAnalytics({ period: 'month', year: 2026, limit: 100 })
  assert.equal(httpCalls[4].config.params.limit, 50)
})

test('getRevenueAnalytics KHÔNG gửi limit khi caller không truyền (để BE dùng default 10)', async () => {
  reset()
  setResponse('GET', '/admin/finance/revenue-analytics', analyticsEnvelope())

  await realService.getRevenueAnalytics({ period: 'month', year: 2026 })
  const params = httpCalls[0].config.params
  assert.equal(params.limit, undefined)
})

// ============================================================
// platform_fee_vnd — hiển thị đúng từ BE
// ============================================================

test('getRevenueAnalytics map platform_fee_vnd từ summary nguyên vẹn (FE không tự tính)', async () => {
  reset()
  setResponse('GET', '/admin/finance/revenue-analytics', {
    payload: {
      success: true,
      data: {
        filter: { period: 'month', year: 2026, month: 8 },
        config: { platform_fee_percent: 20, coin_to_vnd_rate: 100 },
        summary: {
          platform_fee_coin_display: '250.00',
          platform_fee_coin: 250,
          platform_fee_vnd_display: '25000.00',
          platform_fee_vnd: 25000,
        },
        points: [],
        top_series: [],
      },
    },
  })

  const res = await realService.getRevenueAnalytics({ period: 'month', year: 2026, month: 8 })
  // Map nguyên vẹn từ BE — KHÔNG tự nhân gross × percent.
  assert.equal(res.summary.platform_fee_vnd, 25000)
  assert.equal(res.summary.platform_fee_vnd_display, '25000.00')
  assert.equal(res.summary.platform_fee_coin, 250)
  assert.equal(res.config.platform_fee_percent, 20)
})

test('getRevenueAnalytics map platform_fee_vnd trên từng point', async () => {
  reset()
  setResponse('GET', '/admin/finance/revenue-analytics', {
    payload: {
      success: true,
      data: {
        filter: {},
        config: {},
        summary: {},
        points: [
          { label: 'T1', platform_fee_vnd: 10000, platform_fee_coin: 100 },
          { label: 'T2', platform_fee_vnd: 0, platform_fee_coin: 0 },
        ],
        top_series: [],
      },
    },
  })

  const res = await realService.getRevenueAnalytics({ period: 'year', year: 2026 })
  assert.equal(res.points[0].platform_fee_vnd, 10000)
  assert.equal(res.points[1].platform_fee_vnd, 0)
})

test('getRevenueAnalytics map platform_fee_vnd trên từng top_series', async () => {
  reset()
  setResponse('GET', '/admin/finance/revenue-analytics', {
    payload: {
      success: true,
      data: {
        filter: {},
        config: {},
        summary: {},
        points: [],
        top_series: [
          { rank: 1, series_name: 'A', platform_fee_vnd: 5000, platform_fee_coin: 50 },
          { rank: 2, series_name: 'B', platform_fee_vnd: 0, platform_fee_coin: 0 },
        ],
      },
    },
  })

  const res = await realService.getRevenueAnalytics({ period: 'year', year: 2026 })
  assert.equal(res.top_series[0].platform_fee_vnd, 5000)
  assert.equal(res.top_series[1].platform_fee_vnd, 0)
})
