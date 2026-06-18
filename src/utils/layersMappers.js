const BLEND_MODES = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn']

function pickId(v) {
  if (!v) return null
  if (typeof v === 'string') return v
  return v._id ?? v.id ?? null
}

function pickVersionImageUrl(v) {
  if (!v) return ''
  return v.image_url ?? v.url ?? v.fileUrl ?? ''
}

export function apiLayerToUi(item) {
  const layer = item ?? {}
  const current = layer.current_version ?? layer.currentVersion ?? {}
  const version = current.version_no ?? current.versionNo ?? current.version ?? 1
  return {
    id: pickId(layer),
    pageId: pickId(layer.page_id ?? layer.pageId),
    index: layer.index ?? 0,
    visible: layer.visible !== false,
    opacity: typeof layer.opacity === 'number' ? layer.opacity : 100,
    blendMode: BLEND_MODES.includes(layer.blend_mode) ? layer.blend_mode : 'normal',
    name: layer.name ?? '',
    imageUrl: pickVersionImageUrl(current),
    currentVersionNo: version,
    currentVersionId: pickId(current),
    note: layer.note ?? '',
    createdBy: pickId(layer.created_by ?? layer.createdBy),
    createdAt: layer.created_at ?? layer.createdAt,
    updatedAt: layer.updated_at ?? layer.updatedAt,
  }
}

export function apiVersionToUi(item) {
  const v = item ?? {}
  return {
    id: pickId(v),
    layerId: pickId(v.page_layer_id ?? v.layerId),
    versionNo: v.version_no ?? v.versionNo ?? v.version ?? 1,
    imageUrl: pickVersionImageUrl(v),
    uploadedBy: pickId(v.uploaded_by ?? v.uploadedBy),
    uploadedAt: v.uploaded_at ?? v.uploadedAt,
    note: v.note ?? '',
    changeSummary: v.change_summary ?? v.changeSummary ?? '',
  }
}

export function uiLayerPatchToApi(patch = {}) {
  const out = {}
  if (typeof patch.visible === 'boolean') out.visible = patch.visible
  if (typeof patch.opacity === 'number') out.opacity = patch.opacity
  if (typeof patch.blendMode === 'string') out.blend_mode = patch.blendMode
  if (typeof patch.index === 'number') out.index = patch.index
  if (typeof patch.name === 'string') out.name = patch.name
  return out
}

export { BLEND_MODES }
