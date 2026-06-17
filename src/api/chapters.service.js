import { http } from './http.js'

function unwrap(res) {
  return res?.data !== undefined && res?.success !== undefined ? res.data : res
}

function isMissingRoute(err) {
  const status = err?.response?.status
  return status === 404 || status === 405
}

async function notesRequest(pageId, method, suffix = '', body) {
  const path = `/chapters/pages/${pageId}/notes${suffix}`
  try {
    if (method === 'get') return await http.get(path).then(unwrap)
    if (method === 'post') return await http.post(path, body).then(unwrap)
    if (method === 'put') return await http.put(path, body)
    if (method === 'delete') return await http.delete(path)
  } catch (err) {
    throw err
  }
}

export const chaptersService = {
  create({ series_id, chapter_number, title, assistant_id }) {
    return http.post('/chapters', { series_id, chapter_number, title, assistant_id }).then(unwrap)
  },

  getById(id) {
    return http.get(`/chapters/${id}`).then(unwrap)
  },

  update(id, payload) {
    return http.patch(`/chapters/${id}`, payload).then(unwrap)
  },

  getPages(chapterId) {
    return http.get(`/chapters/${chapterId}/pages`).then(unwrap)
  },

  uploadPages(chapterId, files) {
    const fd = new FormData()
    Array.from(files).forEach(file => fd.append('images', file))
    return http.post(`/chapters/${chapterId}/pages`, fd).then(unwrap)
  },

  getPage(pageId) {
    return http.get(`/pages/${pageId}`).then(unwrap)
  },

  assignAssistant(chapterId, assistant_id) {
    return http.post(`/chapters/${chapterId}/assign`, { assistant_id })
  },

  unassignAssistant(chapterId) {
    return http.delete(`/chapters/${chapterId}/assign`)
  },

  getMyAssignments(params) {
    return http.get('/chapters/my-assignments', { params }).then(unwrap)
  },

  getPageNotes(pageId) {
    return notesRequest(pageId, 'get')
  },

  createPageNote(pageId, payload) {
    return notesRequest(pageId, 'post', '', payload)
  },

  updatePageNote(pageId, noteId, payload) {
    return notesRequest(pageId, 'put', `/${noteId}`, payload)
  },

  deletePageNote(pageId, noteId) {
    return notesRequest(pageId, 'delete', `/${noteId}`)
  },
}
