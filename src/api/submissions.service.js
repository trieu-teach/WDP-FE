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

  /**
   * POST /submissions/chapters/:chapterId/submit-to-te
   * @param {string} chapterId
   * @param {string} [teId] — optional; nếu không truyền BE dùng chapter.te_id hoặc broadcast tất cả TE
   */
  submitChapterToTe(chapterId, teId) {
    const body = teId ? { te_id: teId } : {}
    return http.post(`/submissions/chapters/${chapterId}/submit-to-te`, body).then((res) => {
      const raw = res?.data != null && res?.success !== undefined ? res : res
      return {
        chapter: unwrap(res),
        phase: raw?.phase ?? res?.phase ?? null,
        seriesInfo: raw?.seriesInfo ?? res?.seriesInfo ?? null,
        seriesName: raw?.seriesInfo?.name ?? res?.seriesInfo?.name ?? res?.seriesName ?? '',
        message: raw?.message ?? res?.message ?? '',
      }
    })
  },

  getTeQueue() {
    return http.get('/submissions/te').then(unwrap)
  },

  getEbQueue() {
    return http.get('/submissions/eb').then(unwrap)
  },

  /**
   * POST /submissions/chapters/:chapterId/approve-by-mangaka
   * Mangaka duyệt chapter từ Assistant — status → approved_by_mangaka.
   * Yêu cầu: chapter.status === submitted_by_assistant, tất cả tasks đã approved.
   */
  approveChapterByMangaka(chapterId) {
    return http.post(`/submissions/chapters/${chapterId}/approve-by-mangaka`).then((res) => ({
      chapter: unwrap(res),
      message: res?.message ?? '',
    }))
  },

  /** @deprecated Dùng approveChapterByMangaka */
  approveChapter(chapterId) {
    return http.patch(`/submissions/chapters/${chapterId}/approve`).then(unwrap)
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
      .then((res) => ({
        chapter: unwrap(res),
        message: res?.message ?? '',
      }))
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
