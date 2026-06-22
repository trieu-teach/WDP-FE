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

  getPageAnnotations(chapterId, pageId) {
    return http.get(`/te-reviews/chapter/${chapterId}/page/${pageId}/annotations`).then(unwrap)
  },

  createAnnotation(chapterId, payload) {
    return http.post(`/te-reviews/chapter/${chapterId}/annotations`, payload).then(unwrap)
  },

  deleteAnnotation(chapterId, annotationId) {
    return http.delete(`/te-reviews/chapter/${chapterId}/annotations/${annotationId}`).then(unwrap)
  },

  saveSeriesReview(seriesId, payload) {
    return http.post(`/te-reviews/series-review/${seriesId}`, payload).then(unwrap)
  },

  submitSeriesReview(seriesId, payload) {
    return http.post(`/te-reviews/series-review/${seriesId}/submit`, payload).then(unwrap)
  },
}
