import { http } from './http.js'

function unwrap(res) {
  return res?.data !== undefined && res?.success !== undefined ? res.data : res
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
}
