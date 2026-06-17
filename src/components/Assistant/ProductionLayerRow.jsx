import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  Eye,
  EyeOff,
  Layers,
  Upload,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

const BLEND_MODES = [
  { value: 'source-over', label: 'Bình thường' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'screen', label: 'Screen' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'lighten', label: 'Lighten' },
  { value: 'darken', label: 'Darken' },
]

export function ProductionLayerRow({
  layer,
  step,
  onToggle,
  onChangeOpacity,
  onChangeBlend,
  onPickFile,
  onDownload,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  onSelectVersion,
}) {
  const hasImage = !!layer.dataUrl
  const versionCount = layer.versions?.length ?? 0

  return (
    <li
      className={cn(
        'rounded-lg border p-3 transition-colors',
        layer.visible ? 'border-border bg-card' : 'border-dashed border-muted bg-muted/40',
      )}
      style={step?.color ? { borderLeftColor: step.color, borderLeftWidth: 3 } : undefined}
    >
      <div className="flex items-start gap-2">
        <div className="flex flex-col gap-1">
          <Button
            size="icon-xs"
            variant="ghost"
            disabled={!canMoveUp}
            onClick={() => onMoveUp(layer.id)}
            aria-label="Đưa layer lên"
            title="Đưa lên"
          >
            <ArrowUp className="size-3" />
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            disabled={!canMoveDown}
            onClick={() => onMoveDown(layer.id)}
            aria-label="Đưa layer xuống"
            title="Đưa xuống"
          >
            <ArrowDown className="size-3" />
          </Button>
        </div>

        <Button
          size="icon-sm"
          variant={layer.visible ? 'default' : 'outline'}
          onClick={() => onToggle(layer.id)}
          aria-label={layer.visible ? 'Ẩn layer' : 'Hiện layer'}
        >
          {layer.visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
        </Button>

        <div className="size-11 shrink-0 overflow-hidden rounded border bg-muted">
          {layer.thumbUrl ? (
            <img src={layer.thumbUrl} alt="" className="size-full object-contain" />
          ) : (
            <span className="flex size-full items-center justify-center text-[10px] text-muted-foreground">
              Trống
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm font-medium">{layer.name}</p>
            {step?.labelVi ? (
              <Badge variant="outline" className="text-[10px]">
                {step.labelVi}
              </Badge>
            ) : null}
          </div>
          <p className="text-[10px] text-muted-foreground">{step?.hint}</p>
          {versionCount > 0 ? (
            <Select
              value={layer.activeVersionId ?? ''}
              onValueChange={(v) => onSelectVersion(layer.id, v)}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder="Phiên bản" />
              </SelectTrigger>
              <SelectContent>
                {layer.versions.map((ver) => (
                  <SelectItem key={ver.id} value={ver.id}>
                    {ver.label}
                    {ver.createdAt
                      ? ` · ${new Date(ver.createdAt).toLocaleDateString('vi-VN')}`
                      : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-[10px] text-muted-foreground">Chưa có file upload</p>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-1">
          <Button
            size="icon-sm"
            variant="outline"
            onClick={() => onPickFile(layer.id)}
            title="Upload PNG/WebP từ phần mềm ngoài"
          >
            <Upload className="size-3.5" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            disabled={!hasImage}
            onClick={() => onDownload(layer.id)}
            title="Tải layer về máy"
          >
            <ArrowDownToLine className="size-3.5" />
          </Button>
        </div>
      </div>

      {layer.visible && hasImage ? (
        <div className="mt-2 space-y-1.5 pl-12">
          <div className="flex items-center gap-2">
            <span className="w-12 text-[10px] uppercase tracking-wider text-muted-foreground">
              Đậm
            </span>
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              value={layer.opacity ?? 100}
              onChange={(e) => onChangeOpacity(layer.id, Number(e.target.value))}
              className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-muted [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
            />
            <span className="w-8 text-right text-[10px] tabular-nums text-muted-foreground">
              {layer.opacity ?? 100}%
            </span>
          </div>
          {onChangeBlend ? (
            <div className="flex items-center gap-2">
              <Layers className="size-3 text-muted-foreground" />
              <span className="w-12 text-[10px] uppercase tracking-wider text-muted-foreground">
                Trộn
              </span>
              <Select
                value={layer.blendMode ?? 'source-over'}
                onValueChange={(v) => onChangeBlend?.(layer.id, v)}
              >
                <SelectTrigger className="h-7 flex-1 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BLEND_MODES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}
