/**
 * Format helpers cho coin / VND / CoinUnit.
 * Zero dependency, an toàn với undefined/null.
 *
 * Quy ước BE 04/08/2026 (backend gửi):
 * - BE trả sẵn các field *_coin_display (string, vd "5.00") cho UI hiển thị trực tiếp.
 * - Ưu tiên: *_coin_display > *_coin (number) > raw CoinUnit.
 * - Luôn dùng parseCoinString() để parse string → number trước khi format.
 * - KHÔNG tự chia cho 100 hay dùng coin_unit_scale trên UI.
 * - 1 Coin = 100 VND mặc định (rate từ config).
 */

export const DEFAULT_COIN_TO_VND_RATE = 100

/**
 * Parse Coin string từ BE (vd "125.50") → number.
 * Fallback 0 nếu thiếu / lỗi.
 */
export function parseCoinString(value, fallback = 0) {
  if (value == null) return fallback
  const n = Number(String(value).trim())
  return Number.isFinite(n) ? n : fallback
}

/**
 * Convert Coin → VND dùng rate.
 * Nếu rate không truyền → 100 (theo spec).
 */
export function coinToVnd(coins, rate = DEFAULT_COIN_TO_VND_RATE) {
  const num = Number(coins)
  if (!Number.isFinite(num)) return 0
  const r = Number(rate) > 0 ? Number(rate) : DEFAULT_COIN_TO_VND_RATE
  return Math.round(num * r)
}

/**
 * Convert VND → Coin.
 */
export function vndToCoin(vnd, rate = DEFAULT_COIN_TO_VND_RATE) {
  const num = Number(vnd)
  if (!Number.isFinite(num)) return 0
  const r = Number(rate) > 0 ? Number(rate) : DEFAULT_COIN_TO_VND_RATE
  return num / r
}

/**
 * Format Coin: 1234.5 → "1.234,5" (vi-VN, 2 fraction mặc định).
 * @param {number|string} value  Coin
 */
export function formatCoins(value, fractionDigits = 2) {
  const num = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(num)) return '0'
  return num.toLocaleString('vi-VN', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
}

/**
 * Format trực tiếp từ BE coin_display string ("12500.50") → "12.500,50".
 * GIỮ NGUYÊN phần thập phân 2 chữ số (không bị mất ".00" trailing).
 * Tránh lỗi "12.500,5" → "1.250.050" khi parse rồi reformat.
 */
export function formatCoinString(coinDisplay, fractionDigits = 2) {
  const raw = String(coinDisplay ?? '').trim()
  if (!raw) return formatCoins(0, fractionDigits)
  const [intPart = '0', fracRaw = ''] = raw.split('.')
  const intNum = Number(intPart.replace(/[^\d-]/g, '')) || 0
  const frac = (fracRaw || '').padEnd(fractionDigits, '0').slice(0, fractionDigits)
  const intFormatted = intNum.toLocaleString('vi-VN')
  return frac ? `${intFormatted},${frac}` : intFormatted
}

/**
 * Format Coin có hậu tố " Coin" — dùng display string từ BE để không mất ".00".
 */
export function formatCoinStringWithUnit(coinDisplay, fractionDigits = 2) {
  return `${formatCoinString(coinDisplay, fractionDigits)} Coin`
}

/**
 * Format Coin có hậu tố " Coin".
 */
export function formatCoinsWithUnit(value, fractionDigits = 2) {
  return `${formatCoins(value, fractionDigits)} Coin`
}

/**
 * Format VND: 12300 → "12.300 ₫".
 */
export function formatVnd(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '0 ₫'
  return `${num.toLocaleString('vi-VN')} ₫`
}

/**
 * Format Coin → VND: chỉ phòng khi FE cần derive (1 Coin = rate VND).
 */
export function formatCoinAsVnd(coins, rate = DEFAULT_COIN_TO_VND_RATE) {
  return formatVnd(coinToVnd(coins, rate))
}

/**
 * Format "% thay đổi" — giữ dấu +/-, fallback '—' nếu không hợp lệ.
 */
export function formatDeltaPercent(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '—'
  const sign = num > 0 ? '+' : ''
  return `${sign}${num.toFixed(1)}%`
}

/**
 * Format timestamp → "12/08/2026 · 14:30".
 */
export function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Đọc giá trị từ object theo dot path — vd: "by_status.available_coin_display".
 * Trả về `undefined` nếu bất kỳ segment nào không tồn tại.
 */
export function getByPath(obj, path) {
  if (obj == null || path == null) return undefined
  const segments = String(path).split('.').filter(Boolean)
  if (segments.length === 0) return undefined
  let cur = obj
  for (const seg of segments) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = cur[seg]
  }
  return cur
}

/**
 * Helper dùng chung để lấy giá trị coin display ưu tiên.
 * Thứ tự ưu tiên (tham số `keys`):
 *   1. *_coin_display (string) — render trực tiếp, KHÔNG parse rồi reformat.
 *   2. *_coin (number)         — fallback number.
 *   3. raw CoinUnit            — CHỈ dùng khi không có display field.
 *
 * Trả về { display, number }:
 *   - display: string hiển thị (giữ nguyên "2.40"), fallback "0.00".
 *   - number: number để tính toán (parse từ string).
 */
export function pickCoinDisplay(obj, keys = []) {
  if (!obj || typeof obj !== 'object') {
    return { display: '0.00', number: 0 }
  }
  for (const k of keys) {
    const v = getByPath(obj, k)
    if (v == null || v === '') continue
    if (typeof v === 'string') {
      return { display: v, number: parseCoinString(v) }
    }
    if (typeof v === 'number' && Number.isFinite(v)) {
      return { display: v.toFixed(2), number: v }
    }
  }
  return { display: '0.00', number: 0 }
}

/**
 * Helper dùng chung để lấy string số VND.
 * Nếu BE trả *_vnd_display → ưu tiên; fallback *_vnd (number).
 */
export function pickVndDisplay(obj, keys = []) {
  if (!obj || typeof obj !== 'object') {
    return { display: 0, number: 0 }
  }
  for (const k of keys) {
    const v = getByPath(obj, k)
    if (v == null || v === '') continue
    if (typeof v === 'string') {
      const n = parseCoinString(v)
      return { display: n, number: n }
    }
    if (typeof v === 'number' && Number.isFinite(v)) {
      return { display: v, number: v }
    }
  }
  return { display: 0, number: 0 }
}
