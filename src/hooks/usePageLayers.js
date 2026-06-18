import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { layersService } from '@/api/layers.service.js'
import { getApiErrorMessage } from '@/api/http.js'
import {
  apiLayerToUi,
  apiVersionToUi,
  uiLayerPatchToApi,
} from '@/utils/layersMappers.js'

export function usePageLayers(pageId) {
  const [layers, setLayers] = useState([])
  const [versions, setVersions] = useState({})
  const [finalImage, setFinalImage] = useState(null)
  const [finalComposedAt, setFinalComposedAt] = useState(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [finalizing, setFinalizing] = useState(false)

  const refresh = useCallback(async () => {
    if (!pageId) return
    setLoading(true)
    try {
      const [list, finalRes] = await Promise.all([
        layersService.list(pageId).catch(() => []),
        layersService.getFinal(pageId).catch(() => null),
      ])
      const mapped = (Array.isArray(list) ? list : []).map(apiLayerToUi)
      mapped.sort((a, b) => a.index - b.index)
      setLayers(mapped)
      if (finalRes) {
        const final = finalRes?.final_image_url ?? finalRes?.imageUrl ?? finalRes?.url ?? null
        setFinalImage(final)
        setFinalComposedAt(finalRes?.final_composed_at ?? finalRes?.composedAt ?? null)
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Không tải được layer.'))
    } finally {
      setLoading(false)
    }
  }, [pageId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const loadVersions = useCallback(
    async (layerId) => {
      if (!pageId || !layerId) return []
      const list = await layersService.listVersions(pageId, layerId)
      const mapped = (Array.isArray(list) ? list : []).map(apiVersionToUi)
      setVersions((cur) => ({ ...cur, [layerId]: mapped }))
      return mapped
    },
    [pageId],
  )

  const addLayer = useCallback(
    async ({ file, index, onUploadProgress }) => {
      if (!pageId) return null
      setUploading(true)
      try {
        const created = await layersService.uploadLayer(pageId, { file, index, onUploadProgress })
        const ui = apiLayerToUi(created)
        setLayers((cur) => {
          const next = [...cur.filter((l) => l.id !== ui.id), ui]
          next.sort((a, b) => a.index - b.index)
          return next
        })
        toast.success(`Đã thêm layer #${ui.index}.`)
        return ui
      } catch (err) {
        toast.error(getApiErrorMessage(err, 'Không upload được layer.'))
        throw err
      } finally {
        setUploading(false)
      }
    },
    [pageId],
  )

  const updateLayer = useCallback(
    async (layerId, patch) => {
      if (!pageId) return
      const apiPatch = uiLayerPatchToApi(patch)
      setLayers((cur) =>
        cur.map((l) => (l.id === layerId ? { ...l, ...patch } : l)),
      )
      try {
        await layersService.updateLayer(pageId, layerId, apiPatch)
      } catch (err) {
        toast.error(getApiErrorMessage(err, 'Không cập nhật được layer.'))
        await refresh()
      }
    },
    [pageId, refresh],
  )

  const deleteLayer = useCallback(
    async (layerId) => {
      if (!pageId) return
      const target = layers.find((l) => l.id === layerId)
      const ok = window.confirm(`Xóa layer #${target?.index ?? '?'}? Lịch sử version cũng mất.`)
      if (!ok) return
      try {
        await layersService.deleteLayer(pageId, layerId)
        setLayers((cur) => cur.filter((l) => l.id !== layerId))
        setVersions((cur) => {
          const next = { ...cur }
          delete next[layerId]
          return next
        })
        toast.success('Đã xóa layer.')
      } catch (err) {
        toast.error(getApiErrorMessage(err, 'Không xóa được layer.'))
      }
    },
    [pageId, layers],
  )

  const uploadNewVersion = useCallback(
    async (layerId, { file, note, changeSummary, onUploadProgress }) => {
      if (!pageId) return null
      setUploading(true)
      try {
        const created = await layersService.uploadVersion(pageId, layerId, {
          file,
          note,
          changeSummary,
          onUploadProgress,
        })
        const version = apiVersionToUi(created)
        setVersions((cur) => ({
          ...cur,
          [layerId]: [version, ...(cur[layerId] ?? [])],
        }))
        const ui = apiLayerToUi(created.layer ?? { ...layers.find((l) => l.id === layerId), current_version: created })
        setLayers((cur) =>
          cur.map((l) =>
            l.id === layerId
              ? {
                  ...l,
                  imageUrl: version.imageUrl,
                  currentVersionNo: version.versionNo,
                  currentVersionId: version.id,
                }
              : l,
          ),
        )
        toast.success(`Đã upload version ${version.versionNo} cho layer.`)
        return version
      } catch (err) {
        toast.error(getApiErrorMessage(err, 'Không upload được version mới.'))
        throw err
      } finally {
        setUploading(false)
      }
    },
    [pageId, layers],
  )

  const rollback = useCallback(
    async (layerId, versionId) => {
      if (!pageId) return
      try {
        const res = await layersService.rollback(pageId, layerId, versionId)
        const version = apiVersionToUi(res?.version ?? res)
        setLayers((cur) =>
          cur.map((l) =>
            l.id === layerId
              ? {
                  ...l,
                  imageUrl: version.imageUrl,
                  currentVersionNo: version.versionNo,
                  currentVersionId: version.id,
                }
              : l,
          ),
        )
        toast.success(`Đã rollback về version ${version.versionNo}.`)
      } catch (err) {
        toast.error(getApiErrorMessage(err, 'Không rollback được.'))
      }
    },
    [pageId],
  )

  const reorderLayers = useCallback(
    async (orderedIds) => {
      const reordered = orderedIds
        .map((id, idx) => {
          const layer = layers.find((l) => l.id === id)
          return layer ? { ...layer, index: idx } : null
        })
        .filter(Boolean)
      setLayers(reordered)
      try {
        await Promise.all(
          orderedIds.map((id, idx) =>
            layersService.updateLayer(pageId, id, { index: idx }),
          ),
        )
      } catch (err) {
        toast.error(getApiErrorMessage(err, 'Không sắp xếp lại layer.'))
        await refresh()
      }
    },
    [pageId, layers, refresh],
  )

  const finalize = useCallback(async () => {
    if (!pageId) return null
    setFinalizing(true)
    try {
      const res = await layersService.finalize(pageId)
      const url = res?.final_image_url ?? res?.imageUrl ?? res?.url ?? null
      setFinalImage(url)
      setFinalComposedAt(res?.final_composed_at ?? res?.composedAt ?? new Date().toISOString())
      toast.success('Đã gộp layer thành ảnh hoàn chỉnh.')
      return res
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Không gộp được layer.'))
      throw err
    } finally {
      setFinalizing(false)
    }
  }, [pageId])

  const visibleLayers = useMemo(() => layers.filter((l) => l.visible), [layers])

  return {
    layers,
    visibleLayers,
    versions,
    finalImage,
    finalComposedAt,
    loading,
    uploading,
    finalizing,
    refresh,
    loadVersions,
    addLayer,
    updateLayer,
    deleteLayer,
    uploadNewVersion,
    rollback,
    reorderLayers,
    finalize,
  }
}
