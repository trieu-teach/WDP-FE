import { http } from './http.js'

function unwrap(res) {
  if (res && typeof res === 'object' && res.success !== undefined && res.data !== undefined) {
    return unwrap(res.data)
  }
  return res
}

/** Append series fields vào FormData — genre/tags → CSV (BE chấp nhận). */
function appendSeriesPayloadToFormData(fd, payload = {}) {
  for (const [key, value] of Object.entries(payload)) {
    if (value == null || value === '') continue
    if (Array.isArray(value)) {
      if (!value.length) continue
      fd.append(key, value.join(','))
      continue
    }
    fd.append(key, String(value))
  }
}

export const seriesService = {
  /**
   * GET /api/series
   * Query hỗ trợ: publication_status=upcoming|ongoing|hiatus|completed|dropped
   */
  getAll(params) {
    return http.get('/series', { params }).then(unwrap)
  },

  /**
   * GET /series/mine — danh sách series của Mangaka.
   * Fallback GET /series/my (alias BE mới).
   * Query: status=rejected|revision|...
   */
  getMine(params = {}) {
    const query = {}
    if (params.status) query.status = params.status
    if (params.page != null) query.page = params.page
    if (params.limit != null) query.limit = params.limit
    return http
      .get('/series/mine', { params: query })
      .then(unwrap)
      .catch(async (err) => {
        if (err?.response?.status !== 404) throw err
        const res = await http.get('/series/my', { params: query })
        return unwrap(res)
      })
  },

  getRanking(params) {
    return http.get('/series/ranking', { params }).then(unwrap)
  },

  getById(id) {
    return http.get(`/series/${id}`).then(unwrap)
  },

  /**
   * POST /series — multipart/form-data (name, description, genre, tags,
   * age_rating, target_audience, synopsis, cover?)
   */
  create(payload, coverFile) {
    const fd = new FormData()
    appendSeriesPayloadToFormData(fd, payload)
    if (coverFile) fd.append('cover', coverFile)
    return http.post('/series', fd).then(unwrap)
  },

  update(id, payload, coverFile) {
    if (coverFile) {
      const fd = new FormData()
      appendSeriesPayloadToFormData(fd, payload)
      fd.append('cover', coverFile)
      return http.patch(`/series/${id}`, fd).then(unwrap)
    }
    return http.patch(`/series/${id}`, payload).then(unwrap)
  },

  uploadCover(id, coverFile) {
    const fd = new FormData()
    fd.append('cover', coverFile)
    return http.post(`/series/${id}/cover`, fd).then(unwrap)
  },

  getChapters(seriesId) {
    return http.get(`/series/${seriesId}/chapters`).then(res => ({
      chapters: unwrap(res),
      seriesName: res?.seriesName ?? '',
    }))
  },
}
