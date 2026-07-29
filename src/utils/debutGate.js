/**
 * Debut gate (luồng 1) — BE chặn submit-to-TE khi series locked,
 * không chặn tạo chapter.
 *
 * Shape BE:
 * {
 *   locked, can_create_next_chapter, can_submit_more_chapters,
 *   max_submitted_chapters_allowed, current_submitted_chapter_count,
 *   current_chapter_count, reasons
 * }
 */

export function apiDebutGateToUi(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    locked: Boolean(raw.locked),
    canCreateNextChapter: raw.can_create_next_chapter !== false,
    canSubmitMoreChapters: raw.can_submit_more_chapters !== false,
    maxSubmittedChaptersAllowed:
      raw.max_submitted_chapters_allowed != null
        ? Number(raw.max_submitted_chapters_allowed)
        : 1,
    currentSubmittedChapterCount: Number(
      raw.current_submitted_chapter_count ?? 0,
    ) || 0,
    currentChapterCount: Number(raw.current_chapter_count ?? 0) || 0,
    reasons: Array.isArray(raw.reasons) ? raw.reasons.map(String) : [],
  }
}

/** Tạo chapter luôn được phép theo gate mới (fallback true nếu thiếu gate). */
export function canCreateChapterWithDebutGate(debutGate) {
  if (!debutGate) return true
  return debutGate.canCreateNextChapter !== false
}

/**
 * Submit thêm chapter sang TE chỉ khi gate mở.
 * `can_submit_more_chapters === false` → khóa (đã có ≥1 chapter đã submit).
 */
export function canSubmitMoreChaptersToTe(debutGate) {
  if (!debutGate) return true
  return debutGate.canSubmitMoreChapters !== false
}

export function getDebutSubmitLockedMessage(debutGate) {
  const count = debutGate?.currentSubmittedChapterCount ?? 1
  const max = debutGate?.maxSubmittedChaptersAllowed ?? 1
  return (
    `Series đang khóa debut: chỉ được gửi tối đa ${max} chapter sang TE `
    + `(hiện đã gửi ${count}). Chờ EB chấm xong và confirm-publish rồi mới gửi tiếp.`
  )
}

export function isDebutSubmitLockedError(err) {
  const code = String(err?.response?.data?.code ?? err?.code ?? '').trim()
  if (code === 'DEBUT_SUBMIT_LOCKED' || code === 'DEBUT_GATE_LOCKED') return true
  const status = err?.response?.status
  const msg = String(err?.response?.data?.message ?? err?.message ?? '')
  return status === 409 && /debut|submit.?lock|gate/i.test(msg)
}

export function findSeriesDebutGate(seriesList, chapter) {
  const list = Array.isArray(seriesList) ? seriesList : []
  if (!list.length || !chapter) return null
  const seriesId = chapter.seriesId ?? chapter.series_id ?? null
  if (seriesId) {
    const byId = list.find((s) => String(s.id) === String(seriesId))
    if (byId?.debutGate) return byId.debutGate
  }
  const title = String(chapter.series ?? chapter.seriesTitle ?? '').trim()
  if (title) {
    const byTitle = list.find((s) => String(s.title) === title)
    if (byTitle?.debutGate) return byTitle.debutGate
  }
  return null
}
