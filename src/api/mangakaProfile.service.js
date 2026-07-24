import { http, resolveMediaUrl } from './http.js'
import { apiSeriesToUi } from '@/utils/apiMappers.js'

function unwrap(res) {
  if (res && typeof res === 'object' && res.success !== undefined && res.data !== undefined) {
    return unwrap(res.data)
  }
  return res
}

function mapStats(stats) {
  if (!stats || typeof stats !== 'object') return null
  return {
    totalSeries: Number(stats.total_series ?? stats.totalSeries ?? 0),
    published: Number(stats.published ?? 0),
    drafts: Number(stats.drafts ?? 0),
    // legacy / public extras (nếu BE còn trả)
    totalViews: Number(stats.total_views ?? stats.totalViews ?? 0),
    totalVotes: Number(stats.total_votes ?? stats.totalVotes ?? 0),
    averageScore: Number(stats.average_score ?? stats.averageScore ?? 0),
    followersCount: Number(stats.followers_count ?? stats.followersCount ?? 0),
  }
}

function mapUser(user) {
  const s = user && typeof user === 'object' ? user : {}
  const links = s.social_links ?? s.socialLinks ?? {}
  return {
    id: s._id ?? s.userId ?? s.id ?? null,
    username: String(s.username ?? '').trim(),
    fullName: String(s.full_name ?? s.fullName ?? s.name ?? '').trim(),
    email: String(s.email ?? '').trim(),
    avatarUrl: resolveMediaUrl(s.avatar_url ?? s.avatarUrl ?? '') ?? '',
    coverImageUrl: resolveMediaUrl(s.cover_image_url ?? s.coverImageUrl ?? '') ?? '',
    bio: String(s.bio ?? ''),
    role: s.role ?? 'Mangaka',
    joinedAt: s.joined_at ?? s.joinedAt ?? s.createdAt ?? s.created_at ?? null,
    socialLinks: {
      facebook: String(links.facebook ?? ''),
      twitter: String(links.twitter ?? ''),
      website: String(links.website ?? ''),
    },
  }
}

function mapSeriesList(raw) {
  const list = Array.isArray(raw) ? raw : []
  return list.map((item, i) => apiSeriesToUi(item, i)).filter((s) => s?.id)
}

/**
 * Chuẩn hoá GET /mangaka/profile và GET /mangaka/profile/:id
 * Shape BE:
 * { user, stats: { total_series, published, drafts }, series: [...] }
 */
export function apiMangakaProfilePayloadToUi(raw) {
  const root = raw && typeof raw === 'object' ? raw : {}
  const user = mapUser(root.user ?? root.profile ?? root)
  const stats = mapStats(root.stats ?? root.user?.stats)
  const series = mapSeriesList(root.series ?? root.user?.series ?? [])
  return { user, stats, series }
}

/**
 * Form UI → PUT /mangaka/profile
 * Body: { full_name, bio, avatar_base64?, cover_image_base64?, social_links? }
 * Cả avatar và cover đều gửi data URL (data:image/jpeg;base64,...) — cùng format BE Cloudinary nhận được.
 */
export function uiMangakaProfileToApi(form) {
  const body = {
    full_name: String(form.fullName ?? '').trim(),
    bio: String(form.bio ?? '').trim().slice(0, 500),
  }
  const avatarDataUrl = toImageDataUrl(form.avatarBase64)
  if (avatarDataUrl) {
    body.avatar_base64 = avatarDataUrl
  }
  const coverDataUrl = toImageDataUrl(form.coverImageBase64)
  if (coverDataUrl) {
    body.cover_image_base64 = coverDataUrl
  }
  const links = form.socialLinks && typeof form.socialLinks === 'object' ? form.socialLinks : {}
  body.social_links = {
    facebook: String(links.facebook ?? '').trim(),
    twitter: String(links.twitter ?? '').trim(),
    website: String(links.website ?? '').trim(),
  }
  return body
}

/** Chuẩn hoá thành data URL JPEG/PNG hợp lệ cho Cloudinary. */
function toImageDataUrl(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  if (/^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(raw)) {
    return raw.replace(/\s/g, '')
  }
  // Raw base64 → bọc data URL (BE upload() cần dạng này)
  if (/^[A-Za-z0-9+/=\s]+$/.test(raw) && raw.length > 64) {
    return `data:image/jpeg;base64,${raw.replace(/\s/g, '')}`
  }
  return ''
}

/** File ảnh → data URL base64 (avatar / cover preview). */
export function fileToAvatarBase64(file) {
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

export const mangakaProfileService = {
  /** GET /mangaka/profile — profile của mình (auth) */
  getProfile() {
    return http.get('/mangaka/profile').then(unwrap).then(apiMangakaProfilePayloadToUi)
  },

  /**
   * GET /mangaka/profile/:id — profile public (không bắt buộc auth)
   */
  getPublicProfile(authorId) {
    const id = String(authorId ?? '').trim()
    if (!id) return Promise.reject(new Error('authorId required'))
    return http.get(`/mangaka/profile/${id}`).then(unwrap).then(apiMangakaProfilePayloadToUi)
  },

  /**
   * PUT /mangaka/profile
   * Body: { full_name, bio, avatar_base64?, cover_image_base64?, social_links? }
   */
  updateProfile(form) {
    const body = uiMangakaProfileToApi(form)
    return http
      .put('/mangaka/profile', body, {
        // Cover/avatar base64 có thể > 1MB
        maxBodyLength: 15 * 1024 * 1024,
        maxContentLength: 15 * 1024 * 1024,
        timeout: 120_000,
      })
      .then(unwrap)
      .then(apiMangakaProfilePayloadToUi)
  },
}
