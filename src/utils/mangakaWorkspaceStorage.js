/** Phiên Mangaka demo — giữ draft qua khi đổi trang / reload (localStorage). */

import { normalizeSeriesList } from './seriesModel.js'

export const MANGAKA_WORKSPACE_KEY = 'mk-mangaka-workspace-v1'

const PERSIST_DEBOUNCE_MS = 200
let persistTimer = null
let persistGeneration = 0

/** Đọc file ảnh → data URL (nén nhẹ) để lưu được và hiện ở mọi trang liên quan. */
export function fileToStorableDataUrl(file, maxWidth = 1400, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Không đọc được ảnh'))
      img.onload = () => {
        let w = img.naturalWidth || img.width
        let h = img.naturalHeight || img.height
        if (w > maxWidth) {
          h = Math.round((h * maxWidth) / w)
          w = maxWidth
        }
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(typeof reader.result === 'string' ? reader.result : null)
          return
        }
        ctx.drawImage(img, 0, 0, w, h)
        const usePng = file.type === 'image/png'
        const mime = usePng ? 'image/png' : 'image/jpeg'
        resolve(canvas.toDataURL(mime, usePng ? undefined : quality))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

async function blobUrlToStorableDataUrl(blobUrl) {
  const res = await fetch(blobUrl)
  const blob = await res.blob()
  const file = new File([blob], 'page.jpg', { type: blob.type || 'image/jpeg' })
  return fileToStorableDataUrl(file)
}

function isPersistablePageUrl(url) {
  return typeof url === 'string' && (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://'))
}

/** Chuẩn hóa trang ảnh trước khi ghi localStorage — blob → data URL. */
export async function prepareAnnotatorChaptersForStorage(chapters) {
  if (!Array.isArray(chapters)) return []
  return Promise.all(
    chapters.map(async (ch) => ({
      ...ch,
      pages: await Promise.all(
        (ch.pages || []).map(async (p) => {
          const url = p?.url
          if (!url || typeof url !== 'string') return { ...p, url: null }
          if (isPersistablePageUrl(url)) return { ...p, url }
          if (url.startsWith('blob:')) {
            try {
              const dataUrl = await blobUrlToStorableDataUrl(url)
              return { ...p, url: dataUrl }
            } catch {
              return { ...p, url: null }
            }
          }
          return { ...p, url: null }
        }),
      ),
    })),
  )
}

/** @deprecated — dùng prepareAnnotatorChaptersForStorage */
export function stripBlobUrlsFromAnnotatorChapters(chapters) {
  return chapters.map(ch => ({
    ...ch,
    pages: (ch.pages || []).map(p => ({
      ...p,
      url: isPersistablePageUrl(p?.url) ? p.url : null,
    })),
  }))
}

export function loadMangakaWorkspaceState(defaults) {
  try {
    const raw = localStorage.getItem(MANGAKA_WORKSPACE_KEY)
    if (!raw) return defaults
    const d = JSON.parse(raw)
    if (!d || d.v !== 1) return defaults

    const annotatorRaw = Array.isArray(d.annotatorChapters) ? d.annotatorChapters : defaults.annotatorChapters

    return {
      tab: typeof d.tab === 'string' ? d.tab : defaults.tab,
      annotateSeries: typeof d.annotateSeries === 'string' ? d.annotateSeries : defaults.annotateSeries,
      seriesList: Array.isArray(d.seriesList)
        ? normalizeSeriesList(d.seriesList)
        : defaults.seriesList,
      chapterRows: Array.isArray(d.chapterRows) ? d.chapterRows.map(c => ({ ...c })) : defaults.chapterRows,
      annotatorChapters: annotatorRaw.map(c => ({
        ...c,
        pages: (c.pages || []).map(p => ({ ...p })),
      })),
      annotatorNotes:
        d.annotatorNotes && typeof d.annotatorNotes === 'object'
          ? JSON.parse(JSON.stringify(d.annotatorNotes))
          : defaults.annotatorNotes,
      annotatorActiveChapterId:
        typeof d.annotatorActiveChapterId === 'string' ? d.annotatorActiveChapterId : defaults.annotatorActiveChapterId,
      annotatorPageIndex: Number.isFinite(d.annotatorPageIndex) ? d.annotatorPageIndex : defaults.annotatorPageIndex,
      annotatorChapterNum:
        typeof d.annotatorChapterNum === 'string' ? d.annotatorChapterNum : defaults.annotatorChapterNum,
      annotatorPagesPerChapter:
        typeof d.annotatorPagesPerChapter === 'string'
          ? d.annotatorPagesPerChapter
          : defaults.annotatorPagesPerChapter,
      annotatorUploadPageBudget:
        typeof d.annotatorUploadPageBudget === 'string'
          ? d.annotatorUploadPageBudget
          : defaults.annotatorUploadPageBudget,
    }
  } catch {
    return defaults
  }
}

function writeWorkspacePayload(snapshot, annotatorChapters) {
  const payload = {
    v: 1,
    savedAt: Date.now(),
    tab: snapshot.tab,
    annotateSeries: snapshot.annotateSeries,
    seriesList: snapshot.seriesList,
    chapterRows: snapshot.chapterRows,
    annotatorChapters,
    annotatorNotes: snapshot.annotatorNotes,
    annotatorActiveChapterId: snapshot.annotatorActiveChapterId,
    annotatorPageIndex: snapshot.annotatorPageIndex,
    annotatorChapterNum: snapshot.annotatorChapterNum,
    annotatorPagesPerChapter: snapshot.annotatorPagesPerChapter,
    annotatorUploadPageBudget: snapshot.annotatorUploadPageBudget,
  }
  localStorage.setItem(MANGAKA_WORKSPACE_KEY, JSON.stringify(payload))
  window.dispatchEvent(new CustomEvent('mk-workspace-update'))
}

export function persistMangakaWorkspaceState(snapshot) {
  clearTimeout(persistTimer)
  const gen = ++persistGeneration
  persistTimer = setTimeout(async () => {
    try {
      const annotatorChapters = await prepareAnnotatorChaptersForStorage(snapshot.annotatorChapters)
      if (gen !== persistGeneration) return
      writeWorkspacePayload(snapshot, annotatorChapters)
    } catch {
      try {
        if (gen !== persistGeneration) return
        writeWorkspacePayload(snapshot, stripBlobUrlsFromAnnotatorChapters(snapshot.annotatorChapters))
      } catch {
        /* quota / private mode */
      }
    }
  }, PERSIST_DEBOUNCE_MS)
}

/** Lưu ngay (sau upload) — tránh mất ảnh khi chuyển sang trang chi tiết. */
export async function persistMangakaWorkspaceStateNow(snapshot) {
  clearTimeout(persistTimer)
  const gen = ++persistGeneration
  try {
    const annotatorChapters = await prepareAnnotatorChaptersForStorage(snapshot.annotatorChapters)
    if (gen !== persistGeneration) return
    writeWorkspacePayload(snapshot, annotatorChapters)
  } catch {
    if (gen !== persistGeneration) return
    try {
      writeWorkspacePayload(snapshot, stripBlobUrlsFromAnnotatorChapters(snapshot.annotatorChapters))
    } catch {
      /* quota */
    }
  }
}
