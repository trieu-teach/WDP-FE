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
  console.debug(`[API] → ${method} ${formatApiUrl(config)}`)

  return config
})

http.interceptors.response.use(
  res => {
    const duration = Date.now() - (res.config.metadata?.startTime ?? Date.now())
    const method = (res.config.method ?? 'get').toUpperCase()
    const url = formatApiUrl(res.config)
    console.debug(
      `[API] ✓ ${method} ${url} — HTTP ${res.status} (${duration}ms)`,
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

    if (status === 401 && localStorage.getItem('token')) {
      localStorage.removeItem('token')
      sessionStorage.removeItem('manga_user')
    }

    // Đánh dấu lỗi 5xx để caller (vd useAssistantTasks) suppress log spam
    if (status >= 500) {
      err.isServerError = true
    }
    // Đánh dấu lỗi 4xx để caller biết đây là lỗi phía client/BE validation (không phải crash)
    if (status >= 400 && status < 500) {
      err.isClientError = true
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

/** Lỗi mạng / proxy timeout (không có HTTP response) — thường do BE Render sleep. */
export function isNetworkError(err) {
  if (err?.response) return false
  const code = String(err?.code ?? '')
  const msg = String(err?.message ?? '')
  return (
    code === 'ECONNABORTED'
    || code === 'ERR_NETWORK'
    || code === 'ETIMEDOUT'
    || code === 'ECONNRESET'
    || /timeout|network error|exceeded/i.test(msg)
  )
}

/** Lấy tên file từ header Content-Disposition (hỗ trợ filename*=UTF-8''). */
export function parseContentDispositionFilename(header) {
  if (!header || typeof header !== 'string') return null
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header)
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim())
    } catch {
      return star[1].trim()
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header)
  return plain?.[1]?.trim() ?? null
}

async function parseBlobErrorResponse(blob) {
  if (!(blob instanceof Blob)) return null
  try {
    const text = await blob.text()
    return JSON.parse(text)
  } catch {
    return null
  }
}

/**
 * Tải file binary qua BE (stream) — dùng auth token, trigger save-as trên browser.
 * Không đi qua interceptor JSON của `http`.
 */
export async function downloadAuthenticatedFile(path, fallbackFilename) {
  const token = localStorage.getItem('token')
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`

  let res
  try {
    res = await axios.get(url, {
      responseType: 'blob',
      timeout: 60000,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
  } catch (err) {
    const blob = err?.response?.data
    const parsed = await parseBlobErrorResponse(blob)
    if (parsed) {
      err.response = { ...err.response, data: parsed }
    }
    throw err
  }

  const contentType = res.headers['content-type'] ?? ''
  if (res.data instanceof Blob && contentType.includes('application/json')) {
    const parsed = await parseBlobErrorResponse(res.data)
    const e = new Error(parsed?.message ?? 'Tải file thất bại.')
    e.response = { status: res.status, data: parsed }
    throw e
  }

  const filename =
    parseContentDispositionFilename(res.headers['content-disposition']) ??
    fallbackFilename ??
    'download.bin'

  const objectUrl = URL.createObjectURL(res.data)
  try {
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = filename
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }

  return filename
}
