/**
 * Điểm chấm debut theo từng thành viên Hội đồng biên tập (demo localStorage).
 * Một tài khoản đại diện nhập điểm cho từng thành viên; hiển thị tổng hợp đủ cả HĐ.
 */

export const EB_COUNCIL_SCORES_KEY = 'mk-eb-council-scores-v2'

export const EB_COUNCIL_MEMBERS = [
  { id: 'chair', name: 'PGS.TS. Trần Minh Khoa', title: 'Chủ tịch HĐ' },
  { id: 'member-1', name: 'ThS. Lê Thu Hà', title: 'Biên tập trưởng' },
  { id: 'member-2', name: 'Nguyễn Quang Đức', title: 'Biên tập viên' },
  { id: 'member-3', name: 'Phạm Ngọc Linh', title: 'Cố vấn nội dung' },
  { id: 'member-4', name: 'Hoàng Thị Mai', title: 'Đánh giá kỹ thuật' },
]

const NOTIFY = 'mk-eb-council-update'

function readAll() {
  try {
    const raw = localStorage.getItem(EB_COUNCIL_SCORES_KEY)
    const data = raw ? JSON.parse(raw) : {}
    return data && typeof data === 'object' ? data : {}
  } catch {
    return {}
  }
}

function writeAll(data) {
  localStorage.setItem(EB_COUNCIL_SCORES_KEY, JSON.stringify(data))
  window.dispatchEvent(new Event(NOTIFY))
}

export function readCouncilSeriesScores(seriesTitle) {
  const key = String(seriesTitle ?? '').trim()
  if (!key) return null
  return readAll()[key] ?? null
}

/** Chapter đã chấm đủ Hội đồng (API hoặc localStorage) — ẩn khỏi hàng chờ duyệt. */
export function isEbChapterFullyScored(chapterItem) {
  if (!chapterItem?.id) return false

  if (chapterItem.councilAverage != null) return true

  if (
    Array.isArray(chapterItem.memberScores)
    && chapterItem.memberScores.length >= EB_COUNCIL_MEMBERS.length
  ) {
    return true
  }

  const record = readCouncilSeriesScores(chapterItem.id)
  if (!record?.members) return false

  const scoredCount = EB_COUNCIL_MEMBERS.filter(
    (member) => record.members[member.id]?.scores,
  ).length

  return scoredCount >= EB_COUNCIL_MEMBERS.length
}

export function saveCouncilMemberAssessment(seriesTitle, memberId, payload) {
  const key = String(seriesTitle ?? '').trim()
  if (!key || !memberId) return null

  const all = readAll()
  const current = all[key] ?? { members: {} }
  current.members = {
    ...(current.members ?? {}),
    [memberId]: {
      scores: { ...payload.scores },
      criterionNotes: { ...(payload.criterionNotes ?? {}) },
      overallComment: payload.overallComment ?? '',
      notes: payload.notes ?? '',
      average: payload.average,
      assessedAt: payload.assessedAt ?? new Date().toISOString(),
      enteredBy: payload.enteredBy ?? null,
    },
  }
  all[key] = current
  writeAll(all)
  return current
}

export function clampCouncilScore(value, max = 5) {
  const parsed = Number.parseFloat(value)
  if (Number.isNaN(parsed)) return 0
  return Math.min(max, Math.max(0, parsed))
}

/** DTB từng thành viên + DTB hội đồng (trung bình các thành viên đã chấm). */
export function buildCouncilAggregate(seriesRecord, scoreFieldKeys) {
  const emptyCriterionAverages = Object.fromEntries(
    scoreFieldKeys.map((key) => [key, 0]),
  )
  if (!seriesRecord?.members) {
    return {
      memberRows: EB_COUNCIL_MEMBERS.map((member) => ({
        ...member,
        scored: false,
        scores: {},
        average: null,
        assessedAt: null,
        enteredBy: null,
      })),
      councilAverage: 0,
      scoredCount: 0,
      criterionAverages: emptyCriterionAverages,
    }
  }

  const memberRows = EB_COUNCIL_MEMBERS.map((member) => {
    const entry = seriesRecord.members[member.id]
    if (!entry?.scores) {
      return {
        ...member,
        scored: false,
        scores: {},
        average: null,
        assessedAt: null,
        enteredBy: null,
      }
    }

    const scores = entry.scores
    const total = scoreFieldKeys.reduce(
      (sum, key) => sum + clampCouncilScore(scores[key]),
      0,
    )
    const average = scoreFieldKeys.length ? total / scoreFieldKeys.length : 0

    return {
      ...member,
      scored: true,
      scores,
      criterionNotes: entry.criterionNotes ?? {},
      overallComment: entry.overallComment ?? '',
      notes: entry.notes ?? '',
      average: Number(average.toFixed(1)),
      assessedAt: entry.assessedAt,
      enteredBy: entry.enteredBy,
    }
  })

  const scored = memberRows.filter((row) => row.scored)
  const councilAverage = scored.length
    ? scored.reduce((sum, row) => sum + row.average, 0) / scored.length
    : 0

  const criterionAverages = Object.fromEntries(
    scoreFieldKeys.map((key) => {
      const vals = scored.map((row) => clampCouncilScore(row.scores[key]))
      const avg = vals.length
        ? vals.reduce((s, v) => s + v, 0) / vals.length
        : 0
      return [key, Number(avg.toFixed(1))]
    }),
  )

  return {
    memberRows,
    councilAverage: Number(councilAverage.toFixed(1)),
    scoredCount: scored.length,
    criterionAverages,
  }
}

