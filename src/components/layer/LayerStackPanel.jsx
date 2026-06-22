import { useRef, useState } from 'react'
import {
  ChevronDown,
  Eye,
  EyeOff,
  Image as ImageIcon,
  ImagePlus,
  Layers as LayersIcon,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
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
      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-white/5 to-white/10 text-white/20">
        <ImageIcon className="h-4 w-4" />
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

function RowActionButton({ children, className, title, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'inline-flex size-6 items-center justify-center rounded-md text-white/40 transition-colors',
        'hover:bg-white/10 hover:text-white',
        'disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-white/40',
        className,
      )}
    >
      {children}
    </button>
  )
}

function LayerRow({
  layer,
  isTop,
  isBottom,
  onMoveUp,
  onMoveDown,
  onToggleVisible,
  onOpacity,
  onBlend,
  onUploadVersion,
  onDelete,
  onOpenVersions,
  onRename,
  onDragStart,
  onDragOver,
  onDrop,
  isDragOver,
}) {
  const fileRef = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); onDragOver?.(layer.id) }}
      onDrop={(e) => { e.preventDefault(); onDrop?.(layer.id) }}
      className={cn(
        'group relative overflow-hidden rounded-xl border transition-all duration-150',
        layer.visible
          ? 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/[0.07]'
          : 'border-white/5 bg-white/0 opacity-50',
        isDragOver && 'border-violet-400 ring-2 ring-violet-400/40',
      )}
    >
      <div className="flex items-stretch gap-2.5 p-2.5">
        {/* Drag handle / Thumb */}
        <div
          className={cn(
            'relative flex h-14 w-14 shrink-0 cursor-grab items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-white/5 shadow-inner transition-transform active:cursor-grabbing',
          )}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('text/layer-id', layer.id)
            e.dataTransfer.effectAllowed = 'move'
            onDragStart?.(layer.id)
          }}
          title="Kéo để sắp xếp lại"
        >
          <LayerThumb url={layer.imageUrl} name={layer.name} />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {/* Title row */}
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'flex size-5 shrink-0 items-center justify-center rounded-md font-mono text-[10px] font-bold',
                'bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-sm',
              )}
            >
              {layer.index}
            </span>
            <input
              value={layer.name || ''}
              onChange={(e) => onRename?.(layer.id, e.target.value)}
              placeholder={`Layer ${layer.index}`}
              className="min-w-0 flex-1 truncate rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-xs font-semibold text-white/80 transition-colors hover:border-white/10 focus:border-violet-500/60 focus:bg-white/5 focus:outline-none focus:ring-1 focus:ring-violet-500/30"
            />
            {layer.currentVersionNo ? (
              <span className="shrink-0 rounded-md bg-white/5 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white/40">
                v{layer.currentVersionNo}
              </span>
            ) : null}
          </div>

          {/* Opacity row */}
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={100}
              value={layer.opacity}
              onChange={(e) => onOpacity?.(layer.id, Number(e.target.value))}
              className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 accent-violet-500 [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-br [&::-webkit-slider-thumb]:from-violet-400 [&::-webkit-slider-thumb]:to-indigo-500 [&::-webkit-slider-thumb]:shadow-md"
              title={`Opacity ${layer.opacity}%`}
            />
            <span className="w-8 text-right font-mono text-[10px] font-semibold tabular-nums text-white/40">
              {layer.opacity}%
            </span>
          </div>

          {/* Blend mode */}
          <div className="flex items-center gap-1">
            <select
              value={layer.blendMode}
              onChange={(e) => onBlend?.(layer.id, e.target.value)}
              className="h-6 flex-1 cursor-pointer rounded-md border border-white/10 bg-white/5 px-1.5 text-[10px] font-medium text-white/70 transition-colors hover:border-white/20 hover:bg-white/10 focus:border-violet-500/60 focus:bg-white/5 focus:outline-none"
              title="Blend mode"
            >
              {BLEND_MODES.map((m) => (
                <option key={m} value={m}>{BLEND_LABEL[m]}</option>
              ))}
            </select>
          </div>

          {/* Action buttons — own row, always visible */}
          <div className="flex items-center gap-1">
            <RowActionButton
              onClick={() => onToggleVisible?.(layer.id)}
              title={layer.visible ? 'Ẩn layer' : 'Hiện layer'}
            >
              {layer.visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
            </RowActionButton>
            <RowActionButton
              onClick={() => onDelete?.(layer.id)}
              title="Xóa layer"
              className="text-red-400/50 hover:bg-red-500/10 hover:text-red-400"
            >
              <Trash2 className="size-3.5" />
            </RowActionButton>
            <div className="relative">
              <RowActionButton
                onClick={() => setMenuOpen((v) => !v)}
                title="Thêm tác vụ"
              >
                <MoreHorizontal className="size-3.5" />
              </RowActionButton>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute left-0 top-7 z-20 w-44 overflow-hidden rounded-xl border border-white/10 bg-[#13132a] py-1 shadow-xl shadow-black/40">
                    <button onClick={() => { setMenuOpen(false); fileRef.current?.click() }} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white">
                      <Upload className="size-3 text-violet-400" /> Upload version mới
                    </button>
                    <button onClick={() => { setMenuOpen(false); onOpenVersions?.(layer.id) }} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white">
                      <RotateCcw className="size-3 text-violet-400" /> Lịch sử version
                    </button>
                    <div className="my-1 border-t border-white/5" />
                    <button onClick={() => { setMenuOpen(false); onMoveUp?.(layer.id) }} disabled={isTop} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-30">
                      <ChevronDown className="size-3 -rotate-90" /> Lên trên
                    </button>
                    <button onClick={() => { setMenuOpen(false); onMoveDown?.(layer.id) }} disabled={isBottom} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-30">
                      <ChevronDown className="size-3 rotate-90" /> Xuống dưới
                    </button>
                  </div>
                </>
              )}
            </div>
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
    </div>
  )
}

function VersionHistory({ layer, versions, onRollback, onClose }) {
  if (!layer) return null
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <RotateCcw className="size-3.5 text-violet-400" />
          <div className="text-xs font-semibold text-white/80">
            Lịch sử version — Layer #{layer.index}
          </div>
        </div>
        <button
          onClick={onClose}
          className="inline-flex size-6 items-center justify-center rounded-md text-white/40 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div className="space-y-1.5">
        {versions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/10 bg-white/0 py-4 text-center text-[11px] text-white/30">
            Chưa có version nào.
          </div>
        ) : (
          versions.map((v) => (
            <div
              key={v.id}
              className="group flex items-center gap-2 rounded-lg border border-white/5 bg-white/0 p-1.5 transition-colors hover:border-violet-500/30 hover:bg-white/5"
            >
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-white/10 bg-white/5">
                <LayerThumb url={v.imageUrl} name={`v${v.versionNo}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="rounded bg-violet-500/20 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-violet-300">
                    v{v.versionNo}
                  </span>
                  {v.uploadedAt ? (
                    <span className="text-[10px] text-white/40">
                      {new Date(v.uploadedAt).toLocaleString('vi-VN')}
                    </span>
                  ) : null}
                </div>
                {v.note && (
                  <div className="mt-0.5 truncate text-[10px] text-white/50">{v.note}</div>
                )}
              </div>
              {v.versionNo !== layer.currentVersionNo && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 border-white/10 bg-white/5 px-2 text-[10px] font-medium text-white/60 hover:bg-white/10 hover:text-white"
                  onClick={() => onRollback?.(v.id)}
                >
                  <RotateCcw className="mr-1 size-2.5" /> Rollback
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
    <div className={cn('flex h-full flex-col gap-3', className)}>
      {/* Header */}
      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-2.5">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-sm">
            <LayersIcon className="size-3.5" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight text-white/80">Layer</div>
            <div className="text-[10px] text-white/40">{layers.length} mục</div>
          </div>
        </div>
        {canEdit && (
          <Button
            size="sm"
            className="h-8 gap-1 bg-gradient-to-r from-violet-600 to-indigo-600 px-3 text-xs font-medium text-white shadow-sm hover:from-violet-500 hover:to-indigo-500"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            <Plus className="size-3.5" />
            Thêm
          </Button>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAddFile} />
      </div>

      {/* Layer list */}
      <ScrollArea className="flex-1 pr-1">
        <div className="space-y-2 pb-2">
          {loading ? (
            <div className="rounded-xl border border-white/10 bg-white/5 py-10 text-center">
              <div className="mx-auto mb-2 size-8 animate-spin rounded-full border-2 border-white/10 border-t-violet-500" />
              <div className="text-xs text-white/40">Đang tải layer…</div>
            </div>
          ) : layers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/0 py-10 text-center">
              <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 text-violet-400">
                <ImagePlus className="size-6" />
              </div>
              <div className="text-sm font-semibold text-white/60">Chưa có layer nào</div>
              <p className="mx-auto mt-1 max-w-[200px] text-[11px] text-white/30">
                Upload ảnh PNG trong suốt để bắt đầu ghép.
              </p>
              {canEdit && (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="mt-3 inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:shadow-md"
                >
                  <Plus className="size-3" />
                  Upload layer đầu tiên
                </button>
              )}
            </div>
          ) : (
            reversed.map((layer) => {
              const pos = reversed.findIndex((l) => l.id === layer.id)
              return (
                <div key={layer.id} className="space-y-2">
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

      {/* Finalize footer */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="flex size-6 items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">
              <ImageIcon className="size-3" />
            </div>
            <div className="text-xs font-semibold text-white/80">Ảnh hoàn chỉnh</div>
          </div>
          {finalImage && (
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
              đã gộp
            </span>
          )}
        </div>
        {finalImage ? (
          <a
            href={finalImage}
            target="_blank"
            rel="noreferrer"
            className="group/final block overflow-hidden rounded-lg border border-white/10 bg-white/5 transition-shadow hover:shadow-md hover:shadow-violet-500/10"
          >
            <img
              src={finalImage}
              alt="Final"
              className="h-20 w-full object-contain transition-transform duration-300 group-hover/final:scale-[1.02]"
            />
          </a>
        ) : (
          <div className="rounded-lg border border-dashed border-white/10 bg-white/0 py-4 text-center text-[11px] text-white/30">
            Chưa có ảnh hoàn chỉnh.
          </div>
        )}
        {canEdit && (
          <Button
            size="sm"
            className="mt-2.5 h-8 w-full gap-1.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-xs font-semibold text-white shadow-sm hover:from-violet-500 hover:to-fuchsia-500"
            onClick={onFinalize}
            disabled={finalizing || layers.length === 0}
          >
            {finalizing ? (
              <>
                <div className="size-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Đang gộp…
              </>
            ) : (
              <>
                <LayersIcon className="size-3" />
                Gộp layer & gửi Mangaka
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
