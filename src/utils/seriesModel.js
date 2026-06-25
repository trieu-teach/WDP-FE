/** Mô hình series — Mangaka khai báo đầy đủ; Editor Board / Assistant chỉ đọc tóm tắt. */

import { LABEL_EDITOR_BOARD, LABEL_TANTOU_EDITOR } from '../constants/roleTerminology.js'

// 45 thể loại — khớp với BE (models/Series.js GENRES constant)
export const SERIES_GENRES = [
  // Demographics / Format
  'Anime', 'Drama', 'Josei', 'Manhwa', 'One Shot', 'Shounen', 'Webtoons', 'Shoujo',
  // Content themes
  'Harem', 'Ecchi', 'Mature', 'Slice of Life', 'Isekai', 'Manga', 'Manhua',
  // Genre (action/battle)
  'Hành Động', 'Võ Thuật', 'Huyền Bí', 'Thể Thao', 'Học Đường', 'Lịch Sử',
  // Genre (other)
  'Phiêu Lưu', 'Hài Hước', 'Lãng Mạn', 'Kinh Dị', 'Siêu Nhiên', 'Bi Kịch',
  // Sub-genres
  'Trùng Sinh', 'Game', 'Viễn Tưởng', 'Khoa Học', 'Truyện Màu',
  // Sensitive
  'Người Lớn', 'Boylove', 'Hầm Ngục', 'Săn Bắn',
  // Doujinshi & edge
  'Ngôn Từ Nhạy Cảm', 'Doujinshi', 'Bạo Lực', 'Ngôn Tình',
  // Special
  'Nữ Cường', 'Gender Bender', 'Murim', 'Leo Tháp', 'Nấu Ăn',
]

export const SERIES_DEMOGRAPHICS = [
  { value: 'shonen', label: 'Shōnen' },
  { value: 'shojo', label: 'Shōjo' },
  { value: 'seinen', label: 'Seinen' },
  { value: 'josei', label: 'Josei' },
  { value: 'all', label: 'Mọi lứa tuổi' },
]

export const SERIES_FORMATS = [
  { value: 'manga', label: 'Manga (Nhật)' },
  { value: 'manhwa', label: 'Manhwa (Hàn)' },
  { value: 'manhua', label: 'Manhua (Trung)' },
  { value: 'webtoon', label: 'Webtoon (cuộn dọc)' },
]

export const SERIES_LANGUAGES = [
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'zh', label: '中文' },
]

export const SERIES_CONTENT_RATINGS = [
  { value: 'All ages', label: 'Mọi lứa tuổi' },
  { value: 'Teens 13+', label: 'Tuổi teen' },
  { value: 'Mature 17+', label: 'Người lớn' },
  { value: 'Adults Only 18+', label: 'Chỉ 18+' },
]

export const SERIES_TAGS = [
  'Isekai', 'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy',
  'Horror', 'Mystery', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports',
  'Supernatural', 'Thriller', 'Historical', 'Martial Arts', 'Mecha',
  'Psychological', 'School', 'Seinen', 'Shoujo', 'Shounen', 'Yaoi', 'Yuri',
  'Ecchi', 'Harem', 'Gore', 'Post-Apocalyptic', 'Cyberpunk', 'Dark Fantasy',
]

export const SERIES_PUBLICATION_STATUSES = [
  { value: 'preparing', label: 'Chuẩn bị phát hành' },
  { value: 'ongoing', label: 'Đang ra' },
  { value: 'hiatus', label: 'Tạm dừng' },
  { value: 'completed', label: 'Hoàn thành' },
]

export const SERIES_PUBLISH_TYPES = [
  {
    value: 'debut',
    label: 'Phát hành lần đầu trên nền tảng',
    hint: `Luồng đầy đủ: Assistant → bạn duyệt → ${LABEL_TANTOU_EDITOR} → ${LABEL_EDITOR_BOARD} biểu quyết → xuất bản.`,
  },
  {
    value: 'continuing',
    label: 'Series đã có / chỉ thêm chapter',
    hint: `Không qua vòng ${LABEL_EDITOR_BOARD}; chapter mới chỉ qua ${LABEL_TANTOU_EDITOR}.`,
  },
]

export const SERIES_PALETTE = ['#457b9d', '#06d6a0', '#ffb703', '#bc6c25', '#7209b7', '#219ebc', '#e63946', '#9b5de5']

const DEMOGRAPHIC_LABEL = Object.fromEntries(SERIES_DEMOGRAPHICS.map((d) => [d.value, d.label]))
const FORMAT_LABEL = Object.fromEntries(SERIES_FORMATS.map((f) => [f.value, f.label]))
const LANGUAGE_LABEL = Object.fromEntries(SERIES_LANGUAGES.map((l) => [l.value, l.label]))
const RATING_LABEL = Object.fromEntries(SERIES_CONTENT_RATINGS.map((r) => [r.value, r.label]))
const PUB_LABEL = Object.fromEntries(SERIES_PUBLICATION_STATUSES.map((p) => [p.value, p.label]))

export function slugifySeriesTitle(title) {
  const base = String(title)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return base || `series-${Date.now()}`
}

export function createEmptySeriesForm(authorName = '') {
  return {
    name: '',
    description: '',
    genre: [],
    target_audience: '',
    tags: [],
    age_rating: 'All ages',
    cover: null,
  }
}

/** Chuẩn hóa series cũ trong localStorage. */
export function normalizeSeries(raw, index = 0) {
  const s = raw && typeof raw === 'object' ? raw : {}
  const title = String(s.title ?? '').trim() || `Series ${s.id ?? index + 1}`
  const slug = String(s.slug ?? '').trim() || slugifySeriesTitle(title)
  const genres = Array.isArray(s.genres) ? s.genres.filter(Boolean) : []
  const publishType = s.publishType ?? (s.needsFullDebutPipeline ? 'debut' : 'continuing')
  const needsFullDebutPipeline = s.needsFullDebutPipeline ?? publishType === 'debut'

  const normalized = {
    id: s.id ?? index + 1,
    slug,
    title,
    altTitle: String(s.altTitle ?? '').trim(),
    synopsis: String(s.synopsis ?? '').trim(),
    genres: genres.length ? genres : (String(s.synopsis ?? '').trim() ? ['Đời thường'] : []),
    demographic: s.demographic ?? s.target_audience ?? 'shonen',
    format: s.format ?? 'manga',
    language: s.language ?? 'vi',
    contentRating: s.contentRating ?? 'all',
    publicationStatus: s.publicationStatus ?? 'ongoing',
    publishType,
    needsFullDebutPipeline,
    authorName: String(s.authorName ?? '').trim() || 'Mangaka',
    authorId: s.authorId ?? null,
    createdAt: s.createdAt ?? new Date().toISOString(),
    tags: Array.isArray(s.tags) ? s.tags : [],
    category: String(s.category ?? '').trim(),
    age_rating: s.age_rating ?? 'All ages',
    color: s.color ?? SERIES_PALETTE[(s.id ?? index) % SERIES_PALETTE.length],
    coverImage: s.coverImage ?? s.cover_image_url ?? s.coverImageUrl ?? null,
    chapters: s.chapters ?? 0,
    marks: s.marks ?? 0,
    status: s.status ?? 'draft',
    updated: s.updated ?? '—',
    progress: s.progress ?? 0,
    metadataComplete: s.metadataComplete !== false && Boolean(String(s.synopsis ?? '').trim()),
    ebAssessment: s.ebAssessment && typeof s.ebAssessment === 'object'
      ? JSON.parse(JSON.stringify(s.ebAssessment))
      : null,
  }
  normalized.statusLabel = s.statusLabel ?? buildWorkflowStatusLabel(normalized)
  return normalized
}

export function normalizeSeriesList(list) {
  if (!Array.isArray(list)) return []
  return list.map((s, i) => normalizeSeries(s, i))
}

export function buildWorkflowStatusLabel(s) {
  const pub = PUB_LABEL[s.publicationStatus] ?? 'Chuẩn bị'
  if (s.status === 'assistant') return 'Đang vẽ ngoại cảnh'
  if (s.status === 'review') return 'Chờ bạn duyệt'
  if (s.status === 'draft') {
    if (s.publicationStatus === 'preparing') return `Bản nháp · ${pub}`
    return 'Bản nháp'
  }
  return pub
}

export function formatSeriesCatalogLine(series) {
  const fmt = FORMAT_LABEL[series.format] ?? series.format
  const demo = DEMOGRAPHIC_LABEL[series.demographic] ?? series.demographic
  const lang = LANGUAGE_LABEL[series.language] ?? series.language
  return `${fmt} · ${demo} · ${lang}`
}

/** Một dòng ngắn trên thẻ series / Editor Board — tránh chữ nhỏ chồng chữ. */
export function formatSeriesCardLine(series) {
  const s = typeof series?.title === 'string' ? series : normalizeSeries(series)
  const genreBit = s.genres?.length ? s.genres.slice(0, 2).join(' · ') : ''
  const fmtRaw = FORMAT_LABEL[s.format] ?? s.format ?? ''
  const fmt = String(fmtRaw).replace(/\s*\([^)]*\)\s*$/, '').trim()
  return [genreBit, fmt].filter(Boolean).join(' · ') || '—'
}

export function formatSeriesRating(series) {
  return RATING_LABEL[series.age_rating] ?? RATING_LABEL[series.contentRating] ?? series.age_rating ?? series.contentRating
}

/** Payload gửi Editor Board / Assistant — không cần toàn bộ workspace. */
export function seriesToExternalSummary(series) {
  const s = normalizeSeries(series)
  return {
    id: s.id,
    title: s.title,
    slug: s.slug,
    genres: s.genres,
    demographic: s.demographic,
    demographicLabel: DEMOGRAPHIC_LABEL[s.demographic],
    format: s.format,
    formatLabel: FORMAT_LABEL[s.format],
    language: s.language,
    contentRating: s.contentRating,
    ratingLabel: RATING_LABEL[s.contentRating],
    synopsis: s.synopsis,
    synopsisShort: s.synopsis.length > 140 ? `${s.synopsis.slice(0, 137)}…` : s.synopsis,
    authorName: s.authorName,
    altTitle: s.altTitle,
    publishType: s.publishType,
    publicationStatus: s.publicationStatus,
    publicationLabel: PUB_LABEL[s.publicationStatus],
    catalogLine: formatSeriesCatalogLine(s),
    category: s.category,
    tags: s.tags,
    age_rating: s.age_rating,
  }
}

export function seriesToForm(series) {
  const s = normalizeSeries(series)
  const form = {
    name: s.title || '',
    description: s.synopsis || '',
    genre: Array.isArray(s.genres) ? s.genres : [],
    target_audience: s.demographic || '',
    tags: Array.isArray(s.tags) ? s.tags : [],
    age_rating: s.age_rating || 'All ages',
    cover: s.coverImage || null,
    coverPreview: s.coverImage || null,
  }
  return form
}

export function validateSeriesForm(form, existingTitles = [], options = {}) {
  const errors = {}
  const name = String(form.name ?? '').trim()
  const excludeTitle = String(options.excludeTitle ?? '').trim().toLowerCase()
  if (name.length < 2) errors.name = 'Tên series tối thiểu 2 ký tự.'
  else if (existingTitles.some((t) => {
    const lower = String(t).toLowerCase()
    if (excludeTitle && lower === excludeTitle) return false
    return lower === name.toLowerCase()
  })) {
    errors.name = 'Đã có series trùng tên.'
  }
  if (!String(form.description ?? '').trim()) errors.description = 'Vui lòng nhập mô tả.'
  if (!Array.isArray(form.genre) || form.genre.length === 0) errors.genre = 'Vui lòng chọn ít nhất 1 thể loại.'
  if (!String(form.target_audience ?? '').trim()) errors.target_audience = 'Vui lòng chọn đối tượng.'
  return { ok: Object.keys(errors).length === 0, errors }
}

export function buildSeriesFromForm(form, { id, authorName, authorId }) {
  const name = String(form.name).trim()
  const genres = Array.isArray(form.genre) ? form.genre.filter(Boolean) : []

  const series = normalizeSeries({
    id,
    slug: slugifySeriesTitle(name),
    title: name,
    synopsis: String(form.description ?? '').trim(),
    genres,
    demographic: form.target_audience || 'shonen',
    publicationStatus: 'preparing',
    publishType: 'debut',
    needsFullDebutPipeline: true,
    authorName: authorName || 'Mangaka',
    authorId,
    createdAt: new Date().toISOString(),
    chapters: 0,
    marks: 0,
    status: 'draft',
    updated: 'Vừa tạo',
    progress: 0,
    metadataComplete: true,
    tags: Array.isArray(form.tags) ? form.tags : [],
    age_rating: form.age_rating ?? 'All ages',
  })

  return {
    ...series,
    statusLabel: buildWorkflowStatusLabel(series),
  }
}

/** Cập nhật hồ sơ series — giữ id, tiến độ, chapter, trạng thái workflow. */
export function applySeriesFormUpdate(existing, form) {
  const base = normalizeSeries(existing)
  const name = String(form.name).trim()
  const genres = Array.isArray(form.genre) ? form.genre.filter(Boolean) : []

  const merged = normalizeSeries({
    ...base,
    slug: slugifySeriesTitle(name),
    title: name,
    synopsis: String(form.description ?? '').trim(),
    genres,
    demographic: form.target_audience || base.demographic,
    metadataComplete: Boolean(form.description?.trim()),
    updated: 'Vừa cập nhật hồ sơ',
    tags: Array.isArray(form.tags) ? form.tags : (base.tags ?? []),
    age_rating: form.age_rating ?? base.age_rating ?? 'All ages',
  })

  return {
    ...merged,
    statusLabel: buildWorkflowStatusLabel({ ...base, ...merged }),
  }
}

/** Series tạo nhanh khi upload chapter trước khi khai báo hồ sơ. */
export function buildSeriesFromUploadTitle(title, { id, authorName, colorIndex = 0 }) {
  const series = normalizeSeries({
    id,
    title: String(title).trim(),
    slug: slugifySeriesTitle(title),
    synopsis: '',
    genres: [],
    publicationStatus: 'preparing',
    publishType: 'debut',
    needsFullDebutPipeline: true,
    authorName: authorName || 'Mangaka',
    chapters: 1,
    marks: 0,
    status: 'draft',
    statusLabel: 'Đã upload · cần bổ sung hồ sơ',
    updated: 'Vừa upload',
    progress: 15,
    color: SERIES_PALETTE[colorIndex % SERIES_PALETTE.length],
    metadataComplete: false,
  })
  return series
}
