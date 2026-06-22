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

  getByChapter(chapterId) {
    return http.get(`/tasks/chapter/${chapterId}`).then(unwrap)
  },

  start(taskId) {
    return http.patch(`/tasks/${taskId}/start`).then(unwrap)
  },

  submit(taskId, resultFile) {
    console.debug('[tasksService.submit] taskId=', taskId)
    const fd = new FormData()
    fd.append('result_image', resultFile)
    return http.post(`/tasks/${taskId}/submit`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(unwrap)
  },

  /**
   * Nộp cả chapter cho Mangaka.
   * - Nếu có resultFiles: gửi multipart (Assistant vừa upload file mới cho từng page)
   * - Nếu KHÔNG có resultFiles: chỉ gọi POST — BE tự lấy page.result_image_url (đã qua /finalize)
   *   hoặc page.original_image_url (page chưa làm) theo priority chain.
   *
   * @param {string} chapterId
   * @param {File[]|null} [resultFiles=null] - ảnh kết quả mới (optional)
   * @returns {Promise<any>}
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
