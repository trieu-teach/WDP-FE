const STORAGE_KEY = 'mk-te-revision-seen-v1'
export const TE_REVISION_SEEN_EVENT = 'mk-te-revision-seen'

/** @returns {Record<string, string>} chapterId → seen marker */
function readMap() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const data = JSON.parse(raw)
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {}
    return Object.fromEntries(
      Object.entries(data)
        .filter(([id]) => id)
        .map(([id, fp]) => [String(id), String(fp ?? '1')]),
    )
  } catch {
    return {}
  }
}

function writeMap(map) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* ignore quota */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(TE_REVISION_SEEN_EVENT))
  }
}

/** Đánh dấu đã xem — badge ẩn đến khi chapter thoát TE_revision rồi bị reject lại. */
export function isTeRevisionSeen(chapterId) {
  const id = String(chapterId ?? '').trim()
  if (!id) return false
  return Object.prototype.hasOwnProperty.call(readMap(), id)
}

export function markTeRevisionSeen(chapterId, fingerprint = '1') {
  const id = String(chapterId ?? '').trim()
  if (!id) return
  const map = readMap()
  map[id] = String(fingerprint ?? '1') || '1'
  writeMap(map)
}

/** Giữ lại entry của chapter vẫn đang TE_revision.
 *  Không xóa sạch khi `activeChapterIds` rỗng trừ khi `clearWhenEmpty` = true
 *  (tránh race lúc workspace chưa load xong).
 */
export function pruneTeRevisionSeen(activeChapterIds = [], { clearWhenEmpty = true } = {}) {
  const keep = new Set(
    (activeChapterIds ?? [])
      .map((id) => String(id ?? '').trim())
      .filter(Boolean),
  )
  if (keep.size === 0 && !clearWhenEmpty) return

  const map = readMap()
  let changed = false
  for (const id of Object.keys(map)) {
    if (!keep.has(id)) {
      delete map[id]
      changed = true
    }
  }
  if (changed) writeMap(map)
}
