// Tests cho bankInformation.service.
// Dùng node:test mock để stub ../src/api/http.js hoàn toàn (tránh load axios / import.meta.env).

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

const { bankInformationService } = await import('../src/api/bankInformation.service.js')

// ============================================================
// bankInformationService
// ============================================================

test('bankInformationService.get() gọi GET /profile (không phụ thuộc role)', async () => {
  reset()
  setResponse('GET', '/profile', {
    payload: {
      success: true,
      data: {
        user: {
          bank_info: {
            bank_name: 'Vietcombank',
            account_holder: 'Nguyen Van A',
            account_number_masked: '****1234',
            has_account_number: true,
            has_bank_info: true,
          },
        },
      },
    },
  })

  const mangakaInfo = await bankInformationService.get('mangaka')
  assert.equal(mangakaInfo.bankName, 'Vietcombank')
  assert.equal(mangakaInfo.accountHolder, 'Nguyen Van A')
  assert.equal(mangakaInfo.accountNumberMasked, '****1234')
  assert.equal(mangakaInfo.hasAccountNumber, true)
  assert.equal(mangakaInfo.hasBankInfo, true)

  const assistantInfo = await bankInformationService.get('assistant')
  assert.equal(assistantInfo.bankName, 'Vietcombank')

  // Cả 2 role phải gọi đúng GET /profile, không gọi endpoint theo role.
  assert.equal(httpCalls.length, 2)
  for (const call of httpCalls) {
    assert.equal(call.method, 'GET')
    assert.equal(call.url, '/profile')
  }
})

test('bankInformationService.get() KHÔNG gọi /mangaka/profile hoặc /assistant/profile', async () => {
  reset()
  setResponse('GET', '/profile', {
    payload: { success: true, data: { bank_info: { has_bank_info: false } } },
  })

  await bankInformationService.get('mangaka')
  await bankInformationService.get('assistant')

  for (const call of httpCalls) {
    assert.notEqual(call.url, '/mangaka/profile')
    assert.notEqual(call.url, '/assistant/profile')
    assert.equal(call.url, '/profile')
  }
})

test('bankInformationService.update() gọi PATCH /profile/bank-information', async () => {
  reset()
  setResponse('PATCH', '/profile/bank-information', {
    payload: {
      success: true,
      data: {
        bank_info: {
          bank_name: 'ACB',
          account_holder: 'Tran Thi B',
          account_number_masked: '****5678',
          has_account_number: true,
          has_bank_info: true,
        },
      },
    },
  })

  // Service không nhận role — chỉ nhận payload.
  const updated = await bankInformationService.update({
    current_password: 'secret123',
    bank_name: 'ACB',
    account_holder: 'Tran Thi B',
    bank_account_number: '1234567890',
  })

  assert.equal(updated.bankName, 'ACB')
  assert.equal(updated.accountHolder, 'Tran Thi B')
  assert.equal(updated.accountNumberMasked, '****5678')
  assert.equal(updated.hasBankInfo, true)

  // Chỉ gọi đúng PATCH /profile/bank-information.
  assert.equal(httpCalls.length, 1)
  const call = httpCalls[0]
  assert.equal(call.method, 'PATCH')
  assert.equal(call.url, '/profile/bank-information')
  assert.equal(call.body.current_password, 'secret123')
  assert.equal(call.body.bank_name, 'ACB')
  assert.equal(call.body.account_holder, 'Tran Thi B')
  assert.equal(call.body.bank_account_number, '1234567890')
  // Không gửi role lên BE.
  assert.equal(call.body.role, undefined)
})

test('bankInformationService.update() KHÔNG gọi /mangaka/profile/bank-information hoặc /assistant/profile/bank-information', async () => {
  reset()
  setResponse('PATCH', '/profile/bank-information', {
    payload: { success: true, data: { bank_info: { has_bank_info: true } } },
  })

  await bankInformationService.update({
    current_password: 'p',
    bank_name: 'A',
    account_holder: 'B',
    bank_account_number: '1',
  })
  await bankInformationService.update({
    current_password: 'p',
    bank_name: 'A',
    account_holder: 'B',
    bank_account_number: '1',
  })

  for (const call of httpCalls) {
    assert.notEqual(call.url, '/mangaka/profile/bank-information')
    assert.notEqual(call.url, '/assistant/profile/bank-information')
    assert.equal(call.url, '/profile/bank-information')
  }
})

test('bankInformationService KHÔNG trả full account number về caller', async () => {
  reset()
  setResponse('GET', '/profile', {
    payload: {
      success: true,
      data: {
        bank_info: {
          bank_name: 'ACB',
          account_holder: 'X',
          account_number_masked: '****9999',
          has_account_number: true,
          has_bank_info: true,
        },
      },
    },
  })

  const info = await bankInformationService.get()
  // Service mapBankInfo KHÔNG có field full account number.
  assert.equal(info.accountNumberMasked, '****9999')
  assert.equal(info.fullAccountNumber, undefined)
  assert.equal(info.bank_account_number, undefined)
})

test('bankInformationService.get() xử lý response thiếu bank_info', async () => {
  reset()
  setResponse('GET', '/profile', {
    payload: { success: true, data: { user: { email: 'x@y.com' } } },
  })

  const info = await bankInformationService.get()
  assert.equal(info.hasBankInfo, false)
  assert.equal(info.bankName, '')
  assert.equal(info.accountHolder, '')
})

test('hasBankInfo sau khi lưu ngân hàng thành công = true', async () => {
  reset()
  setResponse('PATCH', '/profile/bank-information', {
    payload: {
      success: true,
      data: {
        bank_info: {
          bank_name: 'Vietcombank',
          account_holder: 'Nguyen Van A',
          account_number_masked: '****1234',
          has_account_number: true,
          has_bank_info: true,
        },
      },
    },
  })

  const updated = await bankInformationService.update({
    current_password: 'pw',
    bank_name: 'Vietcombank',
    account_holder: 'Nguyen Van A',
    bank_account_number: '123456789',
  })

  // Verify contract: bankInfo sau save có hasBankInfo=true.
  assert.equal(updated.hasBankInfo, true)
  assert.equal(updated.hasAccountNumber, true)
  // Mask chứ không phải full.
  assert.equal(updated.accountNumberMasked, '****1234')
})
