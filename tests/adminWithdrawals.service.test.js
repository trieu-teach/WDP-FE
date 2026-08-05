// Tests cho listAdminWithdrawals trong real.service.js.
// Verify:
//  - Service giữ nguyên envelope { data, pagination, stats } từ BE.
//    và trả về { items, pagination, stats, success } cho component.
//  - KHÔNG gửi query `search` lên BE.
//  - Pagination/stats từ BE được truyền nguyên vẹn cho component.

import { test, mock } from 'node:test'
import assert from 'node:assert/strict'

// ---------- Mock http module ----------
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
  patch: (url, body, config) => {
    httpCalls.push({ method: 'PATCH', url, body, config })
    const key = `PATCH ${url}`
    const res = httpResponses.get(key)
    if (!res) {
      throw new Error(`No mock response for ${key}`)
    }
    return Promise.resolve(res.payload)
  },
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

// ============================================================
// listAdminWithdrawals
// ============================================================

test('listAdminWithdrawals giữ nguyên envelope từ BE và trả { items, pagination, stats, success }', async () => {
  reset()
  setResponse('GET', '/withdrawals/admin/all', {
    payload: {
      success: true,
      data: [
        { _id: 'w1', status: 'pending', coin_amount_coin_display: '10.00' },
        { _id: 'w2', status: 'approved', coin_amount_coin_display: '20.00' },
      ],
      pagination: { total: 2, page: 1, limit: 20, pages: 1 },
      stats: {
        pending_count: 1,
        pending_coin: 10,
        approved_count: 1,
        approved_coin: 20,
        completed_count: 0,
        completed_coin: 0,
        rejected_count: 0,
        rejected_coin: 0,
        cancelled_count: 0,
        cancelled_coin: 0,
      },
    },
  })

  const res = await realService.listAdminWithdrawals({ page: 1, limit: 20 })

  // Service giữ nguyên envelope — trả về { items, pagination, stats, success }.
  assert.ok(res, 'response must exist')
  assert.equal(res.success, true)
  assert.ok(Array.isArray(res.items), 'items phải là array')
  assert.equal(res.items.length, 2)
  assert.equal(res.items[0]._id, 'w1')
  assert.deepEqual(res.pagination, { total: 2, page: 1, limit: 20, pages: 1 })
  assert.ok(res.stats, 'stats phải được giữ')
  assert.equal(res.stats.pending_count, 1)
  assert.equal(res.stats.approved_count, 1)
  // Service KHÔNG được trả summary thay cho stats.
  assert.equal(res.summary, undefined)
})

test('listAdminWithdrawals KHÔNG gửi query search lên BE', async () => {
  reset()
  setResponse('GET', '/withdrawals/admin/all', {
    payload: { success: true, data: [], pagination: { total: 0, page: 1, limit: 20, pages: 1 }, stats: {} },
  })

  // Caller có thể vô tình truyền search — service phải IGNORE.
  await realService.listAdminWithdrawals({
    status: 'pending',
    page: 1,
    limit: 20,
    search: 'foo bar',
  })

  assert.equal(httpCalls.length, 1)
  const call = httpCalls[0]
  assert.equal(call.url, '/withdrawals/admin/all')
  const params = call.config?.params ?? {}
  assert.equal(params.search, undefined, 'KHÔNG được gửi search')
  assert.equal(params.status, 'pending')
  assert.equal(params.page, 1)
  assert.equal(params.limit, 20)
})

test('listAdminWithdrawals truyền status, page, limit đúng theo BE spec', async () => {
  reset()
  setResponse('GET', '/withdrawals/admin/all', {
    payload: { success: true, data: [], pagination: { total: 0, page: 2, limit: 10, pages: 1 }, stats: {} },
  })

  await realService.listAdminWithdrawals({
    status: 'approved',
    page: 2,
    limit: 10,
  })

  const params = httpCalls[0].config?.params ?? {}
  assert.equal(params.status, 'approved')
  assert.equal(params.page, 2)
  assert.equal(params.limit, 10)
})

test('listAdminWithdrawals default page=1, limit=20 khi không truyền', async () => {
  reset()
  setResponse('GET', '/withdrawals/admin/all', {
    payload: { success: true, data: [], pagination: null, stats: null },
  })

  await realService.listAdminWithdrawals()

  const params = httpCalls[0].config?.params ?? {}
  assert.equal(params.page, 1)
  assert.equal(params.limit, 20)
  // Không gửi status khi không filter.
  assert.equal(params.status, undefined)
})

test('listAdminWithdrawals fallback items = [] khi BE response không có data', async () => {
  reset()
  setResponse('GET', '/withdrawals/admin/all', {
    payload: { success: true, pagination: { total: 0, page: 1, limit: 20, pages: 1 }, stats: {} },
  })

  const res = await realService.listAdminWithdrawals()
  assert.ok(Array.isArray(res.items))
  assert.equal(res.items.length, 0)
})

// ============================================================
// Admin actions vẫn hoạt động (smoke test)
// ============================================================

test('approveWithdrawal gọi PATCH /withdrawals/admin/:id/approve', async () => {
  reset()
  setResponse('PATCH', '/withdrawals/admin/w1/approve', {
    payload: { success: true, data: { status: 'approved' } },
  })

  await realService.approveWithdrawal('w1', { admin_note: 'OK' })
  const call = httpCalls[0]
  assert.equal(call.url, '/withdrawals/admin/w1/approve')
  assert.equal(call.body?.admin_note, 'OK')
})

test('rejectWithdrawal gọi PATCH /withdrawals/admin/:id/reject', async () => {
  reset()
  setResponse('PATCH', '/withdrawals/admin/w1/reject', {
    payload: { success: true, data: { status: 'rejected' } },
  })

  await realService.rejectWithdrawal('w1', { admin_note: 'no' })
  const call = httpCalls[0]
  assert.equal(call.url, '/withdrawals/admin/w1/reject')
  assert.equal(call.body?.admin_note, 'no')
})

test('completeWithdrawal gọi PATCH /withdrawals/admin/:id/complete', async () => {
  reset()
  setResponse('PATCH', '/withdrawals/admin/w1/complete', {
    payload: { success: true, data: { status: 'completed' } },
  })

  await realService.completeWithdrawal('w1', {})
  const call = httpCalls[0]
  assert.equal(call.url, '/withdrawals/admin/w1/complete')
})
