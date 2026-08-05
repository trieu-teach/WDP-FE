import { http, resolveMediaUrl } from './http.js'

function unwrap(res) {
  if (res && typeof res === 'object' && res.success !== undefined && res.data !== undefined) {
    return unwrap(res.data)
  }
  return res
}

function mapStats(stats) {
  if (!stats || typeof stats !== 'object') return null
  return {
    // Ưu tiên snake_case (BE spec 04/08/2026) → fallback camelCase cũ.
    totalSeries: Number(stats.total_series ?? stats.totalSeries ?? 0),
    chapters: Number(stats.chapters ?? 0),
    totalTasks: Number(stats.total_tasks ?? stats.totalTasks ?? 0),
    approvedTasks: Number(stats.approved_tasks ?? stats.approvedTasks ?? 0),
    // legacy extra nếu BE còn trả
    drafts: Number(stats.drafts ?? 0),
    published: Number(stats.published ?? 0),
    totalViews: Number(stats.total_views ?? stats.totalViews ?? 0),
  }
  // NOTE: BE spec VI.2 — Assistant KHÔNG có followersCount.
  // Không fallback, không hiển thị.
}

function mapUser(user) {
  const s = user && typeof user === 'object' ? user : {}
  const links = s.social_links ?? s.socialLinks ?? {}
  return {
    id: s._id ?? s.userId ?? s.id ?? null,
    username: String(s.username ?? '').trim(),
    fullName: String(s.full_name ?? s.fullName ?? s.name ?? '').trim(),
    email: String(s.email ?? '').trim(),
    role: s.role ?? 'Assistant',
    avatarUrl: resolveMediaUrl(s.avatar_url ?? s.avatarUrl ?? '') ?? '',
    coverImageUrl: resolveMediaUrl(s.cover_image_url ?? s.coverImageUrl ?? '') ?? '',
    bio: String(s.bio ?? ''),
    socialLinks: {
      facebook: String(links.facebook ?? ''),
      twitter: String(links.twitter ?? ''),
      website: String(links.website ?? ''),
    },
    joinedAt: s.joined_at ?? s.joinedAt ?? s.createdAt ?? s.created_at ?? null,
  }
}

function mapSeriesList(raw) {
  const list = Array.isArray(raw) ? raw : []
  return list.map((s) => {
    if (s && typeof s === 'object' && s.id) return s
    return {
      id: s._id ?? s.id ?? null,
      title: s.title ?? s.name ?? '',
      coverImage: resolveMediaUrl(s.cover_image_url ?? s.coverImage ?? s.thumbnail ?? '') ?? '',
      chapters: s.chapters ?? s.chapterCount ?? 0,
    }
  }).filter((s) => s?.id)
}

export function apiAssistantProfilePayloadToUi(raw) {
  const root = raw && typeof raw === 'object' ? raw : {}
  return {
    user: mapUser(root.user ?? root),
    stats: mapStats(root.stats ?? null),
    series: mapSeriesList(root.series ?? []),
  }
}

/** UI → PUT /assistant/profile. Body: { full_name, bio, avatar_base64?, cover_image_base64?, social_links? }. */
function uiAssistantProfileToApi(form) {
  const body = {
    full_name: String(form.fullName ?? '').trim(),
    bio: String(form.bio ?? '').trim().slice(0, 500),
  }
  const avatarDataUrl = toImageDataUrl(form.avatarBase64)
  if (avatarDataUrl) body.avatar_base64 = avatarDataUrl
  const coverDataUrl = toImageDataUrl(form.coverImageBase64)
  if (coverDataUrl) body.cover_image_base64 = coverDataUrl
  const links = form.socialLinks && typeof form.socialLinks === 'object' ? form.socialLinks : {}
  body.social_links = {
    facebook: String(links.facebook ?? '').trim(),
    twitter: String(links.twitter ?? '').trim(),
    website: String(links.website ?? '').trim(),
  }
  return body
}

/** Helper: ép về data URL hợp lệ cho Cloudinary. */
function toImageDataUrl(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  if (/^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(raw)) {
    return raw.replace(/\s/g, '')
  }
  if (/^[A-Za-z0-9+/=\s]+$/.test(raw) && raw.length > 64) {
    return `data:image/jpeg;base64,${raw.replace(/\s/g, '')}`
  }
  return ''
}

/** File ảnh → data URL base64 (avatar / cover preview). */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve('')
      return
    }
    if (!String(file.type || '').startsWith('image/')) {
      reject(new Error('Vui lòng chọn file ảnh.'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('Không đọc được file ảnh.'))
    reader.readAsDataURL(file)
  })
}

export const assistantProfileService = {
  /** GET /assistant/profile — profile của assistant đang đăng nhập. */
  getProfile() {
    return http.get('/assistant/profile').then(unwrap).then(apiAssistantProfilePayloadToUi)
  },

  /**
   * PUT /assistant/profile
   * Body: { full_name, bio, avatar_base64?, cover_image_base64?, social_links? }
   */
  updateProfile(form) {
    return http
      .put('/assistant/profile', uiAssistantProfileToApi(form), {
        maxBodyLength: 15 * 1024 * 1024,
        maxContentLength: 15 * 1024 * 1024,
        timeout: 120_000,
      })
      .then(unwrap)
      .then(apiAssistantProfilePayloadToUi)
  },
}
