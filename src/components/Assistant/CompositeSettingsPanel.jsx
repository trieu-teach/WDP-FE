import { useEffect, useState } from 'react'
import { Eye, EyeOff, Layers, Settings2, Sparkles, StickyNote } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const PRESETS = [
  {
    id: 'final',
    label: 'Ảnh cuối',
    hint: 'Ảnh gốc + tất cả layer (mặc định khi gửi Mangaka)',
    values: { baseOpacity: 100, onionOpacity: 0, onlyLineArt: false, onlyColor: false, noBase: false },
  },
  {
    id: 'lineart',
    label: 'Chỉ line art',
    hint: 'Tắt ảnh gốc, chỉ layer có bật hiện — dùng kiểm tra nét',
    values: { baseOpacity: 0, onionOpacity: 0, onlyLineArt: true, onlyColor: false, noBase: true },
  },
  {
    id: 'color-line',
    label: 'Màu + line',
    hint: 'Ảnh gốc mờ + line art + màu — kiểm tra chồng lớp',
    values: { baseOpacity: 30, onionOpacity: 0, onlyLineArt: false, onlyColor: false, noBase: false },
  },
  {
    id: 'onion',
    label: 'Onion skin',
    hint: 'Tất cả layer (kể cả ẩn) hiện mờ — dễ canh nét, đỡ lệch layer dưới',
    values: { baseOpacity: 100, onionOpacity: 35, onlyLineArt: false, onlyColor: false, noBase: false },
  },
]

export function CompositeSettingsPanel({
  baseVisible,
  onToggleBase,
  baseOpacity,
  onChangeBaseOpacity,
  notesVisible,
  onToggleNotes,
  onionOpacity,
  onChangeOnionOpacity,
  className,
}) {
  const [activePreset, setActivePreset] = useState('final')

  // Đồng bộ preset khi user thay slider/toggle
  useEffect(() => {
    const match = PRESETS.find((p) => {
      if (p.values.noBase && baseVisible) return false
      if (!p.values.noBase && !baseVisible) return false
      if (p.values.baseOpacity !== baseOpacity) return false
      if (p.values.onionOpacity !== onionOpacity) return false
      return true
    })
    if (match) setActivePreset(match.id)
  }, [baseVisible, baseOpacity, onionOpacity])

  function applyPreset(preset) {
    setActivePreset(preset.id)
    const v = preset.values
    if (v.noBase) onToggleBase?.(false)
    else if (!baseVisible) onToggleBase?.(true)
    onChangeBaseOpacity?.(v.baseOpacity)
    onChangeOnionOpacity?.(v.onionOpacity)
  }

  return (
    <Card className={cn('border-primary/20 bg-primary/5', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings2 className="size-4 text-primary" />
          Composite & Preview
        </CardTitle>
        <CardDescription className="text-xs">
          Tuỳ chỉnh cách layer + ảnh gốc + note hiển thị khi xem trước.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p)}
              className={cn(
                'rounded-lg border p-2 text-left transition-colors',
                activePreset === p.id
                  ? 'border-primary bg-primary/10 text-foreground shadow-sm'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground',
              )}
              title={p.hint}
            >
              <p className="text-xs font-semibold">{p.label}</p>
              <p className="mt-0.5 text-[10px] leading-tight opacity-80">{p.hint}</p>
            </button>
          ))}
        </div>

        <div className="space-y-2 rounded-lg border bg-background p-2.5">
          <div className="flex items-center gap-2">
            <ButtonIconToggle
              active={baseVisible && baseOpacity > 0}
              onClick={() => onToggleBase?.()}
              onIcon={Eye}
              offIcon={EyeOff}
              label="Ảnh gốc"
            />
            <span className="text-xs font-medium">Ảnh gốc (Mangaka)</span>
            <Badge variant="outline" className="ml-auto text-[10px]">
              {baseOpacity}%
            </Badge>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={baseOpacity}
            onChange={(e) => onChangeBaseOpacity?.(Number(e.target.value))}
            className="h-1 w-full cursor-pointer appearance-none rounded-full bg-muted [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
          />
          <p className="text-[10px] text-muted-foreground">
            Kéo về 0 để tắt ảnh gốc hoàn toàn (xem line art thuần).
          </p>
        </div>

        <div className="space-y-2 rounded-lg border bg-background p-2.5">
          <div className="flex items-center gap-2">
            <Layers className="size-3.5 text-muted-foreground" />
            <span className="text-xs font-medium">Onion skin (xem overlap)</span>
            <Badge variant="outline" className="ml-auto text-[10px]">
              {onionOpacity}%
            </Badge>
          </div>
          <input
            type="range"
            min={0}
            max={80}
            step={5}
            value={onionOpacity}
            onChange={(e) => onChangeOnionOpacity?.(Number(e.target.value))}
            className="h-1 w-full cursor-pointer appearance-none rounded-full bg-muted [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
          />
          <p className="text-[10px] text-muted-foreground">
            Layer đang ẩn sẽ hiện mờ theo % này — dễ canh nét so với layer dưới.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-lg border bg-background p-2.5">
          <StickyNote className="size-3.5 text-rose-500" />
          <span className="text-xs font-medium">Note của Mangaka (ô vàng viền đỏ)</span>
          <button
            type="button"
            onClick={() => onToggleNotes?.()}
            className={cn(
              'ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors',
              notesVisible
                ? 'bg-rose-500 text-white'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {notesVisible ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
            {notesVisible ? 'Đang hiện' : 'Đang ẩn'}
          </button>
        </div>

        <div className="rounded-md border border-dashed bg-muted/30 p-2 text-[10px] text-muted-foreground">
          <Sparkles className="mb-1 inline size-3 text-primary" /> <strong>Mẹo manga:</strong> dùng blend <em>Multiply</em> cho layer shading, <em>Screen</em> cho highlight. Khi gửi cho Mangaka, panel xuất sẽ gộp tất cả layer ở 100% opacity.
        </div>
      </CardContent>
    </Card>
  )
}

function ButtonIconToggle({ active, onClick, onIcon: OnIcon, offIcon: OffIcon, label }) {
  const Icon = active ? OnIcon : OffIcon
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex size-7 items-center justify-center rounded-md border transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-background text-muted-foreground hover:text-foreground',
      )}
      aria-label={label}
      title={label}
    >
      <Icon className="size-3.5" />
    </button>
  )
}

export default CompositeSettingsPanel
