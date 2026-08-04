import { http } from './http.js'
import { parseCoinString } from '@/utils/coinFormatter.js'

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
 *       data = [{ type, direction, coin_amount_coin, coin_display, vnd_amount, description, createdAt, ... }]
 *
 * Luôn dùng parseCoinString() cho *_coin_display fields.
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
}

const LEDGER_TYPE_LABELS = {
  [LEDGER_TYPES.REVENUE]: 'Doanh thu',
  [LEDGER_TYPES.DEPOSIT]: 'Nạp Coin',
  [LEDGER_TYPES.PURCHASE]: 'Mua chapter',
  [LEDGER_TYPES.REFUND]: 'Hoàn tiền',
}

export function ledgerTypeLabel(type) {
  return LEDGER_TYPE_LABELS[type] ?? type ?? '—'
}

/**
 * UI dir (in/out) ưu tiên BE `direction` rồi fallback theo type.
 */
export function isInflow(type) {
  return (
    type === LEDGER_TYPES.REVENUE
    || type === LEDGER_TYPES.REFUND
    || type === LEDGER_TYPES.DEPOSIT
  )
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

/**
 * Lấy giá trị coin ưu tiên: *_coin_display (string) > *_coin (number) > raw.
 * Dùng cho mọi trường hợp khi service layer phải đọc từ BE.
 */
function coinField(raw, ...keys) {
  for (const k of keys) {
    const v = raw?.[k]
    if (v == null) continue
    if (typeof v === 'string') return parseCoinString(v)
    if (typeof v === 'number') return v
  }
  return 0
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

  return {
    // ── Reader ──
    readerBalanceCoin: coinField(r, 'balance_coin_display', 'balance_coin', 'balance'),
    readerBalanceCoinDisplay: String(r.balance_coin_display ?? '0.00'),

    // ── Mangaka / Assistant ──
    availableBalanceCoin: coinField(r, 'available_balance_coin_display', 'available_balance_coin', 'available_balance'),
    availableBalanceCoinDisplay: String(r.available_balance_coin_display ?? '0.00'),
    pendingBalanceCoin: coinField(r, 'pending_balance_coin_display', 'pending_balance_coin', 'pending_balance'),
    pendingBalanceCoinDisplay: String(r.pending_balance_coin_display ?? '0.00'),

    // ── Lifetime aggregates ──
    lifetimeEarningsCoin: coinField(r, 'total_revenue_coin_display', 'total_revenue_coin', 'total_revenue'),
    lifetimeEarningsCoinDisplay: String(r.total_revenue_coin_display ?? '0.00'),
    lifetimeWithdrawnCoin: coinField(r, 'total_withdrawn_coin_display', 'total_withdrawn_coin', 'total_withdrawn'),
    lifetimeWithdrawnCoinDisplay: String(r.total_withdrawn_coin_display ?? '0.00'),
    lifetimeDepositedCoin: coinField(r, 'total_deposited_coin_display', 'total_deposited_coin', 'total_deposited'),
    lifetimeDepositedCoinDisplay: String(r.total_deposited_coin_display ?? '0.00'),
    lifetimeSpentCoin: coinField(r, 'total_spent_coin_display', 'total_spent_coin', 'total_spent'),
    lifetimeSpentCoinDisplay: String(r.total_spent_coin_display ?? '0.00'),

    // ── VND (tính từ coin * rate) ──
    availableBalanceVnd: Math.round(coinField(r, 'available_balance_coin_display', 'available_balance_coin', 'available_balance') * rate),
    pendingBalanceVnd: Math.round(coinField(r, 'pending_balance_coin_display', 'pending_balance_coin', 'pending_balance') * rate),
    lifetimeEarningsVnd: Math.round(coinField(r, 'total_revenue_coin_display', 'total_revenue_coin', 'total_revenue') * rate),
    lifetimeWithdrawnVnd: Math.round(coinField(r, 'total_withdrawn_coin_display', 'total_withdrawn_coin', 'total_withdrawn') * rate),

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
 *  BE `coin_amount_coin` / `coin_display` (string) → dùng trực tiếp.
 */
function mapLedgerEntry(raw) {
  const r = raw && typeof raw === 'object' ? raw : {}
  const direction = r.direction === 'in' ? 'in' : r.direction === 'out' ? 'out' : null

  const amountCoin = coinField(r, 'coin_amount_coin_display', 'coin_amount_coin', 'coin_display', 'coin_amount', 'coin', 'amount')

  return {
    id: r._id ?? r.id ?? null,
    type: r.type ?? '',
    direction: direction ?? (isInflow(r.type) ? 'in' : 'out'),
    amountCoin,
    amountCoinString: String(r.coin_amount_coin_display ?? r.coin_display ?? r.coin_amount ?? '0'),
    amountCoinDisplay: String(r.coin_amount_coin_display ?? r.coin_display ?? '0.00'),
    vndAmount: Number(r.vnd_amount ?? 0) || 0,
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
 *  Service
 * ────────────────────────────────────────────────────────────────────── */
export const walletService = {
  /** GET /wallet — Summary (Reader/Mangaka/Assistant). */
  getSummary() {
    return http.get('/wallet').then(unwrap).then(mapSummary)
  },

  /**
   * GET /wallet/transactions?page=&limit=&type=
   * type: Deposit | Purchase | Revenue | Refund
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
        const items = Array.isArray(raw?.data)
          ? raw.data.map(mapLedgerEntry)
          : Array.isArray(raw)
            ? raw.map(mapLedgerEntry)
            : []
        return { items, pagination: mapPagination(raw) }
      })
  },
}
