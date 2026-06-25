import { http, resolveMediaUrl } from './http.js'

function unwrap(res) {
  if (res && typeof res === 'object' && res.success !== undefined && res.data !== undefined) {
    return unwrap(res.data)
  }
  return res
}

/** BE có thể trả page là object hoặc số thứ tự trang (1-based). */
export function isTePageRecord(value) {
  return (
    value != null
    && typeof value === 'object'
    && !Array.isArray(value)
    && (
      value._id != null
      || value.id != null
      || value.original_image_url != null
      || value.result_image_url != null
      || value.final_image_url != null
      || value.image_url != null
      || value.url != null
      || value.imageUrl != null
    )
  )
}

/** Chuẩn hóa id / pageIndex từ response mới. */
export function normalizeTePageRecord(page) {
  if (!page || typeof page !== 'object') return page
  const id = page._id ?? page.id
  const pageNumber = Number(page.page_number ?? 0) || undefined
  return {
    ...page,
    _id: page._id ?? id,
    id: page.id ?? (id != null ? String(id) : undefined),
    pageIndex:
      page.pageIndex ?? (pageNumber != null ? pageNumber - 1 : undefined),
  }
}

/** Ưu tiên ảnh theo thứ tự BE formatPage — bỏ qua chuỗi rỗng. */
function pickFirstTeImageUrl(...values) {
  for (const value of values) {
    const text = value != null ? String(value).trim() : ''
    if (text) return text
  }
  return null
}

/** @alias getTePageImageUrl */
export function resolveTePageImageUrl(page) {
  if (!page || typeof page !== 'object') return null
  return resolveMediaUrl(
    pickFirstTeImageUrl(
      page.final_image_url,
      page.result_image_url,
      page.original_image_url,
      page.url,
      page.image_url,
      page.imageUrl,
    ),
  )
}

/** Alias rõ nghĩa theo spec TE reviews. */
export const getTePageImageUrl = resolveTePageImageUrl

export function tePageHasImage(page) {
  return Boolean(resolveTePageImageUrl(page))
}

function resolveCurrentTePage(raw, pages) {
  if (isTePageRecord(raw?.page)) return normalizeTePageRecord(raw.page)

  const pageNumber = Number(raw?.page)
  if (!Number.isNaN(pageNumber) && pageNumber > 0 && pages.length) {
    const match =
      pages.find((p) => Number(p?.page_number) === pageNumber)
      ?? pages[pageNumber - 1]
      ?? null
    return match ? normalizeTePageRecord(match) : null
  }

  const first = pages[0] ?? null
  return first ? normalizeTePageRecord(first) : null
}

/** Gộp page chi tiết (`data.page`) vào `data.pages` (summary hoặc full). */
export function enrichTeChapterPagesResponse(res) {
  const pages = (res.pages ?? []).map(normalizeTePageRecord)
  const detail = isTePageRecord(res.page) ? normalizeTePageRecord(res.page) : null

  if (detail) {
    const idx =
      detail.pageIndex
      ?? (detail.page_number != null ? Number(detail.page_number) - 1 : 0)
    const merged = { ...(pages[idx] ?? {}), ...detail }
    if (pages[idx]) {
      pages[idx] = merged
    } else if (!pages.length) {
      pages.push(merged)
    } else {
      pages[idx] = merged
    }
  }

  const rootAnnotations = Array.isArray(res.annotations) ? res.annotations : []
  const pageAnnotations = Array.isArray(detail?.annotations) ? detail.annotations : []

  return {
    ...res,
    page: detail ?? res.page ?? null,
    pages,
    annotations: rootAnnotations.length ? rootAnnotations : pageAnnotations,
  }
}

/** Chuẩn hóa GET /te-reviews/chapter/:id/pages */
export function normalizeTeChapterPagesResponse(raw) {
  if (!raw) {
    return { page: null, pages: [], annotations: [], pagination: null }
  }
  if (Array.isArray(raw)) {
    const pages = raw.map(normalizeTePageRecord)
    return {
      pages,
      page: pages[0] ?? null,
      annotations: [],
      pagination: null,
    }
  }
  if (typeof raw === 'object') {
    const pages = (
      Array.isArray(raw.pages)
        ? raw.pages
        : (Array.isArray(raw.data) ? raw.data : [])
    ).map(normalizeTePageRecord)

    return enrichTeChapterPagesResponse({
      page: resolveCurrentTePage(raw, pages),
      pages,
      annotations: Array.isArray(raw.annotations) ? raw.annotations : [],
      pagination: raw.pagination ?? null,
    })
  }
  return { page: null, pages: [], annotations: [], pagination: null }
}

export function resolveTePageId(page) {
  if (!page) return ''
  return String(page._id ?? page.id ?? '').trim()
}

/** Body format 1 — page_id + region + content + error_type */
export function buildTeAnnotationCreatePayload(note, page) {
  const pageId = resolveTePageId(page)
  if (!pageId) return null

  return {
    page_id: pageId,
    region: {
      x: Number(note.x ?? 0),
      y: Number(note.y ?? 0),
      width: Number(note.w ?? 0),
      height: Number(note.h ?? 0),
    },
    content: String(note.text ?? '').trim() || 'No detail',
    error_type: mapTaskTypeToErrorType(note.taskType),
  }
}

export function mapTaskTypeToErrorType(taskType) {
  const value = String(taskType ?? '').toLowerCase()
  if (value.includes('dialog')) return 'dialogue'
  if (value.includes('script')) return 'script'
  if (value.includes('art')) return 'art'
  if (value.includes('content')) return 'content'
  return 'other'
}

export const teReviewsService = {
  /** GET /te-reviews/pending — chapter chờ TE duyệt */
  getPending() {
    return http.get('/te-reviews/pending').then(unwrap)
  },

  /** GET /te-reviews/chapter/:chapterId/pages?all=true — lấy toàn bộ trang 1 lần */
  getAllChapterPages(chapterId) {
    return http
      .get(`/te-reviews/chapter/${chapterId}/pages`, { params: { all: true } })
      .then(unwrap)
      .then(normalizeTeChapterPagesResponse)
  },

  /** GET /te-reviews/chapter/:chapterId/pages?page=N — chi tiết 1 trang + annotations */
  getChapterPage(chapterId, page = 1) {
    return http
      .get(`/te-reviews/chapter/${chapterId}/pages`, { params: { page } })
      .then(unwrap)
      .then(normalizeTeChapterPagesResponse)
  },

  /** @deprecated Dùng getAllChapterPages hoặc getChapterPage */
  getChapterPages(chapterId, page = 1) {
    return page === 'all' || page === true
      ? this.getAllChapterPages(chapterId)
      : this.getChapterPage(chapterId, page)
  },

  /** GET /te-reviews/chapter/:chapterId/annotations */
  getAnnotations(chapterId, pageId) {
    const params = pageId ? { page_id: pageId } : {}
    return http.get(`/te-reviews/chapter/${chapterId}/annotations`, { params }).then(unwrap)
  },

  /** POST /te-reviews/chapter/:chapterId/annotations */
  createAnnotation(chapterId, payload) {
    return http.post(`/te-reviews/chapter/${chapterId}/annotations`, payload).then(unwrap)
  },

  /** PATCH /te-reviews/chapter/:chapterId/annotations/:annotationId */
  updateAnnotation(chapterId, annotationId, payload) {
    return http
      .patch(`/te-reviews/chapter/${chapterId}/annotations/${annotationId}`, payload)
      .then(unwrap)
  },

  /** DELETE /te-reviews/chapter/:chapterId/annotations/:annotationId */
  deleteAnnotation(chapterId, annotationId) {
    return http.delete(`/te-reviews/chapter/${chapterId}/annotations/${annotationId}`).then(unwrap)
  },

  /**
   * POST /te-reviews/chapter/:chapterId/te-action
   * action: approve | reject
   * notes: string[] (khi reject)
   */
  teAction(chapterId, { action, notes } = {}) {
    const body = { action }
    if (Array.isArray(notes) && notes.length) {
      body.notes = notes.map((n) => String(n ?? '').trim()).filter(Boolean)
    }
    return http.post(`/te-reviews/chapter/${chapterId}/te-action`, body).then(unwrap)
  },
}
