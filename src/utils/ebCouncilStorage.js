/**
 * Điểm chấm debut theo từng thành viên Hội đồng biên tập (demo localStorage).
 * Một tài khoản đại diện nhập điểm cho từng thành viên; hiển thị tổng hợp đủ cả HĐ.
 */

export const EB_COUNCIL_SCORES_KEY = 'mk-eb-council-scores-v1'

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

export function saveCouncilMemberAssessment(seriesTitle, memberId, payload) {
  const key = String(seriesTitle ?? '').trim()
  if (!key || !memberId) return null

  const all = readAll()
  const current = all[key] ?? { scoreType: payload.scoreType ?? 'color', members: {} }
  current.scoreType = payload.scoreType ?? current.scoreType
  current.members = {
    ...(current.members ?? {}),
    [memberId]: {
      scores: { ...payload.scores },
      criterionNotes: { ...(payload.criterionNotes ?? {}) },
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

/** Demo: vài thành viên đã chấm sẵn để minh họa bảng tổng hợp. */
export function seedCouncilDemoScores(seriesTitle, scoreType = 'color') {
  const key = String(seriesTitle ?? '').trim()
  if (!key || readCouncilSeriesScores(key)) return

  const colorScores = {
    chair: { plotDialogue: 4.5, artDesign: 4, panelingCamera: 4, pacingHook: 4.5, coloring: 4 },
    'member-1': { plotDialogue: 3.5, artDesign: 4, panelingCamera: 3.5, pacingHook: 4, coloring: 3.5 },
    'member-3': { plotDialogue: 4, artDesign: 3.5, panelingCamera: 4, pacingHook: 3.5, coloring: 4 },
  }
  const monoScores = {
    chair: { plotDialogue: 4, artDesign: 4.5, panelingCamera: 4, pacingHook: 4, toneShading: 3.5 },
    'member-1': { plotDialogue: 3.5, artDesign: 4, panelingCamera: 3.5, pacingHook: 3.5, toneShading: 4 },
    'member-4': { plotDialogue: 4.5, artDesign: 4, panelingCamera: 4.5, pacingHook: 4, toneShading: 4 },
  }

  const presets = scoreType === 'mono' ? monoScores : colorScores
  const all = readAll()
  const members = {}

  Object.entries(presets).forEach(([memberId, scores]) => {
    const keys = Object.keys(scores)
    const total = keys.reduce((s, k) => s + scores[k], 0)
    members[memberId] = {
      scores,
      criterionNotes: {},
      average: Number((total / keys.length).toFixed(1)),
      assessedAt: new Date(Date.now() - 86400000).toISOString(),
      enteredBy: 'Hệ thống demo',
    }
  })

  all[key] = { scoreType, members }
  writeAll(all)
}
