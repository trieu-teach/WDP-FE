import { http } from './http.js'

function unwrap(res) {
  if (res && typeof res === 'object' && res.success !== undefined && res.data !== undefined) {
    return unwrap(res.data)
  }
  return res
}

export const submissionsService = {
  getMangakaSubmissions(params) {
    return http.get('/submissions/mangaka', { params }).then(unwrap)
  },

  submitChapterToTe(chapterId) {
    return http.post(`/submissions/chapters/${chapterId}/submit-to-te`).then(res => ({
      chapter: unwrap(res),
      seriesName: res?.seriesName ?? '',
      message: res?.message ?? '',
    }))
  },

  getTeQueue() {
    return http.get('/submissions/te').then(unwrap)
  },

  getEbQueue() {
    return http.get('/submissions/eb').then(unwrap)
  },

  /**
   * Luồng mới: Assistant đã nộp chapter (status = `submitted_by_assistant`).
   * Mangaka duyệt → submit thẳng sang TE.
   * Endpoint: POST /submissions/chapters/:chapterId/submit-to-te (đã có).
   */
  approveChapter(chapterId) {
    return http.post(`/submissions/chapters/${chapterId}/submit-to-te`).then(res => ({
      chapter: unwrap(res),
      seriesName: res?.seriesName ?? '',
      message: res?.message ?? '',
    }))
  },

  /**
   * Mangaka yêu cầu Assistant chỉnh sửa lại chapter đã nộp.
   * Gửi kèm ghi chú tổng hợp (revision_note) để Assistant đọc trong queue.
   * Endpoint: POST /submissions/chapters/:chapterId/request-revision
   */
  requestRevision(chapterId, note = '') {
    return http.post(`/submissions/chapters/${chapterId}/request-revision`, {
      revision_note: String(note ?? '').trim(),
    }).then(unwrap)
  },
}
