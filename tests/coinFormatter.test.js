// Lightweight pure-logic tests cho display helpers + wallet mapper.
// Không cần test runner — dùng node:test có sẵn từ Node 18+.
//
//   node --test tests/

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  formatCoinString,
  getByPath,
  parseCoinString,
  pickCoinDisplay,
  pickVndDisplay,
} from '../src/utils/coinFormatter.js'

/* ---------- parseCoinString ---------- */
test('parseCoinString parses "2.40" preserving precision', () => {
  assert.equal(parseCoinString('2.40'), 2.4)
  assert.equal(parseCoinString('0.00'), 0)
  assert.equal(parseCoinString(125.5), 125.5)
})

test('parseCoinString returns fallback on null/NaN', () => {
  assert.equal(parseCoinString(null), 0)
  assert.equal(parseCoinString(undefined), 0)
  assert.equal(parseCoinString('abc'), 0)
  assert.equal(parseCoinString('not a number'), 0)
})

/* ---------- getByPath ---------- */
test('getByPath reads nested object via dot path', () => {
  const obj = { by_status: { available_coin_display: '125.00' } }
  assert.equal(getByPath(obj, 'by_status.available_coin_display'), '125.00')
})

test('getByPath returns undefined for missing segments', () => {
  const obj = { a: { b: 1 } }
  assert.equal(getByPath(obj, 'a.b.c'), undefined)
  assert.equal(getByPath(obj, 'x.y'), undefined)
  assert.equal(getByPath(null, 'a'), undefined)
})

/* ---------- pickCoinDisplay ---------- */
test('pickCoinDisplay prefers *_coin_display string over *_coin number', () => {
  const raw = {
    available_balance_coin_display: '2.40',
    available_balance_coin: 240,
  }
  const r = pickCoinDisplay(raw, [
    'available_balance_coin_display',
    'available_balance_coin',
  ])
  assert.equal(r.display, '2.40')
  assert.equal(r.number, 2.4)
})

test('pickCoinDisplay falls back to nested path via dot notation', () => {
  const raw = { by_status: { available_coin_display: '12.00' } }
  const r = pickCoinDisplay(raw, [
    'available_coin_display',
    'by_status.available_coin_display',
  ])
  assert.equal(r.display, '12.00')
  assert.equal(r.number, 12)
})

test('pickCoinDisplay returns zero defaults for empty objects', () => {
  const r = pickCoinDisplay({}, ['coin_display'])
  assert.equal(r.display, '0.00')
  assert.equal(r.number, 0)
})

test('pickCoinDisplay prefers coin_amount_coin_display over coin_amount legacy', () => {
  // Reproduce bug spec: ledger có coin_amount_coin nhưng amountCoinDisplay = "0.00"
  // → Mapper phải ưu tiên coin_amount_coin_display, không mặc định "0.00".
  const raw = {
    type: 'Revenue',
    direction: 'in',
    coin_amount_coin_display: '5.00',
    coin_amount_coin: 5,
    coin_amount: 500, // raw CoinUnit — KHÔNG dùng như Coin.
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

/* ---------- pickVndDisplay ---------- */
test('pickVndDisplay reads vnd_amount from various keys', () => {
  assert.equal(
    pickVndDisplay({ vnd_amount: 1200 }, ['vnd_amount']).number,
    1200,
  )
  assert.equal(
    pickVndDisplay({ amount_vnd: '500' }, ['vnd_amount', 'amount_vnd']).number,
    500,
  )
})

/* ---------- formatCoinString ---------- */
test('formatCoinString preserves "2.40" without trimming to "2.4"', () => {
  assert.equal(formatCoinString('2.40'), '2,40')
  assert.equal(formatCoinString('12,500.00'), '12.500,00')
  assert.equal(formatCoinString(0), '0,00')
})
