import { http } from './http.js'

function unwrap(res) {
  if (res && typeof res === 'object' && res.success !== undefined && res.data !== undefined) {
    return res.data
  }
  return res?.data ?? res
}

export const ebScoresService = {
  /** GET /eb-scores/chapter/:chapterId/preview — tất cả pages của chapter */
  getChapterPreview(chapterId) {
    return http.get(`/eb-scores/chapter/${chapterId}/preview`).then(unwrap)
  },
}
