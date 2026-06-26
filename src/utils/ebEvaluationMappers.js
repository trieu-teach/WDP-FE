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

/** Chuẩn hóa item từ GET /eb-evaluations/pending (hoặc chapter-pending) */
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

/** Chuẩn hóa ngày publish gửi BE: "YYYY-MM-DD" */
export function formatEbScheduledPublishDate(value) {
  const text = String(value ?? '').trim()
  if (!text) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return text.slice(0, 10)
  return date.toISOString().slice(0, 10)
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

export function validateMemberScoresPayload(memberScores) {
  if (!Array.isArray(memberScores) || memberScores.length < EB_COUNCIL_SIZE) {
    return `Cần đủ ${EB_COUNCIL_SIZE} thành viên Hội đồng trước khi gửi đánh giá.`
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

/** Map GET /eb-evaluations/chapter/:id */
export function mapEbChapterDetailResponse(data) {
  if (!data || typeof data !== 'object') return null
  const chapterRaw = data.chapter ?? data
  const seriesRaw = data.series ?? chapterRaw?.series_id ?? {}
  const chapter = mapEbChapterPendingItem({
    ...chapterRaw,
    series_id: seriesRaw,
  })
  if (!chapter) return null
  return {
    ...chapter,
    seriesDetail: seriesRaw,
    evaluationHistory: Array.isArray(data.evaluation_history)
      ? data.evaluation_history
      : [],
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
