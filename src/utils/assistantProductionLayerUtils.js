import { ASSISTANT_PRODUCTION_STEPS } from '@/constants/assistantProductionLayers.js'

export function createDefaultProductionLayers() {
  return ASSISTANT_PRODUCTION_STEPS.map((step, index) => ({
    id: `prod-${step.key}`,
    stepType: step.key,
    name: step.label,
    type: 'paint',
    visible: true,
    opacity: 100,
    sortOrder: index,
    dataUrl: null,
    thumbUrl: null,
    activeVersionId: null,
    versions: [],
  }))
}

/** Gộp layer đã lưu với 6 slot sản xuất cố định. */
export function normalizeProductionLayers(loaded) {
  const defaults = createDefaultProductionLayers()
  if (!Array.isArray(loaded) || loaded.length === 0) return defaults

  if (loaded.some((l) => l.stepType)) {
    return defaults
      .map((def) => {
        const found = loaded.find((l) => l.stepType === def.stepType)
        if (!found) return def
        return {
          ...def,
          ...found,
          name: def.name,
          sortOrder: found.sortOrder ?? def.sortOrder,
          versions: Array.isArray(found.versions) ? found.versions : [],
        }
      })
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }

  const sortedLegacy = [...loaded].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
  )
  return defaults.map((def, index) => {
    const legacy = sortedLegacy[index]
    if (!legacy) return def
    return {
      ...def,
      ...legacy,
      stepType: def.stepType,
      name: def.name,
      sortOrder: def.sortOrder,
      versions: Array.isArray(legacy.versions) ? legacy.versions : [],
    }
  })
}

export function sortLayersForStack(layers) {
  return [...layers].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
}

export function moveLayerOrder(layers, layerId, direction) {
  const sorted = sortLayersForStack(layers)
  const index = sorted.findIndex((l) => l.id === layerId)
  if (index < 0) return layers
  const swapIndex = direction === 'up' ? index - 1 : index + 1
  if (swapIndex < 0 || swapIndex >= sorted.length) return layers

  const next = sorted.map((layer, i) => {
    if (i === index) return { ...layer, sortOrder: swapIndex }
    if (i === swapIndex) return { ...layer, sortOrder: index }
    return { ...layer, sortOrder: i }
  })
  return next.sort((a, b) => a.sortOrder - b.sortOrder)
}

export function appendLayerVersion(layer, dataUrl) {
  const versionId = `ver-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const label = `v${(layer.versions?.length ?? 0) + 1}`
  const version = {
    id: versionId,
    label,
    createdAt: new Date().toISOString(),
  }
  return {
    ...layer,
    dataUrl,
    thumbUrl: dataUrl,
    visible: true,
    activeVersionId: versionId,
    versions: [...(layer.versions ?? []), version],
  }
}

export function setActiveLayerVersion(layer, versionId, dataUrl) {
  return {
    ...layer,
    activeVersionId: versionId,
    dataUrl: dataUrl ?? null,
    thumbUrl: dataUrl ?? null,
    visible: dataUrl ? layer.visible : layer.visible,
  }
}
