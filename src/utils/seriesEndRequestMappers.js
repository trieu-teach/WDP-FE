import { resolveMediaUrl } from '@/api/http.js'
import { getPublicationStatusLabel } from '@/utils/seriesModel.js'

export const SERIES_END_REQUEST_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'cancelled',
]

export const SERIES_END_STATUS_META = {
  pending: {
    label: 'Chờ duyệt',
    className:
      'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200',
  },
  approved: {
    label: 'Đã duyệt',
    className:
      'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200',
  },
  rejected: {
    label: 'Từ chối',
    className:
      'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200',
  },
  cancelled: {
    label: 'Đã hủy',
    className:
      'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-500/40 dark:bg-slate-500/15 dark:text-slate-300',
  },
}

/** publication_status cho phép gửi yêu cầu kết thúc */
export const SERIES_END_ELIGIBLE_PUBLICATION = new Set([
  'upcoming',
  'ongoing',
  'hiatus',
])

export function canRequestSeriesEnd(publicationStatus) {
  return SERIES_END_ELIGIBLE_PUBLICATION.has(
    String(publicationStatus ?? '').toLowerCase(),
  )
}

export function seriesEndStatusLabel(status) {
  return SERIES_END_STATUS_META[status]?.label ?? String(status ?? '—')
}

export function isSeriesPublicationCompleted(itemOrStatus) {
  if (typeof itemOrStatus === 'string' || itemOrStatus == null) {
    return String(itemOrStatus ?? '').toLowerCase() === 'completed'
  }
  const pub =
    itemOrStatus?.seriesPublicationStatus
    ?? itemOrStatus?.series?.publicationStatus
    ?? ''
  return String(pub).toLowerCase() === 'completed'
}

/**
 * Yêu cầu đang chặn gửi mới (pending hoặc approved nhưng series chưa completed).
 */
export function blocksNewEndRequest(item) {
  const status = String(item?.status ?? '').toLowerCase()
  if (status === 'pending') return true
  if (status === 'approved' && !isSeriesPublicationCompleted(item)) return true
  return false
}

/**
 * Nhãn hiển thị theo request.status + series.publication_status (không nhầm approved = completed).
 */
export function getSeriesEndRequestDisplayStatus(item) {
  const status = String(item?.status ?? '').toLowerCase()
  if (status === 'pending') {
    return {
      key: 'pending',
      label: 'Đang chờ admin duyệt',
      className: SERIES_END_STATUS_META.pending.className,
    }
  }
  if (status === 'approved') {
    if (isSeriesPublicationCompleted(item)) {
      return {
        key: 'completed',
        label: 'Đã hoàn thành',
        className:
          'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200',
      }
    }
    return {
      key: 'awaiting_publish',
      label: 'Đã duyệt, đang chờ chapter cuối publish',
      className:
        'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/40 dark:bg-sky-500/15 dark:text-sky-200',
    }
  }
  if (status === 'rejected') {
    return {
      key: 'rejected',
      label: 'Bị từ chối',
      className: SERIES_END_STATUS_META.rejected.className,
    }
  }
  if (status === 'cancelled') {
    return {
      key: 'cancelled',
      label: 'Đã hủy',
      className: SERIES_END_STATUS_META.cancelled.className,
    }
  }
  return {
    key: status,
    label: seriesEndStatusLabel(status),
    className: seriesEndStatusClass(status),
  }
}

export function seriesEndStatusClass(status) {
  return (
    SERIES_END_STATUS_META[status]?.className
    ?? 'border-border bg-muted text-muted-foreground'
  )
}

function mapPerson(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    id: raw.id ?? raw._id ?? null,
    name: raw.name ?? raw.full_name ?? raw.fullName ?? raw.username ?? '',
    email: raw.email ?? '',
    phoneNumber: raw.phoneNumber ?? raw.phone_number ?? '',
  }
}

function mapSeriesBrief(raw) {
  if (!raw || typeof raw !== 'object') return null
  const publicationStatus =
    raw.publication_status !== undefined
      ? raw.publication_status
      : (raw.publicationStatus ?? null)
  return {
    id: raw.id ?? raw._id ?? null,
    name: raw.name ?? raw.title ?? '',
    coverImageUrl: resolveMediaUrl(
      raw.cover_image_url ?? raw.coverImageUrl ?? raw.coverImage ?? null,
    ),
    publicationStatus,
    publicationLabel: getPublicationStatusLabel(publicationStatus),
    status: raw.status ?? null,
  }
}

function mapScheduledChapter(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    id: raw.id ?? raw._id ?? null,
    chapterNumber: Number(raw.chapter_number ?? raw.chapterNumber ?? 0) || 0,
    title: raw.title ?? '',
    status: raw.status ?? '',
    scheduledPublishAt:
      raw.scheduled_publish_at ?? raw.scheduledPublishAt ?? null,
  }
}

/** final_chapter từ GET detail hoặc PATCH approve response */
export function mapFinalChapterInfo(raw) {
  if (!raw || typeof raw !== 'object') return null
  const number = Number(
    raw.number ?? raw.chapter_number ?? raw.chapterNumber ?? NaN,
  )
  if (!Number.isFinite(number)) return null
  return {
    number,
    isPublished: Boolean(raw.is_published ?? raw.isPublished),
    isScheduled: Boolean(raw.is_scheduled ?? raw.isScheduled),
    status: String(raw.status ?? '').trim(),
  }
}

/** Map response PATCH approve/reject */
export function mapSeriesEndDecideResult(raw = {}) {
  const cancelledAfter =
    raw.cancelled_scheduled_chapters_after_final
      ?? raw.cancelledScheduledChaptersAfterFinal
  const chaptersCancelled =
    cancelledAfter != null
      ? Number(cancelledAfter)
      : (raw.chapters_cancelled != null
        ? Number(raw.chapters_cancelled)
        : (raw.chaptersCancelled != null ? Number(raw.chaptersCancelled) : null))

  return {
    id: raw.id ?? raw._id ?? null,
    status: String(raw.status ?? '').toLowerCase() || null,
    seriesPublicationStatus:
      raw.series_publication_status ?? raw.seriesPublicationStatus ?? null,
    seriesPublicationSchedule:
      raw.series_publication_schedule ?? raw.seriesPublicationSchedule ?? null,
    seriesScheduledPublishAt:
      raw.series_scheduled_publish_at ?? raw.seriesScheduledPublishAt ?? null,
    completedNow: Boolean(raw.completed_now ?? raw.completedNow),
    chaptersCancelled,
    cancelledScheduledChaptersAfterFinal:
      cancelledAfter != null ? Number(cancelledAfter) : null,
    finalChapter: mapFinalChapterInfo(raw.final_chapter ?? raw.finalChapter),
  }
}

export function finalChapterNeedsMangakaAction(finalChapter) {
  return Boolean(finalChapter && !finalChapter.isPublished)
}

/**
 * End request đã approved nhưng series chưa completed (đang chờ publish chapter #N).
 */
export function isApprovedAwaitingFinalPublish(item) {
  if (!item || String(item.status).toLowerCase() !== 'approved') return false
  const pub = String(
    item.seriesPublicationStatus
      ?? item.series?.publicationStatus
      ?? '',
  ).toLowerCase()
  return pub !== 'completed'
}

export function approvedAwaitingFinalPublishMessage(item) {
  const n =
    item?.plannedFinalChapterNumber
    ?? item?.finalChapter?.number
    ?? null
  if (n == null) {
    return 'Đã được Admin duyệt, đang chờ chapter chốt được publish để hoàn thành series.'
  }
  return `Đã được Admin duyệt, đang chờ chapter #${n} được publish để hoàn thành series.`
}

export function formatChapterWorkflowStatus(status) {
  const key = String(status ?? '').toLowerCase()
  const labels = {
    draft: 'Nháp',
    pending_assistant: 'Chờ Assistant',
    pending_te: 'Chờ TE',
    te_revision: 'TE yêu cầu sửa',
    pending_eb: 'Chờ EB',
    eb_revision: 'EB yêu cầu sửa',
    approved_by_eb: 'EB đã duyệt',
    scheduled: 'Đã lên lịch',
    published: 'Đã publish',
  }
  return labels[key] ?? (status || '—')
}

/** Map 1 item từ GET /series/end-requests/my hoặc admin list */
export function mapSeriesEndRequestListItem(raw = {}) {
  const series = mapSeriesBrief(raw.series)
  const status = String(raw.status ?? 'pending').toLowerCase()
  const decidedAt = raw.decided_at ?? raw.decidedAt ?? null
  const createdAt = raw.createdAt ?? raw.created_at ?? null
  const adminNote = raw.admin_note ?? raw.adminNote ?? ''

  // Auto-cancel sau 7 ngày: BE thường để status=cancelled + note/message
  const autoCancelled =
    status === 'cancelled'
    && (
      Boolean(raw.auto_cancelled ?? raw.autoCancelled)
      || /7\s*ngày|auto|tự động/i.test(String(adminNote))
      || /7\s*ngày|auto|tự động/i.test(String(raw.cancel_reason ?? raw.cancelReason ?? ''))
    )

  return {
    id: raw.id ?? raw._id,
    series,
    seriesId: series?.id ?? raw.series_id ?? raw.seriesId ?? null,
    reason: raw.reason ?? '',
    plannedFinalChapterNumber:
      raw.planned_final_chapter_number != null
        ? Number(raw.planned_final_chapter_number)
        : (raw.plannedFinalChapterNumber != null
          ? Number(raw.plannedFinalChapterNumber)
          : null),
    status,
    adminNote,
    decidedAt,
    createdAt,
    requestedBy: mapPerson(raw.requested_by ?? raw.requestedBy),
    decidedBy: mapPerson(raw.decided_by ?? raw.decidedBy),
    seriesPublicationStatus:
      raw.series_publication_status
        ?? raw.seriesPublicationStatus
        ?? series?.publicationStatus
        ?? null,
    autoCancelled,
    autoCancelMessage: autoCancelled
      ? 'Tự động hủy sau 7 ngày không được duyệt'
      : null,
  }
}

/** Map chi tiết GET /admin/end-requests/:id */
export function mapSeriesEndRequestDetail(raw = {}) {
  const base = mapSeriesEndRequestListItem(raw)
  const summary = raw.series_chapters_summary ?? raw.seriesChaptersSummary ?? {}
  const scheduled = Array.isArray(raw.scheduled_chapters)
    ? raw.scheduled_chapters
    : (Array.isArray(raw.scheduledChapters) ? raw.scheduledChapters : [])
  const coop = raw.active_cooperation ?? raw.activeCooperation ?? null

  const finalFromPayload = mapFinalChapterInfo(
    raw.final_chapter
      ?? raw.finalChapter
      ?? summary.final_chapter
      ?? summary.finalChapter,
  )

  const planned = base.plannedFinalChapterNumber
  const scheduledMapped = scheduled.map(mapScheduledChapter).filter(Boolean)
  const plannedScheduled = planned != null
    ? scheduledMapped.find((ch) => ch.chapterNumber === planned)
    : null

  // Suy ra trạng thái chapter cuối nếu BE chưa gửi final_chapter object
  let finalChapter = finalFromPayload
  if (!finalChapter && planned != null) {
    const publishedCount = Number(summary.published ?? 0) || 0
    const total = Number(summary.total ?? 0) || 0
    // Heuristic nhẹ: nếu planned nằm trong scheduled list → chưa publish nhưng có lịch
    if (plannedScheduled) {
      finalChapter = {
        number: planned,
        isPublished: false,
        isScheduled: true,
        status: plannedScheduled.status || 'scheduled',
      }
    } else if (total > 0 && publishedCount >= planned) {
      finalChapter = {
        number: planned,
        isPublished: true,
        isScheduled: false,
        status: 'published',
      }
    } else {
      finalChapter = {
        number: planned,
        isPublished: false,
        isScheduled: false,
        status: summary.final_chapter_status
          ?? summary.finalChapterStatus
          ?? '',
      }
    }
  }

  return {
    ...base,
    chaptersSummary: {
      total: Number(summary.total ?? 0) || 0,
      published: Number(summary.published ?? 0) || 0,
      scheduledFuture:
        Number(summary.scheduled_future ?? summary.scheduledFuture ?? 0) || 0,
    },
    scheduledChapters: scheduledMapped,
    finalChapter,
    activeCooperation: coop && typeof coop === 'object'
      ? {
          id: coop.id ?? coop._id ?? null,
          assistant: mapPerson(coop.assistant),
        }
      : null,
  }
}

export function mapSeriesEndRequestListResponse(payload) {
  const items = Array.isArray(payload?.items)
    ? payload.items
    : (Array.isArray(payload) ? payload : [])
  return {
    items: items.map(mapSeriesEndRequestListItem),
    total: Number(payload?.total ?? items.length) || 0,
    page: Number(payload?.page ?? 1) || 1,
    limit: Number(payload?.limit ?? 20) || 20,
  }
}

export function formatSeriesEndDateTime(value) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

export function truncateText(text, max = 80) {
  const s = String(text ?? '').trim()
  if (s.length <= max) return s
  return `${s.slice(0, max - 1)}…`
}
