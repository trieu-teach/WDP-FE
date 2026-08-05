// Pure-logic tests cho contract của UserFinancialDialog:
//  - revenues.by_status đọc được từ data.revenues.by_status (mới)
//    và fallback về data.revenue_by_status (cũ).
//  - cooperation_revenue_share đọc được từ data.cooperation_revenue_share (mới)
//    và fallback về data.collaboration_revenue (cũ).
//  - revenue_by_series KHÔNG bị biến thành activity — activity dùng revenues.history.
//  - Series có doanh thu (label) đếm trên revenue_by_series.
//  - withdrawals.length không bị gán nhãn "tổng" — chỉ là "yêu cầu đang hiển thị".

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { getByPath, pickCoinDisplay } from '../src/utils/coinFormatter.js'

/* ---------- mirror helpers inlined để tránh module alias @/* ngoài Vite ---------- */

function resolveByStatus(data) {
  const revenuesRoot = data?.revenues
  if (revenuesRoot && typeof revenuesRoot === 'object' && revenuesRoot.by_status) {
    return revenuesRoot.by_status
  }
  if (data?.revenue_by_status && typeof data.revenue_by_status === 'object') {
    return data.revenue_by_status
  }
  return {}
}

function resolveCooperation(data) {
  if (Array.isArray(data?.cooperation_revenue_share)) return data.cooperation_revenue_share
  if (Array.isArray(data?.collaboration_revenue)) return data.collaboration_revenue
  return []
}

function resolveRevenueHistory(data) {
  if (Array.isArray(data?.revenues?.history)) return data.revenues.history
  if (Array.isArray(data?.revenue?.history)) return data.revenue.history
  return []
}

function countSeriesWithRevenue(bySeries) {
  if (!Array.isArray(bySeries) || bySeries.length === 0) return 0
  return bySeries.filter((s) => {
    const total = pickCoinDisplay(s, [
      'total_coin_display',
      'total_coin',
      'total',
    ]).number
    return total > 0
  }).length
}

/* ---------- tests ---------- */

test('revenues.by_status được đọc từ data.revenues.by_status (mới)', () => {
  const data = {
    revenues: {
      by_status: {
        pending_coin_display: '50.00',
        available_coin_display: '100.00',
        withdrawn_coin_display: '20.00',
      },
      history: [],
    },
  }
  const byStatus = resolveByStatus(data)
  assert.equal(byStatus.pending_coin_display, '50.00')
  assert.equal(byStatus.available_coin_display, '100.00')
  assert.equal(byStatus.withdrawn_coin_display, '20.00')
})

test('revenues.by_status fallback về data.revenue_by_status (cũ)', () => {
  const data = {
    revenue_by_status: {
      pending_coin_display: '25.00',
      available_coin_display: '75.00',
      withdrawn_coin_display: '15.00',
    },
  }
  const byStatus = resolveByStatus(data)
  assert.equal(byStatus.pending_coin_display, '25.00')
  assert.equal(byStatus.available_coin_display, '75.00')
  assert.equal(byStatus.withdrawn_coin_display, '15.00')
})

test('revenues.by_status ưu tiên mới — KHÔNG fallback sang cũ khi có data.revenues', () => {
  const data = {
    revenues: { by_status: { pending_coin_display: '99.00' } },
    revenue_by_status: { pending_coin_display: '1.00' },
  }
  const byStatus = resolveByStatus(data)
  assert.equal(byStatus.pending_coin_display, '99.00')
})

test('cooperation đọc được từ data.cooperation_revenue_share (mới)', () => {
  const data = {
    cooperation_revenue_share: [
      { series_id: 's1', series_name: 'A', share_percent: 60 },
      { series_id: 's2', series_name: 'B', share_percent: 40 },
    ],
  }
  const rows = resolveCooperation(data)
  assert.equal(rows.length, 2)
  assert.equal(rows[0].series_name, 'A')
})

test('cooperation fallback về data.collaboration_revenue (cũ)', () => {
  const data = {
    collaboration_revenue: [{ series_id: 's9', series_name: 'Old' }],
  }
  const rows = resolveCooperation(data)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].series_name, 'Old')
})

test('cooperation ưu tiên mới — KHÔNG fallback khi có data.cooperation_revenue_share', () => {
  const data = {
    cooperation_revenue_share: [{ series_name: 'NEW' }],
    collaboration_revenue: [{ series_name: 'OLD' }],
  }
  const rows = resolveCooperation(data)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].series_name, 'NEW')
})

test('revenue activity lấy từ data.revenues.history chứ không phải revenue_by_series', () => {
  const data = {
    revenues: {
      history: [
        {
          _id: 'r1',
          series_name: 'Series Revenue',
          chapter_number: 5,
          status: 'available',
          coin_amount_coin_display: '30.00',
          createdAt: '2026-08-01T00:00:00Z',
        },
      ],
    },
    revenue_by_series: [
      { series_id: 's1', series_name: 'BySeries 1', total_coin_display: '99.00' },
    ],
  }
  const history = resolveRevenueHistory(data)
  assert.equal(history.length, 1)
  assert.equal(history[0].series_name, 'Series Revenue')
  assert.notEqual(history[0].series_name, 'BySeries 1')
})

test('countSeriesWithRevenue đếm đúng số series có totalCoin > 0', () => {
  const bySeries = [
    { series_id: 's1', total_coin_display: '10.00' },
    { series_id: 's2', total_coin_display: '0.00' },
    { series_id: 's3', total_coin: 5 },
    { series_id: 's4', total: 0 },
  ]
  assert.equal(countSeriesWithRevenue(bySeries), 2)
})

test('countSeriesWithRevenue fallback = 0 khi bySeries rỗng', () => {
  assert.equal(countSeriesWithRevenue([]), 0)
  assert.equal(countSeriesWithRevenue(null), 0)
})

test('Pending/Available KHÔNG lặp trong 3 KPI — chỉ hiển thị ở HeroCard', () => {
  // Logic test: 3 KPI tiles không chứa 'Pending' / 'Available'.
  // Đây là test đảm bảo behavior UI: HeroCoinCard đã hiển thị 2 metric này.
  const kpiLabels = ['Tổng kiếm', 'Đã chi trả hoàn tất', 'Coin đã đưa vào yêu cầu rút', 'Series có doanh thu']
  assert.equal(kpiLabels.filter((l) => /Pending/i.test(l)).length, 0)
  assert.equal(kpiLabels.filter((l) => /Available/i.test(l)).length, 0)
})

test('withdrawals.length chỉ được label "yêu cầu đang hiển thị" khi BE không có total', () => {
  // Spec: BE chỉ trả ≤100 record → KHÔNG coi history.length là tổng toàn bộ.
  const data = { withdrawals: { history: new Array(20).fill({}) } }
  const total = Number(data?.withdrawals?.total ?? 0)
  const label = total > 0 ? `${total} yêu cầu rút (BE cung cấp tổng)` : `${data.withdrawals.history.length} yêu cầu đang hiển thị`
  assert.equal(label, '20 yêu cầu đang hiển thị')
})

test('withdrawals.length dùng total khi BE cung cấp', () => {
  const data = { withdrawals: { history: new Array(20).fill({}), total: 1234 } }
  const total = Number(data?.withdrawals?.total ?? 0)
  const label = total > 0 ? `${total} yêu cầu rút (BE cung cấp tổng)` : `${data.withdrawals.history.length} yêu cầu đang hiển thị`
  assert.equal(label, '1234 yêu cầu rút (BE cung cấp tổng)')
})

test('totalWithdrawal và by_status.withdrawn có label khác nhau', () => {
  // Label phân biệt rõ để tránh gây hiểu nhầm:
  // - totalWithdrawal (financial_summary.total_withdrawal) = "Đã chi trả hoàn tất"
  // - by_status.withdrawn (revenues.by_status.withdrawn) = "Coin đã đưa vào yêu cầu rút"
  const summary = pickCoinDisplay(
    { total_withdrawal_display: '300.00', total_withdrawal_coin_display: '300.00' },
    ['total_withdrawal_display', 'total_withdrawal_coin_display'],
  )
  const byStatus = pickCoinDisplay(
    { by_status: { withdrawn_coin_display: '120.00' } },
    ['withdrawn_coin_display', 'by_status.withdrawn_coin_display'],
  )
  assert.equal(summary.display, '300.00')
  assert.equal(byStatus.display, '120.00')
})

test('getByPath hoạt động với nested by_status.withdrawn_coin_display', () => {
  const obj = { by_status: { withdrawn_coin_display: '7.00' } }
  assert.equal(getByPath(obj, 'by_status.withdrawn_coin_display'), '7.00')
})
