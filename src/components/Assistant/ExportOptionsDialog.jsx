import { useEffect, useState } from 'react'
import { FileImage, Layers, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const EXPORT_PRESETS = [
  {
    id: 'final',
    label: 'Ảnh cuối ghép đầy đủ',
    desc: 'Ảnh gốc + tất cả layer ở opacity hiện tại, có note (mặc định).',
    icon: Sparkles,
    badge: 'Mặc định',
    values: { outputMode: 'final', includeBase: true, baseOpacity: 100, notesVisible: true, flatten: false },
  },
  {
    id: 'clean',
    label: 'Ảnh sạch cuối cùng (flatten)',
    desc: 'Chỉ layer, không note, không ảnh gốc, layer 100% — gửi cho in/xuất bản.',
    icon: FileImage,
    badge: 'Phẳng',
    values: { outputMode: 'clean', includeBase: false, baseOpacity: 0, notesVisible: false, flatten: true },
  },
  {
    id: 'lineart',
    label: 'Chỉ line art + màu',
    desc: 'Bỏ ảnh gốc, bỏ note, layer ở opacity hiện tại — kiểm tra chất lượng vẽ.',
    icon: Layers,
    badge: 'Kiểm tra',
    values: { outputMode: 'lineart', includeBase: false, baseOpacity: 0, notesVisible: false, flatten: false },
  },
]

export function ExportOptionsDialog({ open, onOpenChange, onConfirm, busy, pageCount }) {
  const [selected, setSelected] = useState('final')

  useEffect(() => {
    if (open) setSelected('final')
  }, [open])

  function handleConfirm() {
    const preset = EXPORT_PRESETS.find((p) => p.id === selected) ?? EXPORT_PRESETS[0]
    onConfirm(preset)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Chọn kiểu xuất ảnh trước khi gửi Mangaka</DialogTitle>
          <DialogDescription>
            Áp dụng cho <strong>{pageCount ?? 0} trang</strong>. Bạn có thể đổi kiểu xuất cho từng lần gửi.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {EXPORT_PRESETS.map((p) => {
            const Icon = p.icon
            const active = selected === p.id
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelected(p.id)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                  active
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border bg-card hover:bg-muted/50',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md',
                    active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{p.label}</p>
                    <Badge variant="outline" className="text-[10px]">
                      {p.badge}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{p.desc}</p>
                </div>
                <span
                  className={cn(
                    'mt-1 size-4 shrink-0 rounded-full border-2',
                    active ? 'border-primary bg-primary' : 'border-muted-foreground/40',
                  )}
                  aria-hidden
                />
              </button>
            )
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Huỷ
          </Button>
          <Button onClick={handleConfirm} disabled={busy}>
            {busy ? 'Đang xuất...' : 'Xuất & gửi Mangaka'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ExportOptionsDialog
