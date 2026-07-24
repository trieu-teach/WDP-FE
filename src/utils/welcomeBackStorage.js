const WELCOME_BACK_KEY = 'mk-welcome-back-v1'

/** Cache in-memory — sống qua Strict Mode remount (effect chạy 2 lần). */
let memoryPayload = null

function normalizePayload({ name, avatarUrl, at } = {}) {
  return {
    name: String(name ?? '').trim() || 'Mangaka',
    avatarUrl: String(avatarUrl ?? '').trim(),
    at: Number(at) || Date.now(),
  }
}

/** Lưu payload chào mừng sau login — trang chủ sẽ đọc và hiện pill. */
export function queueWelcomeBack({ name, avatarUrl } = {}) {
  const payload = normalizePayload({ name, avatarUrl })
  memoryPayload = payload
  try {
    sessionStorage.setItem(WELCOME_BACK_KEY, JSON.stringify(payload))
  } catch {
    /* ignore quota */
  }
}

/**
 * Đọc payload (không xoá).
 * Dùng memory trước để Strict Mode remount vẫn còn data.
 */
export function peekWelcomeBack() {
  if (memoryPayload) return { ...memoryPayload }

  try {
    const raw = sessionStorage.getItem(WELCOME_BACK_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data || typeof data !== 'object') return null
    // Cho phép tới 5 phút — user có thể đi vòng rồi mới về home
    if (data.at && Date.now() - Number(data.at) > 5 * 60_000) {
      clearWelcomeBack()
      return null
    }
    memoryPayload = normalizePayload(data)
    return { ...memoryPayload }
  } catch {
    return null
  }
}

/** Xoá sau khi pill đã hiện xong (hoặc user dismiss). */
export function clearWelcomeBack() {
  memoryPayload = null
  try {
    sessionStorage.removeItem(WELCOME_BACK_KEY)
  } catch {
    /* ignore */
  }
}
