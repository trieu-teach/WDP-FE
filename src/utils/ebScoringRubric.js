/**
 * EB scoring rubric — FE mirror của BE utils/ebScoringRubric.js
 * Label/hint dùng khi API chỉ trả weights map; source of truth vẫn là BE.
 *
 * API (cập nhật):
 * - has_extensions (boolean) — thay has_extension
 * - extensions[] — thay extension (object đơn)
 * - extension_criteria[] — catalog toàn bộ tiêu chí mở rộng (GET /rubrics)
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

/**
 * Extension criteria catalog (26+) — khớp BE Extension Criteria theo genre family.
 * Legacy keys (humor_timing, romance_chemistry, emotional_impact) giữ để map lịch sử chấm.
 */
export const EB_EXTENSION_CRITERIA = [
  // Romance-Lifestyle
  {
    key: 'character_development',
    label: 'Phát triển nhân vật',
    hint: 'Character development',
    shortLabel: 'Nhân vật',
  },
  {
    key: 'emotional_resonance',
    label: 'Cộng hưởng cảm xúc',
    hint: 'Emotional resonance',
    shortLabel: 'Cảm xúc',
  },
  {
    key: 'romantic_tension',
    label: 'Căng thẳng lãng mạn',
    hint: 'Romantic tension',
    shortLabel: 'Romance',
  },
  {
    key: 'educational_value',
    label: 'Giá trị giáo dục',
    hint: 'Educational value',
    shortLabel: 'Giáo dục',
  },
  // Horror-Suspense
  {
    key: 'atmosphere',
    label: 'Không khí / Tone',
    hint: 'Atmosphere',
    shortLabel: 'Không khí',
  },
  {
    key: 'pacing_horror',
    label: 'Nhịp độ kinh dị',
    hint: 'Horror pacing',
    shortLabel: 'Nhịp horror',
  },
  {
    key: 'mystery_setup',
    label: 'Dựng bí ẩn',
    hint: 'Mystery setup',
    shortLabel: 'Bí ẩn',
  },
  {
    key: 'fear_impact',
    label: 'Tác động sợ hãi',
    hint: 'Fear impact',
    shortLabel: 'Sợ hãi',
  },
  // Action-Adventure
  {
    key: 'action_choreography',
    label: 'Triển khai hành động',
    hint: 'Action choreography',
    shortLabel: 'Action',
  },
  {
    key: 'world_building',
    label: 'Xây dựng thế giới',
    hint: 'World building',
    shortLabel: 'Thế giới',
  },
  {
    key: 'stakes_tension',
    label: 'Mức độ căng thẳng',
    hint: 'Stakes & tension',
    shortLabel: 'Căng thẳng',
  },
  {
    key: 'fight_impact',
    label: 'Tác động trận đấu',
    hint: 'Fight impact',
    shortLabel: 'Trận đấu',
  },
  // Comedy
  {
    key: 'comedy_timing',
    label: 'Timing hài',
    hint: 'Comedy timing',
    shortLabel: 'Timing',
  },
  {
    key: 'comedy_originality',
    label: 'Độ sáng tạo hài',
    hint: 'Comedy originality',
    shortLabel: 'Sáng tạo',
  },
  {
    key: 'character_comedy',
    label: 'Hài nhân vật',
    hint: 'Character comedy',
    shortLabel: 'Hài NV',
  },
  {
    key: 'wordplay_translation',
    label: 'Chơi chữ / Dịch thuật',
    hint: 'Wordplay & translation',
    shortLabel: 'Chơi chữ',
  },
  // Fantasy-SciFi
  {
    key: 'magic_system',
    label: 'Hệ thống phép thuật',
    hint: 'Magic system',
    shortLabel: 'Phép thuật',
  },
  {
    key: 'technology_logic',
    label: 'Logic công nghệ',
    hint: 'Technology logic',
    shortLabel: 'Công nghệ',
  },
  {
    key: 'mythology_lore',
    label: 'Thần thoại / Lore',
    hint: 'Mythology & lore',
    shortLabel: 'Lore',
  },
  // Drama-SliceOfLife
  {
    key: 'narrative_depth',
    label: 'Chiều sâu kể chuyện',
    hint: 'Narrative depth',
    shortLabel: 'Chiều sâu',
  },
  {
    key: 'relatability',
    label: 'Độ gần gũi',
    hint: 'Relatability',
    shortLabel: 'Gần gũi',
  },
  // Art-Heavy
  {
    key: 'line_quality',
    label: 'Chất lượng nét',
    hint: 'Line quality',
    shortLabel: 'Nét',
  },
  {
    key: 'color_harmony',
    label: 'Hài hòa màu sắc',
    hint: 'Color harmony',
    shortLabel: 'Màu',
  },
  {
    key: 'splash_pages',
    label: 'Trang splash',
    hint: 'Splash pages',
    shortLabel: 'Splash',
  },
  {
    key: 'visual_expression',
    label: 'Biểu đạt hình ảnh',
    hint: 'Visual expression',
    shortLabel: 'Hình ảnh',
  },
  // Mature-Adult
  {
    key: 'maturity_handling',
    label: 'Xử lý nội dung trưởng thành',
    hint: 'Maturity handling',
    shortLabel: 'Trưởng thành',
  },
  {
    key: 'character_complexity',
    label: 'Độ phức tạp nhân vật',
    hint: 'Character complexity',
    shortLabel: 'Phức tạp',
  },
  // Legacy keys (rubric cũ / lịch sử chấm)
  {
    key: 'humor_timing',
    label: 'Hài hước & Timing',
    hint: 'Humor & timing (legacy)',
    shortLabel: 'Hài',
  },
  {
    key: 'romance_chemistry',
    label: 'Hóa học lãng mạn',
    hint: 'Romance chemistry (legacy)',
    shortLabel: 'Romance',
  },
  {
    key: 'emotional_impact',
    label: 'Tác động cảm xúc',
    hint: 'Emotional impact (legacy)',
    shortLabel: 'Cảm xúc',
  },
]

export const EB_EXTENSION_KEYS = EB_EXTENSION_CRITERIA.map((c) => c.key)

const CRITERIA_BY_KEY = Object.fromEntries(
  [...EB_CORE_SCORE_CRITERIA, ...EB_EXTENSION_CRITERIA].map((c) => [c.key, c]),
)

function isCoreCriterionKey(key) {
  return EB_CORE_SCORE_KEYS.includes(key)
}

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
      const isCore = isCoreCriterionKey(key)
      return extensionOnly ? !isCore : isCore
    })
    .map(([key, weight]) => {
      const meta = getCriterionMeta(key)
      const isExtension = !isCoreCriterionKey(key)
      return {
        key,
        label: meta.label,
        hint: meta.hint,
        shortLabel: meta.shortLabel,
        description: meta.hint,
        weight: Number(weight) || 0,
        isExtension,
      }
    })
}

function attachWeightPct(list, totalWeight) {
  const total = totalWeight > 0
    ? totalWeight
    : list.reduce((sum, item) => sum + (Number(item.weight) || 0), 0)
  // BE WEIGHT_MATRIX dùng điểm % (tổng ~90–150 khi có nhiều extensions) — hiển thị thẳng weight làm %
  const looksLikePercentMatrix = total >= 50 && total <= 200
  return list.map((item) => ({
    ...item,
    weightPct: looksLikePercentMatrix
      ? Number(item.weight) || 0
      : (total > 0 ? Math.round(((Number(item.weight) || 0) / total) * 1000) / 10 : 0),
  }))
}

/** Chuẩn hóa 1 phần tử extension từ API (extensions[] | extension | extension_criteria). */
function mapExtensionItem(item, weights = {}) {
  if (!item || typeof item !== 'object') return null
  const key = String(item.key ?? item.criterion ?? item.id ?? '').trim()
  if (!key || isCoreCriterionKey(key)) return null
  const meta = getCriterionMeta(key)
  const description = String(
    item.description ?? item.hint ?? meta.hint ?? '',
  ).trim()
  return {
    key,
    label: item.label ?? meta.label,
    hint: description || meta.hint,
    shortLabel: item.short_label ?? item.shortLabel ?? meta.shortLabel,
    description: description || meta.hint,
    weight: Number(item.weight ?? weights[key] ?? 1) || 1,
    isExtension: true,
  }
}

function resolveExtensionsRaw(raw) {
  if (Array.isArray(raw?.extensions)) return raw.extensions
  // Legacy: extension object đơn
  if (raw?.extension && typeof raw.extension === 'object' && !Array.isArray(raw.extension)) {
    return [raw.extension]
  }
  if (Array.isArray(raw?.extension_criteria)) return raw.extension_criteria
  if (Array.isArray(raw?.extensionCriteria)) return raw.extensionCriteria
  return null
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

  const extensionFromApi = resolveExtensionsRaw(raw)

  let extensionCriteria = extensionFromApi
    ? extensionFromApi.map((item) => mapExtensionItem(item, weights)).filter(Boolean)
    : criteriaListFromWeights(weights, { extensionOnly: true })

  let coreCriteria = Array.isArray(raw.criteria)
    ? raw.criteria
      .map((item) => {
        const key = String(item.key ?? item.criterion ?? item.id ?? '').trim()
        if (!key || !isCoreCriterionKey(key)) return null
        const meta = getCriterionMeta(key)
        return {
          key,
          label: item.label ?? meta.label,
          hint: item.description ?? item.hint ?? meta.hint,
          shortLabel: item.short_label ?? item.shortLabel ?? meta.shortLabel,
          description: item.description ?? item.hint ?? meta.hint,
          weight: Number(item.weight ?? weights[key] ?? 1) || 1,
          isExtension: false,
        }
      })
      .filter(Boolean)
    : criteriaListFromWeights(weights, { extensionOnly: false })

  if (!coreCriteria.length) {
    coreCriteria = EB_CORE_SCORE_CRITERIA.map((c) => ({
      ...c,
      description: c.hint,
      weight: Number(weights[c.key] ?? 1) || 1,
      isExtension: false,
    }))
  }

  // Deduplicate extensions by key (API có thể overlap với weights)
  const seenExt = new Set()
  extensionCriteria = extensionCriteria.filter((c) => {
    if (seenExt.has(c.key)) return false
    seenExt.add(c.key)
    return true
  })

  const hasExtension = Boolean(
    raw.has_extensions
    ?? raw.has_extension
    ?? raw.hasExtensions
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

  const resolvedExtensions = hasExtension ? extensionCriteria : []

  return {
    id,
    name,
    genreFamily,
    ageRating,
    /** @deprecated dùng hasExtensions — giữ để không phá UI hiện tại */
    hasExtension,
    hasExtensions: hasExtension,
    weights: {
      ...Object.fromEntries(coreCriteria.map((c) => [c.key, c.weight])),
      ...Object.fromEntries(resolvedExtensions.map((c) => [c.key, c.weight])),
      ...weights,
    },
    totalWeight,
    coreCriteria,
    /** @deprecated alias — giữ extensionCriteria cho UI hiện tại */
    extensionCriteria: resolvedExtensions,
    extensions: resolvedExtensions,
    scoreFields: [
      ...coreCriteria,
      ...resolvedExtensions,
    ],
    coreKeys: coreCriteria.map((c) => c.key),
    extensionKeys: resolvedExtensions.map((c) => c.key),
    sourceGenre: raw.source_genre ?? raw.sourceGenre ?? null,
    sourceGenres: Array.isArray(raw.source_genres)
      ? raw.source_genres.map((g) => String(g).trim()).filter(Boolean)
      : (Array.isArray(raw.sourceGenres)
        ? raw.sourceGenres.map((g) => String(g).trim()).filter(Boolean)
        : (raw.source_genre || raw.sourceGenre
          ? [String(raw.source_genre ?? raw.sourceGenre)]
          : [])),
    sourceFamily: raw.source_family ?? raw.sourceFamily ?? (genreFamily || null),
    suggested: Boolean(raw.suggested),
    reason: raw.reason ?? '',
    raw,
  }
}

/** Catalog toàn bộ extension criteria từ GET /rubrics. */
export function mapEbExtensionCriteriaCatalog(body) {
  const data = body?.data ?? body ?? {}
  const list = Array.isArray(data.extension_criteria)
    ? data.extension_criteria
    : (Array.isArray(data.extensionCriteria) ? data.extensionCriteria : [])
  if (!list.length) return EB_EXTENSION_CRITERIA.filter((c) =>
    !['humor_timing', 'romance_chemistry', 'emotional_impact'].includes(c.key),
  )
  return list
    .map((item) => mapExtensionItem(item, {}))
    .filter(Boolean)
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

/** GET /rubrics full payload: rubrics + extension_criteria catalog. */
export function mapEbRubricsResponse(body) {
  return {
    rubrics: mapEbRubricList(body),
    extensionCriteria: mapEbExtensionCriteriaCatalog(body),
  }
}

export function mapSuggestedRubricResponse(body) {
  const data = body?.data ?? body ?? {}
  const rubricRaw = data.suggested_rubric
    ?? data.suggestedRubric
    ?? data.rubric
    ?? data
  const rubric = mapEbRubric(rubricRaw)

  const mapAltList = (list) =>
    (Array.isArray(list) ? list : []).map(mapEbRubric).filter(Boolean)

  const sameFamilyAlternatives = mapAltList(
    rubricRaw?.same_family_alternatives
    ?? rubricRaw?.sameFamilyAlternatives
    ?? data.same_family_alternatives
    ?? data.sameFamilyAlternatives,
  )
  const crossFamilyAlternatives = mapAltList(
    rubricRaw?.cross_family_alternatives
    ?? rubricRaw?.crossFamilyAlternatives
    ?? data.cross_family_alternatives
    ?? data.crossFamilyAlternatives,
  )
  const alternativesRaw = Array.isArray(data.alternatives)
    ? data.alternatives
    : (Array.isArray(data.alternative_rubrics) ? data.alternative_rubrics : [])
  const alternatives = alternativesRaw.length
    ? mapAltList(alternativesRaw)
    : (() => {
      const byId = new Map()
      for (const alt of [...sameFamilyAlternatives, ...crossFamilyAlternatives]) {
        byId.set(alt.id, alt)
      }
      return [...byId.values()]
    })()

  const validationRaw = data.validation
    ?? rubricRaw?.validation
    ?? null
  const validation = mapSuggestValidation(validationRaw)

  const seriesInfoRaw = data.series_info ?? data.seriesInfo ?? null
  const reason = String(
    data.reason
    ?? rubricRaw?.reason
    ?? validation.errors[0]?.message
    ?? data.message
    ?? '',
  ).trim()

  const suggestedFlag = rubricRaw?.suggested
  const canSuggest = validation.canSuggest
  const isFallback = canSuggest === false
    || suggestedFlag === false
    || Boolean(reason && !canSuggest)

  const sourceGenres = Array.isArray(rubricRaw?.source_genres)
    ? rubricRaw.source_genres.map((g) => String(g).trim()).filter(Boolean)
    : (Array.isArray(rubric?.sourceGenres) ? rubric.sourceGenres : [])
  const sourceFamily = String(
    rubricRaw?.source_family
    ?? rubricRaw?.sourceFamily
    ?? rubric?.sourceFamily
    ?? rubric?.genreFamily
    ?? '',
  ).trim() || null

  const matchedFamilies = validation.normalized.matchedFamilies.length
    ? validation.normalized.matchedFamilies
    : (sourceFamily ? [sourceFamily] : [])

  const matchedGenreChips = validation.normalized.matchedGenres.length
    ? validation.normalized.matchedGenres.map((m) => ({
        input: m.input,
        matched: m.matched,
        family: m.family,
        label: m.family && m.input
          ? `${m.family} (${m.input})`
          : (m.family || m.matched || m.input),
      }))
    : sourceGenres.map((g) => ({
        input: g,
        matched: g,
        family: sourceFamily,
        label: sourceFamily ? `${sourceFamily} (${g})` : g,
      }))

  return {
    rubric,
    alternatives,
    sameFamilyAlternatives,
    crossFamilyAlternatives,
    reason,
    isFallback,
    canSuggest,
    validation,
    sourceGenres,
    sourceFamily,
    matchedFamilies,
    matchedGenreChips,
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
      ?? sourceGenres[0]
      ?? rubric?.sourceGenre
      ?? null,
    matchedAgeRating:
      data.matched_age_rating
      ?? data.matchedAgeRating
      ?? validation.normalized.normalizedAgeRating
      ?? rubric?.ageRating
      ?? null,
    debug: data.debug ?? null,
    raw: data,
  }
}

function mapSuggestValidationIssue(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    code: String(raw.code ?? '').trim(),
    message: String(raw.message ?? '').trim(),
    suggested: raw.suggested != null ? String(raw.suggested) : null,
    unmatched: Array.isArray(raw.unmatched) ? raw.unmatched : [],
    invalidCombinations: Array.isArray(raw.invalid_combinations)
      ? raw.invalid_combinations
      : (Array.isArray(raw.invalidCombinations) ? raw.invalidCombinations : []),
  }
}

/** Chuẩn hóa ValidationReport từ suggest-rubric. */
export function mapSuggestValidation(raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      valid: true,
      canSuggest: true,
      errors: [],
      warnings: [],
      normalized: {
        rawGenres: [],
        rawAgeRating: null,
        matchedGenres: [],
        matchedFamilies: [],
        unmatchedGenres: [],
        normalizedAgeRating: null,
      },
    }
  }

  const normalizedRaw = raw.normalized ?? {}
  const matchedGenres = Array.isArray(normalizedRaw.matched_genres)
    ? normalizedRaw.matched_genres
    : (Array.isArray(normalizedRaw.matchedGenres) ? normalizedRaw.matchedGenres : [])
  const unmatchedGenres = Array.isArray(normalizedRaw.unmatched_genres)
    ? normalizedRaw.unmatched_genres
    : (Array.isArray(normalizedRaw.unmatchedGenres) ? normalizedRaw.unmatchedGenres : [])

  return {
    valid: raw.valid !== false,
    canSuggest: raw.can_suggest !== false && raw.canSuggest !== false,
    errors: (Array.isArray(raw.errors) ? raw.errors : [])
      .map(mapSuggestValidationIssue)
      .filter(Boolean),
    warnings: (Array.isArray(raw.warnings) ? raw.warnings : [])
      .map(mapSuggestValidationIssue)
      .filter(Boolean),
    normalized: {
      rawGenres: Array.isArray(normalizedRaw.raw_genres)
        ? normalizedRaw.raw_genres
        : (Array.isArray(normalizedRaw.rawGenres) ? normalizedRaw.rawGenres : []),
      rawAgeRating:
        normalizedRaw.raw_age_rating
        ?? normalizedRaw.rawAgeRating
        ?? null,
      matchedGenres: matchedGenres.map((m) => ({
        input: String(m?.input ?? '').trim(),
        matched: String(m?.matched ?? '').trim(),
        family: String(m?.family ?? '').trim(),
      })),
      matchedFamilies: Array.isArray(normalizedRaw.matched_families)
        ? normalizedRaw.matched_families.map((f) => String(f).trim()).filter(Boolean)
        : (Array.isArray(normalizedRaw.matchedFamilies)
          ? normalizedRaw.matchedFamilies.map((f) => String(f).trim()).filter(Boolean)
          : []),
      unmatchedGenres: unmatchedGenres.map((u) => ({
        input: String(u?.input ?? '').trim(),
        normalized: String(u?.normalized ?? '').trim(),
      })),
      normalizedAgeRating:
        normalizedRaw.normalized_age_rating
        ?? normalizedRaw.normalizedAgeRating
        ?? null,
    },
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
    has_extensions: false,
    weights,
    total_weight: EB_CORE_SCORE_KEYS.length,
  })
}
