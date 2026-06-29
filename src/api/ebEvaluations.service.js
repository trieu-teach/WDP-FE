import { http } from './http.js'
import { chaptersService } from './chapters.service.js'
import { ebScoresService } from './ebScores.service.js'
import { buildEbChapterDetailPayload } from '@/utils/ebEvaluationMappers.js'
import { resolveEntityId } from '@/utils/notificationTarget.js'

function unwrap(res) {
  if (res && typeof res === 'object' && res.success !== undefined && res.data !== undefined) {
    return res
  }
  return res
}

function unwrapData(res) {
  const body = unwrap(res)
  return body?.data ?? body
}

function normalizePendingListResponse(body) {
  const data = body?.data ?? body
  if (Array.isArray(data)) {
    return { items: data, pagination: body?.pagination ?? null }
  }
  if (data && typeof data === 'object' && Array.isArray(data.items)) {
    return {
      items: data.items,
      pagination: data.pagination ?? body?.pagination ?? null,
    }
  }
  return { items: [], pagination: body?.pagination ?? null }
}

export const ebEvaluationsService = {
  /**
   * GET /eb-evaluations/pending — hàng chờ chapter chờ EB (Swagger BE).
   * Fallback /chapter-pending nếu BE triển khai route mới sau này.
   */
  getChapterPending(params = {}) {
    return http
      .get('/eb-evaluations/pending', { params })
      .then((res) => normalizePendingListResponse(unwrap(res)))
      .catch(async (err) => {
        if (err?.response?.status !== 404) throw err
        const res = await http.get('/eb-evaluations/chapter-pending', { params })
        return normalizePendingListResponse(unwrap(res))
      })
  },

  /** GET /eb-evaluations/series/:seriesId/detail — series + first_chapter.pages + pending_chapters */
  getSeriesDetail(seriesId) {
    return http.get(`/eb-evaluations/series/${seriesId}/detail`).then(unwrapData)
  },

  /** @deprecated Dùng getChapterPending */
  getPending() {
    return this.getChapterPending().then((res) => res.items)
  },

  /**
   * Load context chấm chapter EB.
   * BE không có GET /eb-evaluations/chapter/:id — dùng:
   * 1. GET /eb-scores/chapter/:id/preview
   * 2. GET /eb-evaluations/series/:seriesId/detail
   */
  async getChapterDetail(chapterId) {
    const id = String(chapterId ?? '').trim()
    if (!id) throw new Error('chapterId required')

    let preview = null
    let seriesId = ''

    try {
      preview = await ebScoresService.getChapterPreview(id)
      seriesId = resolveEntityId(preview?.series?._id ?? preview?.series?.id)
    } catch {
      preview = null
    }

    if (!seriesId) {
      try {
        const ch = await chaptersService.getById(id)
        const raw = ch?.chapter ?? ch
        seriesId = resolveEntityId(
          raw?.series_id?._id ?? raw?.series_id ?? raw?.seriesId,
        )
        if (!preview && raw) {
          preview = { chapter: raw, series: raw.series_id }
        }
      } catch {
        /* fallback below */
      }
    }

    if (!seriesId) {
      const err = new Error('Không xác định được series cho chapter.')
      err.response = { status: 404 }
      throw err
    }

    const seriesDetail = await this.getSeriesDetail(seriesId)
    return buildEbChapterDetailPayload({
      preview,
      seriesDetail,
      chapterId: id,
    })
  },

  /**
   * POST /eb-evaluations/chapter/:chapterId/evaluate
   * Body: { member_scores: [{ member_id, scores }], notes? }
   */
  evaluateChapter(chapterId, payload) {
    return http
      .post(`/eb-evaluations/chapter/${chapterId}/evaluate`, payload)
      .then(unwrapData)
  },

  /**
   * POST /eb-evaluations/series/:seriesId/confirm-publish
   * Body: {
   *   publication_schedule?: "weekly"|"monthly",
   *   scheduled_publish_at?: string — ISO 8601 (ngày + giờ + phút)
   * }
   */
  confirmPublish(seriesId, { publication_schedule, scheduled_publish_at } = {}) {
    const id = String(seriesId ?? '').trim()
    if (!id) {
      return Promise.reject(new Error('seriesId required'))
    }
    const body = {}
    if (publication_schedule) body.publication_schedule = publication_schedule
    if (scheduled_publish_at) body.scheduled_publish_at = scheduled_publish_at
    return http
      .post(`/eb-evaluations/series/${id}/confirm-publish`, body)
      .then(unwrapData)
  },
}
