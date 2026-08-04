/** Mô hình series — Mangaka khai báo đầy đủ; Editor Board / Assistant chỉ đọc tóm tắt. */

import { LABEL_EDITOR_BOARD, LABEL_TANTOU_EDITOR } from '../constants/roleTerminology.js'

// Thể loại — khớp BE Series GENRES (42+ giá trị; "Slice of life" đúng casing BE)
export const SERIES_GENRES = [
  // Demographics / Format
  'Anime', 'Drama', 'Josei', 'Manhwa', 'One Shot', 'Shounen', 'Webtoons', 'Shoujo',
  // Content themes
  'Harem', 'Ecchi', 'Mature', 'Slice of life', 'Isekai', 'Manga', 'Manhua',
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

/** Giá trị age_rating hợp lệ — khớp BE. */
export const SERIES_AGE_RATINGS = [
  { value: 'All ages', label: 'Mọi lứa tuổi' },
  { value: 'Teens 13+', label: 'Tuổi teen' },
  { value: 'Mature 17+', label: 'Người lớn' },
  { value: 'Adults Only 18+', label: 'Chỉ 18+' },
]

export const SERIES_AGE_RATING_VALUES = SERIES_AGE_RATINGS.map((r) => r.value)

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

export const SERIES_CONTENT_RATINGS = SERIES_AGE_RATINGS

export const SERIES_TAGS = [
  'Isekai', 'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy',
  'Horror', 'Mystery', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports',
  'Supernatural', 'Thriller', 'Historical', 'Martial Arts', 'Mecha',
  'Psychological', 'School', 'Seinen', 'Shoujo', 'Shounen', 'Yaoi', 'Yuri',
  'Ecchi', 'Harem', 'Gore', 'Post-Apocalyptic', 'Cyberpunk', 'Dark Fantasy',
]

/**
 * Trạng thái phát hành (BE: Series.publication_status).
 * null = chưa xác định (series mới, chưa phát hành).
 * Flow: null → EB duyệt → upcoming → job → ongoing → TE: hiatus/completed/dropped
 */
export const SERIES_PUBLICATION_STATUSES = [
  { value: 'upcoming', label: 'Chuẩn bị phát hành' },
  { value: 'ongoing', label: 'Đang phát hành' },
  { value: 'hiatus', label: 'Tạm ngưng' },
  { value: 'completed', label: 'Hoàn thành' },
  { value: 'dropped', label: 'Bị drop' },
]

/** Transition TE được phép (khớp PATCH /te-reviews/series/:id/publication-status). */
export const TE_PUBLICATION_TRANSITIONS = {
  ongoing: ['hiatus', 'completed', 'dropped'],
  hiatus: ['ongoing'],
  dropped: ['ongoing'],
  // completed, upcoming: read-only
}

const PUB_LABEL = Object.fromEntries(SERIES_PUBLICATION_STATUSES.map((p) => [p.value, p.label]))

export function getPublicationStatusLabel(value) {
  if (value == null || value === '') return 'Chưa xác định'
  return PUB_LABEL[value] ?? String(value)
}

export function getAllowedTePublicationStatuses(current) {
  return TE_PUBLICATION_TRANSITIONS[current] ?? []
}

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

export function createEmptySeriesForm(_authorName = '') {
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
    publicationStatus: s.publicationStatus ?? null,
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
    debutGate: s.debutGate && typeof s.debutGate === 'object'
      ? { ...s.debutGate }
      : null,
    deletedAt: s.deletedAt ?? s.deleted_at ?? null,
    apiStatus: s.apiStatus ?? null,
    ebEvaluationId: s.ebEvaluationId ?? null,
    ebEvaluationNotes: s.ebEvaluationNotes ?? null,
  }
  normalized.statusLabel = s.statusLabel ?? buildWorkflowStatusLabel(normalized)
  return normalized
}

export function normalizeSeriesList(list) {
  if (!Array.isArray(list)) return []
  return list.map((s, i) => normalizeSeries(s, i))
}

export function buildWorkflowStatusLabel(s) {
  if (s.status === 'rejected') return 'Bị từ chối bởi Editor Board'
  if (s.status === 'revision') return 'Cần chỉnh sửa theo góp ý EB'
  const pub = getPublicationStatusLabel(s.publicationStatus)
  if (s.status === 'assistant') return 'Đang vẽ ngoại cảnh'
  if (s.status === 'review') return 'Chờ bạn duyệt'
  if (s.status === 'draft') {
    if (s.publicationStatus == null) return `Bản nháp · ${pub}`
    return 'Bản nháp'
  }
  if (s.status === 'approved') return 'Đã duyệt EB'
  return pub
}

/** Series đang rejected/revision — được nộp lại qua TE, nên xác nhận trước khi gửi. */
export function isSeriesEbResubmitStatus(seriesOrStatus) {
  const status = typeof seriesOrStatus === 'string'
    ? seriesOrStatus
    : (seriesOrStatus?.status ?? seriesOrStatus?.apiStatus ?? '')
  const s = String(status ?? '').toLowerCase()
  return s === 'rejected' || s === 'revision'
}

/** @deprecated Dùng isSeriesEbResubmitStatus — không khóa nộp, chỉ cần xác nhận. */
export function isSeriesEbSubmitLocked(seriesOrStatus) {
  return isSeriesEbResubmitStatus(seriesOrStatus)
}

export function getSeriesEbResubmitConfirmMessage(seriesOrStatus, { forTe = false } = {}) {
  const status = typeof seriesOrStatus === 'string'
    ? seriesOrStatus
    : (seriesOrStatus?.status ?? seriesOrStatus?.apiStatus ?? '')
  const s = String(status ?? '').toLowerCase()
  if (forTe) {
    if (s === 'rejected') {
      return 'Series này đang bị EB từ chối. Bạn có chắc gửi lại lên EB không?'
    }
    if (s === 'revision') {
      return 'Series này đang ở trạng thái revision (EB yêu cầu chỉnh). Bạn có chắc gửi lại lên EB không?'
    }
    return 'Series đã từng bị EB trả về. Bạn có chắc gửi lại lên EB không?'
  }
  if (s === 'rejected') {
    return 'Series đang bị EB từ chối. Đã chỉnh theo feedback chưa? Tiếp tục gửi lại cho TE để TE chuyển EB?'
  }
  if (s === 'revision') {
    return 'Series đang ở trạng thái revision. Đã chỉnh theo feedback EB chưa? Tiếp tục gửi lại cho TE?'
  }
  return 'Series đã từng bị EB trả về. Tiếp tục gửi lại cho TE?'
}

/** @deprecated Dùng getSeriesEbResubmitConfirmMessage */
export function getSeriesEbSubmitLockMessage(seriesOrStatus) {
  return getSeriesEbResubmitConfirmMessage(seriesOrStatus)
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
    publicationLabel: getPublicationStatusLabel(s.publicationStatus),
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
  if (!Array.isArray(form.genre) || form.genre.length === 0) {
    errors.genre = 'Vui lòng chọn ít nhất 1 thể loại.'
  } else {
    const invalid = form.genre.filter((g) => !SERIES_GENRES.includes(g))
    if (invalid.length) {
      errors.genre = `Thể loại không hợp lệ: ${invalid.join(', ')}`
    }
  }
  const age = String(form.age_rating ?? '').trim() || 'All ages'
  if (!SERIES_AGE_RATING_VALUES.includes(age)) {
    errors.age_rating = 'Độ tuổi không hợp lệ.'
  }
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
    publicationStatus: null,
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
    publicationStatus: null,
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
