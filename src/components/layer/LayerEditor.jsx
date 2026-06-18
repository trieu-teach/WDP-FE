import { useEffect, useMemo, useState } from 'react'
import { ArrowDownToLine, ChevronLeft, ChevronRight, FileDown, Layers as LayersIcon, Loader2, Maximize2, RefreshCw, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card } from '@/components/ui/card'
import { usePageLayers } from '@/hooks/usePageLayers.js'
import { layersService } from '@/api/layers.service.js'
import { apiNoteToUi } from '@/utils/apiMappers.js'
import { chaptersService } from '@/api/chapters.service.js'
import { getApiErrorMessage } from '@/api/http.js'
import { cn } from '@/lib/utils'
import LayerCanvas from './LayerCanvas.jsx'
import LayerStackPanel from './LayerStackPanel.jsx'
import { ImageLightbox } from './ImageLightbox.jsx'

function buildLayerNote(layers, notes) {
  if (!Array.isArray(notes)) return null
  const blocked = notes.find(n => n.status === 'open' && n.layerIndex !== undefined && n.layerIndex !== null)
  if (!blocked) return null
  const layer = layers.find(l => l.index === blocked.layerIndex)
  return { note: blocked, layer }
}

async function urlToFile(url, filename) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Không fetch được ${url}`)
  const blob = await res.blob()
  return new File([blob], filename, { type: blob.type || 'image/png' })
}

export default function LayerEditor({ chapter, onSubmitted }) {
  const pages = chapter?.pages ?? []
  const [pageIdx, setPageIdx] = useState(0)
  const [submittingAll, setSubmittingAll] = useState(false)

  const safeIdx = Math.min(Math.max(0, pageIdx), Math.max(0, pages.length - 1))
  const safePage = pages[safeIdx] ?? null

  const layersApi = usePageLayers(safePage?.id ?? null)
  const {
    layers,
    versions,
    finalImage,
    loading,
    uploading,
    finalizing,
    addLayer,
    updateLayer,
    deleteLayer,
    uploadNewVersion,
    rollback,
    loadVersions,
    reorderLayers,
    finalize,
    refresh,
  } = layersApi

  const [pageNotes, setPageNotes] = useState([])
  const [notesLoading, setNotesLoading] = useState(false)

  async function loadNotes() {
    if (!safePage?.id) return
    setNotesLoading(true)
    try {
      const res = await chaptersService.getPageNotes(safePage.id).catch(() => [])
      setPageNotes((Array.isArray(res) ? res : []).map(apiNoteToUi))
    } finally {
      setNotesLoading(false)
    }
  }

  useEffect(() => { loadNotes() }, [safePage?.id])

  const layerNoteInfo = useMemo(() => buildLayerNote(layers, pageNotes), [layers, pageNotes])

  const canvasW = safePage?.width ?? 800
  const canvasH = safePage?.height ?? 1100

  async function handleAddLayer(file) {
    const nextIdx = layers.length
    await addLayer({ file, index: nextIdx })
  }

  async function handleUploadVersion(layerId, file) {
    const target = layerNoteInfo?.layer
    const note = target && target.id === layerId
      ? layerNoteInfo.note?.content ?? layerNoteInfo.note?.text ?? ''
      : ''
    await uploadNewVersion(layerId, { file, note })
  }

  async function handleSubmitAllPages({ chapterTaskId, chapterId }) {
    if (!chapterTaskId) {
      toast.error('Chưa có task — chờ Mangaka gửi chapter cho bạn.')
      return
    }
    if (!pages.length) return
    setSubmittingAll(true)
    try {
      const files = []
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i]
        if (!page?.id) continue
        toast.info(`Đang gộp trang ${i + 1}/${pages.length}…`)
        try {
          await layersService.finalize(page.id)
        } catch {
          toast.error(`Trang ${i + 1}: finalize thất bại — bỏ qua.`)
          continue
        }
        await new Promise(r => window.setTimeout(r, 500))
        try {
          const finalRes = await layersService.getFinal(page.id)
          const url = finalRes?.final_image_url ?? finalRes?.imageUrl ?? finalRes?.url ?? null
          if (!url) {
            toast.error(`Trang ${i + 1}: không có ảnh final — bỏ qua.`)
            continue
          }
          const filename = `${chapter?.seriesTitle ?? 'Ch' + chapter?.chapterNum}-p${i + 1}.png`
          const file = await urlToFile(url, filename)
          files.push(file)
        } catch {
          toast.error(`Trang ${i + 1}: lỗi khi lấy ảnh final — bỏ qua.`)
        }
      }

      if (!files.length) {
        toast.error('Không có trang nào có ảnh final để gửi.')
        return
      }

      toast.info(`Đang gửi ${files.length} trang cho Mangaka…`)
      const { tasksService } = await import('@/api/tasks.service.js')
      const { apiTaskToUi } = await import('@/utils/apiMappers.js')
      let updated
      if (files.length > 1) {
        updated = await tasksService.submitChapter(chapterTaskId, files)
      } else {
        updated = await tasksService.submit(chapterTaskId, files[0])
      }
      const task = apiTaskToUi(updated)
      toast.success(
        `Đã gửi ${files.length} trang cho Mangaka.`,
      )
      onSubmitted?.(task)
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Gửi chapter thất bại.'))
    } finally {
      setSubmittingAll(false)
    }
  }

  const baseFileName = `${chapter?.seriesTitle ?? ''}-Ch${chapter?.chapterNum ?? ''}`

  return (
    <Card className="flex h-[calc(100vh-180px)] min-h-[640px] flex-col overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {chapter?.seriesTitle} · Ch.{chapter?.chapterNum}
          </p>
          <p className="text-xs text-muted-foreground">
            Trang {safeIdx + 1} / {pages.length} ·{' '}
            {layers.length} layer
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            disabled={safeIdx <= 0}
            onClick={() => setPageIdx(i => Math.max(0, i - 1))}
            title="Trang trước"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs tabular-nums text-muted-foreground">
            {safeIdx + 1} / {pages.length}
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            disabled={safeIdx >= pages.length - 1}
            onClick={() => setPageIdx(i => Math.min(pages.length - 1, i + 1))}
            title="Trang sau"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={() => { refresh(); loadNotes() }}
            disabled={loading}
            title="Làm mới"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </Button>
          <div className="h-5 w-px bg-border" />
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={() => {
              const url = safePage?.url
              if (!url) return
              const a = document.createElement('a')
              a.href = url
              a.download = `${baseFileName}-p${safeIdx + 1}.png`
              document.body.appendChild(a)
              a.click()
              document.body.removeChild(a)
              toast.success('Đã tải ảnh gốc trang hiện tại.')
            }}
            disabled={!safePage?.url}
            title="Tải ảnh gốc trang hiện tại"
          >
            <ArrowDownToLine className="h-3.5 w-3.5" />
          </Button>
          {finalImage && (
            <a
              href={finalImage}
              download={`${baseFileName}-p${safeIdx + 1}-final.png`}
              className="inline-flex"
            >
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs">
                <FileDown className="h-3.5 w-3.5" />
              </Button>
            </a>
          )}
        </div>
      </div>

      {layerNoteInfo && (
        <Alert className="m-3 border-amber-300 bg-amber-50">
          <AlertDescription className="flex items-start gap-2 text-xs">
            <span className="shrink-0 font-semibold text-amber-800">
              Mangaka yêu cầu sửa layer #{layerNoteInfo.layer.index}
              {layerNoteInfo.layer.name ? ` (${layerNoteInfo.layer.name})` : ''}:
            </span>
            <span className="text-amber-700">
              {layerNoteInfo.note.content ?? layerNoteInfo.note.text ?? '(không có nội dung)'}
            </span>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-h-0 flex-col items-stretch justify-start overflow-auto bg-slate-100 p-4">
          <div
            className="group/canvas relative mx-auto"
            style={{
              width: canvasW,
              maxWidth: '100%',
              aspectRatio: `${canvasW} / ${canvasH}`,
            }}
          >
            {safePage?.url ? (
              <img
                src={safePage.url}
                alt="Gốc"
                className="pointer-events-none absolute inset-0 h-full w-full opacity-25"
                style={{ objectFit: 'fill' }}
                draggable={false}
              />
            ) : null}
            <LayerCanvas
              layers={layers}
              width={canvasW}
              height={canvasH}
              mode="edit"
              className="relative z-10 h-full w-full"
            />
            <div className="absolute inset-0 z-20 cursor-zoom-in opacity-0 transition-opacity group-hover/canvas:opacity-100">
              <ImageLightbox
                src={finalImage || safePage?.url}
                alt={`Trang ${safeIdx + 1}`}
                title={`Trang ${safeIdx + 1} · ${layers.length} layer`}
              />
            </div>
          </div>

          {finalImage && (
            <div className="mt-4 w-full self-center rounded border border-violet-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-violet-800">
                  Ảnh đã gộp trang {safeIdx + 1}
                </span>
                <span className="text-[10px] text-violet-500">
                  {layers.length} layer
                </span>
              </div>
              <div className="group/final relative">
                <img
                  src={finalImage}
                  alt="Final"
                  className="block h-auto w-full rounded border border-violet-100"
                  style={{ maxHeight: '70vh', objectFit: 'contain' }}
                />
                <ImageLightbox
                  src={finalImage}
                  alt={`Final trang ${safeIdx + 1}`}
                  title={`Ảnh gộp trang ${safeIdx + 1} · ${layers.length} layer`}
                  trigger={
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon-sm"
                      className="absolute right-2 top-2 z-20 size-7 rounded-full bg-white/90 opacity-0 shadow-sm backdrop-blur transition-opacity hover:bg-white group-hover/final:opacity-100"
                      title="Xem ảnh phóng to"
                      aria-label="Xem ảnh phóng to"
                    >
                      <Maximize2 className="size-3.5" />
                    </Button>
                  }
                />
              </div>
            </div>
          )}

          {(uploading || notesLoading) && (
            <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              {uploading ? 'Đang upload…' : 'Đang tải ghi chú…'}
            </div>
          )}
        </div>

        <div className="border-l">
          <ScrollArea className="h-full">
            <LayerStackPanel
              layers={layers}
              versions={versions}
              loading={loading}
              uploading={uploading}
              finalizing={finalizing}
              finalImage={finalImage}
              onAddLayer={handleAddLayer}
              onUpdateLayer={updateLayer}
              onDeleteLayer={deleteLayer}
              onUploadVersion={handleUploadVersion}
              onRollback={rollback}
              onLoadVersions={loadVersions}
              onReorder={reorderLayers}
              onFinalize={finalize}
              canEdit
              className="rounded-none border-0 bg-slate-50/60"
            />
          </ScrollArea>
        </div>
      </div>

      <div className="border-t bg-muted/20 px-4 py-3">
        <Button
          className="w-full bg-violet-600 hover:bg-violet-700"
          disabled={submittingAll || finalizing || pages.length === 0}
          onClick={() => handleSubmitAllPages({ chapterTaskId: chapter?._task?.id, chapterId: chapter?.chapterId })}
        >
          {submittingAll ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Đang gửi {pages.length} trang…
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Gửi {pages.length} trang cho Mangaka
            </>
          )}
        </Button>
        {pages.length > 1 && (
          <p className="mt-1 text-center text-[10px] text-muted-foreground">
            Sẽ gộp từng trang rồi gửi cả chapter cùng lúc.
          </p>
        )}
      </div>
    </Card>
  )
}
