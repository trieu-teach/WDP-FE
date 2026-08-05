import { http } from './http.js'
import {
  pickCoinDisplay,
  pickVndDisplay,
} from '@/utils/coinFormatter.js'

/**
 * BE ground truth (04/08/2026 — backend contract):
 *
 * BE trả sẵn các field *_coin_display (string, vd "5.00") cho UI hiển thị.
 * Ưu tiên: *_coin_display > *_coin (number) > raw CoinUnit.
 *
 *   Wallets:
 *     GET /wallet
 *       Reader: balance_coin_display, total_deposited_coin_display, total_spent_coin_display,
 *               current_coin_display, pending_revenue_display, ...
 *       Mangaka/Assistant: balance_coin_display, pending_balance_coin_display,
 *                         available_balance_coin_display, total_revenue_coin_display,
 *                         total_withdrawn_coin_display, total_deposited_coin_display,
 *                         total_spent_coin_display, ...
 *                         + config: { coin_to_vnd_rate, platform_fee_percent, revenue_pending_hours }
 *
 *     GET /wallet/transactions
 *       data = [{ type, direction, coin_amount_coin_display, coin_amount_coin,
 *                 coin_display, vnd_amount, description, createdAt, ... }]
 *
 * Luôn dùng pickCoinDisplay() / pickVndDisplay() cho *_display fields.
 * KHÔNG tự chia cho 100 hay dùng coin_unit_scale.
 */

/* ──────────────────────────────────────────────────────────────────────
 *  Ledger types (BE enum PascalCase)
 * ────────────────────────────────────────────────────────────────────── */
export const LEDGER_TYPES = {
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

export function ledgerTypeLabel(type) {
  return LEDGER_TYPE_LABELS[type] ?? type ?? '—'
}

/**
 * UI dir (in/out) ưu tiên BE `direction` rồi fallback theo type.
 *  - Revenue / Refund / Deposit → in (cộng)
 *  - Purchase → out (trừ)
 *  - Withdrawal:
 *      direction='out' (request) → out
 *      direction='in'  (refund/reject) → in
 *      fallback theo status: pending/approved/completed → out; rejected → in (refund)
 */
export function isInflow(type, direction, status) {
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

/**
 * Map direction từ response — KHÔNG suy luận từ type nếu BE đã trả direction.
 */
export function resolveDirection(entry) {
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

/* ──────────────────────────────────────────────────────────────────────
 *  Helpers
 * ────────────────────────────────────────────────────────────────────── */
function unwrap(res) {
  if (res && typeof res === 'object' && res.success !== undefined && res.data !== undefined) {
    return unwrap(res.data)
  }
  return res
}

/* ──────────────────────────────────────────────────────────────────────
 *  Wallet summary mapper
 * ──────────────────────────────────────────────────────────────────────
 *  BE /wallet trả *_coin_display (string) → ưu tiên dùng trực tiếp.
 *  UI cần hiển thị ĐÚNG "2.40" chứ không phải "2.4" → luôn giữ string.
 */
function mapSummary(raw) {
  const r = raw && typeof raw === 'object' ? raw : {}
  const config = r.config && typeof r.config === 'object' ? r.config : {}
  const rate = Number(config.coin_to_vnd_rate ?? 0) || 0

  const available = pickCoinDisplay(r, [
    'available_balance_coin_display',
    'available_balance_coin',
    'available_balance',
  ])
  const pending = pickCoinDisplay(r, [
    'pending_balance_coin_display',
    'pending_balance_coin',
    'pending_balance',
  ])
  const readerBalance = pickCoinDisplay(r, [
    'balance_coin_display',
    'balance_coin',
    'balance',
  ])
  const totalRevenue = pickCoinDisplay(r, [
    'total_revenue_coin_display',
    'total_revenue_coin',
    'total_revenue',
  ])
  const totalWithdrawn = pickCoinDisplay(r, [
    'total_withdrawn_coin_display',
    'total_withdrawn_coin',
    'total_withdrawn',
  ])
  const totalDeposited = pickCoinDisplay(r, [
    'total_deposited_coin_display',
    'total_deposited_coin',
    'total_deposited',
  ])
  const totalSpent = pickCoinDisplay(r, [
    'total_spent_coin_display',
    'total_spent_coin',
    'total_spent',
  ])

  return {
    // ── Reader ──
    readerBalanceCoin: readerBalance.number,
    readerBalanceCoinDisplay: readerBalance.display,

    // ── Mangaka / Assistant ──
    availableBalanceCoin: available.number,
    availableBalanceCoinDisplay: available.display,
    pendingBalanceCoin: pending.number,
    pendingBalanceCoinDisplay: pending.display,
    currentBalanceCoin: pickCoinDisplay(r, [
      'current_balance_coin_display',
      'current_balance_coin',
      'balance_coin_display',
      'balance_coin',
    ]),
    hasBankInfo: Boolean(
      r.has_bank_info ?? r.bank_info?.has_bank_info ?? r.bank_info?.has_account_number,
    ),
    bankInfo: r.bank_info && typeof r.bank_info === 'object' ? r.bank_info : null,

    // ── Lifetime aggregates ──
    lifetimeEarningsCoin: totalRevenue.number,
    lifetimeEarningsCoinDisplay: totalRevenue.display,
    lifetimeWithdrawnCoin: totalWithdrawn.number,
    lifetimeWithdrawnCoinDisplay: totalWithdrawn.display,
    lifetimeDepositedCoin: totalDeposited.number,
    lifetimeDepositedCoinDisplay: totalDeposited.display,
    lifetimeSpentCoin: totalSpent.number,
    lifetimeSpentCoinDisplay: totalSpent.display,

    // ── VND (ưu tiên BE; fallback coin * rate) ──
    availableBalanceVnd: Number(
      r.available_balance_vnd ?? Math.round(available.number * rate),
    ),
    pendingBalanceVnd: Number(r.pending_balance_vnd ?? Math.round(pending.number * rate)),
    lifetimeEarningsVnd: Number(
      r.total_revenue_vnd ?? Math.round(totalRevenue.number * rate),
    ),
    lifetimeWithdrawnVnd: Number(
      r.total_withdrawn_vnd ?? Math.round(totalWithdrawn.number * rate),
    ),

    // ── Config ──
    coinToVndRate: rate,
    platformFeePercent: Number(config.platform_fee_percent ?? 0) || 0,
    revenuePendingHours: Number(config.revenue_pending_hours ?? 0) || 0,

    updatedAt: r.updatedAt ?? r.updated_at ?? null,
    raw: r,
  }
}

/* ──────────────────────────────────────────────────────────────────────
 *  Ledger entry mapper
 * ──────────────────────────────────────────────────────────────────────
 *  BE `coin_amount_coin_display` (string) → dùng trực tiếp, không parse lại.
 *  Fallback: coin_amount_coin → coin_display → coin_amount (legacy).
 */
function mapLedgerEntry(raw) {
  const r = raw && typeof raw === 'object' ? raw : {}
  const direction = resolveDirection(r)

  const amount = pickCoinDisplay(r, [
    'coin_amount_coin_display',
    'coin_amount_coin',
    'coin_display',
    'coin_amount',
    'coin',
    'amount',
  ])
  const vnd = pickVndDisplay(r, [
    'vnd_amount_display',
    'vnd_amount',
    'amount_vnd',
  ])

  return {
    id: r._id ?? r.id ?? null,
    type: r.type ?? '',
    direction,
    status: r.status ?? r.withdrawal_status ?? null,
    amountCoin: amount.number,
    amountCoinString: amount.display,
    amountCoinDisplay: amount.display,
    vndAmount: vnd.number,
    description: String(r.description ?? r.note ?? ''),
    createdAt: r.createdAt ?? r.created_at ?? null,
    raw: r,
  }
}

function mapPagination(raw) {
  const p = raw?.pagination && typeof raw.pagination === 'object' ? raw.pagination : {}
  return {
    page: Number(p.page ?? 1) || 1,
    limit: Number(p.limit ?? 20) || 20,
    total: Number(p.total ?? 0) || 0,
    pages: Number(p.pages ?? 1) || 1,
  }
}

/* ──────────────────────────────────────────────────────────────────────
 *  Withdrawals
 * ────────────────────────────────────────────────────────────────────── */
function mapWithdrawalRequest(raw) {
  const r = raw && typeof raw === 'object' ? raw : {}
  const amount = pickCoinDisplay(r, [
    'coin_amount_coin_display',
    'coin_amount_coin',
    'coin_display',
    'coin_amount',
  ])
  const vnd = pickVndDisplay(r, [
    'vnd_amount_display',
    'vnd_amount',
    'amount_vnd',
  ])
  const bank = r.bank_snapshot && typeof r.bank_snapshot === 'object'
    ? {
        bank_name: r.bank_snapshot.bank_name ?? '',
        account_holder: r.bank_snapshot.account_holder ?? '',
        account_number_masked:
          r.bank_snapshot.account_number_masked
          ?? r.bank_snapshot.bank_account_number_masked
          ?? null,
        has_account_number:
          r.bank_snapshot.has_account_number
          ?? Boolean(r.bank_snapshot.bank_account_number_masked),
      }
    : null
  return {
    id: r._id ?? r.id ?? null,
    userId: r.user_id ?? r.userId ?? null,
    status: r.status ?? 'pending',
    amountCoin: amount.number,
    amountCoinDisplay: amount.display,
    vndAmount: vnd.number,
    vndAmountDisplay: vnd.number.toLocaleString('vi-VN'),
    note: String(r.note ?? ''),
    adminNote: String(r.admin_note ?? ''),
    bankSnapshot: bank,
    createdAt: r.createdAt ?? r.created_at ?? null,
    processedAt: r.processed_at ?? r.processedAt ?? null,
    raw: r,
  }
}

/* ──────────────────────────────────────────────────────────────────────
 *  Service
 * ────────────────────────────────────────────────────────────────────── */
export const walletService = {
  /** GET /wallet — Summary (Reader/Mangaka/Assistant). */
  getSummary() {
    return http.get('/wallet').then(unwrap).then(mapSummary)
  },

  /**
   * GET /wallet/transactions?page=&limit=&type=
   * type: Deposit | Purchase | Revenue | Refund | Withdrawal
   */
  getTransactions(params = {}) {
    const query = { page: 1, limit: 20 }
    if (params.page) query.page = Number(params.page)
    if (params.limit) query.limit = Number(params.limit)
    if (params.type) query.type = String(params.type)
    return http
      .get('/wallet/transactions', { params: query })
      .then(unwrap)
      .then((raw) => {
        const list = Array.isArray(raw?.data)
          ? raw.data
          : Array.isArray(raw?.items)
            ? raw.items
            : Array.isArray(raw)
              ? raw
              : []
        return {
          items: list.map(mapLedgerEntry),
          pagination: mapPagination(raw),
        }
      })
  },

  /** POST /withdrawals — tạo yêu cầu rút tiền. Body: { note? }. */
  createWithdrawal(body = {}) {
    const payload = {}
    const note = String(body?.note ?? '').trim()
    if (note) payload.note = note
    return http.post('/withdrawals', payload).then(unwrap).then(mapWithdrawalRequest)
  },

  /** GET /withdrawals/mine?page=&limit= */
  listMyWithdrawals(params = {}) {
    const query = { page: 1, limit: 20 }
    if (params.page) query.page = Number(params.page)
    if (params.limit) query.limit = Number(params.limit)
    return http.get('/withdrawals/mine', { params: query }).then(unwrap).then((raw) => {
      const list = Array.isArray(raw?.data)
        ? raw.data
        : Array.isArray(raw?.items)
          ? raw.items
          : Array.isArray(raw)
            ? raw
            : []
      return {
        items: list.map(mapWithdrawalRequest),
        pagination: mapPagination(raw),
      }
    })
  },

  /** GET /withdrawals/mine/:id */
  getMyWithdrawal(id) {
    return http.get(`/withdrawals/mine/${id}`).then(unwrap).then(mapWithdrawalRequest)
  },
}

export { mapWithdrawalRequest }
