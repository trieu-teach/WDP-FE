import { http } from './http.js'

function unwrap(res) {
  if (res && typeof res === 'object' && res.success !== undefined && res.data !== undefined) {
    return unwrap(res.data)
  }
  return res
}

export const tasksService = {
  create(payload) {
    return http.post('/tasks', payload).then(unwrap)
  },

  /**
   * Assistant — tasks được gán cho user hiện tại.
   * Filter theo chapter: `?chapter_id=...`
   */
  getMyAssignments(params) {
    return http.get('/tasks/my-assignments', { params }).then(res => {
      const body = res && typeof res === 'object' ? res : {}
      const data = body.data
      const items = Array.isArray(data) ? data : []
      return {
        items,
        pagination: body.pagination ?? null,
        seriesName: body.seriesName ?? null,
      }
    })
  },

  /**
   * Assistant — lấy tasks của 1 chapter (thay cho getByChapter — Mangaka only).
   */
  async getAssignmentsByChapter(chapterId, params = {}) {
    const res = await this.getMyAssignments({
      chapter_id: chapterId,
      limit: 100,
      ...params,
    })
    return res.items ?? []
  },

  /**
   * Mangaka only — requireMangaka + chapter.submitted_by = current user.
   * Assistant gọi endpoint này sẽ nhận 403.
   */
  getByChapter(chapterId) {
    return http.get(`/tasks/chapter/${chapterId}`).then(unwrap)
  },

  start(taskId) {
    return http.patch(`/tasks/${taskId}/start`).then(unwrap)
  },

  /**
   * LUỒNG 2 — Bước 6: Assistant gửi URL ảnh kết quả (đã upload Cloudinary / finalize).
   * PATCH /tasks/:id/upload-result
   */
  uploadResult(taskId, resultImageUrl) {
    return http
      .patch(`/tasks/${taskId}/upload-result`, {
        result_image_url: resultImageUrl,
      })
      .then(unwrap)
  },

  /**
   * LUỒNG 2 — Bước 7: Nộp tất cả task của chapter sau khi đã upload-result từng task.
   * POST /tasks/chapter/:chapterId/submit-all-by-assistant
   */
  submitAllByAssistant(chapterId) {
    return http
      .post(`/tasks/chapter/${chapterId}/submit-all-by-assistant`, {})
      .then(unwrap)
  },

  /** @deprecated LUỒNG 2 dùng uploadResult + submitAllByAssistant */
  submit(taskId, resultFile) {
    console.debug('[tasksService.submit] taskId=', taskId)
    const fd = new FormData()
    fd.append('result_image', resultFile)
    return http.post(`/tasks/${taskId}/submit`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(unwrap)
  },

  /**
   * Flow B — chỉ cập nhật page.result_image_url + chapter.status.
   * KHÔNG cập nhật Task. Để nộp chapter chuẩn dùng POST /tasks/:id/submit từng task (Flow A).
   * @deprecated Cho workflow submit — dùng tasksService.submit() từng task.
   */
  submitChapter(chapterId, resultFiles = null) {
    if (resultFiles && resultFiles.length > 0) {
      const fd = new FormData()
      const list = Array.isArray(resultFiles) ? resultFiles : [resultFiles]
      list.forEach(file => fd.append('files', file))
      return http.post(`/chapters/${chapterId}/submit-all`, fd).then(unwrap)
    }
    // Không có file mới — gửi JSON rỗng, BE dùng result_image_url đã finalize
    return http.post(`/chapters/${chapterId}/submit-all`, {}).then(unwrap)
  },

  approve(taskId) {
    return http.patch(`/tasks/${taskId}/approve`).then(unwrap)
  },

  requestRevision(taskId, note = '') {
    return http.patch(`/tasks/${taskId}/revision`, note ? { note } : {}).then(unwrap)
  },

  /**
   * Mangaka nhận task đã submitted → chuyển sang in_review.
   * BE: PATCH /api/tasks/:id/acknowledge
   */
  acknowledge(taskId) {
    return http.patch(`/tasks/${taskId}/acknowledge`).then(unwrap)
  },

  /**
   * List task đang chờ Mangaka duyệt (status submitted + in_review).
   * BE: GET /api/tasks/pending-review
   */
  pendingReview(params) {
    return http.get('/tasks/pending-review', { params }).then(res => {
      const body = res && typeof res === 'object' ? res : {}
      const data = body.data
      return {
        items: Array.isArray(data) ? data : (Array.isArray(res) ? res : []),
        pagination: body.pagination ?? null,
      }
    })
  },

  getStats(params) {
    return http.get('/tasks/stats', { params }).then(unwrap)
  },
}
