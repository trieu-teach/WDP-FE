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

/**
 * Gộp ảnh kết quả từ Task vào Page — BE thường chỉ lưu result trên task,
 * GET /pages không có result_image_url → Upload & ghi chú vẫn hiện ảnh gốc nếu không merge.
 */
export function mergeTaskResultsIntoPages(pages = [], tasks = []) {
  const deduped = dedupeTasksByPage(tasks)
  const byPageId = new Map()
  const byPageNum = new Map()
  for (const t of deduped) {
    if (t?.pageId) byPageId.set(String(t.pageId), t)
    if (t?.pageNumber != null && Number.isFinite(Number(t.pageNumber))) {
      byPageNum.set(Number(t.pageNumber), t)
    }
  }

  return (pages ?? []).map((p) => {
    const task =
      byPageId.get(String(p?.id))
      ?? byPageNum.get(Number(p?.pageNumber))
    const fromTask = taskResultUrl(task)
    if (!fromTask && task?.status !== 'approved') return p

    const resultUrl = p.resultUrl || fromTask || null
    const taskApproved = task?.status === 'approved'
    return {
      ...p,
      resultUrl,
      assistantApproved: Boolean(p.assistantApproved || taskApproved),
      // Khi đã có ảnh Assistant / task approved → ưu tiên hiện result
      url: (taskApproved || p.assistantApproved) && resultUrl
        ? resultUrl
        : p.url,
    }
  })
}

const TASK_STATUS_RANK = {
  approved: 60,
  revision: 55,
  in_review: 50,
  submitted: 48,
  in_progress: 44,
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

/** Ưu tiên task chưa approved khi cùng page (tránh ẩn task cần duyệt sau revision). */
function pickReviewTaskPerPage(a, b) {
  const aApproved = a?.status === 'approved'
  const bApproved = b?.status === 'approved'
  if (aApproved && !bApproved) return b
  if (!aApproved && bApproved) return a
  return pickPreferredTask(a, b)
}

/**
 * 1 page = 1 task cho màn duyệt Mangaka — luôn hiện task chưa approved nếu có trùng page.
 */
export function dedupeTasksForMangakaReview(tasks) {
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
    byPage.set(pageKey, existing ? pickReviewTaskPerPage(existing, task) : task)
  }

  return sortTasksByPage([...byPage.values(), ...orphans])
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
  const tasks = dedupeTasksForMangakaReview(
    review?.allTasks ?? review?.tasks ?? [],
  )
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

/** Task chưa approved cần có result_image_url trước submit-all-by-assistant. */
export function taskRequiresResultImage(task) {
  if (!task?.id) return false
  if (task.status === 'approved') return false
  return !normalizeResultImageUrl(task.resultImageUrl)
}

/** Danh sách task thiếu ảnh kết quả (kèm số trang để hiển thị). */
export function listTasksMissingResultImage(tasks, pages = []) {
  const pageById = new Map()
  for (const p of pages ?? []) {
    const id = p?.id ?? p?._id
    if (id) pageById.set(String(id), p)
  }
  return sortTasksByPage(tasks ?? [])
    .filter(taskRequiresResultImage)
    .map((t) => {
      const pid = t.pageId != null ? String(t.pageId) : null
      const page = pid ? pageById.get(pid) : null
      return {
        taskId: t.id,
        pageId: pid,
        pageNumber: t.pageNumber ?? page?.pageNumber ?? null,
        status: t.status ?? null,
      }
    })
}

function formatMissingPagesLabel(missing) {
  const nums = [...new Set(
    (missing ?? [])
      .map((m) => m.pageNumber)
      .filter((n) => n != null && n !== ''),
  )].sort((a, b) => Number(a) - Number(b))
  if (nums.length) return nums.map((n) => `Trang ${n}`).join(', ')
  const ids = (missing ?? []).map((m) => m.taskId).filter(Boolean)
  return ids.length ? `task ${ids.slice(0, 3).join(', ')}${ids.length > 3 ? '…' : ''}` : 'một số task'
}

/** Thông báo lỗi submit-all — ưu tiên data structured từ BE, fallback parse message. */
export function formatSubmitAllAssistantError(err, pages = []) {
  const body = err?.response?.data ?? {}
  const code = body.code ?? ''
  const data = body.data ?? {}

  if (code === 'MISSING_IMAGES' || data.missing_count != null) {
    const count = Number(data.missing_count) || 0
    const pageNums = Array.isArray(data.missing_page_numbers)
      ? data.missing_page_numbers.filter((n) => n != null)
      : []
    const label = pageNums.length
      ? pageNums.map((n) => `Trang ${n}`).join(', ')
      : formatMissingPagesLabel(
        (data.missing_task_ids ?? []).map((id) => ({ taskId: id })),
      )
    return `${count || 'Một số'} task chưa có ảnh kết quả (${label}). Vào từng trang, bấm "Gộp layer" rồi thử gửi lại.`
  }

  const apiMsg = String(body.message ?? '')
  if (apiMsg.includes('chưa có ảnh')) {
    const countMatch = apiMsg.match(/(\d+)\s+task/)
    const count = countMatch ? Number(countMatch[1]) : null
    const prefix = count ? `${count} task` : 'Một số task'
    return `${prefix} chưa có ảnh kết quả trên server. Vào từng trang còn thiếu, bấm "Gộp layer" rồi thử gửi lại.`
  }

  if (apiMsg.includes('approved')) {
    return 'Một số trang đã được Mangaka duyệt nên không thể nộp lại. Hãy tải lại trang để cập nhật trạng thái mới nhất.'
  }

  return getApiErrorMessageFallback(err, 'Gửi chapter thất bại.')
}

function getApiErrorMessageFallback(err, fallback) {
  const message = err?.response?.data?.message
  return message && String(message).trim() ? String(message) : fallback
}

/** Chuẩn hoá data.missing_tasks từ POST approve-by-mangaka 400. */
export function parseApproveChapterErrorData(err) {
  const data = err?.response?.data?.data ?? {}
  const missing = Array.isArray(data.missing_tasks) ? data.missing_tasks : []
  return {
    totalUnfinished: Number(data.total_unfinished) || missing.length || 0,
    affectedPages: Number(data.affected_pages) || 0,
    missingTasks: missing.map((t) => ({
      taskId: t.task_id ?? t.taskId ?? t._id ?? t.id ?? null,
      pageId: t.page_id ?? t.pageId ?? null,
      pageNumber: t.page_number ?? t.pageNumber ?? null,
      status: t.status ?? null,
      revisionRound: t.revision_round ?? t.revisionRound ?? null,
    })),
    message: String(err?.response?.data?.message ?? ''),
  }
}

/** Thông báo lỗi approve-by-mangaka — ưu tiên affected_pages + missing_tasks từ BE. */
export function formatApproveByMangakaError(err) {
  const parsed = parseApproveChapterErrorData(err)
  const { affectedPages, missingTasks, message } = parsed

  if (missingTasks.length || affectedPages > 0) {
    const pageNums = [...new Set(
      missingTasks.map((t) => t.pageNumber).filter((n) => n != null && n !== ''),
    )].sort((a, b) => Number(a) - Number(b))
    const count = affectedPages || pageNums.length || missingTasks.length
    const pagesLabel = pageNums.length
      ? pageNums.map((n) => `Trang ${n}`).join(', ')
      : `${count} trang`
    const statusHint = missingTasks
      .filter((t) => t.status && t.status !== 'approved')
      .map((t) => (t.pageNumber != null ? `Trang ${t.pageNumber}: ${t.status}` : t.status))
      .slice(0, 3)
      .join(' · ')
    const suffix = statusHint ? ` (${statusHint})` : ''
    return `${count} trang còn task chưa được duyệt (${pagesLabel})${suffix}. Nhận → Duyệt từng task ở danh sách bên dưới rồi thử Gửi lại.`
  }

  if (message.includes('chưa được duyệt') || message.includes('chưa duyệt')) {
    const countMatch = message.match(/(\d+)\s+(?:trang|task)/)
    const count = countMatch ? countMatch[1] : 'Một số'
    return `${count} trang/task chưa được duyệt. Nhận → Duyệt từng task rồi thử Gửi lại.`
  }

  return getApiErrorMessageFallback(err, 'Duyệt chapter thất bại.')
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
