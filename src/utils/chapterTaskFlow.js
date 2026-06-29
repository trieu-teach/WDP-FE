/**
 * Luồng task/page (Cách A — chuẩn BE):
 * Assistant: start → submit từng task
 * Mangaka: acknowledge (submitted) → approve (in_review) → approve-by-mangaka
 *
 * LUỒNG 2: upload-result (URL) → submit-all-by-assistant
 */

import { resolveMediaUrl } from '@/api/http.js'

export function countUnapprovedTasks(tasks) {
  return (tasks ?? []).filter((t) => t.status !== 'approved').length
}

export function allChapterTasksApproved(tasks) {
  const list = tasks ?? []
  if (!list.length) return false
  return list.every((t) => t.status === 'approved')
}

export function isChapterSubmittedByAssistant(review) {
  const status = String(
    review?.submission?.status ?? review?.chapter?.apiStatus ?? '',
  )
  return status === 'submitted_by_assistant'
}

/** Chuẩn hoá URL ảnh kết quả từ string hoặc response object (finalize / task). */
export function normalizeResultImageUrl(value) {
  if (value == null) return null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed || trimmed === '[object Object]') return null
    if (/^blob:|^data:/i.test(trimmed)) return null
    return resolveMediaUrl(trimmed) ?? trimmed
  }
  if (typeof value === 'object') {
    const nested =
      value.result_image_url
      ?? value.final_image_url
      ?? value.resultImageUrl
      ?? value.finalImageUrl
      ?? value.composed_image_url
      ?? value.url
      ?? value.data?.result_image_url
      ?? value.data?.final_image_url
      ?? null
    return normalizeResultImageUrl(nested)
  }
  return null
}

function taskResultUrl(task) {
  if (!task) return null
  if (task.resultImageUrl) return task.resultImageUrl
  const fromList = Array.isArray(task.resultImageUrls)
    ? task.resultImageUrls.find(Boolean)
    : null
  return fromList ?? null
}

const TASK_STATUS_RANK = {
  approved: 60,
  in_review: 50,
  submitted: 40,
  in_progress: 30,
  pending: 20,
  cancelled: 0,
}

function taskPriority(task) {
  let score = TASK_STATUS_RANK[task?.status] ?? 10
  if (taskResultUrl(task)) score += 5
  if (task?.updatedAt) {
    const ts = new Date(task.updatedAt).getTime()
    if (!Number.isNaN(ts)) score += ts / 1e15
  }
  return score
}

function pickPreferredTask(a, b) {
  return taskPriority(b) > taskPriority(a) ? b : a
}

/**
 * LUỒNG 2: 1 page = 1 task. Gộp bản trùng (POST /chapters + PATCH submit tạo 2 lần).
 */
export function dedupeTasksByPage(tasks) {
  const byPage = new Map()
  const orphans = []

  for (const task of tasks ?? []) {
    if (!task) continue
    const pageKey = task.pageId != null ? String(task.pageId) : null
    if (!pageKey) {
      orphans.push(task)
      continue
    }
    const existing = byPage.get(pageKey)
    byPage.set(pageKey, existing ? pickPreferredTask(existing, task) : task)
  }

  return sortTasksByPage([...byPage.values(), ...orphans])
}

/**
 * Ảnh so sánh: ưu tiên Page.resultUrl, fallback Task.resultImageUrl.
 */
export function buildReviewPageCompare(pages = [], tasks = []) {
  const dedupedTasks = dedupeTasksByPage(tasks)
  const sortedPages = [...pages].sort(
    (a, b) => (a.pageNumber ?? 0) - (b.pageNumber ?? 0),
  )
  const taskByPageId = new Map()
  for (const t of dedupedTasks) {
    if (t?.pageId) taskByPageId.set(String(t.pageId), t)
  }

  const originals = []
  const results = []

  if (sortedPages.length > 0) {
    for (const p of sortedPages) {
      const task = taskByPageId.get(String(p.id))
      originals.push(p?.originalUrl || p?.url || null)
      results.push(p?.resultUrl || taskResultUrl(task) || null)
    }
  } else if (dedupedTasks.length > 0) {
    for (const t of dedupedTasks) {
      originals.push(null)
      results.push(taskResultUrl(t))
    }
  }

  const resultCount = results.filter(Boolean).length
  return {
    originals,
    results,
    resultCount,
    pageCount: sortedPages.length || results.length,
  }
}

/** Cho phép phê duyệt chapter khi đủ ảnh (Flow B) hoặc đủ task đã duyệt (Flow A). */
export function canMangakaApproveChapterReview(review, pageCompare) {
  const tasks = dedupeTasksByPage(review?.tasks ?? [])
  const { resultCount, pageCount } = pageCompare ?? {}

  if (isChapterSubmittedByAssistant(review) && resultCount > 0) {
    if (pageCount === 0 || resultCount >= pageCount) return true
  }

  if (!tasks.length) return false
  return countUnapprovedTasks(tasks) === 0
}

export function sortTasksByPage(tasks) {
  return [...(tasks ?? [])].sort((a, b) => {
    const pa = a.pageNumber ?? a.pageId ?? ''
    const pb = b.pageNumber ?? b.pageId ?? ''
    return String(pa).localeCompare(String(pb))
  })
}

/** Task đủ điều kiện PATCH /tasks/:id/revision (Mangaka → Assistant). */
const MANGAKA_TASK_REVISION_STATUSES = new Set(['submitted', 'in_review'])

export function getTasksForMangakaRevision(tasks) {
  return dedupeTasksByPage(tasks).filter(
    (t) => t?.id && MANGAKA_TASK_REVISION_STATUSES.has(t.status),
  )
}

/** Tải ảnh đã finalize thành File để POST /tasks/:id/submit */
export async function urlToResultFile(url, filename = 'result.png') {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Không tải được ảnh kết quả để nộp task.')
  const blob = await res.blob()
  const type = blob.type && blob.type !== 'application/octet-stream'
    ? blob.type
    : 'image/png'
  return new File([blob], filename, { type })
}
