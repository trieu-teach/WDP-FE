import { useEffect, useState } from 'react'
import { BookOpen, Check, Edit3, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/api/index.js'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { SERIES_GENRES } from '@/utils/seriesModel.js'

const SERIES_STATUS_VALUES = [
  'draft',
  'submitted',
  'approved',
  'rejected',
  'published',
  'cancelled',
]

const SERIES_STATUS_LABELS = {
  draft: 'Nháp',
  submitted: 'Đã gửi',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
  published: 'Đã xuất bản',
  cancelled: 'Đã huỷ',
}

/**
 * Dialog thêm/sửa truyện (dùng chung trang Manga list & chi tiết series).
 */
export default function MangaEditDialog({ manga, open, onClose, onSave }) {
  const isEdit = !!manga?.id
  const [form, setForm] = useState({
    title: '',
    author: '',
    genre: [],
    status: 'draft',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    const genre = Array.isArray(manga?.genre)
      ? [...manga.genre]
      : (Array.isArray(manga?.tags) ? [...manga.tags] : [])
    setForm({
      title: manga?.title ?? '',
      author: manga?.author ?? '',
      genre,
      status: manga?.status ?? 'draft',
    })
  }, [open, manga])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  function toggleGenre(genre) {
    setForm((f) => {
      const selected = Array.isArray(f.genre) ? f.genre : []
      return {
        ...f,
        genre: selected.includes(genre)
          ? selected.filter((g) => g !== genre)
          : [...selected, genre],
      }
    })
  }

  async function handleSave() {
    if (!form.title.trim()) return
    setSaving(true)
    const tags = (Array.isArray(form.genre) ? form.genre : [])
      .map((s) => String(s).trim())
      .filter(Boolean)
    const payload = {
      title: form.title,
      author: form.author,
      tags,
      status: form.status,
    }
    try {
      await (isEdit
        ? api.updateManga(manga.id, payload)
        : api.createManga(payload))
      toast.success(isEdit ? 'Đã cập nhật truyện' : 'Đã thêm truyện mới')
      onSave?.({
        ...payload,
        genre: tags,
        tags,
        id: manga?.id,
      })
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Có lỗi xảy ra')
    } finally {
      setSaving(false)
    }
  }

  const selectedGenres = Array.isArray(form.genre) ? form.genre : []
  const genreOptions = [
    ...SERIES_GENRES,
    ...selectedGenres.filter((g) => !SERIES_GENRES.includes(g)),
  ]

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader className="pb-1">
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-rose-600 shadow-md shadow-primary/25">
              <BookOpen className="size-5 text-white" />
            </div>
            <div className="min-w-0 space-y-1">
              <DialogTitle className="text-xl leading-none">
                {isEdit ? 'Chỉnh sửa truyện' : 'Thêm truyện mới'}
              </DialogTitle>
              <DialogDescription>
                {isEdit
                  ? 'Cập nhật thông tin bộ truyện'
                  : 'Tạo bộ truyện mới trong hệ thống'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">
              Tên truyện <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Input
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="Nhập tên truyện..."
                className="h-10 pl-10"
              />
              <BookOpen className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">Tác giả</Label>
              <div className="relative">
                <Input
                  value={form.author}
                  onChange={(e) => set('author', e.target.value)}
                  placeholder="Tên tác giả"
                  className="h-10 pl-10"
                />
                <Edit3 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">
                Trạng thái duyệt
              </Label>
              <Select value={form.status} onValueChange={(v) => set('status', v)}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SERIES_STATUS_VALUES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SERIES_STATUS_LABELS[s] ?? s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-sm font-medium text-foreground">Thể loại</Label>
              {selectedGenres.length > 0 ? (
                <span className="text-xs text-gray-400">
                  Đã chọn: {selectedGenres.length}
                </span>
              ) : null}
            </div>
            <div className="max-h-44 overflow-y-auto rounded-lg border border-border/70 bg-muted/20 p-2.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex flex-wrap gap-1.5">
                {genreOptions.map((g) => {
                  const active = selectedGenres.includes(g)
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => toggleGenre(g)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                        active
                          ? 'border-primary/40 bg-primary/10 text-primary'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50',
                      )}
                    >
                      {active ? <Check className="size-3" /> : null}
                      {g}
                    </button>
                  )
                })}
              </div>
            </div>
            <p className="text-xs text-gray-400">Chọn một hoặc nhiều thể loại</p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-end">
          <Button variant="outline" onClick={onClose}>
            Huỷ bỏ
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !form.title.trim()}
            className="gap-1.5"
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            {saving ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Thêm truyện'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
