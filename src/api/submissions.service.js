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
   * PATCH /submissions/chapters/:chapterId/approve
   * Mangaka duyệt chapter đã nộp — chuyển status submitted → review.
   * Sau bước này mới gửi sang TE được.
   */
  approveChapter(chapterId) {
    return http.patch(`/submissions/chapters/${chapterId}/approve`).then(unwrap)
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

  // =========================================================================
  // TE Assignment — luồng mới (Mangaka chọn TE trước khi submit-to-te)
  // =========================================================================

  /**
   * GET /submissions/te-users
   * Lấy danh sách TE (Editor) active để Mangaka chọn gán cho chapter.
   * Response: [{ _id, username, full_name, email }]
   */
  getTeUsers() {
    return http.get('/submissions/te-users').then(unwrap)
  },

  /**
   * POST /submissions/chapters/:chapterId/assign-te
   * Gán TE cụ thể cho chapter.
   * Body: { te_id: ObjectId | null }
   */
  assignTe(chapterId, teId) {
    return http
      .post(`/submissions/chapters/${chapterId}/assign-te`, { te_id: teId })
      .then(unwrap)
  },

  /**
   * PATCH /submissions/chapters/:chapterId/assign-te
   * Gỡ TE khỏi chapter (gán te_id = null).
   * Dùng PATCH thay vì DELETE theo yêu cầu.
   */
  removeTe(chapterId) {
    return http
      .delete(`/submissions/chapters/${chapterId}/remove-te`)
      .then(unwrap)
  },

  /**
   * POST /submissions/chapters/:chapterId/submit-to-eb
   * Mangaka gửi chapter debut sang EB — chapter.status → pending_EB
   */
  submitChapterToEb(chapterId) {
    return http
      .post(`/submissions/chapters/${chapterId}/submit-to-eb`)
      .then((res) => ({
        chapter: unwrap(res),
        message: res?.message ?? '',
      }))
  },
}
