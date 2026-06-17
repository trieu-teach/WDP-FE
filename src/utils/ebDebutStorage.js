/** Mock đồng bộ Editor Board ↔ Mangaka (localStorage). Production thay bằng API. */

export const EB_DEBUT_APPROVED_KEY = 'mk-eb-debut-approved'
export const EB_DEBUT_PENDING_KEY = 'mk-eb-debut-pending'

export function notifyEbApprovedListeners() {
  window.dispatchEvent(new Event('mk-eb-approved-update'))
}

export function notifyEbPendingListeners() {
  window.dispatchEvent(new Event('mk-eb-pending-update'))
}

export function readEbDebutApproved() {
  try {
    const raw = localStorage.getItem(EB_DEBUT_APPROVED_KEY)
    const o = raw ? JSON.parse(raw) : {}
    return o && typeof o === 'object' ? o : {}
  } catch {
    return {}
  }
}

export function readEbDebutPending() {
  try {
    const raw = localStorage.getItem(EB_DEBUT_PENDING_KEY)
    const a = raw ? JSON.parse(raw) : []
    return Array.isArray(a) ? a : []
  } catch {
    return []
  }
}

/** Editor Board gọi — chỉ Board được phép duyệt vòng đầu series (demo). */
export function approveEbDebutSeries(title) {
  const key = String(title).trim()
  if (!key) return
  const map = readEbDebutApproved()
  map[key] = true
  localStorage.setItem(EB_DEBUT_APPROVED_KEY, JSON.stringify(map))
  notifyEbApprovedListeners()
}

/** Mangaka đóng vòng đầu hoặc xóa series — gỡ cờ Editor Board. */
export function removeEbDebutApproval(title) {
  const key = String(title).trim()
  if (!key) return
  const map = readEbDebutApproved()
  if (!map[key]) return
  delete map[key]
  localStorage.setItem(EB_DEBUT_APPROVED_KEY, JSON.stringify(map))
  notifyEbApprovedListeners()
}

/** @param {Array<object>} summaries — từ seriesToExternalSummary (Mangaka). */
export function syncEbDebutPendingFromSeries(summaries) {
  try {
    localStorage.setItem(EB_DEBUT_PENDING_KEY, JSON.stringify(summaries))
    notifyEbPendingListeners()
  } catch {
    /* quota / private mode */
  }
}
