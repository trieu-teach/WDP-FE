import { http } from './http.js'

function unwrap(res) {
  if (res && typeof res === 'object' && res.success !== undefined && res.data !== undefined) {
    return unwrap(res.data)
  }
  return res
}

export const teReviewsService = {
  getPending() {
    return http.get('/te-reviews/pending').then(unwrap)
  },

  getChapterPages(chapterId, page = 1) {
    return http.get(`/te-reviews/chapter/${chapterId}/pages`, { params: { page } }).then(unwrap)
  },

  /**
   * GET /te-reviews/chapter/{chapterId}/annotations
   * - Không truyền pageId → lấy tất cả annotations của chapter.
   * - Truyền pageId → lọc annotations của page đó.
   */
  getAnnotations(chapterId, pageId) {
    const params = pageId ? { page_id: pageId } : {}
    return http.get(`/te-reviews/chapter/${chapterId}/annotations`, { params }).then(unwrap)
  },

  createAnnotation(chapterId, payload) {
    return http.post(`/te-reviews/chapter/${chapterId}/annotations`, payload).then(unwrap)
  },

  deleteAnnotation(chapterId, annotationId) {
    return http.delete(`/te-reviews/chapter/${chapterId}/annotations/${annotationId}`).then(unwrap)
  },

  /**
   * POST /te-reviews/chapter/{chapterId}/te-action
   * TE gửi quyết định: forward_eb (gửi EB) hoặc request_revision (yêu cầu sửa).
   */
  teAction(chapterId, { action, notes } = {}) {
    return http.post(`/te-reviews/chapter/${chapterId}/te-action`, { action, notes }).then(unwrap)
  },

  saveSeriesReview(seriesId, payload) {
    return http.post(`/te-reviews/series-review/${seriesId}`, payload).then(unwrap)
  },

  submitSeriesReview(seriesId, payload) {
    return http.post(`/te-reviews/series-review/${seriesId}/submit`, payload).then(unwrap)
  },
}
