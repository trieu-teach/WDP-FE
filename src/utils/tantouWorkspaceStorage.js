/**
 * Tantou Editor ↔ Mangaka / Editor Board (demo localStorage).
 */

import { readEbDebutApproved, readEbDebutPending } from './ebDebutStorage.js'
import { placeholderPageDataUrl } from './placeholderPageDataUrl.js'

export const TANTOU_SUBMISSIONS_KEY = 'mk-tantou-submissions-v1'
export const TANTOU_SCHEDULE_KEY = 'mk-tantou-publish-schedule-v1'
export const TANTOU_REVIEW_HISTORY_KEY = 'mk-tantou-review-history-v1'

const NOTIFY = 'mk-tantou-storage'

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const d = JSON.parse(raw)
    return Array.isArray(d) ? d : d
  } catch {
    return fallback
  }
}

function writeJson(key, data) {
  localStorage.setItem(key, JSON.stringify(data))
  window.dispatchEvent(new Event(NOTIFY))
}

export function listTantouSubmissions() {
  return readJson(TANTOU_SUBMISSIONS_KEY, [])
}

export function getTantouSubmission(id) {
  return listTantouSubmissions().find(s => s.id === id) ?? null
}

export function upsertTantouSubmission(submission) {
  const list = listTantouSubmissions().filter(s => s.id !== submission.id)
  list.unshift(submission)
  writeJson(TANTOU_SUBMISSIONS_KEY, list.slice(0, 100))
  return submission
}

export function updateTantouSubmission(id, patch) {
  const list = listTantouSubmissions().map(s => (s.id === id ? { ...s, ...patch } : s))
  writeJson(TANTOU_SUBMISSIONS_KEY, list)
}

export function listPublishSchedules() {
  const raw = readJson(TANTOU_SCHEDULE_KEY, {})
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
}

export function listTantouReviewHistory() {
  return readJson(TANTOU_REVIEW_HISTORY_KEY, [])
}

export function pushTantouReviewHistory(entry) {
  const list = listTantouReviewHistory()
  list.unshift(entry)
  writeJson(TANTOU_REVIEW_HISTORY_KEY, list.slice(0, 50))
}

export function setPublishSchedule(seriesTitle, schedule) {
  const map = listPublishSchedules()
  map[seriesTitle] = { ...schedule, updatedAt: new Date().toISOString() }
  writeJson(TANTOU_SCHEDULE_KEY, map)
}

export function isSeriesEbApproved(seriesTitle) {
  return !!readEbDebutApproved()[seriesTitle]
}

/** Mangaka gửi bản thảo lên Tantou Editor. */
export function buildTantouSubmissionFromMangaka({
  seriesTitle,
  seriesMeta = {},
  chapterId,
  chapterNum,
  pageIndex = 0,
  pageName,
  mangakaImageUrl,
  mangakaNotes = [],
  mangakaName = 'Mangaka',
  pipeline = 'debut',
}) {
  const needsEb = pipeline === 'debut' || seriesMeta.needsFullDebutPipeline !== false
  return {
    id: `te-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    seriesTitle,
    chapterId,
    chapterNum: String(chapterNum),
    pageIndex,
    pageLabel: pageName || `Trang ${pageIndex + 1}`,
    mangakaImageUrl: mangakaImageUrl || placeholderPageDataUrl(`${seriesTitle} · Ch.${chapterNum}`),
    mangakaNotes: mangakaNotes.map(n => ({ ...n })),
    reviewNotes: {},
    editorialComment: '',
    pipeline: needsEb ? 'debut' : 'recurring',
    needsEb,
    status: 'pending',
    qualityScore: seriesMeta.qualityScore ?? 72,
    popularityScore: seriesMeta.popularityScore ?? 65,
    publishCadence: null,
    sentAt: new Date().toISOString(),
    mangakaName,
    seriesMeta: {
      genres: seriesMeta.genres ?? [],
      formatLabel: seriesMeta.formatLabel ?? '',
      authorName: seriesMeta.authorName ?? mangakaName,
    },
  }
}

export function pushTantouSubmissionFromMangaka(payload) {
  const sub = buildTantouSubmissionFromMangaka(payload)
  return upsertTantouSubmission(sub)
}

/** Tantou: chuyển series lần đầu sang Editor Board. */
export function forwardSubmissionToEb(submissionId) {
  const sub = getTantouSubmission(submissionId)
  if (!sub) return null
  const summary = {
    id: sub.seriesTitle,
    title: sub.seriesTitle,
    genres: sub.seriesMeta?.genres ?? [],
    formatLabel: sub.seriesMeta?.formatLabel ?? 'Manga',
    authorName: sub.seriesMeta?.authorName ?? sub.mangakaName,
    needsFullDebutPipeline: true,
    tantouForwardedAt: new Date().toISOString(),
  }
  const pending = readEbDebutPending()
  const next = [summary, ...pending.filter(p => p.title !== sub.seriesTitle)]
  localStorage.setItem('mk-eb-debut-pending', JSON.stringify(next))
  window.dispatchEvent(new Event('mk-eb-pending-update'))

  updateTantouSubmission(submissionId, {
    status: 'forwarded_eb',
    forwardedAt: new Date().toISOString(),
  })
  return sub
}

/** Tantou: chưa đạt — gửi nhận xét về Mangaka. */
export function rejectSubmissionToMangaka(submissionId, { editorialComment, reviewNotes, editorialNotes }) {
  updateTantouSubmission(submissionId, {
    status: 'revision',
    editorialComment,
    reviewNotes,
    editorialNotes: Array.isArray(editorialNotes) ? editorialNotes.map(n => ({ ...n })) : undefined,
    rejectedAt: new Date().toISOString(),
  })
}

/** Tantou: duyệt chapter (luồng đã qua EB — chỉ Tantou). */
export function approveRecurringSubmission(submissionId) {
  updateTantouSubmission(submissionId, {
    status: 'approved_publish',
    approvedAt: new Date().toISOString(),
  })
}

/** Gợi ý lịch phát hành từ điểm chất lượng + độ nổi. */
export function suggestPublishCadence(qualityScore, popularityScore) {
  const score = qualityScore * 0.55 + popularityScore * 0.45
  if (score >= 75) return 'weekly'
  if (score >= 55) return 'biweekly'
  return 'monthly'
}

export function applyScheduleForEbApprovedSeries(seriesTitle, qualityScore, popularityScore, cadence) {
  const c = cadence || suggestPublishCadence(qualityScore, popularityScore)
  setPublishSchedule(seriesTitle, {
    cadence: c,
    qualityScore,
    popularityScore,
    label: c === 'weekly' ? 'Theo tuần' : c === 'biweekly' ? '2 tuần / lần' : 'Theo tháng',
  })
}

export function seedTantouDemoIfEmpty() {
  if (listTantouSubmissions().length > 0) return
  pushTantouSubmissionFromMangaka({
    seriesTitle: 'One Thorn',
    seriesMeta: {
      genres: ['Hành động', 'Drama'],
      formatLabel: 'Manga (Nhật)',
      authorName: 'Demo Mangaka',
      qualityScore: 78,
      popularityScore: 82,
    },
    chapterId: 'ch-demo',
    chapterNum: '12',
    pageIndex: 0,
    mangakaNotes: [
      { id: 'mn1', x: 10, y: 15, w: 30, h: 20, text: 'Cần chỉnh bố cục khung', taskType: 'other' },
      { id: 'mn2', x: 50, y: 40, w: 35, h: 25, text: 'Đối thoại chưa rõ', taskType: 'other' },
    ],
    pipeline: 'debut',
  })
  pushTantouSubmissionFromMangaka({
    seriesTitle: 'Sắc Không',
    seriesMeta: {
      genres: ['Isekai'],
      formatLabel: 'Webtoon',
      authorName: 'Nguyễn Văn A',
      qualityScore: 68,
      popularityScore: 70,
      needsFullDebutPipeline: false,
    },
    chapterId: 'ch-sk-8',
    chapterNum: '8',
    pageIndex: 0,
    pipeline: 'recurring',
  })
}
