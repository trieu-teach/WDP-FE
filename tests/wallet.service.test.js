// Pure-logic tests cho wallet ledger helpers.
// Tái sử dụng helper `pickCoinDisplay` từ `coinFormatter.js` (relative import).
// Logic resolveDirection/isInflow được inline để tránh module alias @/* ngoài Vite.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { pickCoinDisplay } from '../src/utils/coinFormatter.js'

/* ---------- helpers (mirror src/api/wallet.service.js) ---------- */
const LEDGER_TYPES = {
  REVENUE: 'Revenue',
  DEPOSIT: 'Deposit',
  PURCHASE: 'Purchase',
  REFUND: 'Refund',
  WITHDRAWAL: 'Withdrawal',
}

const LEDGER_TYPE_LABELS = {
  [LEDGER_TYPES.REVENUE]: 'Doanh thu',
  [LEDGER_TYPES.DEPOSIT]: 'Nạp Coin',
  [LEDGER_TYPES.PURCHASE]: 'Mua chapter',
  [LEDGER_TYPES.REFUND]: 'Hoàn tiền',
  [LEDGER_TYPES.WITHDRAWAL]: 'Rút Coin',
}

function ledgerTypeLabel(type) {
  return LEDGER_TYPE_LABELS[type] ?? type ?? '—'
}

function resolveDirection(entry) {
  if (!entry || typeof entry !== 'object') return null
  if (entry.direction === 'in' || entry.direction === 'out') return entry.direction
  if (entry.type === LEDGER_TYPES.REVENUE) return 'in'
  if (entry.type === LEDGER_TYPES.REFUND) return 'in'
  if (entry.type === LEDGER_TYPES.DEPOSIT) return 'in'
  if (entry.type === LEDGER_TYPES.PURCHASE) return 'out'
  if (entry.type === LEDGER_TYPES.WITHDRAWAL) {
    if (entry.status === 'rejected' || entry.status === 'cancelled' || entry.status === 'refunded') return 'in'
    return 'out'
  }
  return null
}

function isInflow(type, direction, status) {
  if (direction === 'in') return true
  if (direction === 'out') return false
  if (type === LEDGER_TYPES.REVENUE) return true
  if (type === LEDGER_TYPES.REFUND) return true
  if (type === LEDGER_TYPES.DEPOSIT) return true
  if (type === LEDGER_TYPES.PURCHASE) return false
  if (type === LEDGER_TYPES.WITHDRAWAL) {
    if (status === 'rejected' || status === 'cancelled' || status === 'refunded') return true
    return false
  }
  return false
}

/* ---------- tests ---------- */
test('LEDGER_TYPES includes Withdrawal', () => {
  assert.equal(LEDGER_TYPES.WITHDRAWAL, 'Withdrawal')
})

test('ledgerTypeLabel maps Withdrawal to "Rút Coin"', () => {
  assert.equal(ledgerTypeLabel(LEDGER_TYPES.WITHDRAWAL), 'Rút Coin')
})

test('resolveDirection prefers BE-provided direction over inferred one', () => {
  assert.equal(resolveDirection({ type: 'Withdrawal', direction: 'in' }), 'in')
  assert.equal(resolveDirection({ type: 'Withdrawal', direction: 'out' }), 'out')
  assert.equal(resolveDirection({ type: 'Revenue' }), 'in')
  assert.equal(resolveDirection({ type: 'Purchase' }), 'out')
  assert.equal(resolveDirection({ type: 'Deposit' }), 'in')
  assert.equal(resolveDirection({ type: 'Refund' }), 'in')
})

test('resolveDirection handles Withdrawal status edge-cases', () => {
  assert.equal(resolveDirection({ type: 'Withdrawal', status: 'pending' }), 'out')
  assert.equal(resolveDirection({ type: 'Withdrawal', status: 'approved' }), 'out')
  assert.equal(resolveDirection({ type: 'Withdrawal', status: 'completed' }), 'out')
  assert.equal(resolveDirection({ type: 'Withdrawal', status: 'rejected' }), 'in')
  assert.equal(resolveDirection({ type: 'Withdrawal', status: 'cancelled' }), 'in')
  assert.equal(resolveDirection({ type: 'Withdrawal', status: 'refunded' }), 'in')
})

test('isInflow respects explicit direction first', () => {
  assert.equal(isInflow('Withdrawal', 'in'), true)
  assert.equal(isInflow('Withdrawal', 'out'), false)
})

test('isInflow fallback infers from type when direction missing', () => {
  assert.equal(isInflow('Revenue'), true)
  assert.equal(isInflow('Purchase'), false)
  assert.equal(isInflow('Deposit'), true)
  assert.equal(isInflow('Refund'), true)
})

test('isInflow considers withdrawal status', () => {
  assert.equal(isInflow('Withdrawal', null, 'rejected'), true)
  assert.equal(isInflow('Withdrawal', null, 'pending'), false)
})

/* ---------- ledger entry mapper (regression: không hiển thị 0.00 khi có coin_amount_coin) ---------- */
test('ledger mapper ưu tiên coin_amount_coin_display, không mặc định "0.00"', () => {
  // Reproduce bug spec: ledger có coin_amount_coin (number) → display phải lấy số đó,
  // KHÔNG phải raw coin_amount, và KHÔNG mặc định "0.00".
  const raw = {
    type: 'Revenue',
    direction: 'in',
    coin_amount_coin_display: '5.00',
    coin_amount_coin: 5,
    coin_amount: 500, // raw CoinUnit
  }
  const r = pickCoinDisplay(raw, [
    'coin_amount_coin_display',
    'coin_amount_coin',
    'coin_display',
    'coin_amount',
  ])
  assert.equal(r.display, '5.00')
  assert.equal(r.number, 5)
})

test('ledger mapper fallback legacy coin_display khi không có *_display', () => {
  const raw = { type: 'Deposit', coin_display: '10.00', coin_amount: 1000 }
  const r = pickCoinDisplay(raw, [
    'coin_amount_coin_display',
    'coin_amount_coin',
    'coin_display',
    'coin_amount',
  ])
  assert.equal(r.display, '10.00')
  assert.equal(r.number, 10)
})
