import { http } from './http.js'

function unwrap(res) {
  return res?.data !== undefined && res?.success !== undefined ? res.data : res
}

export const layersService = {
  list(pageId) {
    return http.get(`/chapters/pages/${pageId}/layers`).then(unwrap)
  },

  uploadLayer(pageId, { file, index, onUploadProgress }) {
    const fd = new FormData()
    fd.append('image', file)
    if (index !== undefined && index !== null) fd.append('index', String(index))
    return http
      .post(`/chapters/pages/${pageId}/layers`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress,
      })
      .then(unwrap)
  },

  updateLayer(pageId, layerId, patch) {
    return http
      .patch(`/chapters/pages/${pageId}/layers/${layerId}`, patch)
      .then(unwrap)
  },

  deleteLayer(pageId, layerId) {
    return http
      .delete(`/chapters/pages/${pageId}/layers/${layerId}`)
      .then(unwrap)
  },

  listVersions(pageId, layerId) {
    return http
      .get(`/chapters/pages/${pageId}/layers/${layerId}/versions`)
      .then(unwrap)
  },

  uploadVersion(pageId, layerId, { file, note, changeSummary, onUploadProgress }) {
    const fd = new FormData()
    fd.append('image', file)
    if (note) fd.append('note', note)
    if (changeSummary) fd.append('change_summary', changeSummary)
    return http
      .post(`/chapters/pages/${pageId}/layers/${layerId}/versions`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress,
      })
      .then(unwrap)
  },

  rollback(pageId, layerId, versionId) {
    return http
      .post(`/chapters/pages/${pageId}/layers/${layerId}/rollback/${versionId}`)
      .then(unwrap)
  },

  finalize(pageId) {
    return http
      .post(`/chapters/pages/${pageId}/finalize`)
      .then(unwrap)
  },

  getFinal(pageId) {
    return http
      .get(`/chapters/pages/${pageId}/final`)
      .then(unwrap)
  },
}
