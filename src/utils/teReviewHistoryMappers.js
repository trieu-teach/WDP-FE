import { resolveMediaUrl } from '@/api/http.js'

const TE_HISTORY_DECISIONS = [
  'draft',
  'revision',
  'approved',
  'rejected',
  'approved_publish',
]

export { TE_HISTORY_DECISIONS }

function resolveId(value) {
  if (value == null) return ''
  if (typeof value === 'object') {
    return String(value._id ?? value.id ?? '').trim()
  }
  return String(value).trim()
}

export function teHistoryDecisionLabel(decision) {
  const map = {
    draft: 'Nháp',
    revision: 'Yêu cầu chỉnh',
    approved: 'Đã duyệt',
    rejected: 'Từ chối',
    approved_publish: 'Đã duyệt phát hành',
  }
  return map[String(decision ?? '').toLowerCase()] ?? (decision || '—')
}

export function teHistoryDecisionBadgeClass(decision) {
  const value = String(decision ?? '').toLowerCase()
  if (value === 'approved' || value === 'approved_publish') {
    return 'border-green-200 bg-green-50 text-green-700'
  }
  if (value === 'revision' || value === 'rejected') {
    return 'border-rose-200 bg-rose-50 text-rose-700'
  }
  if (value === 'draft') {
    return 'border-gray-200 bg-gray-100 text-gray-600'
  }
  return 'border-border bg-muted text-muted-foreground'
}

export function teHistoryChapterStatusLabel(status) {
  const value = String(status ?? '').toLowerCase().replace(/\s+/g, '_')
  const map = {
    pending_te: 'Chờ TE',
    te_revision: 'Mangaka sửa',
    pending_eb: 'Chờ EB',
    approved_by_eb: 'Chờ phát hành',
    published: 'Đã publish',
    rejected: 'Từ chối',
  }
  return map[value] ?? (status || '—')
}

export function teHistoryChapterStatusBadgeClass(status) {
  const value = String(status ?? '').toLowerCase().replace(/\s+/g, '_')
  if (value === 'published') {
    return 'border-green-200 bg-green-50 text-green-700'
  }
  if (
    value === 'approved_by_eb'
    || value === 'pending_te'
    || value === 'pending_eb'
  ) {
    return 'border-amber-200 bg-amber-50 text-amber-700'
  }
  if (value === 'te_revision' || value === 'rejected') {
    return 'border-rose-200 bg-rose-50 text-rose-700'
  }
  return 'border-amber-200 bg-amber-50 text-amber-700'
}

/**
 * Map 1 item từ GET /te-reviews/history
 * chapter_id có thể là object populate hoặc id string.
 */
export function mapTeReviewHistoryItem(raw = {}) {
  const chapterRaw =
    raw.chapter_id && typeof raw.chapter_id === 'object'
      ? raw.chapter_id
      : {}
  const seriesRaw =
    chapterRaw.series_id && typeof chapterRaw.series_id === 'object'
      ? chapterRaw.series_id
      : {}
  const submittedBy =
    chapterRaw.submitted_by && typeof chapterRaw.submitted_by === 'object'
      ? chapterRaw.submitted_by
      : {}

  const chapterCover = resolveMediaUrl(
    chapterRaw.cover_image_url ?? chapterRaw.coverImageUrl ?? null,
  )
  const seriesCover = resolveMediaUrl(
    seriesRaw.cover_image_url ?? seriesRaw.coverImageUrl ?? null,
  )

  return {
    id: resolveId(raw),
    decision: String(raw.decision ?? '').toLowerCase(),
    feedback: String(raw.feedback ?? '').trim(),
    revisionFeedback: String(raw.revision_feedback ?? '').trim(),
    quickNotes: String(raw.quick_notes ?? '').trim(),
    annotationsCount: Number(raw.annotations_count ?? 0) || 0,
    createdAt: raw.createdAt ?? raw.created_at ?? null,
    updatedAt: raw.updatedAt ?? raw.updated_at ?? null,
    chapterId:
      resolveId(chapterRaw)
      || (typeof raw.chapter_id !== 'object' ? resolveId(raw.chapter_id) : ''),
    chapterNumber: chapterRaw.chapter_number ?? chapterRaw.chapterNumber ?? null,
    chapterTitle: chapterRaw.title ?? '',
    chapterStatus: chapterRaw.status ?? '',
    isPublished: Boolean(chapterRaw.is_published ?? chapterRaw.isPublished),
    publishedAt: chapterRaw.published_at ?? chapterRaw.publishedAt ?? null,
    scheduledPublishAt:
      chapterRaw.scheduled_publish_at ?? chapterRaw.scheduledPublishAt ?? null,
    publicationSchedule:
      chapterRaw.publication_schedule
      ?? chapterRaw.publicationSchedule
      ?? seriesRaw.publication_schedule
      ?? seriesRaw.publicationSchedule
      ?? null,
    coverImageUrl: chapterCover || seriesCover || null,
    seriesId: resolveId(seriesRaw),
    seriesName: seriesRaw.name ?? 'Series',
    seriesStatus: seriesRaw.status ?? null,
    authorName:
      submittedBy.full_name
      ?? submittedBy.fullName
      ?? submittedBy.username
      ?? '',
    raw,
  }
}

/** Chuẩn hoá response mới { items, pagination } (+ fallback array cũ). */
export function mapTeReviewHistoryResponse(body) {
  const data = body?.data ?? body ?? {}

  if (Array.isArray(data)) {
    return {
      items: data.map(mapTeReviewHistoryItem),
      pagination: {
        page: 1,
        limit: data.length,
        total: data.length,
        totalPages: 1,
      },
    }
  }

  const itemsRaw = Array.isArray(data.items)
    ? data.items
    : (Array.isArray(data.reviews) ? data.reviews : [])
  const pagination = data.pagination ?? {}

  return {
    items: itemsRaw.map(mapTeReviewHistoryItem),
    pagination: {
      page: Number(pagination.page ?? 1) || 1,
      limit: Number(pagination.limit ?? 20) || 20,
      total: Number(pagination.total ?? itemsRaw.length) || 0,
      totalPages: Number(pagination.total_pages ?? pagination.totalPages ?? 1) || 1,
    },
  }
}
