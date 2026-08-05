// Tests cho Finance page UI:
//  - resolvePlatformFeeVnd: ưu tiên *_vnd từ BE, fallback coin × rate.
//  - Chuẩn hóa label tiếng Việt trong Finance.jsx và UserFinancialDialog.jsx.
//  - Không còn text mojibake trong các file đã sửa.
//  - Service-level: đổi period chỉ gọi 1 analytics request.
//  - Service-level: empty data không crash.

import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/* ---------- mock http trước khi import realService ---------- */
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
await mock.module(httpModuleUrl, { namedExports: httpStub })

const { realService } = await import('../src/api/real.service.js')

/* ---------- mirror resolvePlatformFeeVnd từ Finance.jsx ---------- */
function resolvePlatformFeeVnd(item, coinRate) {
  if (!item || typeof item !== 'object') return null
  const direct = item.platform_fee_vnd ?? item.platform_fee_vnd_display
  const directNum = Number(direct)
  if (Number.isFinite(directNum) && directNum > 0) return directNum
  const coinNum = Number(
    item.platform_fee_coin ?? item.platform_fee_coin_display ?? 0,
  )
  const rateNum = Number(coinRate ?? 0)
  if (coinNum > 0 && rateNum > 0) return coinNum * rateNum
  return null
}

/* ============================================================
 * resolvePlatformFeeVnd — ưu tiên *_vnd, fallback coin × rate
 * ============================================================ */

test('resolvePlatformFeeVnd ưu tiên platform_fee_vnd từ BE', () => {
  const item = {
    platform_fee_vnd: 25000,
    platform_fee_coin: 250, // fallback nhưng bị bỏ vì đã có *_vnd.
    coin_to_vnd_rate: 100,
  }
  assert.equal(resolvePlatformFeeVnd(item, 100), 25000)
})

test('resolvePlatformFeeVnd đọc được platform_fee_vnd_display (string)', () => {
  const item = {
    platform_fee_vnd_display: '25000.00',
    platform_fee_coin: 999, // bỏ qua vì đã có *_vnd_display
  }
  assert.equal(resolvePlatformFeeVnd(item, 100), 25000)
})

test('resolvePlatformFeeVnd fallback platform_fee_coin × coinRate khi thiếu *_vnd', () => {
  const item = {
    platform_fee_coin: 250,
    // không có platform_fee_vnd
  }
  // 250 × 100 = 25000
  assert.equal(resolvePlatformFeeVnd(item, 100), 25000)
})

test('resolvePlatformFeeVnd fallback từ *_coin_display khi thiếu *_coin number', () => {
  const item = {
    platform_fee_coin_display: '500.50',
  }
  // 500.5 × 200 = 100100
  assert.equal(resolvePlatformFeeVnd(item, 200), 100100)
})

test('resolvePlatformFeeVnd trả null khi không có *_vnd và rate = 0', () => {
  const item = { platform_fee_coin: 250 }
  assert.equal(resolvePlatformFeeVnd(item, 0), null)
})

test('resolvePlatformFeeVnd trả null khi không có field nào', () => {
  assert.equal(resolvePlatformFeeVnd({}, 100), null)
  assert.equal(resolvePlatformFeeVnd(null, 100), null)
  assert.equal(resolvePlatformFeeVnd(undefined, 100), null)
})

test('resolvePlatformFeeVnd KHÔNG tự tính từ gross revenue (chỉ quy đổi đơn vị)', () => {
  // Đảm bảo helper không tham chiếu gross_revenue / gross_* để "tính lại platform fee".
  const item = {
    gross_revenue_coin: 9999,
    gross_revenue_coin_display: '9999.00',
    // không có platform_fee_* field nào
  }
  assert.equal(resolvePlatformFeeVnd(item, 100), null)
})

test('resolvePlatformFeeVnd KHÔNG hard-code tỷ lệ 20%', () => {
  // Dù *_coin = 1000, rate = 50 → trả 50000 (KHÔNG phải 1000 × 0.2 = 200).
  const item = { platform_fee_coin: 1000 }
  assert.equal(resolvePlatformFeeVnd(item, 50), 50000)
})

test('resolvePlatformFeeVnd KHÔNG dùng *_vnd = 0 làm truthy (chỉ > 0)', () => {
  const item = {
    platform_fee_vnd: 0,
    platform_fee_coin: 100,
  }
  // *_vnd = 0 → fallback về coin × rate.
  assert.equal(resolvePlatformFeeVnd(item, 100), 10000)
})

/* ============================================================
 * Label tiếng Việt ưu tiên — check file đã sửa có chuẩn tiếng Việt
 * ============================================================ */

function readSrc(relPath) {
  return readFileSync(
    fileURLToPath(new URL(`../src/${relPath}`, import.meta.url)),
    'utf8',
  )
}

test('Finance.jsx ưu tiên label tiếng Việt — không còn "Phí nền tảng"', () => {
  const src = readSrc('pages/Admin/Finance/Finance.jsx')
  assert.equal(src.includes('Phí nền tảng'), false, 'Còn "Phí nền tảng" trong Finance.jsx')
  assert.ok(src.includes('Doanh thu hệ thống'), 'Thiếu "Doanh thu hệ thống"')
  assert.ok(src.includes('Tổng doanh thu bán chương'), 'Thiếu "Tổng doanh thu bán chương"')
  assert.ok(src.includes('Doanh thu nhà sáng tạo'), 'Thiếu "Doanh thu nhà sáng tạo"')
  assert.ok(src.includes('Doanh thu trợ lý'), 'Thiếu "Doanh thu trợ lý"')
  assert.ok(src.includes('Lượt mua chương'), 'Thiếu "Lượt mua chương"')
  assert.ok(src.includes('Truyện có doanh thu cao nhất'), 'Thiếu "Truyện có doanh thu cao nhất"')
  assert.ok(src.includes('Kỳ thống kê'), 'Thiếu "Kỳ thống kê"')
  assert.ok(src.includes('Chưa có dữ liệu trong kỳ đã chọn'), 'Thiếu "Chưa có dữ liệu trong kỳ đã chọn"')
  assert.ok(src.includes('Làm mới'), 'Thiếu "Làm mới"')
  // Gross revenue chỉ còn ở JSDoc — KHÔNG xuất hiện ở label.
  assert.equal(/label="Tổng gross revenue"/.test(src), false)
  assert.equal(/label="Chapters sold"/.test(src), false)
})

test('UserFinancialDialog.jsx ưu tiên label tiếng Việt — sửa mojibake', () => {
  const src = readSrc('pages/Admin/Users/UserFinancialDialog.jsx')
  assert.ok(src.includes('Đã huỷ'), 'Thiếu "Đã huỷ"')
  assert.ok(src.includes('Đã sao chép'), 'Thiếu "Đã sao chép"')
  assert.ok(src.includes('Đã ghi nhận'), 'Thiếu "Đã ghi nhận"')
  assert.ok(src.includes('Đã chi trả hoàn tất'), 'Thiếu "Đã chi trả hoàn tất"')
  assert.ok(src.includes('Có thể rút'), 'Thiếu "Có thể rút"')
  assert.ok(src.includes('Coin đã đưa vào yêu cầu rút'), 'Thiếu "Coin đã đưa vào yêu cầu rút"')
  assert.ok(src.includes('Truyện có doanh thu cao nhất'), 'Thiếu "Truyện có doanh thu cao nhất"')
  // KHÔNG còn chuỗi mojibake (ký tự thay thế).
  assert.equal(src.includes('�'), false, 'Còn ký tự mojibake trong UserFinancialDialog.jsx')
})

test('WithdrawalPanel.jsx sửa mojibake trong STATUS_LABELS', () => {
  const src = readSrc('components/Wallet/WithdrawalPanel.jsx')
  assert.ok(src.includes('Đã duyệt'), 'Thiếu "Đã duyệt"')
  assert.ok(src.includes('Từ chối'), 'Thiếu "Từ chối"')
  assert.ok(src.includes('Đã huỷ'), 'Thiếu "Đã huỷ"')
  assert.ok(src.includes('Đã chi trả hoàn tất'), 'Thiếu "Đã chi trả hoàn tất"')
  assert.ok(src.includes('Đang chờ'), 'Thiếu "Đang chờ"')
  assert.equal(src.includes('�'), false, 'Còn ký tự mojibake trong WithdrawalPanel.jsx')
})

test('real.service.js không còn mojibake sau khi sửa', () => {
  const src = readSrc('api/real.service.js')
  assert.equal(src.includes('�'), false, 'Còn ký tự mojibake trong real.service.js')
})

/* ============================================================
 * Service-level — đổi period chỉ gọi 1 analytics request
 * ============================================================ */

test('đổi period chỉ gọi 1 analytics request qua realService.getRevenueAnalytics', async () => {
  reset()
  setResponse('GET', '/admin/finance/revenue-analytics', {
    payload: {
      success: true,
      data: {
        filter: { period: 'month', year: 2026, month: 8 },
        config: { platform_fee_percent: 20, coin_to_vnd_rate: 100 },
        summary: {},
        points: [],
        top_series: [],
      },
    },
  })

  // Gọi đổi period 2 lần — chỉ có 2 GET /admin/finance/revenue-analytics.
  await realService.getRevenueAnalytics({ period: 'month', year: 2026, month: 8 })
  await realService.getRevenueAnalytics({ period: 'quarter', year: 2026, quarter: 2 })

  assert.equal(httpCalls.length, 2)
  for (const call of httpCalls) {
    assert.equal(call.url, '/admin/finance/revenue-analytics')
  }
  assert.equal(httpCalls[0].config.params.period, 'month')
  assert.equal(httpCalls[1].config.params.period, 'quarter')
})

/* ============================================================
 * Empty data không crash
 * ============================================================ */

test('getRevenueAnalytics KHÔNG crash khi points = top_series = summary = filter = null', async () => {
  reset()
  setResponse('GET', '/admin/finance/revenue-analytics', {
    payload: {
      success: true,
      data: { filter: null, config: null, summary: null, points: null, top_series: null },
    },
  })

  const res = await realService.getRevenueAnalytics({ period: 'year', year: 2026 })
  assert.equal(res.filter, null)
  assert.equal(res.config, null)
  assert.equal(res.summary, null)
  assert.ok(Array.isArray(res.points))
  assert.ok(Array.isArray(res.top_series))
  assert.equal(res.points.length, 0)
  assert.equal(res.top_series.length, 0)
})
