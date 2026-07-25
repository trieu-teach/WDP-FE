const STORAGE_KEY = 'mk-assistant-approved-pages'
const ALL = '*'

function readAll() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeAll(map) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

export function isChapterFullyAssistantApproved(chapterId) {
  const id = String(chapterId ?? '')
  if (!id) return false
  const list = readAll()[id]
  return Array.isArray(list) && list.includes(ALL)
}

export function getAssistantApprovedPageNumbers(chapterId) {
  const id = String(chapterId ?? '')
  if (!id) return []
  const list = readAll()[id]
  if (!Array.isArray(list) || list.includes(ALL)) return []
  return list.map(Number).filter((n) => Number.isFinite(n))
}

export function markAssistantApprovedPages(chapterId, pageNumbers = [], { markAll = false } = {}) {
  const id = String(chapterId ?? '')
  if (!id) return
  const map = readAll()
  if (markAll) {
    map[id] = [ALL]
    writeAll(map)
    return
  }
  if (map[id]?.includes?.(ALL)) return
  const prev = new Set(getAssistantApprovedPageNumbers(id))
  for (const n of pageNumbers ?? []) {
    const num = Number(n)
    if (Number.isFinite(num)) prev.add(num)
  }
  map[id] = [...prev]
  writeAll(map)
}

export function isAssistantPageApproved(chapterId, pageNumber) {
  const id = String(chapterId ?? '')
  if (!id) return false
  if (isChapterFullyAssistantApproved(id)) return true
  return getAssistantApprovedPageNumbers(id).includes(Number(pageNumber))
}

/** Gắn cờ + ưu tiên resultUrl cho trang đã duyệt Assistant. */
export function stampAssistantApprovedOnPages(chapterId, pages) {
  return (Array.isArray(pages) ? pages : []).map((p) => {
    const approved = isAssistantPageApproved(chapterId, p.pageNumber)
    if (!approved && !p.assistantApproved) return p
    return {
      ...p,
      assistantApproved: true,
      url: p.resultUrl ?? p.url ?? p.originalUrl ?? null,
    }
  })
}

/** Chuẩn hoá response GET /chapters/:id/pages → mảng page raw. */
export function unwrapChapterPagesPayload(raw) {
  if (Array.isArray(raw)) return raw
  if (raw && typeof raw === 'object') {
    if (Array.isArray(raw.pages)) return raw.pages
    if (Array.isArray(raw.data)) return raw.data
    if (raw.data && typeof raw.data === 'object') {
      if (Array.isArray(raw.data.pages)) return raw.data.pages
      if (Array.isArray(raw.data.data)) return raw.data.data
    }
  }
  return []
}
