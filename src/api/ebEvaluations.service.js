import { http } from './http.js'

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

  /** @deprecated Dùng getChapterPending */
  getPending() {
    return this.getChapterPending().then((res) => res.items)
  },

  /** GET /eb-evaluations/chapter/:chapterId — chi tiết chapter + series + evaluation_history */
  getChapterDetail(chapterId) {
    return http.get(`/eb-evaluations/chapter/${chapterId}`).then(unwrapData)
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
   * POST /eb-evaluations/chapter/:chapterId/confirm-publish
   * Body: { publication_schedule?: "weekly"|"monthly", scheduled_publish_at?: "YYYY-MM-DD" }
   */
  confirmPublish(chapterId, { publication_schedule, scheduled_publish_at } = {}) {
    const body = {}
    if (publication_schedule) body.publication_schedule = publication_schedule
    if (scheduled_publish_at) body.scheduled_publish_at = scheduled_publish_at
    return http
      .post(`/eb-evaluations/chapter/${chapterId}/confirm-publish`, body)
      .then(unwrapData)
  },
}
