import { http } from './http.js'

function unwrap(res) {
  if (res && typeof res === 'object' && res.success !== undefined && res.data !== undefined) {
    return unwrap(res.data)
  }
  return res
}

export const seriesService = {
  getAll(params) {
    return http.get('/series', { params }).then(unwrap)
  },

  getMine() {
    return http.get('/series/mine').then(unwrap)
  },

  getRanking(params) {
    return http.get('/series/ranking', { params }).then(unwrap)
  },

  getById(id) {
    return http.get(`/series/${id}`).then(unwrap)
  },

  create(payload, coverFile) {
    if (coverFile) {
      const fd = new FormData()
      Object.entries(payload).forEach(([k, v]) => {
        if (v != null && v !== '') fd.append(k, v)
      })
      fd.append('cover', coverFile)
      return http.post('/series', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then(unwrap)
    }
    return http.post('/series', payload).then(unwrap)
  },

  update(id, payload, coverFile) {
    if (coverFile) {
      const fd = new FormData()
      Object.entries(payload).forEach(([k, v]) => {
        if (v != null && v !== '') fd.append(k, v)
      })
      fd.append('cover', coverFile)
      return http.patch(`/series/${id}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then(unwrap)
    }
    return http.patch(`/series/${id}`, payload).then(unwrap)
  },

  uploadCover(id, coverFile) {
    const fd = new FormData()
    fd.append('cover', coverFile)
    return http.post(`/series/${id}/cover`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(unwrap)
  },

  getChapters(seriesId) {
    return http.get(`/series/${seriesId}/chapters`).then(res => ({
      chapters: unwrap(res),
      seriesName: res?.seriesName ?? '',
    }))
  },
}
