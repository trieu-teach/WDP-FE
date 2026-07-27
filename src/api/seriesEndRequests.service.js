import { http } from './http.js'

/** Body axios đã qua interceptor — giữ pagination khi list. */
function asBody(res) {
  return res && typeof res === 'object' ? res : {}
}

function unwrapData(res) {
  const body = asBody(res)
  if (body.success !== undefined && body.data !== undefined) {
    return body.data
  }
  return body
}

/**
 * Mangaka + Admin — yêu cầu kết thúc truyện.
 * Mangaka: POST/GET/DELETE dưới /series/...
 * Admin: GET/PATCH dưới /admin/end-requests
 */
export const seriesEndRequestsService = {
  /** POST /series/:seriesId/end-request */
  create(seriesId, payload = {}) {
    const body = {}
    const reason = String(payload.reason ?? '').trim()
    if (reason) body.reason = reason.slice(0, 1000)
    const planned = payload.planned_final_chapter_number
      ?? payload.plannedFinalChapterNumber
    const n = Number(planned)
    if (!Number.isInteger(n) || n < 1) {
      return Promise.reject(
        Object.assign(new Error('planned_final_chapter_number required'), {
          response: {
            status: 400,
            data: { message: 'Cần nhập chapter muốn dừng (số nguyên ≥ 1).' },
          },
        }),
      )
    }
    body.planned_final_chapter_number = n
    return http.post(`/series/${seriesId}/end-request`, body).then((res) => {
      const raw = asBody(res)
      return {
        data: unwrapData(raw),
        message: raw.message ?? '',
      }
    })
  },

  /**
   * GET /series/end-requests/my
   * @param {{ status?: string, page?: number, limit?: number }} params
   */
  getMine(params = {}) {
    return http
      .get('/series/end-requests/my', { params })
      .then((res) => {
        const body = asBody(res)
        const items = Array.isArray(body.data)
          ? body.data
          : (Array.isArray(body) ? body : [])
        return {
          items,
          total: Number(body.total ?? items.length) || 0,
          page: Number(body.page ?? 1) || 1,
          limit: Number(body.limit ?? 20) || 20,
        }
      })
  },

  /** DELETE /series/end-requests/:requestId — hủy (pending only) */
  cancel(requestId) {
    return http.delete(`/series/end-requests/${requestId}`).then((res) => {
      const raw = asBody(res)
      return {
        data: unwrapData(raw),
        message: raw.message ?? '',
      }
    })
  },

  /**
   * GET /admin/end-requests
   * @param {{ status?: string, page?: number, limit?: number }} params
   */
  adminList(params = {}) {
    return http.get('/admin/end-requests', { params }).then((res) => {
      const body = asBody(res)
      const items = Array.isArray(body.data)
        ? body.data
        : (Array.isArray(body) ? body : [])
      return {
        items,
        total: Number(body.total ?? items.length) || 0,
        page: Number(body.page ?? 1) || 1,
        limit: Number(body.limit ?? 20) || 20,
      }
    })
  },

  /** GET /admin/end-requests/:id */
  adminGetById(id) {
    return http.get(`/admin/end-requests/${id}`).then(unwrapData)
  },

  /**
   * PATCH /admin/end-requests/:id
   * @param {string} id
   * @param {{ decision: 'approved'|'rejected', admin_note?: string }} payload
   */
  adminDecide(id, payload) {
    const body = {
      decision: payload.decision,
    }
    const note = String(payload.admin_note ?? payload.adminNote ?? '').trim()
    if (note) body.admin_note = note.slice(0, 1000)
    return http.patch(`/admin/end-requests/${id}`, body).then((res) => {
      const raw = asBody(res)
      return {
        data: unwrapData(raw),
        message: raw.message ?? '',
      }
    })
  },
}
