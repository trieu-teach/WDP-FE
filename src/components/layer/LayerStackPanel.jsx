import { useRef, useState } from 'react'
import { Eye, EyeOff, GripVertical, ImagePlus, Layers, MoreVertical, RotateCcw, Trash2, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { BLEND_MODES } from '@/utils/layersMappers.js'

const BLEND_LABEL = {
  normal: 'Bình thường',
  multiply: 'Multiply',
  screen: 'Screen',
  overlay: 'Overlay',
  darken: 'Darken',
  lighten: 'Lighten',
  'color-dodge': 'Color Dodge',
  'color-burn': 'Color Burn',
}

function LayerThumb({ url, name }) {
  const [errored, setErrored] = useState(false)
  if (!url || errored) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-400">
        <ImagePlus className="h-5 w-5" />
      </div>
    )
  }
  return (
    <img
      src={url}
      alt={name || 'layer'}
      className="h-full w-full object-cover"
      onError={() => setErrored(true)}
      draggable={false}
    />
  )
}

function LayerRow({ layer, isTop, isBottom, onMoveUp, onMoveDown, onToggleVisible, onOpacity, onBlend, onUploadVersion, onDelete, onOpenVersions, onRename, onDragStart, onDragOver, onDrop, isDragOver }) {
  const fileRef = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); onDragOver?.(layer.id) }}
      onDrop={(e) => { e.preventDefault(); onDrop?.(layer.id) }}
      className={cn(
        'group flex items-stretch gap-2 rounded-md border bg-white p-2 transition',
        layer.visible ? 'border-slate-200' : 'border-slate-200 bg-slate-50 opacity-70',
        isDragOver && 'ring-2 ring-violet-400',
      )}
    >
      <div
        className="flex h-14 w-14 shrink-0 cursor-grab items-center justify-center overflow-hidden rounded border border-slate-200 bg-slate-50 active:cursor-grabbing"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('text/layer-id', layer.id)
          e.dataTransfer.effectAllowed = 'move'
          onDragStart?.(layer.id)
        }}
        title="Kéo để sắp xếp lại"
      >
        <LayerThumb url={layer.imageUrl} name={layer.name} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div className="flex items-center gap-1">
          <Badge variant="outline" className="shrink-0 border-violet-200 bg-violet-50 text-[10px] font-mono text-violet-700">
            #{layer.index}
          </Badge>
          <input
            value={layer.name || ''}
            onChange={(e) => onRename?.(layer.id, e.target.value)}
            placeholder={`Layer ${layer.index}`}
            className="min-w-0 flex-1 truncate rounded border border-transparent bg-transparent px-1 text-xs font-medium text-slate-800 hover:border-slate-200 focus:border-violet-400 focus:outline-none"
          />
          {layer.currentVersionNo ? (
            <span className="shrink-0 rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px] text-slate-600">
              v{layer.currentVersionNo}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5">
          <input
            type="range"
            min={0}
            max={100}
            value={layer.opacity}
            onChange={(e) => onOpacity?.(layer.id, Number(e.target.value))}
            className="h-1 flex-1 cursor-pointer accent-violet-600"
            title={`Opacity ${layer.opacity}%`}
          />
          <span className="w-7 text-right font-mono text-[10px] text-slate-500">{layer.opacity}%</span>
        </div>

        <div className="flex items-center gap-1">
          <select
            value={layer.blendMode}
            onChange={(e) => onBlend?.(layer.id, e.target.value)}
            className="h-5 flex-1 rounded border border-slate-200 bg-white px-1 text-[10px] text-slate-700 focus:border-violet-400 focus:outline-none"
            title="Blend mode"
          >
            {BLEND_MODES.map((m) => (
              <option key={m} value={m}>{BLEND_LABEL[m]}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex w-7 flex-col items-center justify-between gap-1">
        <button
          type="button"
          onClick={() => onToggleVisible?.(layer.id)}
          className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          title={layer.visible ? 'Ẩn layer' : 'Hiện layer'}
        >
          {layer.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            title="Thêm tác vụ"
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 top-6 z-20 w-40 rounded-md border border-slate-200 bg-white py-1 shadow-lg"
              onMouseLeave={() => setMenuOpen(false)}
            >
              <button
                onClick={() => { setMenuOpen(false); fileRef.current?.click() }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-slate-50"
              >
                <Upload className="h-3 w-3" /> Upload version mới
              </button>
              <button
                onClick={() => { setMenuOpen(false); onOpenVersions?.(layer.id) }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-slate-50"
              >
                <RotateCcw className="h-3 w-3" /> Lịch sử version
              </button>
              <button
                onClick={() => { setMenuOpen(false); onMoveUp?.(layer.id) }}
                disabled={isTop}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-slate-50 disabled:opacity-40"
              >
                ↑ Lên trên
              </button>
              <button
                onClick={() => { setMenuOpen(false); onMoveDown?.(layer.id) }}
                disabled={isBottom}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-slate-50 disabled:opacity-40"
              >
                ↓ Xuống dưới
              </button>
              <div className="my-1 border-t border-slate-100" />
              <button
                onClick={() => { setMenuOpen(false); onDelete?.(layer.id) }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-3 w-3" /> Xóa layer
              </button>
            </div>
          )}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onUploadVersion?.(layer.id, file)
          e.target.value = ''
        }}
      />
    </div>
  )
}

function VersionHistory({ layer, versions, onRollback, onClose }) {
  if (!layer) return null
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-semibold text-slate-700">Lịch sử version — Layer #{layer.index}</div>
        <button onClick={onClose} className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="space-y-1.5">
        {versions.length === 0 ? (
          <div className="text-xs text-slate-400">Chưa có version nào.</div>
        ) : (
          versions.map((v) => (
            <div key={v.id} className="flex items-center gap-2 rounded border border-slate-100 bg-slate-50 p-1.5">
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded">
                <LayerThumb url={v.imageUrl} name={`v${v.versionNo}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] text-slate-600">v{v.versionNo}</span>
                  {v.uploadedAt ? (
                    <span className="text-[10px] text-slate-400">
                      {new Date(v.uploadedAt).toLocaleString('vi-VN')}
                    </span>
                  ) : null}
                </div>
                {v.note && <div className="truncate text-[10px] text-slate-500">{v.note}</div>}
              </div>
              {v.versionNo !== layer.currentVersionNo && (
                <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => onRollback?.(v.id)}>
                  <RotateCcw className="mr-1 h-2.5 w-2.5" /> Rollback
                </Button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default function LayerStackPanel({
  layers,
  versions,
  loading,
  uploading,
  finalizing,
  finalImage,
  onAddLayer,
  onUpdateLayer,
  onDeleteLayer,
  onUploadVersion,
  onRollback,
  onLoadVersions,
  onReorder,
  onFinalize,
  canEdit,
  className,
}) {
  const fileRef = useRef(null)
  const [dragId, setDragId] = useState(null)
  const [dragOverId, setDragOverId] = useState(null)
  const [openVersionFor, setOpenVersionFor] = useState(null)

  const reversed = [...layers].reverse()

  function handleAddFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    onAddLayer?.(file)
    e.target.value = ''
  }

  function moveUp(id) {
    const sorted = [...layers].sort((a, b) => a.index - b.index)
    const idx = sorted.findIndex((l) => l.id === id)
    if (idx < sorted.length - 1) {
      const ids = sorted.map((l) => l.id)
      ;[ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]]
      onReorder?.(ids)
    }
  }
  function moveDown(id) {
    const sorted = [...layers].sort((a, b) => a.index - b.index)
    const idx = sorted.findIndex((l) => l.id === id)
    if (idx > 0) {
      const ids = sorted.map((l) => l.id)
      ;[ids[idx], ids[idx - 1]] = [ids[idx - 1], ids[idx]]
      onReorder?.(ids)
    }
  }

  function handleDrop(targetId) {
    if (!dragId || dragId === targetId) return
    const ids = layers.map((l) => l.id)
    const from = ids.indexOf(dragId)
    const to = ids.indexOf(targetId)
    if (from < 0 || to < 0) return
    const [moved] = ids.splice(from, 1)
    ids.splice(to, 0, moved)
    onReorder?.(ids)
    setDragId(null)
    setDragOverId(null)
  }

  function openVersion(layerId) {
    onLoadVersions?.(layerId)
    setOpenVersionFor(layerId)
  }

  return (
    <div className={cn('flex h-full flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Layers className="h-4 w-4 text-violet-600" />
          <span className="text-sm font-semibold text-slate-800">Layer</span>
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{layers.length}</Badge>
        </div>
        {canEdit && (
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <ImagePlus className="mr-1 h-3 w-3" />
            Thêm layer
          </Button>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAddFile} />
      </div>

      <ScrollArea className="flex-1 pr-1">
        <div className="space-y-1.5 pb-2">
          {loading ? (
            <div className="py-8 text-center text-xs text-slate-400">Đang tải layer…</div>
          ) : layers.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-300 bg-white py-8 text-center">
              <Layers className="mx-auto mb-1 h-6 w-6 text-slate-300" />
              <div className="text-xs text-slate-500">Chưa có layer nào.</div>
              {canEdit && (
                <button onClick={() => fileRef.current?.click()} className="mt-2 text-xs font-medium text-violet-600 hover:underline">
                  + Upload layer đầu tiên
                </button>
              )}
            </div>
          ) : (
            reversed.map((layer) => {
              const pos = reversed.findIndex((l) => l.id === layer.id)
              return (
                <div key={layer.id} className="space-y-1.5">
                  <LayerRow
                    layer={layer}
                    isTop={pos === 0}
                    isBottom={pos === reversed.length - 1}
                    onMoveUp={moveUp}
                    onMoveDown={moveDown}
                    onToggleVisible={(id) => onUpdateLayer?.(id, { visible: !layer.visible })}
                    onOpacity={(id, opacity) => onUpdateLayer?.(id, { opacity })}
                    onBlend={(id, blendMode) => onUpdateLayer?.(id, { blendMode })}
                    onUploadVersion={(id, file) => onUploadVersion?.(id, file)}
                    onDelete={onDeleteLayer}
                    onOpenVersions={openVersion}
                    onRename={(id, name) => onUpdateLayer?.(id, { name })}
                    onDragStart={setDragId}
                    onDragOver={setDragOverId}
                    onDrop={handleDrop}
                    isDragOver={dragOverId === layer.id && dragId !== layer.id}
                  />
                  {openVersionFor === layer.id && (
                    <VersionHistory
                      layer={layer}
                      versions={versions[layer.id] ?? []}
                      onRollback={(vid) => { onRollback?.(layer.id, vid); setOpenVersionFor(null) }}
                      onClose={() => setOpenVersionFor(null)}
                    />
                  )}
                </div>
              )
            })
          )}
        </div>
      </ScrollArea>

      <div className="rounded-md border border-violet-200 bg-violet-50/60 p-2">
        <div className="mb-1.5 flex items-center justify-between">
          <div className="text-xs font-semibold text-violet-800">Ảnh hoàn chỉnh</div>
          {finalImage && (
            <span className="text-[10px] text-violet-600">đã gộp {layers.length} layer</span>
          )}
        </div>
        {finalImage ? (
          <a href={finalImage} target="_blank" rel="noreferrer" className="block">
            <img src={finalImage} alt="Final" className="h-20 w-full rounded border border-violet-200 object-contain bg-white" />
          </a>
        ) : (
          <div className="rounded border border-dashed border-violet-200 bg-white py-3 text-center text-[11px] text-slate-500">
            Chưa có ảnh hoàn chỉnh.
          </div>
        )}
        {canEdit && (
          <Button
            size="sm"
            className="mt-2 h-7 w-full bg-violet-600 text-xs hover:bg-violet-700"
            onClick={onFinalize}
            disabled={finalizing || layers.length === 0}
          >
            {finalizing ? 'Đang gộp…' : 'Gộp layer & gửi Mangaka'}
          </Button>
        )}
      </div>
    </div>
  )
}
