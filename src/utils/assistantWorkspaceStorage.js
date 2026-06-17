/**
 * Hộp thư Assistant ↔ Mangaka (demo localStorage + IndexedDB).
 * Mangaka gửi: ảnh trang + ô ghi chú.
 * Assistant tải lên: layer PNG (lưu trong IndexedDB để tránh quota localStorage).
 * Assistant gửi lại: layer trong suốt hoặc bản ghép (cũng lưu IndexedDB).
 */

import {
  deleteBlob,
  deleteBlobsByPrefix,
  getBlob,
  paintLayerBlobKey,
  paintLayerVersionBlobKey,
  deliverableBlobKey,
  putBlob,
} from './assistantLayerBlobs.js'
import { normalizeProductionLayers } from './assistantProductionLayerUtils.js'

export const ASSISTANT_INBOX_KEY = 'mk-assistant-inbox-v1'
export const ASSISTANT_DELIVERABLES_KEY = 'mk-assistant-deliverables-v1'

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const d = JSON.parse(raw)
    return Array.isArray(d) ? d : fallback
  } catch {
    return fallback
  }
}

function writeJson(key, data) {
  let payload = data
  try {
    localStorage.setItem(key, JSON.stringify(payload))
  } catch (err) {
    if (err && err.name === 'QuotaExceededError' && Array.isArray(payload) && payload.length > 1) {
      // Cắt bớt 50% mục cũ nhất rồi thử lại
      console.warn(`[assistantWorkspaceStorage] quota exceeded → trim oldest entries for ${key}`)
      payload = payload.slice(0, Math.max(1, Math.floor(payload.length / 2)))
      try {
        localStorage.setItem(key, JSON.stringify(payload))
      } catch {
        console.error('[assistantWorkspaceStorage] still failed after trim — dropping key', key)
        try { localStorage.removeItem(key) } catch { /* ignore */ }
        return
      }
    } else {
      console.error('[assistantWorkspaceStorage] write failed', key, err)
      return
    }
  }
  window.dispatchEvent(new Event('mk-assistant-storage'))
}

/**
 * Migration: nếu inbox/deliverables đang giữ dataUrl lớn trong localStorage,
 * chuyển chúng sang IndexedDB và ghi đè localStorage chỉ với metadata.
 */
let migrationPromise = null
export function migrateAssistantStorage() {
  if (migrationPromise) return migrationPromise
  if (typeof window === 'undefined') return Promise.resolve()
  migrationPromise = (async () => {
    try {
      // Inbox
      const inbox = readJson(ASSISTANT_INBOX_KEY, [])
      let inboxChanged = false
      for (const sub of inbox) {
        if (sub.mangakaImageUrl && typeof sub.mangakaImageUrl === 'string' && sub.mangakaImageUrl.length > 32 * 1024) {
          const key = `sub:${sub.id}:image`
          try {
            await putBlob(key, sub.mangakaImageUrl)
            sub.mangakaImageUrl = null
            sub.mangakaImageBlobKey = key
            inboxChanged = true
          } catch { /* ignore */ }
        }
      }
      if (inboxChanged) {
        try { localStorage.setItem(ASSISTANT_INBOX_KEY, JSON.stringify(inbox)) } catch { /* ignore */ }
      }

      // Deliverables
      const dels = readJson(ASSISTANT_DELIVERABLES_KEY, [])
      let delsChanged = false
      for (const d of dels) {
        if (d.compositeDataUrl && typeof d.compositeDataUrl === 'string' && d.compositeDataUrl.length > 32 * 1024) {
          const k = deliverableBlobKey(d.id, 'composite')
          try { await putBlob(k, d.compositeDataUrl); d.compositeDataUrl = null; d.compositeBlobKey = k; delsChanged = true } catch { /* ignore */ }
        }
        if (d.overlayDataUrl && typeof d.overlayDataUrl === 'string' && d.overlayDataUrl.length > 32 * 1024) {
          const k = deliverableBlobKey(d.id, 'overlay')
          try { await putBlob(k, d.overlayDataUrl); d.overlayDataUrl = null; d.overlayBlobKey = k; delsChanged = true } catch { /* ignore */ }
        }
        if (d.mangakaImageUrl && typeof d.mangakaImageUrl === 'string' && d.mangakaImageUrl.length > 32 * 1024) {
          const k = deliverableBlobKey(d.id, 'manga')
          try { await putBlob(k, d.mangakaImageUrl); d.mangakaImageUrl = null; d.mangakaImageBlobKey = k; delsChanged = true } catch { /* ignore */ }
        }
      }
      if (delsChanged) {
        try { localStorage.setItem(ASSISTANT_DELIVERABLES_KEY, JSON.stringify(dels)) } catch { /* ignore */ }
      }
    } catch (err) {
      console.warn('[assistantWorkspaceStorage] migration failed', err)
    }
  })()
  return migrationPromise
}

export function placeholderPageDataUrl(label = 'Chưa có ảnh trang') {
  const c = document.createElement('canvas')
  c.width = 728
  c.height = 1030
  const ctx = c.getContext('2d')
  if (!ctx) return ''
  ctx.fillStyle = '#1e1d1b'
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.fillStyle = '#6b6a66'
  ctx.font = '22px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(label, c.width / 2, c.height / 2)
  return c.toDataURL('image/png')
}

/**
 * Tách dataUrl của ảnh gốc Mangaka khỏi submission, lưu vào IndexedDB.
 * localStorage chỉ giữ key. Trả về submission "slim".
 */
async function persistMangakaImage(submission) {
  if (!submission) return submission
  const url = submission.mangakaImageUrl
  if (!url || typeof url !== 'string') return submission
  if (url.length < 64 * 1024) return submission // nhỏ thì giữ nguyên
  const key = `sub:${submission.id}:image`
  try {
    await putBlob(key, url)
    return { ...submission, mangakaImageUrl: null, mangakaImageBlobKey: key }
  } catch {
    return submission
  }
}

export async function pushAssistantSubmission(submission) {
  const slim = await persistMangakaImage(submission)
  const list = readJson(ASSISTANT_INBOX_KEY, [])
  list.unshift(slim)
  try {
    writeJson(ASSISTANT_INBOX_KEY, list.slice(0, 80))
  } catch {
    /* fall through */
  }
  return submission
}

export function listAssistantSubmissions() {
  return readJson(ASSISTANT_INBOX_KEY, [])
}

export function getAssistantSubmission(id) {
  return listAssistantSubmissions().find(s => s.id === id) ?? null
}

export function updateAssistantSubmission(id, patch) {
  const list = listAssistantSubmissions().map(s => (s.id === id ? { ...s, ...patch } : s))
  writeJson(ASSISTANT_INBOX_KEY, list)
}

/** Hydrate submission: lấy ảnh gốc từ IDB nếu cần. */
export async function hydrateAssistantSubmission(submission) {
  if (!submission) return submission
  if (submission.mangakaImageUrl) return submission
  if (!submission.mangakaImageBlobKey) return submission
  try {
    const url = await getBlob(submission.mangakaImageBlobKey)
    return { ...submission, mangakaImageUrl: url ?? null }
  } catch {
    return submission
  }
}

/**
 * Lưu paint layers cho một submission. Mỗi layer dataUrl được đẩy vào IndexedDB.
 * localStorage chỉ giữ metadata (id, name, visible, opacity, blobKey, hasImage).
 */
export async function saveAssistantPaintLayers(submissionId, paintLayers) {
  if (!submissionId) return
  const layers = Array.isArray(paintLayers) ? paintLayers : []

  const sub = getAssistantSubmission(submissionId)
  const prev = Array.isArray(sub?.paintLayers) ? sub.paintLayers : []
  const prevIds = new Set(prev.map(l => l.id))
  const nextIds = new Set(layers.map(l => l.id))

  // Xóa blob của layer đã bị bỏ
  for (const m of prev) {
    if (!nextIds.has(m.id)) {
      const key = m.blobKey || paintLayerBlobKey(submissionId, m.id)
      try { await deleteBlob(key) } catch { /* ignore */ }
    }
  }

  // Ghi blob cho layer hiện tại
  const metaList = []
  for (const layer of layers) {
    const blobKey = paintLayerBlobKey(submissionId, layer.id)
    if (layer.dataUrl) {
      try { await putBlob(blobKey, layer.dataUrl) } catch { /* ignore */ }
    }

    const versionsMeta = []
    for (const ver of layer.versions ?? []) {
      const verKey = paintLayerVersionBlobKey(submissionId, layer.id, ver.id)
      if (ver.dataUrl) {
        try { await putBlob(verKey, ver.dataUrl) } catch { /* ignore */ }
      }
      versionsMeta.push({
        id: ver.id,
        label: ver.label,
        createdAt: ver.createdAt,
        blobKey: verKey,
        hasImage: !!ver.dataUrl || ver.id === layer.activeVersionId,
      })
    }

    metaList.push({
      id: layer.id,
      name: layer.name,
      stepType: layer.stepType ?? null,
      type: layer.type ?? 'paint',
      visible: layer.visible !== false,
      opacity: layer.opacity ?? 100,
      sortOrder: layer.sortOrder ?? 0,
      hasImage: !!layer.dataUrl,
      blobKey,
      activeVersionId: layer.activeVersionId ?? null,
      versions: versionsMeta,
    })
  }

  updateAssistantSubmission(submissionId, { paintLayers: metaList })
}

/** Đọc paint layers + ảnh dataUrl từ IDB cho submission. */
export async function loadAssistantPaintLayers(submissionId) {
  if (!submissionId) return []
  const sub = getAssistantSubmission(submissionId)
  const meta = Array.isArray(sub?.paintLayers) ? sub.paintLayers : []
  const out = []
  for (const m of meta) {
    let dataUrl = null
    if (m.hasImage) {
      const key = m.blobKey || paintLayerBlobKey(submissionId, m.id)
      try { dataUrl = await getBlob(key) } catch { dataUrl = null }
    }

    const versions = []
    for (const ver of m.versions ?? []) {
      let verUrl = null
      if (ver.hasImage) {
        const verKey =
          ver.blobKey || paintLayerVersionBlobKey(submissionId, m.id, ver.id)
        try { verUrl = await getBlob(verKey) } catch { verUrl = null }
      }
      versions.push({
        id: ver.id,
        label: ver.label,
        createdAt: ver.createdAt,
        dataUrl: verUrl,
      })
    }

    if (!dataUrl && m.activeVersionId) {
      const activeVer = versions.find((v) => v.id === m.activeVersionId)
      dataUrl = activeVer?.dataUrl ?? null
    }

    out.push({
      id: m.id,
      name: m.name,
      stepType: m.stepType ?? null,
      type: m.type ?? 'paint',
      visible: m.visible !== false,
      opacity: m.opacity ?? 100,
      sortOrder: m.sortOrder ?? 0,
      dataUrl,
      thumbUrl: dataUrl,
      activeVersionId: m.activeVersionId ?? null,
      versions,
    })
  }
  return normalizeProductionLayers(out)
}

/**
 * Push deliverable: dataUrls (composite/overlay) lưu IDB, metadata lưu localStorage.
 */
export async function pushAssistantDeliverable(deliverable) {
  if (!deliverable) return null
  const slim = { ...deliverable }

  if (slim.compositeDataUrl) {
    const key = deliverableBlobKey(slim.id, 'composite')
    try {
      await putBlob(key, slim.compositeDataUrl)
      slim.compositeBlobKey = key
    } catch { /* ignore */ }
    slim.compositeDataUrl = null
  }
  if (slim.overlayDataUrl) {
    const key = deliverableBlobKey(slim.id, 'overlay')
    try {
      await putBlob(key, slim.overlayDataUrl)
      slim.overlayBlobKey = key
    } catch { /* ignore */ }
    slim.overlayDataUrl = null
  }
  // Đẩy mangakaImageUrl vào IDB nếu chưa có blobKey (tránh phình localStorage)
  if (slim.mangakaImageUrl && !slim.mangakaImageBlobKey) {
    const key = deliverableBlobKey(slim.id, 'manga')
    try {
      await putBlob(key, slim.mangakaImageUrl)
      slim.mangakaImageBlobKey = key
    } catch { /* ignore */ }
  }
  slim.mangakaImageUrl = null

  const list = readJson(ASSISTANT_DELIVERABLES_KEY, [])
  list.unshift(slim)
  try {
    writeJson(ASSISTANT_DELIVERABLES_KEY, list.slice(0, 80))
  } catch {
    /* fall through */
  }
  if (slim.submissionId) {
    updateAssistantSubmission(slim.submissionId, { status: 'submitted_to_mangaka' })
  }
  return slim
}

export function listAssistantDeliverables() {
  return readJson(ASSISTANT_DELIVERABLES_KEY, [])
}

export function getLatestDeliverableForChapter({ seriesTitle, chapterId, pageIndex }) {
  return listAssistantDeliverables().find(
    d =>
      d.seriesTitle === seriesTitle
      && d.chapterId === chapterId
      && d.pageIndex === pageIndex
      && d.status !== 'rejected',
  ) ?? null
}

export function getPendingDeliverableForMangaka() {
  return listAssistantDeliverables().find(d => d.status === 'pending_mangaka_review') ?? null
}

export function updateDeliverableStatus(id, status) {
  const list = listAssistantDeliverables().map(d => (d.id === id ? { ...d, status } : d))
  writeJson(ASSISTANT_DELIVERABLES_KEY, list)
}

/** Lấy dataUrl ảnh ghép/overlay cho deliverable từ IDB (cho Mangaka xem trước). */
export async function hydrateAssistantDeliverable(deliverable) {
  if (!deliverable) return deliverable
  const out = { ...deliverable }
  if (!out.compositeDataUrl && out.compositeBlobKey) {
    try { out.compositeDataUrl = await getBlob(out.compositeBlobKey) } catch { /* ignore */ }
  }
  if (!out.overlayDataUrl && out.overlayBlobKey) {
    try { out.overlayDataUrl = await getBlob(out.overlayBlobKey) } catch { /* ignore */ }
  }
  if (!out.mangakaImageUrl && out.mangakaImageBlobKey) {
    try { out.mangakaImageUrl = await getBlob(out.mangakaImageBlobKey) } catch { /* ignore */ }
  }
  return out
}

/** Dọn IDB khi xóa submission/deliverable. */
export async function purgeAssistantSubmissionBlobs(submissionId) {
  await deleteBlobsByPrefix(`paint:${submissionId}:`).catch(() => {})
  await deleteBlob(`sub:${submissionId}:image`).catch(() => {})
}

export function buildSubmissionFromMangakaPage({
  seriesTitle,
  chapterId,
  chapterNum,
  pageIndex,
  pageName,
  mangakaImageUrl,
  notes,
  mangakaName = 'Mangaka',
}) {
  const imageUrl = mangakaImageUrl || placeholderPageDataUrl(`${seriesTitle} · Trang ${pageIndex + 1}`)
  return {
    id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    seriesTitle,
    chapterId,
    chapterNum: String(chapterNum),
    pageIndex,
    pageLabel: pageName || `Trang ${pageIndex + 1}`,
    mangakaImageUrl: imageUrl,
    notes: (notes || []).map(n => ({ ...n })),
    mangakaName,
    status: 'pending_assistant',
    sentAt: new Date().toISOString(),
  }
}
