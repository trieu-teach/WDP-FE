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

/** Chuẩn hoá status local sau te-action approve. */
export const TE_CHAPTER_APPROVED_STATUS = 'approved_by_EB'

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
  if (status === 403) {
    return 'Chỉ TE đã phê duyệt chapter mới được phát hành.'
  }
  if (status === 400) {
    return 'Chapter chưa ở trạng thái approved_by_EB — hãy phê duyệt trước.'
  }
  return getApiErrorMessage(err, fallback)
}
