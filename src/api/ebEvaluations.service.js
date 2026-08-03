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
   * Body: {
   *   rubric_id?,
   *   content_levels?,
   *   member_scores: [{ member_id, member_name, scores, extension_scores? }],
   *   notes?, result?
   * }
   */
  evaluateChapter(chapterId, payload) {
    return http
      .post(`/eb-evaluations/chapter/${chapterId}/evaluate`, payload)
      .then(unwrapData)
  },

  /**
   * POST /eb-evaluations/series/:seriesId/evaluate — first review + rubric + age safety.
   */
  evaluateSeries(seriesId, payload) {
    const id = String(seriesId ?? '').trim()
    if (!id) return Promise.reject(new Error('seriesId required'))
    return http
      .post(`/eb-evaluations/series/${id}/evaluate`, payload)
      .then(unwrapData)
  },

  /**
   * GET /eb-evaluations/age-safety-check
   * Query flat: age_rating + violence, fear, profanity, nudity, danger_simulation
   */
  checkAgeSafety(params = {}) {
    const query = {}
    if (params.age_rating != null) query.age_rating = params.age_rating
    if (params.series_id) query.series_id = params.series_id
    const levels = params.content_levels && typeof params.content_levels === 'object'
      ? params.content_levels
      : params
    for (const key of [
      'violence',
      'fear',
      'profanity',
      'nudity',
      'danger_simulation',
    ]) {
      if (levels[key] != null) query[key] = levels[key]
    }
    return http
      .get('/eb-evaluations/age-safety-check', { params: query })
      .then(unwrap)
  },

  /**
   * POST /eb-evaluations/preview-council-average
   * Body: { rubric_id, member_scores }
   * Response data: weighted_council_average, per_criteria_averages, classification...
   */
  previewCouncilAverage(payload) {
    return http
      .post('/eb-evaluations/preview-council-average', payload)
      .then(unwrapData)
  },

  /**
   * GET /eb-evaluations/rubrics?family=
   */
  getRubrics(params = {}) {
    return http.get('/eb-evaluations/rubrics', { params }).then(unwrap)
  },

  /** GET /eb-evaluations/suggest-rubric/:seriesId → suggested_rubric + alternatives */
  suggestRubric(seriesId) {
    const id = String(seriesId ?? '').trim()
    if (!id) return Promise.reject(new Error('seriesId required'))
    return http
      .get(`/eb-evaluations/suggest-rubric/${id}`)
      .then(unwrap)
  },

  /**
   * PATCH /eb-evaluations/series/:seriesId/decision
   * Body: { decision: continue|cancelled|change_schedule, schedule? }
   */
  decideSeries(seriesId, payload) {
    const id = String(seriesId ?? '').trim()
    if (!id) return Promise.reject(new Error('seriesId required'))
    return http
      .patch(`/eb-evaluations/series/${id}/decision`, payload)
      .then(unwrapData)
  },

  /** GET /eb-evaluations/series/:seriesId — lịch sử chấm của 1 series */
  getSeriesEvaluations(seriesId) {
    const id = String(seriesId ?? '').trim()
    if (!id) return Promise.reject(new Error('seriesId required'))
    return http.get(`/eb-evaluations/series/${id}`).then(unwrapData)
  },

  /** GET /eb-evaluations/my-history */
  getMyHistory(params = {}) {
    return http
      .get('/eb-evaluations/my-history', { params })
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

  /**
   * GET /eb-evaluations/publication-schedule
   * Query: from, to, publication_schedule, view, include_overdue
   */
  getPublicationSchedule(params = {}) {
    return http
      .get('/eb-evaluations/publication-schedule', { params })
      .then(unwrap)
  },

  /**
   * GET /eb-evaluations/history
   * Query: scope (series|chapter|all), result, status, series_id, q, page, limit
   */
  getHistory(params = {}) {
    const query = {}
    if (params.scope) query.scope = params.scope
    if (params.result) query.result = params.result
    if (params.status) query.status = params.status
    if (params.series_id) query.series_id = params.series_id
    if (params.q) query.q = params.q
    if (params.page != null) query.page = params.page
    if (params.limit != null) query.limit = params.limit
    return http
      .get('/eb-evaluations/history', { params: query })
      .then(unwrapData)
  },

  /**
   * GET /eb-evaluations/:evaluationId/history-detail
   */
  getHistoryDetail(evaluationId) {
    const id = String(evaluationId ?? '').trim()
    if (!id) return Promise.reject(new Error('evaluationId required'))
    return http
      .get(`/eb-evaluations/${id}/history-detail`)
      .then(unwrapData)
  },
}
