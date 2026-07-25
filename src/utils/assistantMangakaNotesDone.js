import { noteSpatialFingerprint } from '@/utils/apiMappers.js'

const STORAGE_PREFIX = 'assistant-mangaka-notes-done-v1'

/** Các key gắn với 1 note (id + vùng) để ẩn ổn định dù nguồn/id khác nhau. */
export function mangakaNoteDoneKeysFor(note) {
  if (!note) return []
  const keys = []
  const id = note.clientKey ?? note.id ?? note._id
  if (id != null && String(id).trim()) keys.push(`id:${String(id)}`)
  const region = noteSpatialFingerprint(note)
  if (region) keys.push(`region:${region}`)
  if (!keys.length) {
    const text = String(note.text ?? note.content ?? '').trim().slice(0, 40)
    keys.push(
      `fallback:${Math.round(Number(note.x ?? 0))}:${Math.round(Number(note.y ?? 0))}:${text}`,
    )
  }
  return keys
}

/** Key chính để React list. */
export function mangakaNoteDoneKey(note) {
  return mangakaNoteDoneKeysFor(note)[0] ?? ''
}

function storageKey(chapterId, pageId) {
  return `${STORAGE_PREFIX}:${String(chapterId ?? '')}:${String(pageId ?? '')}`
}

export function readDoneMangakaNoteKeys(chapterId, pageId) {
  if (typeof window === 'undefined' || !pageId) return new Set()
  try {
    const raw = window.sessionStorage.getItem(storageKey(chapterId, pageId))
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    return new Set(Array.isArray(arr) ? arr.map(String) : [])
  } catch {
    return new Set()
  }
}

export function writeDoneMangakaNoteKeys(chapterId, pageId, keys) {
  if (typeof window === 'undefined' || !pageId) return
  try {
    window.sessionStorage.setItem(
      storageKey(chapterId, pageId),
      JSON.stringify([...(keys ?? [])].map(String)),
    )
  } catch {
    /* ignore quota */
  }
}

export function isMangakaNoteMarkedDone(note, doneKeys) {
  const done = doneKeys instanceof Set ? doneKeys : new Set(doneKeys ?? [])
  if (!done.size) return false
  return mangakaNoteDoneKeysFor(note).some((k) => done.has(k))
}

export function filterOutDoneMangakaNotes(notes, doneKeys) {
  const done = doneKeys instanceof Set ? doneKeys : new Set(doneKeys ?? [])
  if (!done.size) return notes ?? []
  return (notes ?? []).filter((n) => !isMangakaNoteMarkedDone(n, done))
}
