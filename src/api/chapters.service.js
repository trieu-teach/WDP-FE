import { http } from './http.js'

function unwrap(res) {
  if (res && typeof res === 'object' && res.success !== undefined && res.data !== undefined) {
    const unwrapped = res.data
    return unwrap(unwrapped)
  }
  return res
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

  /**
   * Luồng mới: Mangaka gửi 1 request multipart duy nhất.
   * BE tự tạo Chapter + Page(s) + Task(s) + PageNote(s).
   *
   * @param {FormData} formData - fields: series_id, chapter_number, title,
   *   pages (file[]), pages[i].note, pages[i].work_type, pages[i].assigned_to,
   *   pages[i].x, pages[i].y, pages[i].w, pages[i].h
   * @returns {Promise<{data, pages, tasks}>}
   *
   * @example
   * const fd = new FormData();
   * fd.append('series_id', '...');
   * fd.append('chapter_number', '1');
   * fd.append('pages', file1);
   * fd.append('pages[0].note', 'Tô shading mặt');
   * fd.append('pages[0].work_type', 'shading');
   * fd.append('pages[0].x', '15');
   * fd.append('pages[0].y', '20');
   * fd.append('pages[0].w', '30');
   * fd.append('pages[0].h', '40');
   * const { data, pages, tasks } = await chaptersService.uploadChapterWithPages(fd);
   */
  uploadChapterWithPages(formData) {
    return http.post('/chapters', formData).then(res => {
      const unwrapped = unwrap(res)
      // BE có thể trả: { chapter, pages, tasks } hoặc { data: { chapter, pages, tasks } }
      // Hoặc { success, data: { chapter, pages, tasks } }
      if (unwrapped && typeof unwrapped === 'object') {
        return {
          chapter: unwrapped.chapter ?? unwrapped.data ?? null,
          pages: unwrapped.pages ?? [],
          tasks: unwrapped.tasks ?? [],
        }
      }
      return { chapter: null, pages: [], tasks: [] }
    })
  },

  getById(id) {
    return http.get(`/chapters/${id}`).then(res => {
      const unwrapped = unwrap(res)
      if (res?.seriesName !== undefined) {
        return { ...unwrapped, seriesName: res.seriesName }
      }
      return unwrapped
    })
  },

  update(id, payload) {
    return http.patch(`/chapters/${id}`, payload).then(unwrap)
  },

  getPages(chapterId) {
    return http.get(`/chapters/${chapterId}/pages`).then(unwrap)
  },

  uploadPages(chapterId, files, pageNotes = []) {
    const results = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const note = pageNotes[i]
      const fd = new FormData()
      fd.append('page', file)
      const noteText = note?.text?.trim?.() ?? ''
      if (noteText) {
        fd.append('note', noteText)
        fd.append('work_type', note.taskType ?? 'other')
        fd.append('x', String(note.x ?? 0))
        fd.append('y', String(note.y ?? 0))
        fd.append('w', String(note.w ?? 0))
        fd.append('h', String(note.h ?? 0))
      } else {
        fd.append('note', ' ')
      }
      results.push(
        http
          .post(`/chapters/${chapterId}/pages`, fd)
          .then(res => {
            const unwrapped = unwrap(res)
            // unwrap đệ quy: { success, data: { page, note, task } } → { page, note, task }
            if (Array.isArray(unwrapped)) return unwrapped
            if (unwrapped && typeof unwrapped === 'object' && 'page' in unwrapped) return unwrapped.page
            if (unwrapped && typeof unwrapped === 'object' && '_id' in unwrapped) return unwrapped
            if (unwrapped && typeof unwrapped === 'object' && 'data' in unwrapped) {
              const inner = unwrapped.data
              if (Array.isArray(inner)) return inner
              if (inner && typeof inner === 'object' && 'page' in inner) return inner.page
              if (inner && typeof inner === 'object' && '_id' in inner) return inner
            }
            return null
          })
      )
    }
    return Promise.all(results).then(list => {
      const filtered = list.flat().filter(Boolean).map(p => (Array.isArray(p) ? p[0] : p))
      return filtered
    })
  },

  deletePage(pageId) {
    return http.delete(`/chapters/pages/${pageId}`).then(unwrap)
  },

  getPage(pageId) {
    return http.get(`/chapters/pages/${pageId}`).then(unwrap)
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
