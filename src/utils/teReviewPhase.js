/**
 * TE review — 2 giai đoạn (BE field `phase` hoặc suy từ series.status).
 *
 * series_level: Series chưa EB-approved → TE duyệt Series + Chapter → pending_EB
 * chapter_level: Series đã EB-approved → TE chỉ duyệt Chapter → published
 */

import { getApiErrorMessage } from '@/api/http.js'

export const SERIES_LEVEL_STATUSES = [
  'draft',
  'submitted',
  'rejected',
  'cancelled',
]

export const CHAPTER_LEVEL_STATUSES = [
  'approved_by_eb',
  'approved',
  'published',
]

/** @returns {'series_level' | 'chapter_level'} */
export function resolveTePhase({ phase, seriesStatus } = {}) {
  const normalized = String(phase ?? '').toLowerCase()
  if (normalized === 'series_level' || normalized === 'chapter_level') {
    return normalized
  }

  const status = String(seriesStatus ?? '').toLowerCase()
  if (SERIES_LEVEL_STATUSES.includes(status)) return 'series_level'
  if (CHAPTER_LEVEL_STATUSES.includes(status)) return 'chapter_level'

  return 'series_level'
}

/** Chuẩn hoá phase từ BE `phase` hoặc legacy `pipeline`. */
export function coerceTePhase(value, seriesStatus) {
  const v = String(value ?? '').toLowerCase()
  if (v === 'chapter_level' || v === 'recurring') return 'chapter_level'
  if (v === 'series_level' || v === 'debut') return 'series_level'
  return resolveTePhase({ phase: value, seriesStatus })
}

export function isSeriesLevelPhase(phaseOrInput, seriesStatus) {
  if (typeof phaseOrInput === 'object' && phaseOrInput !== null) {
    return resolveTePhase(phaseOrInput) === 'series_level'
  }
  return coerceTePhase(phaseOrInput, seriesStatus) === 'series_level'
}

export function isChapterLevelPhase(phaseOrInput, seriesStatus) {
  if (typeof phaseOrInput === 'object' && phaseOrInput !== null) {
    return resolveTePhase(phaseOrInput) === 'chapter_level'
  }
  return coerceTePhase(phaseOrInput, seriesStatus) === 'chapter_level'
}

/** Giữ tương thích UI cũ: debut = series_level, recurring = chapter_level */
export function phaseToPipeline(phase) {
  return isChapterLevelPhase(phase) ? 'recurring' : 'debut'
}

export function pipelineToPhase(pipeline) {
  return pipeline === 'recurring' ? 'chapter_level' : 'series_level'
}

export function tePhaseLabel(phaseOrPipeline, seriesStatus) {
  return isChapterLevelPhase(phaseOrPipeline, seriesStatus)
    ? 'Giai đoạn 2 — Duyệt chapter'
    : 'Giai đoạn 1 — Duyệt series'
}

export function mangakaTeSubmitMessage(phaseOrPipeline, seriesStatus) {
  return isChapterLevelPhase(phaseOrPipeline, seriesStatus)
    ? 'Đã gửi chapter cho TE — TE sẽ duyệt để publish.'
    : 'Đã gửi chapter cho TE — TE sẽ duyệt series và gửi EB nếu đạt.'
}

/** Giai đoạn 2 — chapter approved_by_EB, TE publish thủ công (không qua te-action). */
export function isChapterAwaitingTePublish(chapterStatus) {
  return String(chapterStatus ?? '').toLowerCase() === 'approved_by_eb'
}

/** Chapter đã published (API hoặc UI status). */
export function isTeChapterPublishedStatus(status) {
  const value = String(status ?? '').toLowerCase().replace(/\s+/g, '_')
  return value === 'published' || value === 'approved_publish'
}

/**
 * BE: scheduled_publish_at bắt buộc khi đây là lần publish đầu của series
 * (chưa có chapter nào published). Chapter 2+ job auto-schedule theo cadence.
 */
export function requiresTeManualScheduledPublish(chapters = []) {
  if (!Array.isArray(chapters) || chapters.length === 0) {
    // Chưa có list → coi như first publish (an toàn hơn, hiện dialog).
    return true
  }
  return !chapters.some((ch) => {
    if (!ch || typeof ch !== 'object') return false
    if (ch.publishedAt || ch.published_at) return true
    return isTeChapterPublishedStatus(
      ch.status ?? ch.apiChapterStatus ?? ch.api_status,
    )
  })
}

/** Chuẩn hoá status local sau te-action approve. */
export const TE_CHAPTER_APPROVED_STATUS = 'approved_by_EB'

/** UI status: đã phê duyệt, chờ TE bấm Phát hành. */
export const TE_UI_AWAITING_PUBLISH = 'awaiting_publish'

/** UI status: đã lên lịch, chờ job publish (có thể bị buffer hold). */
export const TE_UI_SCHEDULED = 'scheduled'

/** Gợi ý buffer cho panel Phát hành — chỉ thông tin, không chặn. */
export const TE_PUBLISH_BUFFER_HINT =
  'Job chỉ phát hành khi đủ ≥2 chapter đã duyệt chưa publish. '
  + 'Miễn: chapter đầu series, hoặc chapter cuối khi series đã completed. '
  + 'Buffer chưa đủ → vẫn lên lịch được, job có thể tạm giữ (Policy B).'

/**
 * Lấy next_step từ response te-action approve.
 * Shape: { action: 'publish', endpoint: 'POST /te-reviews/chapter/:id/publish' }
 */
export function parseTeActionNextStep(res) {
  const raw =
    res?.data?.next_step
    ?? res?.next_step
    ?? res?.data?.data?.next_step
    ?? null
  if (!raw || typeof raw !== 'object') return null
  const action = String(raw.action ?? '').toLowerCase()
  const endpoint = String(raw.endpoint ?? '').trim()
  if (!action && !endpoint) return null
  return { action: action || 'publish', endpoint }
}

/** Message lỗi POST .../publish theo status code. */
export function formatTeChapterPublishError(err, fallback = 'Không phát hành được chapter.') {
  const status = err?.response?.status
  const apiMessage = getApiErrorMessage(err, '')
  if (status === 403) {
    return 'Chỉ TE đã phê duyệt chapter mới được phát hành.'
  }
  if (status === 400) {
    if (apiMessage && /scheduled_publish_at|chapter đầu/i.test(apiMessage)) {
      return apiMessage
    }
    return apiMessage || 'Chapter chưa ở trạng thái approved_by_EB — hãy phê duyệt trước.'
  }
  return apiMessage || fallback
}

/**
 * Chapter fields từ POST .../publish (sau khi service giữ message + buffer).
 */
export function parseTePublishChapterResult(res) {
  if (!res || typeof res !== 'object') {
    return {
      apiChapterStatus: null,
      isScheduled: false,
      scheduledPublishAt: null,
      publishedAt: null,
    }
  }
  const apiChapterStatus =
    res.status != null ? String(res.status) : null
  const isScheduled = Boolean(
    res.is_scheduled ?? res.isScheduled ?? res.is_scheduled_publish,
  )
  const scheduledPublishAt =
    res.scheduled_publish_at
    ?? res.scheduledPublishAt
    ?? null
  const publishedAt = res.published_at ?? res.publishedAt ?? null
  return {
    apiChapterStatus,
    isScheduled,
    scheduledPublishAt: scheduledPublishAt != null ? String(scheduledPublishAt) : null,
    publishedAt: publishedAt != null ? String(publishedAt) : null,
  }
}

/**
 * Map status BE + lịch → status UI (không đổi rule publish).
 * - published → approved_publish
 * - approved_by_EB + scheduled → scheduled
 * - approved_by_EB → awaiting_publish
 */
export function resolveTeUiChapterStatus({
  apiStatus,
  isScheduled = false,
  scheduledPublishAt = null,
} = {}) {
  const value = String(apiStatus ?? '').toLowerCase().replace(/\s+/g, '_')
  if (value === 'published' || value === 'approved_publish') {
    return 'approved_publish'
  }
  if (value === 'approved_by_eb') {
    if (isScheduled || scheduledPublishAt) return TE_UI_SCHEDULED
    return TE_UI_AWAITING_PUBLISH
  }
  if (value === 'pending_eb' || value === 'forwarded_eb') return 'forwarded_eb'
  if (value.includes('revision') || value === 'rejected' || value === 'reject') {
    return 'revision'
  }
  if (value.includes('publish')) return 'approved_publish'
  return 'pending'
}

/** Hiển thị scheduled_publish_at (ISO) giờ VN. */
export function formatTeScheduledPublishDisplay(isoValue) {
  if (!isoValue) return ''
  const date = new Date(isoValue)
  if (Number.isNaN(date.getTime())) return String(isoValue)
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(date)
}

/**
 * Buffer soft-warning từ POST .../publish.
 * Shape: {
 *   approved_unpublished_count, min_required, is_final_chapter,
 *   series_completed, is_first_chapter_of_series, ok, warning
 * }
 * Buffer OK khi: chapter đầu series HOẶC count >= 2 HOẶC (completed + final).
 */
export function parseTePublishBuffer(res) {
  const raw = res?.buffer ?? null
  if (!raw || typeof raw !== 'object') return null
  const approvedCount = Number(raw.approved_unpublished_count)
  const minRequired = Number(raw.min_required)
  const min = Number.isFinite(minRequired) ? minRequired : 2
  const count = Number.isFinite(approvedCount) ? approvedCount : null
  const isFirstChapterOfSeries = Boolean(
    raw.is_first_chapter_of_series ?? raw.is_first_chapter,
  )
  const isFinalChapter = Boolean(raw.is_final_chapter)
  const seriesCompleted = Boolean(raw.series_completed)
  const derivedOk =
    isFirstChapterOfSeries
    || (count != null && count >= min)
    || (seriesCompleted && isFinalChapter)
  return {
    approvedUnpublishedCount: count,
    minRequired: min,
    isFinalChapter,
    seriesCompleted,
    isFirstChapterOfSeries,
    ok: raw.ok != null ? Boolean(raw.ok) : derivedOk,
    warning: raw.warning != null ? String(raw.warning).trim() : '',
  }
}

/** Toast / copy khi buffer chưa đủ — schedule vẫn OK, job tạm giữ (Policy B). */
export function formatTePublishBufferWarning(buffer, fallback) {
  if (!buffer || buffer.ok || buffer.isFirstChapterOfSeries) return ''
  if (fallback) return String(fallback)
  const count = buffer.approvedUnpublishedCount
  const min = buffer.minRequired ?? 2
  if (count != null) {
    return (
      `Hiện có ${count}/${min} chapter đã duyệt chưa publish. `
      + 'Job sẽ tạm giữ chapter này đến khi đủ buffer '
      + '(hoặc đây là chapter cuối của series đã completed).'
    )
  }
  return (
    'Buffer chưa đủ (≥2 chapter đã duyệt chưa publish). '
    + 'Job sẽ tạm giữ chapter này; lịch/cadence vẫn được giữ.'
  )
}

/**
 * Toast success sau POST publish.
 * Không dùng nguyên message BE nếu buffer chưa đủ — tránh mâu thuẫn
 * ("sẽ publish khi tới hạn" vs "job tạm giữ").
 */
export function formatTePublishSuccessMessage(res, {
  seriesName = '',
  chapterNumber = '',
  buffer: bufferArg,
} = {}) {
  const chapter = parseTePublishChapterResult(res)
  const buffer = bufferArg ?? parseTePublishBuffer(res)
  const chLabel = chapterNumber ? ` · Ch.${chapterNumber}` : ''
  const title = seriesName ? `"${seriesName}"${chLabel}` : (chLabel.replace(/^ · /, '') || 'chapter')
  const when = formatTeScheduledPublishDisplay(chapter.scheduledPublishAt)
  const status = String(chapter.apiChapterStatus ?? '').toLowerCase()

  if (status === 'published') {
    return `Đã phát hành ${title}.`
  }

  if (buffer?.isFirstChapterOfSeries) {
    return when
      ? `Đã lên lịch phát hành ${title} · ${when}.`
      : `Đã lên lịch phát hành ${title}.`
  }

  if (buffer && !buffer.ok) {
    return when
      ? `Đã lên lịch ${title} · ${when}. Job sẽ tạm giữ đến khi đủ buffer.`
      : `Đã lên lịch ${title} theo chu kỳ series. Job sẽ tạm giữ đến khi đủ buffer.`
  }

  if (chapter.isScheduled || chapter.scheduledPublishAt || buffer?.ok) {
    return when
      ? `Đã lên lịch ${title} theo chu kỳ series · ${when}. Job sẽ publish khi tới hạn.`
      : `Đã lên lịch ${title} theo chu kỳ series. Job sẽ publish khi tới hạn.`
  }

  if (res?.message) return String(res.message)
  return `Đã gửi yêu cầu phát hành ${title}.`
}
