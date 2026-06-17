import { http } from './http.js'

function unwrap(res) {
  return res?.data !== undefined && res?.success !== undefined ? res.data : res
}

export const tasksService = {
  create(payload) {
    return http.post('/tasks', payload).then(unwrap)
  },

  getMyAssignments(params) {
    return http.get('/tasks/my-assignments', { params }).then(res => ({
      items: unwrap(res),
      pagination: res?.pagination ?? null,
    }))
  },

  getByChapter(chapterId) {
    return http.get(`/tasks/chapter/${chapterId}`).then(unwrap)
  },

  start(taskId) {
    return http.patch(`/tasks/${taskId}/start`).then(unwrap)
  },

  submit(taskId, resultFile) {
    const fd = new FormData()
    fd.append('result_image', resultFile)
    return http.post(`/tasks/${taskId}/submit`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(unwrap)
  },

  /**
   * Flow mới (1 task = 1 chapter): assistant nộp NHIỀU ảnh kết quả cho 1 task chapter.
   * TODO backend: bổ sung endpoint `POST /tasks/{id}/submit-chapter` nhận `result_images[]` (multipart).
   * Tạm thời dùng `submit` với ảnh đầu nếu BE chưa cập nhật.
   */
  submitChapter(taskId, resultFiles) {
    const fd = new FormData()
    const list = Array.isArray(resultFiles) ? resultFiles : [resultFiles]
    list.forEach((file) => fd.append('result_images', file))
    return http.post(`/tasks/${taskId}/submit`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(unwrap)
  },

  approve(taskId) {
    return http.patch(`/tasks/${taskId}/approve`).then(unwrap)
  },

  requestRevision(taskId, note = '') {
    return http.patch(`/tasks/${taskId}/revision`, note ? { note } : {}).then(unwrap)
  },

  getStats(params) {
    return http.get('/tasks/stats', { params }).then(unwrap)
  },
}
