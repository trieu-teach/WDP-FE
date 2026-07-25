import { resolveMediaUrl } from '@/api/http.js'

export const CHAPTER_COVER_ACCEPT = 'image/jpeg,image/jpg,image/png,image/webp'
export const CHAPTER_COVER_MAX_BYTES = 10 * 1024 * 1024

/** Chuỗi fallback ảnh bìa chapter theo contract BE. */
export function resolveChapterCoverDisplay({
  coverImageUrl,
  page1OriginalUrl,
  seriesCoverUrl,
} = {}) {
  return (
    resolveMediaUrl(coverImageUrl)
    || resolveMediaUrl(page1OriginalUrl)
    || resolveMediaUrl(seriesCoverUrl)
    || null
  )
}

/** Lấy original của page 1 từ danh sách page UI. */
export function getPage1OriginalUrl(pages = []) {
  const list = Array.isArray(pages) ? pages : []
  const page1 =
    list.find((p) => Number(p?.pageNumber) === 1)
    ?? list[0]
    ?? null
  if (!page1) return null
  return page1.originalUrl || page1.url || null
}

export function isChapterCoverLocked(apiStatus) {
  return String(apiStatus ?? '').toLowerCase() === 'published'
}

/**
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function validateChapterCoverFile(file) {
  if (!file) return { ok: false, message: 'Chưa chọn ảnh bìa.' }
  const okType =
    file.type === 'image/jpeg'
    || file.type === 'image/jpg'
    || file.type === 'image/png'
    || file.type === 'image/webp'
    || /\.(jpe?g|png|webp)$/i.test(file.name)
  if (!okType) {
    return { ok: false, message: 'Ảnh bìa cần là JPEG/JPG/PNG/WEBP.' }
  }
  if (file.size > CHAPTER_COVER_MAX_BYTES) {
    return { ok: false, message: 'Ảnh bìa tối đa 10MB.' }
  }
  return { ok: true }
}
