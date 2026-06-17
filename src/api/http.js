import axios from 'axios'

// Dev: gọi qua Vite proxy (/api) để tránh CORS. Prod: gọi thẳng backend.
export const API_BASE_URL = import.meta.env.DEV
  ? '/api'
  : (import.meta.env.VITE_API_URL ?? 'https://wdp-be-a2qb.onrender.com')

/** Origin backend (không có /api) — dùng ghép URL ảnh `/uploads/...`. */
export function getBackendOrigin() {
  const raw = import.meta.env.VITE_API_URL ?? 'https://wdp-be-a2qb.onrender.com'
  return String(raw).replace(/\/api\/?$/, '').replace(/\/$/, '')
}

/** Backend trả path tương đối — chuyển thành URL tuyệt đối để hiển thị ảnh. */
export function resolveMediaUrl(url) {
  if (url == null) return null
  const value = String(url).trim()
  if (!value) return null
  if (/^(data:|blob:|https?:)/i.test(value)) return value
  const origin = getBackendOrigin()
  return value.startsWith('/') ? `${origin}${value}` : `${origin}/${value}`
}

function formatApiUrl(config) {
  const base = config.baseURL ?? ''
  const path = config.url ?? ''
  return `${base}${path}`
}

export const http = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

http.interceptors.request.use(config => {
  // FormData cần browser tự set Content-Type kèm boundary — xoá header mặc định
  // để tránh backend không parse được multipart payload.
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    if (config.headers) {
      if (typeof config.headers.delete === 'function') {
        config.headers.delete('Content-Type')
        config.headers.delete('content-type')
      } else {
        delete config.headers['Content-Type']
        delete config.headers['content-type']
      }
    }
  }

  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`

  config.metadata = { startTime: Date.now() }
  const method = (config.method ?? 'get').toUpperCase()
  console.log(`[API] → Gửi request: ${method} ${formatApiUrl(config)}`)

  return config
})

http.interceptors.response.use(
  res => {
    const duration = Date.now() - (res.config.metadata?.startTime ?? Date.now())
    const method = (res.config.method ?? 'get').toUpperCase()
    const url = formatApiUrl(res.config)
    console.log(
      `[API] ✓ Kết nối thành công: ${method} ${url} — HTTP ${res.status} (${duration}ms)`,
      res.data,
    )
    return res.data
  },
  err => {
    const config = err.config ?? {}
    const duration = Date.now() - (config.metadata?.startTime ?? Date.now())
    const method = (config.method ?? 'get').toUpperCase()
    const url = formatApiUrl(config)
    const status = err.response?.status ?? 'NO_RESPONSE'
    const message = err.response?.data?.message ?? err.message ?? 'Không có phản hồi từ server'

    if (status === 'NO_RESPONSE') {
      console.error(
        `[API] ✗ Kết nối thất bại: ${method} ${url} — Không kết nối được server (${duration}ms)`,
        err.message,
      )
    } else {
      console.error(
        `[API] ✗ Kết nối thất bại: ${method} ${url} — HTTP ${status} (${duration}ms)`,
        message,
        err.response?.data,
      )
    }

    return Promise.reject(err)
  },
)

export function getApiErrorMessage(err, fallback = 'Có lỗi xảy ra. Vui lòng thử lại.') {
  const message = err?.response?.data?.message
  if (!message) return fallback

  const translated = {
    'Invalid username or password': 'Email hoặc mật khẩu không đúng.',
    'Username or email already exists': 'Email này đã được đăng ký.',
    'No images uploaded': 'Vui lòng chọn ít nhất một ảnh để upload.',
  }

  return translated[message] ?? message
}

console.log('[API] Base URL:', API_BASE_URL)
console.log(
  '[API] Môi trường:',
  import.meta.env.DEV ? 'development (Vite proxy → backend)' : 'production',
)
