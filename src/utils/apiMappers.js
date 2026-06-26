import { resolveMediaUrl } from '@/api/http.js'
import { normalizeSeries, slugifySeriesTitle } from './seriesModel.js'

const API_STATUS_TO_UI = {
  draft: 'draft',
  pending_assistant: 'assistant',
  pending_TE: 'review',
  TE_revision: 'assistant',
  pending_EB: 'review',
  EB_revision: 'assistant',
  assigned: 'assistant',
  in_progress: 'assistant',
  submitted: 'review',
  published: 'done',
}

const UI_STATUS_TO_API = {
  draft: 'draft',
  assistant: 'pending_assistant',
  review: 'pending_TE',
  tantou: 'pending_TE',
  done: 'published',
}

const TARGET_AUDIENCE_TO_DEMO = {
  shonen: 'shonen',
  shojo: 'shojo',
  seinen: 'seinen',
  josei: 'josei',
  all: 'all',
  children: 'all',
  teen: 'teen',
  adult: 'mature',
}

export function apiSeriesToUi(raw, index = 0) {
  const s = raw && typeof raw === 'object' ? raw : {}
  const id = s._id ?? s.id
  const title = String(s.name ?? s.title ?? '').trim() || `Series ${index + 1}`
  // BE trả genre là array; fallback để parse từ string (legacy)
  const genreRaw = s.genre
  const genres = Array.isArray(genreRaw)
    ? genreRaw
    : genreRaw
      ? String(genreRaw).split(/[,;|]/).map(g => g.trim()).filter(Boolean)
      : (Array.isArray(s.genres) ? s.genres : [])

  // author_id can be a populated object {_id, username, full_name} or a raw ObjectId string
  const authorObj = s.author_id
  const authorId = authorObj && typeof authorObj === 'object' ? authorObj._id : authorObj
  const authorName = authorObj && typeof authorObj === 'object'
    ? (authorObj.full_name ?? authorObj.username ?? 'Mangaka')
    : (s.author_name ?? s.authorName ?? 'Mangaka')

  return normalizeSeries({
    id,
    slug: slugifySeriesTitle(title),
    title,
    altTitle: s.alt_title ?? s.altTitle ?? '',
    synopsis: String(s.synopsis ?? s.description ?? '').trim(),
    genres,
    demographic: TARGET_AUDIENCE_TO_DEMO[s.target_audience] ?? s.demographic ?? 'shonen',
    format: s.format ?? 'manga',
    language: s.language ?? 'vi',
    contentRating: s.content_rating ?? s.contentRating ?? 'all',
    publicationStatus: s.is_public ? 'ongoing' : (s.publication_status ?? 'preparing'),
    publishType: s.publish_type ?? 'debut',
    authorName,
    authorId,
    createdAt: s.createdAt ?? s.created_at,
    updatedAt: s.updatedAt ?? s.updated_at,
    coverImage: resolveMediaUrl(s.cover_image_url ?? s.coverImage ?? null),
    chapters: s.chapter_count ?? s.chapters ?? 0,
    marks: s.marks ?? 0,
    status: API_STATUS_TO_UI[s.status] ?? s.status ?? 'draft',
    updated: formatRelativeDate(s.updatedAt ?? s.updated_at),
    progress: s.progress ?? 0,
    metadataComplete: Boolean(String(s.synopsis ?? s.description ?? '').trim()),
    category: String(s.category ?? '').trim(),
    tags: Array.isArray(s.tags) ? s.tags : [],
    age_rating: s.age_rating ?? s.ageRating ?? 'All ages',
  })
}

/**
 * Tách payload gửi BE và cover file (binary) riêng.
 * BE nhận `cover` là multipart field.
 */
export function uiSeriesFormToApi(form) {
  const genres = Array.isArray(form.genre) ? form.genre : []
  const payload = {
    name: String(form.name ?? '').trim(),
    description: String(form.description ?? '').trim(),
    genre: genres,
    target_audience: String(form.target_audience ?? '').trim(),
    synopsis: String(form.description ?? '').trim(),
    tags: Array.isArray(form.tags) ? form.tags : [],
    age_rating: String(form.age_rating ?? 'All ages').trim(),
  }
  const coverFile = form.cover && typeof form.cover === 'object' ? form.cover : null
  return { payload, coverFile }
}

export function apiChapterToRow(chapter, seriesTitle) {
  const c = chapter ?? {}
  const id = c._id ?? c.id

  // assistant_id can be populated object {_id, username, full_name} or raw ObjectId string
  const assistantObj = c.assistant_id
  const assistantId = assistantObj && typeof assistantObj === 'object' ? assistantObj._id : assistantObj

  return {
    id,
    seriesId: c.series_id?._id ?? c.series_id ?? null,
    series: seriesTitle ?? c.seriesName ?? c.series_name ?? '',
    num: c.chapter_number ?? c.num ?? 0,
    type: 'PNG',
    pages: c.page_count ?? c.pages ?? 0,
    status: API_STATUS_TO_UI[c.status] ?? c.status ?? 'draft',
    date: formatRelativeDate(c.updatedAt ?? c.updated_at ?? c.createdAt),
    statusLabel: null,
    title: c.title ?? '',
    assistantId,
  }
}

export function apiChapterToAnnotator(chapter, pages = [], seriesTitle) {
  const c = chapter ?? {}
  const id = c._id ?? c.id
  return {
    id,
    seriesId: c.series_id?._id ?? c.series_id ?? null,
    series: seriesTitle ?? '',
    num: c.chapter_number ?? c.num ?? 0,
    pages: pages.map(apiPageToUi),
    createdAt: formatRelativeDate(c.createdAt ?? c.created_at),
    cover: null,
  }
}

export function apiPageToUi(page, index = 0) {
  const p = page ?? {}
  const rawUrl =
    (p.result_image_url && p.result_image_url !== '' ? p.result_image_url : null)
    ?? (p.original_image_url && p.original_image_url !== '' ? p.original_image_url : null)
    ?? p.image_url
    ?? p.url
    ?? p.imageUrl
    ?? null
  const pageNum = p.page_number ?? index + 1
  // Ưu tiên _id từ BE (24-char ObjectId). Nếu BE tạo page trong 1 request
  // mà không trả _id, dùng page_number. Luôn dùng index làm fallback cuối
  // để đảm bảo key DUY NHẤT trong danh sách.
  const stableId = p._id ?? p.id ?? (p.page_number != null ? `p-${String(p.page_number)}` : null)
  const id = stableId ? `${stableId}` : `fallback-${index}`
  return {
    id,
    name: p.name ?? p.filename ?? `Trang ${pageNum}`,
    url: resolveMediaUrl(rawUrl),
    pageNumber: pageNum,
    width: p.width ?? 800,
    height: p.height ?? 1100,
  }
}

export function apiRankingToUi(item, index) {
  return {
    title: item.series_name ?? item.name ?? item.title ?? '',
    rank: item.rank ?? index + 1,
    delta: item.delta ?? 0,
    reads: item.reads ?? item.total_reads ?? item.view_count ?? 0,
    atRisk: Boolean(item.at_risk ?? item.atRisk),
    riskReason: item.message ?? item.risk_reason ?? item.riskReason ?? '',
    averageScore: item.average_score ?? item.averageScore ?? 0,
    seriesId: item.series_id ?? item._id ?? null,
  }
}

export function apiAssignmentToUi(item) {
  const a = item ?? {}
  const chapterId = a._id ?? a.chapter_id ?? a.id
  return {
    id: chapterId,
    chapterId,
    seriesTitle: a.series_name ?? a.seriesName ?? a.series?.name ?? '',
    seriesId: a.series_id?._id ?? a.series_id ?? null,
    chapterNum: a.chapter_number ?? a.chapterNum ?? 0,
    title: a.title ?? '',
    status: mapAssignmentStatus(a.status ?? 'assigned'),
    pageCount: a.page_count ?? a.pages?.length ?? 0,
    taskProgress: a.task_progress ?? a.taskProgress ?? null,
    pages: Array.isArray(a.pages) ? a.pages.map(apiPageToUi) : [],
  }
}

/** Body cho POST /pages/:id/notes */
export function uiNoteToApi(note) {
  return {
    text: note.text ?? '',
    x: note.x ?? 0,
    y: note.y ?? 0,
    w: note.w ?? 0,
    h: note.h ?? 0,
    taskType: note.taskType ?? 'other',
  }
}

/** @deprecated Dùng uiNoteToApi */
export const uiNoteToApiContent = uiNoteToApi

export function apiNoteToUi(raw) {
  const n = raw ?? {}
  const id = n._id ?? n.id
  const base = {
    clientKey: id ? String(id) : undefined,
    assignee: n.assignee ?? '',
  }
  if (n.text !== undefined || n.x !== undefined || n.taskType !== undefined) {
    return {
      ...base,
      id,
      text: n.text ?? '',
      x: n.x ?? 0,
      y: n.y ?? 0,
      w: n.w ?? 0,
      h: n.h ?? 0,
      taskType: n.taskType ?? 'other',
      layerIndex: n.layerIndex ?? n.layer_index ?? null,
      noteKind: n.noteKind ?? n.note_kind ?? 'paint',
      status: n.status ?? 'open',
      pageId: n.pageId ?? n.page_id ?? null,
      authorRole: n.authorRole ?? n.author_role ?? null,
    }
  }

  let parsed = {}
  try {
    parsed = typeof n.content === 'string' ? JSON.parse(n.content) : (n.content ?? {})
  } catch {
    parsed = { text: n.content ?? '' }
  }
  return {
    ...base,
    id,
    text: parsed.text ?? n.content ?? '',
    x: parsed.x ?? 0,
    y: parsed.y ?? 0,
    w: parsed.w ?? 0,
    h: parsed.h ?? 0,
    taskType: parsed.taskType ?? 'other',
    assignee: parsed.assignee ?? '',
    layerIndex: parsed.layerIndex ?? parsed.layer_index ?? null,
    noteKind: parsed.noteKind ?? parsed.note_kind ?? 'paint',
    status: parsed.status ?? n.status ?? 'open',
    pageId: parsed.pageId ?? parsed.page_id ?? n.pageId ?? n.page_id ?? null,
    authorRole: parsed.authorRole ?? parsed.author_role ?? n.authorRole ?? n.author_role ?? null,
  }
}

export function uiChapterStatusToApi(status) {
  return UI_STATUS_TO_API[status] ?? status
}

const UI_TASK_TYPE_TO_API = {
  background: 'background',
  shading: 'shading',
  fx: 'effects',
  effects: 'effects',
  details: 'details',
  other: 'other',
}

// BE enum cho revision_annotations.error_type
const UI_TASK_TYPE_TO_ERROR_TYPE = {
  background: 'art',
  shading: 'art',
  details: 'art',
  fx: 'content',
  effects: 'content',
  paint: 'art',
  layout: 'art',
  dialogue: 'dialogue',
  script: 'script',
  art: 'art',
  content: 'content',
  other: 'other',
}

export function uiTaskTypeToErrorType(taskType) {
  return UI_TASK_TYPE_TO_ERROR_TYPE[taskType] ?? 'other'
}

export function uiTaskTypeToApi(taskType) {
  return UI_TASK_TYPE_TO_API[taskType] ?? 'other'
}

export function noteRegionToApi(note) {
  return {
    x: note.x ?? 0,
    y: note.y ?? 0,
    width: note.w ?? note.width ?? 0,
    height: note.h ?? note.height ?? 0,
  }
}

export function uiNoteToTaskCreate(note, { pageId, assignedTo, price }) {
  return {
    page_id: pageId,
    assigned_to: assignedTo,
    work_type: uiTaskTypeToApi(note.taskType),
    region: noteRegionToApi(note),
    description: note.text ?? '',
    ...(price != null ? { price } : {}),
  }
}

/**
 * Tạo 1 task duy nhất cho cả chapter (luồng mới: 1 task = 1 chapter).
 * Gửi chapter_id thay vì page_id.
 */
export function uiChapterToTaskCreate({ chapterId, assignedTo, description, price, workType }) {
  return {
    chapter_id: chapterId,
    assigned_to: assignedTo,
    work_type: workType ?? 'background',
    description: description ?? '',
    ...(price != null ? { price } : {}),
  }
}

/**
 * Chuyển region (%) từ BE thành pixel coordinates.
 * @param {object} region - { x, y, width, height } tính bằng % (0-100)
 * @param {number} imgWidth - chiều rộng thực của ảnh (px)
 * @param {number} imgHeight - chiều cao thực của ảnh (px)
 * @returns {{ x: number, y: number, width: number, height: number }} pixel coords
 */
export function regionToPixels(region, imgWidth, imgHeight) {
  if (!region) return { x: 0, y: 0, width: imgWidth ?? 0, height: imgHeight ?? 0 }
  return {
    x: Math.round((region.x ?? 0) * (imgWidth || 1) / 100),
    y: Math.round((region.y ?? 0) * (imgHeight || 1) / 100),
    width: Math.round((region.width ?? 100) * (imgWidth || 1) / 100),
    height: Math.round((region.height ?? 100) * (imgHeight || 1) / 100),
  }
}

export function apiTaskToUi(raw) {
  const t = raw ?? {}
  const region = t.region ?? null
  return {
    id: t._id ?? t.id,
    pageId: t.page_id?._id ?? t.page_id ?? null,
    chapterId: t.chapter_id?._id ?? t.chapter_id ?? null,
    seriesName: t.seriesName ?? t.series_name ?? t.chapter_id?.seriesName ?? t.chapter_id?.series_name ?? t.chapter_id?.series?.name ?? null,
    assignedBy: t.assigned_by?._id ?? t.assigned_by ?? null,
    assignedTo: t.assigned_to?._id ?? t.assigned_to ?? null,
    workType: t.work_type ?? 'other',
    /**
     * region: BE trả { x, y, width, height } tính bằng % (0-100).
     * Dùng regionToPixels(region, imgWidth, imgHeight) để chuyển sang pixel khi vẽ overlay.
     */
    region,
    description: t.description ?? '',
    revisionNote: t.revision_note ?? '',
    /**
     * note_ids: mảng PageNote gắn với task.
     * BE populate đầy đủ: [{ _id, text, x, y, w, h, taskType, status, createdAt }]
     * FE nên dùng mảng này thay vì gọi riêng GET /pages/:id/notes.
     */
    noteIds: Array.isArray(t.note_ids)
      ? t.note_ids.map(n => ({
          id: n._id ?? n.id,
          text: n.text ?? '',
          x: n.x ?? 0,
          y: n.y ?? 0,
          w: n.w ?? n.width ?? 0,
          h: n.h ?? n.height ?? 0,
          taskType: n.taskType ?? 'other',
          status: n.status ?? 'open',
          createdAt: n.createdAt ?? n.created_at ?? null,
        }))
      : [],
    /**
     * Lịch sử các lần Mangaka yêu cầu chỉnh sửa.
     * TODO backend: BE nên trả về `revision_history: [{ at, by, note, request_revision_count }]`
     * để hiển thị timeline. Tạm thời fallback về mảng 1 phần tử từ `revision_note`.
     */
    revisionHistory: Array.isArray(t.revision_history)
      ? t.revision_history.map((r) => ({
          at: r.at ?? r.createdAt ?? r.updatedAt ?? null,
          by: r.by ?? r.requested_by ?? null,
          note: r.note ?? r.revision_note ?? '',
        }))
      : t.revision_note
        ? [{ at: t.updatedAt ?? t.createdAt ?? null, by: t.assigned_by ?? null, note: t.revision_note }]
        : [],
    status: t.status ?? 'pending',
    resultImageUrl: resolveMediaUrl(t.result_image_url ?? null),
    /**
     * Flow mới (1 task = 1 chapter): backend có thể trả về mảng URL
     * nhiều trang kết quả trong `result_image_urls` hoặc zip trong `result_archive_url`.
     */
    resultImageUrls: Array.isArray(t.result_image_urls)
      ? t.result_image_urls.map(resolveMediaUrl)
      : [],
    price: t.price ?? null,
    createdAt: t.createdAt ?? t.created_at,
    updatedAt: t.updatedAt ?? t.updated_at,
  }
}

export function apiSubmissionChapterToUi(raw, index = 0) {
  const c = raw ?? {}
  const series = c.series_id ?? {}
  const seriesName = typeof series === 'string' ? '' : (series.name ?? series.title ?? '')
  return {
    id: c._id ?? c.id,
    seriesId: series._id ?? series.id ?? (typeof c.series_id === 'string' ? c.series_id : null),
    seriesName,
    status: c.status ?? '',
    chapterNumber: c.chapter_number ?? c.num ?? index + 1,
    createdAt: c.createdAt ?? c.created_at,
    updatedAt: c.updatedAt ?? c.updated_at,
  }
}

function formatRelativeDate(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('vi-VN')
  } catch {
    return '—'
  }
}

export function mapAssignmentStatus(status) {
  const map = {
    draft: 'pending_assistant',
    assigned: 'pending_assistant',
    pending_assistant: 'pending_assistant',
    pending_TE: 'pending_TE',
    TE_revision: 'TE_revision',
    pending_EB: 'pending_EB',
    EB_revision: 'EB_revision',
    in_progress: 'in_progress',
    submitted: 'submitted_to_mangaka',
    approved: 'approved',
    revision: 'revision',
    published: 'submitted_to_mangaka',
  }
  return map[status] ?? 'pending_assistant'
}

export function findSeriesByIdOrSlug(list, idOrSlug) {
  if (!idOrSlug) return null
  return list.find(s => String(s.id) === String(idOrSlug))
    ?? list.find(s => s.slug === idOrSlug)
    ?? list.find(s => slugifySeriesTitle(s.title) === idOrSlug)
    ?? null
}
