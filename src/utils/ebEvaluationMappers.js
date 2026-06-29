import { resolveMediaUrl } from '@/api/http.js'
import { resolveEntityId } from '@/utils/notificationTarget.js'
import { EB_COUNCIL_MEMBERS } from '@/utils/ebCouncilStorage.js'

export const EB_SCORE_MAX = 5
export const EB_COUNCIL_SIZE = 5

/** Tiêu chí chấm điểm — khớp BE EB_CRITERIA_KEYS */
export const EB_SCORE_CRITERIA = [
  {
    key: 'story_dialogue',
    label: 'Cốt truyện & Lời thoại',
    hint: 'Story & Dialogue',
  },
  {
    key: 'art_design',
    label: 'Nét vẽ & Tạo hình nhân vật',
    hint: 'Art & Design',
  },
  {
    key: 'panel_camera',
    label: 'Phân khung & Góc máy',
    hint: 'Panel & Camera',
  },
  {
    key: 'pacing_climax',
    label: 'Nhịp độ & Cao trào',
    hint: 'Pacing & Climax',
  },
  {
    key: 'color',
    label: 'Đổ màu & Phối màu',
    hint: 'Color',
  },
]

export const EB_SCORE_KEYS = EB_SCORE_CRITERIA.map((c) => c.key)

const LEGACY_SCORE_KEYS = {
  plotDialogue: 'story_dialogue',
  artDesign: 'art_design',
  panelingCamera: 'panel_camera',
  pacingHook: 'pacing_climax',
  coloring: 'color',
  toneShading: 'color',
  story: 'story_dialogue',
  art: 'art_design',
  content_script: 'story_dialogue',
  characters: 'panel_camera',
  commercial_potential: 'pacing_climax',
  publisher_fit: 'color',
  character: 'panel_camera',
  overall: 'pacing_climax',
}

/** Chuẩn hóa pages từ BE (image_url). */
export function mapEbPages(rawPages = []) {
  return [...(Array.isArray(rawPages) ? rawPages : [])]
    .sort((a, b) => (a.page_number ?? 0) - (b.page_number ?? 0))
    .map((p) => ({
      id: resolveEntityId(p._id ?? p.id),
      pageNumber: Number(p.page_number ?? 0) || 0,
      imageUrl: resolveMediaUrl(
        p.image_url ?? p.url ?? p.final_image_url ?? p.result_image_url,
      ),
      status: p.status ?? '',
    }))
    .filter((p) => p.imageUrl)
}

/** Item từ GET /eb-evaluations/pending — mỗi phần tử là 1 Series (summary). */
export function mapEbSeriesPendingItem(raw) {
  if (!raw) return null

  const seriesId = resolveEntityId(raw._id ?? raw.id)
  if (!seriesId) return null

  const author =
    raw.author_id && typeof raw.author_id === 'object' ? raw.author_id : {}
  const firstRef = raw.first_pending_chapter ?? raw.first_chapter ?? null
  const firstChapterId = firstRef
    ? resolveEntityId(firstRef._id ?? firstRef.id)
    : ''

  return {
    id: seriesId,
    seriesId,
    name: raw.name ?? 'Series',
    seriesName: raw.name ?? 'Series',
    coverUrl: resolveMediaUrl(raw.cover_image_url),
    synopsis: String(raw.synopsis ?? '').trim(),
    genre: Array.isArray(raw.genre) ? raw.genre.filter(Boolean) : [],
    tags: Array.isArray(raw.tags) ? raw.tags.filter(Boolean) : [],
    status: raw.status ?? 'pending_EB',
    publicationSchedule: raw.publication_schedule ?? null,
    mangakaName: author.full_name ?? author.username ?? '',
    councilAverage: raw.council_average ?? null,
    classification: raw.classification ?? null,
    classificationText: raw.classification_text ?? raw.classificationText ?? '',
    evaluationId: resolveEntityId(raw.evaluation_id),
    evaluationStatus: raw.evaluation_status ?? null,
    evaluationLocked: Boolean(raw.evaluation_locked),
    firstChapter: firstChapterId
      ? {
          id: firstChapterId,
          chapterNumber: firstRef.chapter_number ?? firstRef.chapterNumber,
          title: firstRef.title ?? '',
          updatedAt: firstRef.updatedAt ?? firstRef.updated_at ?? null,
        }
      : null,
    previewImageUrl: resolveMediaUrl(raw.cover_image_url),
    raw,
  }
}

/** GET /eb-evaluations/series/:id/detail */
export function mapEbSeriesDetailResponse(data) {
  if (!data || typeof data !== 'object') return null

  const seriesRaw = data.series ?? {}
  const series = mapEbSeriesPendingItem(seriesRaw) ?? {
    id: resolveEntityId(seriesRaw._id),
    seriesId: resolveEntityId(seriesRaw._id),
    name: seriesRaw.name ?? 'Series',
    seriesName: seriesRaw.name ?? 'Series',
  }

  const firstChapterRaw = data.first_chapter ?? null
  const firstChapterId = firstChapterRaw
    ? resolveEntityId(firstChapterRaw._id ?? firstChapterRaw.id)
    : ''
  const firstChapterPages = mapEbPages(firstChapterRaw?.pages)

  const pendingChapters = (Array.isArray(data.pending_chapters)
    ? data.pending_chapters
    : []
  ).map((ch) => ({
    id: resolveEntityId(ch._id ?? ch.id),
    chapterNumber: ch.chapter_number ?? ch.chapterNumber,
    title: ch.title ?? '',
    status: ch.status ?? 'pending_EB',
    updatedAt: ch.updatedAt ?? ch.updated_at ?? null,
  })).filter((ch) => ch.id)

  return {
    series,
    firstChapter: firstChapterId
      ? {
          id: firstChapterId,
          chapterNumber:
            firstChapterRaw.chapter_number ?? firstChapterRaw.chapterNumber,
          title: firstChapterRaw.title ?? '',
          status: firstChapterRaw.status ?? 'pending_EB',
          pages: firstChapterPages,
        }
      : null,
    pendingChapters,
    evaluation: data.evaluation ?? null,
  }
}

/** GET /eb-scores/chapter/:id/preview */
export function mapEbChapterPreviewResponse(data) {
  if (!data || typeof data !== 'object') return null

  const chapterRaw = data.chapter ?? {}
  const seriesRaw = data.series ?? {}
  const submittedBy =
    data.submitted_by && typeof data.submitted_by === 'object'
      ? data.submitted_by
      : {}

  const chapterId = resolveEntityId(chapterRaw._id ?? chapterRaw.id)
  if (!chapterId) return null

  return {
    id: chapterId,
    chapterId,
    chapterNumber: chapterRaw.chapter_number ?? chapterRaw.chapterNumber,
    title: chapterRaw.title ?? '',
    status: chapterRaw.status ?? 'pending_EB',
    seriesId: resolveEntityId(seriesRaw._id ?? seriesRaw.id),
    seriesName: seriesRaw.name ?? '',
    seriesCoverUrl: resolveMediaUrl(seriesRaw.cover_image_url),
    mangakaName: submittedBy.full_name ?? submittedBy.username ?? '',
    pages: mapEbPages(data.pages),
  }
}

/** Chuẩn hóa item từ GET /eb-evaluations/pending (legacy chapter-centric) */
export function mapEbChapterPendingItem(raw) {
  if (!raw) return null

  const chapter =
    raw.chapter && typeof raw.chapter === 'object' ? raw.chapter : raw
  const seriesRef = chapter.series_id ?? raw.series_id
  const series =
    raw.series && typeof raw.series === 'object'
      ? raw.series
      : seriesRef && typeof seriesRef === 'object'
        ? seriesRef
        : {}
  const seriesIdFromRef =
    seriesRef != null && typeof seriesRef !== 'object'
      ? resolveEntityId(seriesRef)
      : null
  const chapterId = resolveEntityId(chapter._id ?? chapter.id ?? raw.chapter_id)
  if (!chapterId) return null

  const previewImages = (
    Array.isArray(chapter.preview_images) ? chapter.preview_images : []
  )
    .map((url) => resolveMediaUrl(url))
    .filter(Boolean)

  const pages = Array.isArray(chapter.pages) ? chapter.pages : []
  const previewPage = pages[0] ?? null
  const author =
    series.author && typeof series.author === 'object' ? series.author : {}

  return {
    id: chapterId,
    evaluationId: resolveEntityId(raw._id ?? raw.evaluation_id),
    chapterNumber: chapter.chapter_number ?? chapter.chapterNumber,
    title: chapter.title ?? '',
    status: chapter.status ?? 'pending_EB',
    submittedAt: chapter.submitted_at ?? raw.submitted_at ?? null,
    seriesId: resolveEntityId(series._id ?? series.id) ?? seriesIdFromRef ?? '',
    seriesName: series.name ?? series.title ?? 'Series',
    seriesCoverUrl: resolveMediaUrl(series.cover_image_url),
    councilAverage: raw.council_average ?? null,
    classification: raw.classification ?? null,
    classificationText: raw.classification_text ?? raw.classificationText ?? '',
    previewImageUrl:
      previewImages[0]
      ?? resolveMediaUrl(
        previewPage?.image_url
        ?? previewPage?.url
        ?? previewPage?.final_image_url
        ?? previewPage?.result_image_url
        ?? null,
      ),
    previewImages,
    mangakaName:
      author.full_name
      ?? author.username
      ?? chapter.submitted_by?.full_name
      ?? chapter.submitted_by?.username
      ?? raw.submitted_by?.username
      ?? '',
    memberScores: Array.isArray(raw.member_scores) ? raw.member_scores : [],
    pages,
    raw,
  }
}

/** @deprecated — alias mapEbChapterPendingItem */
export function mapEbPendingChapter(raw) {
  return mapEbChapterPendingItem(raw)
}

export function clampEbScore(value, max = EB_SCORE_MAX) {
  const parsed = Number.parseFloat(value)
  if (Number.isNaN(parsed)) return 0
  const stepped = Math.round(parsed * 2) / 2
  return Math.min(max, Math.max(0, stepped))
}

export function validateEbScore(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return 'Vui lòng nhập điểm.'
  const parsed = Number.parseFloat(raw)
  if (Number.isNaN(parsed)) return 'Điểm phải là số.'
  if (parsed < 0 || parsed > EB_SCORE_MAX) {
    return `Điểm phải trong khoảng 0 - ${EB_SCORE_MAX}.`
  }
  const stepped = Math.round(parsed * 2) / 2
  if (Math.abs(stepped - parsed) > 0.001) {
    return 'Điểm chỉ nhận bước 0.5 (ví dụ: 3.5, 4.0, 4.5).'
  }
  return ''
}

/** Chuẩn hóa ngày publish (chỉ ngày): "YYYY-MM-DD" */
export function formatEbScheduledPublishDate(value) {
  const text = String(value ?? '').trim()
  if (!text) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return text.slice(0, 10)
  return date.toISOString().slice(0, 10)
}

/**
 * Gộp ngày + giờ → ISO 8601 cho BE (scheduled_publish_at).
 * BE job quét mỗi phút — cần đủ giờ/phút, không chỉ ngày.
 */
export function formatEbScheduledPublishDateTime(dateValue, timeValue = '09:00') {
  const dateText = String(dateValue ?? '').trim()
  if (!dateText) return ''

  if (/^\d{4}-\d{2}-\d{2}T/.test(dateText)) {
    const parsed = new Date(dateText)
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString()
  }

  let datePart = ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    datePart = dateText
  } else {
    const parsed = new Date(dateText)
    if (Number.isNaN(parsed.getTime())) return ''
    datePart = parsed.toISOString().slice(0, 10)
  }

  const timeText = String(timeValue ?? '09:00').trim() || '09:00'
  const match = /^(\d{1,2}):(\d{2})$/.exec(timeText)
  const hours = match ? Math.min(23, Math.max(0, Number(match[1]))) : 9
  const minutes = match ? Math.min(59, Math.max(0, Number(match[2]))) : 0

  const [year, month, day] = datePart.split('-').map(Number)
  const local = new Date(year, month - 1, day, hours, minutes, 0, 0)
  if (Number.isNaN(local.getTime())) return ''
  return local.toISOString()
}

/** Hiển thị scheduled_publish_at (ISO) cho người dùng. */
export function formatEbScheduledPublishDisplay(isoValue) {
  if (!isoValue) return ''
  const date = new Date(isoValue)
  if (Number.isNaN(date.getTime())) return String(isoValue)
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function buildEmptyEbScores() {
  return Object.fromEntries(EB_SCORE_KEYS.map((key) => [key, '']))
}

export function buildEmptyEbComments() {
  return Object.fromEntries(EB_SCORE_KEYS.map((key) => [key, '']))
}

/** Chuẩn hóa scores từ localStorage cũ hoặc BE → key BE */
export function normalizeMemberScoreMap(scores = {}) {
  const normalized = {}
  for (const [key, value] of Object.entries(scores ?? {})) {
    const apiKey = LEGACY_SCORE_KEYS[key] ?? key
    if (EB_SCORE_KEYS.includes(apiKey) && value != null && String(value).trim() !== '') {
      normalized[apiKey] = value
    }
  }
  return normalized
}

export function normalizeMemberCommentsMap(comments = {}) {
  const normalized = {}
  for (const [key, value] of Object.entries(comments ?? {})) {
    const apiKey = LEGACY_SCORE_KEYS[key] ?? key
    if (EB_SCORE_KEYS.includes(apiKey)) {
      normalized[apiKey] = String(value ?? '')
    }
  }
  return normalized
}

/** Map scores form → object BE (không gửi average/total_score — BE tự tính) */
export function mapFeScoresToApiScores(feScores = {}) {
  const normalized = normalizeMemberScoreMap(feScores)
  return Object.fromEntries(
    EB_SCORE_KEYS.map((key) => [key, clampEbScore(normalized[key])]),
  )
}

export function mapFeCommentsToApiComments(feComments = {}) {
  const normalized = normalizeMemberCommentsMap(feComments)
  return Object.fromEntries(
    EB_SCORE_KEYS.map((key) => [key, String(normalized[key] ?? '').trim()]),
  )
}

function memberEntryToApiRow(member, entry) {
  if (!entry?.scores) return null
  const scores = mapFeScoresToApiScores(entry.scores)
  if (EB_SCORE_KEYS.some((key) => validateEbScore(scores[key]) !== '')) {
    return null
  }

  return {
    member_id: member.id,
    scores,
  }
}

/**
 * Gộp draft thành viên đang nhập vào council record (localStorage).
 */
export function mergeCouncilDraft(councilRecord, activeMemberId, draft) {
  const members = { ...(councilRecord?.members ?? {}) }
  if (activeMemberId && draft?.scores) {
    members[activeMemberId] = {
      ...(members[activeMemberId] ?? {}),
      scores: mapFeScoresToApiScores(draft.scores),
      criterionNotes: mapFeCommentsToApiComments(draft.criterionNotes),
      overallComment: String(draft.overallComment ?? '').trim(),
      notes: String(draft.notes ?? '').trim(),
      assessedAt: new Date().toISOString(),
      enteredBy: draft.enteredBy ?? null,
    }
  }
  return { ...(councilRecord ?? {}), members }
}

/**
 * Build POST body member_scores[] từ council localStorage (+ draft đang nhập).
 */
export function buildMemberScoresPayload({
  councilRecord,
  members = EB_COUNCIL_MEMBERS,
  activeMemberId,
  draft,
}) {
  const merged = mergeCouncilDraft(councilRecord, activeMemberId, draft)
  const rows = []

  for (const member of members) {
    const entry = merged.members?.[member.id]
    const row = memberEntryToApiRow(member, entry)
    if (row) rows.push(row)
  }

  return rows
}

export function validateMemberScoresPayload(memberScores, requiredCount = EB_COUNCIL_SIZE) {
  const minCount = Math.max(1, Number(requiredCount) || EB_COUNCIL_SIZE)
  if (!Array.isArray(memberScores) || memberScores.length < minCount) {
    return `Cần đủ ${minCount} thành viên Hội đồng trước khi gửi đánh giá.`
  }

  for (const row of memberScores) {
    const name = row.member_name || row.member_id || 'Thành viên'
    const scores = row.scores ?? {}
    for (const key of EB_SCORE_KEYS) {
      const err = validateEbScore(scores[key])
      if (err) {
        return `${name}: ${EB_SCORE_CRITERIA.find((c) => c.key === key)?.label ?? key} — ${err}`
      }
    }
  }

  return ''
}

export const EB_PUBLICATION_SCHEDULES = [
  { value: 'weekly', label: 'Hàng tuần (weekly)' },
  { value: 'monthly', label: 'Hàng tháng (monthly)' },
]

export const EB_CLASSIFICATION_LABELS = {
  khong_dat: 'KHÔNG ĐẠT',
  dat: 'ĐẠT',
  tot: 'TỐT',
  xuat_sac: 'XUẤT SẮC',
  FAIL: 'Không đạt',
  GOOD: 'Tốt',
  EXCELLENT: 'Xuất sắc',
}

/** Chuẩn hóa response POST .../evaluate */
export function normalizeEbEvaluateResponse(res) {
  if (!res || typeof res !== 'object') {
    return {
      evaluation: null,
      councilAverage: null,
      classification: null,
      classificationText: '',
      message: '',
    }
  }
  const evaluation = res.evaluation ?? null
  return {
    evaluation,
    councilAverage:
      res.council_average ?? evaluation?.council_average ?? null,
    classification: res.classification ?? evaluation?.classification ?? null,
    classificationText:
      res.classification_text
      ?? evaluation?.classification_text
      ?? '',
    message: res.message ?? '',
  }
}

/** Gộp preview + series detail — thay GET /eb-evaluations/chapter/:id (404). */
export function buildEbChapterDetailPayload({ preview, seriesDetail, chapterId }) {
  const cid = resolveEntityId(chapterId)
  const chapterRaw = preview?.chapter && typeof preview.chapter === 'object'
    ? preview.chapter
    : {}
  const seriesRaw = seriesDetail?.series ?? preview?.series ?? {}
  const evaluation = seriesDetail?.evaluation ?? null

  const pendingMatch = (Array.isArray(seriesDetail?.pending_chapters)
    ? seriesDetail.pending_chapters
    : []
  ).find((ch) => resolveEntityId(ch) === cid)

  const firstChapter =
    resolveEntityId(seriesDetail?.first_chapter) === cid
      ? seriesDetail.first_chapter
      : null

  const chapter = {
    ...chapterRaw,
    _id: cid || resolveEntityId(chapterRaw._id ?? chapterRaw.id),
    chapter_number:
      chapterRaw.chapter_number
      ?? chapterRaw.chapterNumber
      ?? pendingMatch?.chapter_number
      ?? firstChapter?.chapter_number,
    title: chapterRaw.title ?? pendingMatch?.title ?? firstChapter?.title ?? '',
    status:
      chapterRaw.status
      ?? pendingMatch?.status
      ?? firstChapter?.status
      ?? 'pending_EB',
    pages: chapterRaw.pages ?? firstChapter?.pages,
  }

  return {
    chapter,
    series: seriesRaw,
    evaluation,
    evaluation_history: evaluation ? [evaluation] : [],
    council_average: evaluation?.council_average ?? null,
    classification: evaluation?.classification ?? null,
    classification_text: evaluation?.classification_text ?? '',
  }
}

/** Map chapter context từ preview + GET /eb-evaluations/series/:id/detail */
export function mapEbChapterDetailResponse(data) {
  if (!data || typeof data !== 'object') return null
  const evaluation = data.evaluation ?? null
  const evaluationHistory = Array.isArray(data.evaluation_history)
    ? data.evaluation_history
    : evaluation
      ? [evaluation]
      : []
  const latestEval = evaluationHistory.at(-1) ?? evaluation

  const chapterRaw = data.chapter ?? data
  const seriesRaw = data.series ?? chapterRaw?.series_id ?? {}
  const chapter = mapEbChapterPendingItem({
    ...chapterRaw,
    series_id: seriesRaw,
    council_average:
      data.council_average
      ?? latestEval?.council_average
      ?? chapterRaw.council_average,
    classification:
      data.classification
      ?? latestEval?.classification
      ?? chapterRaw.classification,
    classification_text:
      data.classification_text
      ?? latestEval?.classification_text
      ?? chapterRaw.classification_text,
    evaluation_id: latestEval?._id ?? latestEval?.id ?? data.evaluation_id,
  })
  if (!chapter) return null
  return {
    ...chapter,
    seriesDetail: seriesRaw,
    evaluationHistory,
  }
}

export function formatEbClassification(evaluation) {
  if (!evaluation) return null
  const code = evaluation.classification
  const text = evaluation.classification_text ?? evaluation.classificationText
  if (text) return text
  if (code && EB_CLASSIFICATION_LABELS[code]) return EB_CLASSIFICATION_LABELS[code]
  if (code) return String(code)
  return null
}
