/**
 * EB scoring rubric — FE mirror của BE utils/ebScoringRubric.js
 * Label/hint dùng khi API chỉ trả weights map; source of truth vẫn là BE.
 */

export const EB_SCORE_MAX = 5

/** Core 5 tiêu chí — khớp EB_SCORE_CRITERIA / BE EB_CRITERIA_KEYS. */
export const EB_CORE_SCORE_CRITERIA = [
  {
    key: 'story_dialogue',
    label: 'Cốt truyện & Lời thoại',
    hint: 'Story & Dialogue',
    shortLabel: 'Cốt truyện',
  },
  {
    key: 'art_design',
    label: 'Nét vẽ & Tạo hình nhân vật',
    hint: 'Art & Design',
    shortLabel: 'Nét vẽ',
  },
  {
    key: 'panel_camera',
    label: 'Phân khung',
    hint: 'Panel',
    shortLabel: 'Phân khung',
  },
  {
    key: 'pacing_climax',
    label: 'Nhịp độ & Cao trào',
    hint: 'Pacing & Climax',
    shortLabel: 'Nhịp độ',
  },
  {
    key: 'color',
    label: 'Đổ màu & Phối màu',
    hint: 'Color',
    shortLabel: 'Màu sắc',
  },
]

export const EB_CORE_SCORE_KEYS = EB_CORE_SCORE_CRITERIA.map((c) => c.key)

/** 5 trường age-safety (mức 0–3). */
export const EB_CONTENT_LEVEL_FIELDS = [
  {
    key: 'violence',
    label: 'Bạo lực',
    hint: 'Violence',
  },
  {
    key: 'fear',
    label: 'Sợ hãi / Kinh dị',
    hint: 'Fear',
  },
  {
    key: 'profanity',
    label: 'Ngôn từ thô',
    hint: 'Profanity',
  },
  {
    key: 'nudity',
    label: 'Khỏa thân / Gợi cảm',
    hint: 'Nudity',
  },
  {
    key: 'danger_simulation',
    label: 'Mô phỏng nguy hiểm',
    hint: 'Danger simulation',
  },
]

export const EB_CONTENT_LEVEL_KEYS = EB_CONTENT_LEVEL_FIELDS.map((f) => f.key)
export const EB_CONTENT_LEVEL_MAX = 3

export const EB_CONTENT_LEVEL_LABELS = [
  { value: 0, label: 'Không' },
  { value: 1, label: 'Nhẹ' },
  { value: 2, label: 'Trung bình' },
  { value: 3, label: 'Mạnh' },
]

/** 7 tiêu chí mở rộng — khớp BE Extension Criteria. */
export const EB_EXTENSION_CRITERIA = [
  {
    key: 'character_development',
    label: 'Phát triển nhân vật',
    hint: 'Character development',
    shortLabel: 'Nhân vật',
  },
  {
    key: 'atmosphere',
    label: 'Không khí / Tone',
    hint: 'Atmosphere',
    shortLabel: 'Không khí',
  },
  {
    key: 'action_choreography',
    label: 'Biên đạo hành động',
    hint: 'Action choreography',
    shortLabel: 'Action',
  },
  {
    key: 'humor_timing',
    label: 'Hài hước & Timing',
    hint: 'Humor & timing',
    shortLabel: 'Hài',
  },
  {
    key: 'romance_chemistry',
    label: 'Hóa học lãng mạn',
    hint: 'Romance chemistry',
    shortLabel: 'Romance',
  },
  {
    key: 'world_building',
    label: 'Xây dựng thế giới',
    hint: 'World building',
    shortLabel: 'Thế giới',
  },
  {
    key: 'emotional_impact',
    label: 'Tác động cảm xúc',
    hint: 'Emotional impact',
    shortLabel: 'Cảm xúc',
  },
]

export const EB_EXTENSION_KEYS = EB_EXTENSION_CRITERIA.map((c) => c.key)

const CRITERIA_BY_KEY = Object.fromEntries(
  [...EB_CORE_SCORE_CRITERIA, ...EB_EXTENSION_CRITERIA].map((c) => [c.key, c]),
)

export function buildEmptyContentLevels(level = 0) {
  const n = Math.min(EB_CONTENT_LEVEL_MAX, Math.max(0, Number(level) || 0))
  return Object.fromEntries(EB_CONTENT_LEVEL_KEYS.map((key) => [key, n]))
}

export function normalizeContentLevels(raw = {}) {
  const src = raw && typeof raw === 'object' ? raw : {}
  return Object.fromEntries(
    EB_CONTENT_LEVEL_KEYS.map((key) => {
      const parsed = Number(src[key])
      if (!Number.isFinite(parsed)) return [key, 0]
      return [key, Math.min(EB_CONTENT_LEVEL_MAX, Math.max(0, Math.round(parsed)))]
    }),
  )
}

export function getCriterionMeta(key) {
  return (
    CRITERIA_BY_KEY[key] ?? {
      key,
      label: key,
      hint: key,
      shortLabel: key,
    }
  )
}

function asWeightMap(raw) {
  if (!raw) return {}
  if (raw instanceof Map) return Object.fromEntries(raw.entries())
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return Object.fromEntries(
      Object.entries(raw)
        .map(([k, v]) => [k, Number(v)])
        .filter(([, v]) => Number.isFinite(v) && v > 0),
    )
  }
  return {}
}

function criteriaListFromWeights(weights, { extensionOnly = false } = {}) {
  const entries = Object.entries(weights)
  return entries
    .filter(([key]) => {
      const isExt = EB_EXTENSION_KEYS.includes(key)
      return extensionOnly ? isExt : !isExt
    })
    .map(([key, weight]) => {
      const meta = getCriterionMeta(key)
      return {
        key,
        label: meta.label,
        hint: meta.hint,
        shortLabel: meta.shortLabel,
        weight: Number(weight) || 0,
        isExtension: EB_EXTENSION_KEYS.includes(key),
      }
    })
}

function attachWeightPct(list, totalWeight) {
  const total = totalWeight > 0
    ? totalWeight
    : list.reduce((sum, item) => sum + (Number(item.weight) || 0), 0)
  // BE WEIGHT_MATRIX dùng điểm % (tổng ~90–100) — hiển thị thẳng weight làm %
  const looksLikePercentMatrix = total >= 50 && total <= 150
  return list.map((item) => ({
    ...item,
    weightPct: looksLikePercentMatrix
      ? Number(item.weight) || 0
      : (total > 0 ? Math.round(((Number(item.weight) || 0) / total) * 1000) / 10 : 0),
  }))
}

/**
 * Chuẩn hóa 1 rubric từ GET /rubrics | suggest | evaluate response.
 */
export function mapEbRubric(raw) {
  if (!raw || typeof raw !== 'object') return null

  const id = String(
    raw.id
    ?? raw.rubric_id
    ?? raw.rubricId
    ?? raw.code
    ?? '',
  ).trim()
  if (!id) return null

  const weights = asWeightMap(
    raw.weights
    ?? raw.applied_rubric_weights
    ?? raw.appliedRubricWeights
    ?? raw.weight_matrix
    ?? raw.weightMatrix,
  )

  const extensionFromApi = Array.isArray(raw.extension_criteria)
    ? raw.extension_criteria
    : (Array.isArray(raw.extensionCriteria) ? raw.extensionCriteria : null)

  let extensionCriteria = extensionFromApi
    ? extensionFromApi.map((item) => {
      const key = String(item.key ?? item.criterion ?? item.id ?? '').trim()
      const meta = getCriterionMeta(key)
      return {
        key,
        label: item.label ?? meta.label,
        hint: item.hint ?? meta.hint,
        shortLabel: item.short_label ?? item.shortLabel ?? meta.shortLabel,
        weight: Number(item.weight ?? weights[key] ?? 1) || 1,
        isExtension: true,
      }
    }).filter((c) => c.key)
    : criteriaListFromWeights(weights, { extensionOnly: true })

  let coreCriteria = Array.isArray(raw.criteria)
    ? raw.criteria
      .map((item) => {
        const key = String(item.key ?? item.criterion ?? item.id ?? '').trim()
        if (!key || EB_EXTENSION_KEYS.includes(key)) return null
        const meta = getCriterionMeta(key)
        return {
          key,
          label: item.label ?? meta.label,
          hint: item.hint ?? meta.hint,
          shortLabel: item.short_label ?? item.shortLabel ?? meta.shortLabel,
          weight: Number(item.weight ?? weights[key] ?? 1) || 1,
          isExtension: false,
        }
      })
      .filter(Boolean)
    : criteriaListFromWeights(weights, { extensionOnly: false })

  if (!coreCriteria.length) {
    coreCriteria = EB_CORE_SCORE_CRITERIA.map((c) => ({
      ...c,
      weight: Number(weights[c.key] ?? 1) || 1,
      isExtension: false,
    }))
  }

  const hasExtension = Boolean(
    raw.has_extension
    ?? raw.hasExtension
    ?? extensionCriteria.length > 0,
  )

  const allForWeight = [
    ...coreCriteria,
    ...(hasExtension ? extensionCriteria : []),
  ]
  const totalWeight = Number(
    raw.total_weight
    ?? raw.totalWeight
    ?? raw.applied_rubric_total_weight
    ?? allForWeight.reduce((sum, c) => sum + (Number(c.weight) || 0), 0),
  ) || 0

  coreCriteria = attachWeightPct(coreCriteria, totalWeight)
  extensionCriteria = attachWeightPct(extensionCriteria, totalWeight)

  const genreFamily = raw.genre_family ?? raw.genreFamily ?? raw.family ?? ''
  const ageRating = raw.age_rating ?? raw.ageRating ?? ''
  const name = raw.name
    ?? raw.label
    ?? raw.title
    ?? [genreFamily, ageRating].filter(Boolean).join(' · ')
    ?? id

  return {
    id,
    name,
    genreFamily,
    ageRating,
    hasExtension,
    weights: {
      ...Object.fromEntries(coreCriteria.map((c) => [c.key, c.weight])),
      ...(hasExtension
        ? Object.fromEntries(extensionCriteria.map((c) => [c.key, c.weight]))
        : {}),
      ...weights,
    },
    totalWeight,
    coreCriteria,
    extensionCriteria: hasExtension ? extensionCriteria : [],
    scoreFields: [
      ...coreCriteria,
      ...(hasExtension ? extensionCriteria : []),
    ],
    coreKeys: coreCriteria.map((c) => c.key),
    extensionKeys: hasExtension ? extensionCriteria.map((c) => c.key) : [],
    sourceGenre: raw.source_genre ?? raw.sourceGenre ?? null,
    sourceFamily: raw.source_family ?? raw.sourceFamily ?? (genreFamily || null),
    suggested: Boolean(raw.suggested),
    reason: raw.reason ?? '',
    raw,
  }
}

export function mapEbRubricList(body) {
  const data = body?.data ?? body
  const list = Array.isArray(data)
    ? data
    : (Array.isArray(data?.items)
      ? data.items
      : (Array.isArray(data?.rubrics) ? data.rubrics : []))
  return list.map(mapEbRubric).filter(Boolean)
}

export function mapSuggestedRubricResponse(body) {
  const data = body?.data ?? body ?? {}
  const rubricRaw = data.suggested_rubric
    ?? data.suggestedRubric
    ?? data.rubric
    ?? data
  const rubric = mapEbRubric(rubricRaw)
  const alternativesRaw = Array.isArray(data.alternatives)
    ? data.alternatives
    : (Array.isArray(data.alternative_rubrics) ? data.alternative_rubrics : [])
  const seriesInfoRaw = data.series_info ?? data.seriesInfo ?? null
  const reason = String(
    data.reason
    ?? rubricRaw?.reason
    ?? data.message
    ?? '',
  ).trim()
  const suggestedFlag = rubricRaw?.suggested
  const isFallback = suggestedFlag === false || Boolean(reason)

  return {
    rubric,
    alternatives: alternativesRaw.map(mapEbRubric).filter(Boolean),
    reason,
    isFallback,
    seriesInfo: seriesInfoRaw
      ? {
          id: seriesInfoRaw._id ?? seriesInfoRaw.id ?? null,
          name: seriesInfoRaw.name ?? '',
          genre: Array.isArray(seriesInfoRaw.genre) ? seriesInfoRaw.genre : [],
          ageRating:
            seriesInfoRaw.age_rating
            ?? seriesInfoRaw.ageRating
            ?? null,
        }
      : null,
    matchedGenre:
      data.matched_genre
      ?? data.matchedGenre
      ?? rubric?.sourceGenre
      ?? null,
    matchedAgeRating:
      data.matched_age_rating
      ?? data.matchedAgeRating
      ?? rubric?.ageRating
      ?? null,
    raw: data,
  }
}

export function mapAgeSafetyResponse(body) {
  const data = body?.data ?? body ?? {}
  const ageSafety = data.age_safety ?? data.ageSafety ?? data
  const violationsRaw = Array.isArray(ageSafety.violations)
    ? ageSafety.violations
    : (Array.isArray(data.violations) ? data.violations : [])

  return {
    passed: Boolean(
      ageSafety.passed
      ?? data.passed
      ?? (violationsRaw.length === 0 && ageSafety.passed !== false),
    ),
    severity: ageSafety.severity ?? data.severity ?? null,
    violations: violationsRaw.map((v) => ({
      field: v.field ?? v.key ?? v.criterion ?? '',
      level: v.level ?? v.value ?? null,
      maxAllowed: v.max_allowed ?? v.maxAllowed ?? v.max ?? null,
      message: v.message ?? v.reason ?? '',
    })),
    raw: data,
  }
}

export function buildEmptyExtensionScores(extensionKeys = []) {
  return Object.fromEntries(
    (extensionKeys.length ? extensionKeys : EB_EXTENSION_KEYS).map((key) => [key, '']),
  )
}

export function normalizeExtensionScoreMap(scores = {}, extensionKeys = EB_EXTENSION_KEYS) {
  const allowed = new Set(extensionKeys)
  const normalized = {}
  for (const [key, value] of Object.entries(scores ?? {})) {
    if (!allowed.has(key)) continue
    if (value == null || String(value).trim() === '') continue
    normalized[key] = value
  }
  return normalized
}

/** FE map → BE extension_scores[] — { key, value, comment? } */
export function mapExtensionScoresToApi(
  extensionScores = {},
  extensionKeys = [],
  extensionComments = {},
) {
  const keys = extensionKeys.length ? extensionKeys : Object.keys(extensionScores ?? {})
  return keys.map((key) => {
    const parsed = Number.parseFloat(extensionScores?.[key])
    const stepped = Number.isFinite(parsed)
      ? Math.min(EB_SCORE_MAX, Math.max(0, Math.round(parsed * 2) / 2))
      : 0
    const comment = String(extensionComments?.[key] ?? '').trim()
    return {
      key,
      value: stepped,
      ...(comment ? { comment } : {}),
    }
  })
}

/** BE extension_scores[] → FE map */
export function mapExtensionScoresFromApi(raw) {
  if (Array.isArray(raw)) {
    const out = {}
    for (const item of raw) {
      const key = String(item?.key ?? item?.criterion ?? '').trim()
      if (!key) continue
      if (item?.score != null) out[key] = item.score
      else if (item?.value != null) out[key] = item.value
    }
    return out
  }
  if (raw && typeof raw === 'object') return { ...raw }
  return {}
}

/** Weighted average local (preview khi chưa gọi API). */
export function computeWeightedAverage(scores = {}, weights = {}) {
  let weightedSum = 0
  let totalWeight = 0
  for (const [key, weightRaw] of Object.entries(weights ?? {})) {
    const weight = Number(weightRaw)
    const score = Number(scores[key])
    if (!Number.isFinite(weight) || weight <= 0) continue
    if (!Number.isFinite(score)) continue
    weightedSum += score * weight
    totalWeight += weight
  }
  if (totalWeight <= 0) return null
  return Math.round((weightedSum / totalWeight) * 100) / 100
}

export function defaultRubricFromCore() {
  const weights = Object.fromEntries(EB_CORE_SCORE_KEYS.map((key) => [key, 1]))
  return mapEbRubric({
    id: 'default',
    name: 'Mặc định (5 tiêu chí)',
    has_extension: false,
    weights,
    total_weight: EB_CORE_SCORE_KEYS.length,
  })
}
