import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  Clock,
  Edit3,
  Eye,
  FileText,
  Filter,
  Heart,
  Image as ImageIcon,
  Layers,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  Sparkles,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/api/index.js'
import { realService } from '@/api/real.service.js'
import { getSession } from '@/lib/auth.js'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/Admin/ConfirmDialog/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
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

const CHAPTER_STATUSES = [
  'draft',
  'pending_assistant',
  'pending_TE',
  'TE_revision',
  'pending_EB',
  'EB_revision',
  'published',
]

const STATUS_CONFIG = {
  draft: { label: 'Nháp', class: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', color: 'slate' },
  pending_assistant: { label: 'Chờ Assistant', class: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400', color: 'amber' },
  pending_TE: { label: 'Chờ Tantou', class: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400', color: 'orange' },
  TE_revision: { label: 'TE sửa', class: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400', color: 'blue' },
  pending_EB: { label: 'Chờ EB', class: 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400', color: 'purple' },
  EB_revision: { label: 'EB sửa', class: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400', color: 'violet' },
  published: { label: 'Đã xuất bản', class: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400', color: 'emerald' },
}

function formatDate(value) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return '—'
  }
}

function normalizeManga(raw, index = 0) {
  const title = raw.title ?? raw.name ?? '—'
  return {
    id: raw.id ?? raw._id,
    title,
    author: raw.author ?? '',
    genre: Array.isArray(raw.tags) ? raw.tags : Array.isArray(raw.genre) ? raw.genre : [],
    status: raw.status ?? 'draft',
    chapters: raw.chapters ?? raw.chapterCount ?? 0,
    views: raw.views ?? raw.reads ?? 0,
    initials: title.slice(0, 2).toUpperCase(),
    bg: `linear-gradient(135deg, hsl(${(title.charCodeAt(0) || index) * 37 % 360} 60% 45%), hsl(${(title.charCodeAt(0) || index) * 17 % 360} 70% 55%))`,
    thumbnail: raw.thumbnail ?? raw.cover_image_url ?? '',
  }
}

const SERIES_STATUS_CONFIG = {
  draft: { label: 'Nháp', class: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
  submitted: { label: 'Đã gửi', class: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400' },
  approved: { label: 'Đã duyệt', class: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' },
  rejected: { label: 'Từ chối', class: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400' },
  published: { label: 'Đã xuất bản', class: 'bg-primary/20 text-primary border border-primary/30 font-bold shadow-sm dark:bg-primary/30 dark:text-primary-foreground' },
  cancelled: { label: 'Đã huỷ', class: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  ongoing: { label: 'Đang phát hành', class: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400' },
  completed: { label: 'Hoàn thành', class: 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400' },
  hiatus: { label: 'Tạm ngưng', class: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400' },
  dropped: { label: 'Bị drop', class: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400' },
}

function StarDisplay({ rating }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            'size-4',
            star <= Math.round(rating || 0)
              ? 'fill-amber-400 text-amber-400'
              : 'text-muted-foreground/30'
          )}
        />
      ))}
    </div>
  )
}

function formatNumber(n) {
  const num = Number(n) || 0
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return String(num)
}

function SeriesDetailCard({ series, chapters, comments, onDeleteComment, onBack, isAdmin }) {
  const statusConfig = SERIES_STATUS_CONFIG[series.status] ?? { label: series.status ?? '—', class: '' }
  const seriesCover = series.thumbnail || series.cover_image_url || series.coverImage
  const avgRating = series.averageRating ? Number(series.averageRating).toFixed(1) : '0.0'

  return (
    <div className="space-y-4">
      {/* Header with back button */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack} className="gap-2">
          <ArrowLeft className="size-4" />
          Quay lại danh sách
        </Button>
      </div>

      {/* Main Content - 2 columns: Cover Left, Info Right */}
      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        {/* Left Column - Cover */}
        <div className="space-y-3">
          <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-muted shadow-lg">
            {seriesCover ? (
              <img src={seriesCover} alt={series.title} className="size-full object-cover" />
            ) : (
              <div
                className="flex size-full items-center justify-center text-3xl font-bold text-white"
                style={{ background: series.bg }}
              >
                {(series.title || '?').slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>

          {/* Quick Stats */}
          <Card>
            <CardContent className="grid grid-cols-2 gap-2 p-3">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-sm font-bold text-blue-500">
                  <Eye className="size-3.5" />
                  {formatNumber(series.views || series.reads || 0)}
                </div>
                <p className="text-xs text-muted-foreground">Lượt xem</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-sm font-bold text-emerald-500">
                  <BookOpen className="size-3.5" />
                  {chapters.length || series.chapters || 0}
                </div>
                <p className="text-xs text-muted-foreground">Chương</p>
              </div>
            </CardContent>
          </Card>

          {/* Rating */}
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Đánh giá</p>
                  <div className="mt-0.5 flex items-baseline gap-1">
                    <span className="text-lg font-bold">{avgRating}</span>
                    <span className="text-xs text-muted-foreground">/5</span>
                  </div>
                </div>
                <StarDisplay rating={series.averageRating || 0} />
              </div>
              <Separator className="my-2" />
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1 text-amber-500">
                  <Heart className="size-3.5" />
                  {formatNumber(series.votesCount || series.votes_count || 0)}
                </span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <MessageSquare className="size-3.5" />
                  {comments.length}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Info & Chapters */}
        <div className="space-y-3">
          {/* Series Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Badge className={cn('text-xs', statusConfig.class)}>{statusConfig.label}</Badge>
              </div>
              <h2 className="mt-2 text-xl font-bold">{series.title || series.name}</h2>
              {series.author && (
                <p className="text-sm text-muted-foreground">Tác giả: {series.author}</p>
              )}
            </div>
          </div>

          {/* Description */}
          {series.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {series.description}
            </p>
          )}

          {/* Genre Tags */}
          {series.genre?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {series.genre.map((g) => (
                <Badge key={g} variant="outline" className="text-xs">
                  {g}
                </Badge>
              ))}
            </div>
          )}

          {/* Chapters List */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <FileText className="size-4 text-primary" />
                Danh sách chương
                <Badge variant="secondary" className="ml-auto text-xs">
                  {chapters.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 px-4 pb-4">
              {chapters.length === 0 ? (
                <div className="flex flex-col items-center py-6 text-center">
                  <ImageIcon className="size-8 text-muted-foreground/30" />
                  <p className="mt-2 text-xs text-muted-foreground">Chưa có chương nào</p>
                </div>
              ) : (
                <div className="max-h-[250px] overflow-y-auto">
                  {chapters.map((chapter) => (
                    <div
                      key={chapter.id}
                      className="group flex items-center gap-3 border-b border-border/50 py-2 last:border-0 hover:bg-muted/30"
                    >
                      <div className="flex size-10 shrink-0 items-center justify-center rounded bg-muted text-xs font-bold">
                        #{chapter.number}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{chapter.title || `Chapter ${chapter.number}`}</p>
                        <p className="text-xs text-muted-foreground">
                          <Clock className="mr-1 inline size-3" />
                          {chapter.uploadedAt || formatDate(chapter.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Comments Section */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <MessageSquare className="size-4 text-primary" />
            Bình luận & Đánh giá
            <Badge variant="secondary" className="ml-2 text-xs">
              {comments.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {comments.length === 0 ? (
            <div className="flex flex-col items-center py-6 text-center">
              <MessageSquare className="size-8 text-muted-foreground/30" />
              <p className="mt-2 text-xs text-muted-foreground">Chưa có bình luận nào</p>
            </div>
          ) : (
            <div className="space-y-3">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-3 border-b border-border/50 pb-3 last:border-0 last:pb-0">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {comment.user?.name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{comment.user?.name || 'Người dùng'}</span>
                      {comment.rating != null && <StarDisplay rating={comment.rating} />}
                    </div>
                    <p className="text-sm text-muted-foreground">{comment.content || comment.text}</p>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{formatDate(comment.createdAt)}</span>
                      {isAdmin && (
                        <button
                          onClick={() => onDeleteComment(comment.id)}
                          className="flex items-center gap-1 text-destructive/60 hover:text-destructive"
                        >
                          <Trash2 className="size-3" />
                          Xoá
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ModerationCard({ chapter, onStatusChange, onDelete, canDelete = true }) {
  const statusConfig = STATUS_CONFIG[chapter.status] ?? { label: chapter.status ?? '—', class: '', color: 'slate' }
  
  const statusColors = {
    slate: 'border-l-slate-400',
    amber: 'border-l-amber-500',
    orange: 'border-l-orange-500',
    blue: 'border-l-blue-500',
    purple: 'border-l-purple-500',
    violet: 'border-l-violet-500',
    emerald: 'border-l-emerald-500',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
    >
      <Card className={cn('overflow-hidden border-l-4 transition-all hover:shadow-md hover:-translate-y-0.5', statusColors[statusConfig.color] || 'border-l-slate-400')}>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Chapter number */}
            <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 font-mono text-lg font-bold text-primary">
              #{chapter.number}
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <h4 className="truncate text-sm font-semibold">{chapter.title || 'Không có tiêu đề'}</h4>
              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <BookOpen className="size-3.5" />
                  <span className="max-w-[120px] truncate">{chapter.seriesName}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <ImageIcon className="size-3.5" />
                  {chapter.pages ?? 0} trang
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="size-3.5" />
                  {chapter.uploadedAt ?? chapter.createdAt}
                </span>
              </div>
            </div>

            {/* Status */}
            <div className="shrink-0">
              <Badge className={cn('font-semibold tracking-wide shadow-sm', statusConfig.class)}>
                {statusConfig.label}
              </Badge>
            </div>

            {/* Actions */}
            <div className="flex gap-2 shrink-0">
              {onStatusChange && (
                <Select value={chapter.status} onValueChange={onStatusChange}>
                  <SelectTrigger className="w-[40px] h-9 p-0">
                    <Edit3 className="size-4" />
                  </SelectTrigger>
                  <SelectContent>
                    {CHAPTER_STATUSES.map(s => (
                      <SelectItem key={s} value={s}>
                        <Badge className={STATUS_CONFIG[s]?.class}>{STATUS_CONFIG[s]?.label}</Badge>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {canDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-destructive hover:bg-destructive/10"
                  onClick={onDelete}
                >
                  <Trash2 className="size-3.5" />
                  Xoá
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function ChapterCard({ chapter, mangaTitle, mangaThumbnail, onDelete, canDelete = true }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
    >
      <Card className="overflow-hidden transition-all hover:shadow-md">
        <CardContent className="flex flex-wrap items-center gap-4 p-4">
          {/* Manga thumbnail */}
          <div className="relative shrink-0">
            {mangaThumbnail ? (
              <img src={mangaThumbnail} alt="" className="size-14 rounded-xl object-cover shadow-md" />
            ) : (
              <div className="flex size-14 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
                {mangaTitle?.slice(0, 2).toUpperCase() ?? '??'}
              </div>
            )}
          </div>

          {/* Chapter info */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono text-sm px-2 py-0.5">
                #{chapter.number}
              </Badge>
              <h4 className="truncate text-sm font-semibold">{chapter.title || 'Không có tiêu đề'}</h4>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <ImageIcon className="size-3.5" />
                {chapter.pages ?? 0} trang
              </span>
              <span className="flex items-center gap-1">
                <Clock className="size-3.5" />
                {chapter.uploadedAt ?? chapter.createdAt}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 shrink-0">
            {canDelete && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-destructive hover:bg-destructive/10"
                onClick={onDelete}
              >
                <Trash2 className="size-3.5" />
                Xoá
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function ModerationStats({ chapters }) {
  const stats = CHAPTER_STATUSES.reduce((acc, s) => {
    acc[s] = chapters.filter(ch => ch.status === s).length
    return acc
  }, {})

  const totalPending = stats.pending_assistant + stats.pending_TE + stats.pending_EB

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
      {CHAPTER_STATUSES.map(s => {
        const cfg = STATUS_CONFIG[s]
        const count = stats[s]
        const isHighlight = s.includes('pending')
        return (
          <button
            key={s}
            onClick={() => {}}
            className={cn(
              'rounded-xl border p-3 text-left transition-all hover:scale-105',
              isHighlight && count > 0 ? 'border-primary/20 bg-primary/5' : 'border-border bg-card'
            )}
          >
            <div className={cn('text-2xl font-bold', cfg.class.includes('dark:') ? '' : '')}>{count}</div>
            <div className="mt-1 truncate text-xs font-medium text-muted-foreground">{cfg.label}</div>
          </button>
        )
      })}
    </div>
  )
}

function ChapterDialog({ mangaId, open, onClose, onSave }) {
  const [form, setForm] = useState({ number: '', title: '' })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (open) setForm({ number: '', title: '' })
  }, [open])

  async function handleSave() {
    if (!form.number || !mangaId) return
    setSaving(true)
    try {
      await api.createChapter({
        mangaId,
        number: form.number,
        title: form.title,
      })
      toast.success('Đã thêm chương mới')
      onSave()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Không thể tạo chương')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="relative pb-2">
          <div className="absolute -left-6 -top-4 flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 shadow-lg shadow-blue-500/30">
            <Sparkles className="size-6 text-white" />
          </div>
          <DialogTitle className="pl-10 pt-2 text-xl">Thêm chương mới</DialogTitle>
          <DialogDescription className="pl-10">Tạo chương mới cho truyện đã chọn</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                <span className="mr-1.5">🔢</span> Số chương <span className="text-destructive">*</span>
              </Label>
              <Input
                type="number"
                value={form.number}
                onChange={e => set('number', e.target.value)}
                placeholder="143"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                <span className="mr-1.5">📖</span> Tiêu đề chương
              </Label>
              <Input
                value={form.title}
                onChange={e => set('title', e.target.value)}
                placeholder="Tên chương (tuỳ chọn)"
                className="h-11"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">
              <span className="mr-1.5">📸</span> Tải ảnh lên
            </Label>
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-muted/30 px-6 py-10 text-center transition-colors hover:border-primary/50 hover:bg-muted/50">
              <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
                <Upload className="size-7 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Upload ảnh qua luồng Mangaka</p>
                <p className="mt-1 text-xs text-muted-foreground">Chức năng upload trực tiếp đang phát triển</p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="gap-1.5">
            <X className="size-4" />
            Huỷ bỏ
          </Button>
          <Button onClick={handleSave} disabled={saving || !form.number} className="gap-1.5">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            {saving ? 'Đang lưu...' : 'Thêm chương'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MangaSelector({ manga, mangaList, onChange }) {
  return (
    <Card className="overflow-hidden border-primary/10">
      <CardContent className="flex flex-wrap items-center gap-4 p-5">
        {/* Selected manga preview */}
        <div className="relative size-18 overflow-hidden rounded-2xl shadow-lg">
          {manga.thumbnail ? (
            <img src={manga.thumbnail} alt={manga.title} className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center text-xl font-bold text-white" style={{ background: manga.bg }}>
              {manga.initials}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-bold">{manga.title}</h3>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <BookOpen className="size-4" />
            {manga.chapters} chương
          </p>
        </div>

        {/* Selector */}
        <Select
          value={String(manga.id)}
          onValueChange={(v) => onChange(mangaList.find(m => String(m.id) === v) ?? null)}
        >
          <SelectTrigger className="w-[240px] h-11 bg-muted/30 border-0">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-primary" />
              <SelectValue placeholder="Chọn truyện" />
            </div>
          </SelectTrigger>
          <SelectContent>
            {mangaList.map(m => (
              <SelectItem key={m.id} value={String(m.id)}>
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded bg-muted p-1 text-xs font-bold flex items-center justify-center">{m.initials}</div>
                  <span className="truncate">{m.title}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  )
}

export default function Chapters() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState('by-manga')
  const [mangaList, setMangaList] = useState([])
  const [selectedManga, setSelectedManga] = useState(null)
  const [chapters, setChapters] = useState([])
  const [legacyChapters, setLegacyChapters] = useState([])
  const [legacyFilter, setLegacyFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)

  // Series detail state
  const [seriesDetail, setSeriesDetail] = useState(null)
  const [seriesComments, setSeriesComments] = useState([])

  // Confirm delete
  const [deleting, setDeleting] = useState(null)
  const [deletingComment, setDeletingComment] = useState(null)
  const [deletingLoading, setDeletingLoading] = useState(false)

  const currentUser = getSession()
  const isAdmin = currentUser?.role === 'admin'

  const mangaIdFromUrl = searchParams.get('mangaId')
  const isFromManga = !!mangaIdFromUrl

  // Fetch series detail when coming from Manga page
  useEffect(() => {
    if (!isFromManga || !mangaIdFromUrl) return

    const fetchSeriesDetail = async () => {
      setLoading(true)
      try {
        const [seriesData, chaptersData, commentsData] = await Promise.all([
          realService.getMangaById(mangaIdFromUrl),
          realService.getChaptersByManga(mangaIdFromUrl),
          realService.getCommentsByManga(mangaIdFromUrl).then(res => {
            console.log('📝 Comments raw response:', res)
            return res
          }).catch(err => {
            console.log('📝 Comments API error:', err?.response?.data || err.message)
            return []
          }),
        ])
        setSeriesDetail(seriesData)
        setChapters(Array.isArray(chaptersData) ? chaptersData : [])
        console.log('📝 Comments data:', commentsData)
        setSeriesComments(Array.isArray(commentsData) ? commentsData : [])
      } catch (err) {
        console.error('Error fetching series detail:', err)
        toast.error('Không thể tải thông tin series')
      } finally {
        setLoading(false)
      }
    }

    void fetchSeriesDetail()
  }, [mangaIdFromUrl, isFromManga])

  // Fetch manga list for selector (only when not viewing series detail)
  useEffect(() => {
    if (isFromManga) return
    setLoading(true)
    api.getMangaList()
      .then(d => {
        const list = Array.isArray(d) ? d.map(normalizeManga) : []
        setMangaList(list)
        if (list.length > 0 && !selectedManga) {
          setSelectedManga(list[0])
        }
      })
      .catch(() => setMangaList([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (tab !== 'by-manga' || !selectedManga?.id) return
    setLoading(true)
    api.getChaptersByManga(selectedManga.id)
      .then(d => setChapters(Array.isArray(d) ? d : []))
      .catch(() => setChapters([]))
      .finally(() => setLoading(false))
  }, [selectedManga, tab])

  useEffect(() => {
    if (tab !== 'moderation') return
    setLoading(true)
    const params = legacyFilter === 'all' ? {} : { status: legacyFilter }
    api.getChaptersLegacy(params)
      .then(d => setLegacyChapters(Array.isArray(d) ? d : []))
      .catch(() => setLegacyChapters([]))
      .finally(() => setLoading(false))
  }, [tab, legacyFilter])

  async function handleDelete(id) {
    if (!deleting) return
    setDeletingLoading(true)
    try {
      await api.deleteChapter(deleting.id)
      setChapters(c => c.filter(ch => ch.id !== deleting.id))
      toast.success('Đã xoá chương')
      setDeleting(null)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Không thể xoá chương')
    } finally {
      setDeletingLoading(false)
    }
  }

  async function handleSave() {
    setModal(false)
    if (!selectedManga?.id) return
    setLoading(true)
    try {
      const d = await api.getChaptersByManga(selectedManga.id)
      setChapters(Array.isArray(d) ? d : [])
    } catch {
      setChapters([])
    }
    setLoading(false)
  }

  function updateChapterStatus(id, status) {
    setChapters(prev => prev.map(ch => ch.id === id ? { ...ch, status } : ch))
    setLegacyChapters(prev => prev.map(ch => ch.id === id ? { ...ch, status } : ch))
  }

  async function handleStatusChange(id, status) {
    try {
      await api.updateChapterStatus(id, status)
      updateChapterStatus(id, status)
      toast.success('Đã cập nhật trạng thái')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Không cập nhật được trạng thái')
    }
  }

  const filteredChapters = chapters.filter(ch => {
    if (!search) return true
    const q = search.toLowerCase()
    return String(ch.number).includes(q) || (ch.title ?? '').toLowerCase().includes(q)
  })

  const filteredLegacy = legacyChapters.filter(ch => {
    if (!search) return true
    const q = search.toLowerCase()
    return String(ch.number).includes(q) || (ch.title ?? '').toLowerCase().includes(q) || (ch.seriesName ?? '').toLowerCase().includes(q)
  })

  const rows = tab === 'by-manga' ? filteredChapters : filteredLegacy

  return (
    <div className="space-y-6">
      {/* Series Detail View - when coming from Manga page */}
      {isFromManga && seriesDetail && (
        <SeriesDetailCard
          series={seriesDetail}
          chapters={chapters}
          comments={seriesComments}
          onDeleteComment={(id) => {
            const c = seriesComments.find(x => x.id === id)
            setDeletingComment(c || { id })
          }}
          onBack={() => navigate('/admin/manga')}
          isAdmin={isAdmin}
        />
      )}

      {/* Normal Chapters View */}
      {!isFromManga && (
        <>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 shadow-lg shadow-blue-500/20">
              <Layers className="size-5 text-white" />
            </div>
            Chương truyện
          </h1>
          <p className="mt-2 pl-[52px] text-sm text-muted-foreground">
            Quản lý chương theo truyện hoặc kiểm duyệt toàn hệ thống
          </p>
        </div>
        <div className="flex gap-2">
          {tab === 'by-manga' && selectedManga && (
            <Button onClick={() => setModal(true)} className="gap-2 shadow-lg shadow-blue-500/20">
              <Plus className="size-4" />
              Thêm chương
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <Button
          size="lg"
          variant={tab === 'by-manga' ? 'secondary' : 'ghost'}
          onClick={() => setTab('by-manga')}
          className={cn('gap-2', tab === 'by-manga' && 'shadow-md')}
        >
          <BookOpen className="size-4" />
          Theo truyện
        </Button>
        <Button
          size="lg"
          variant={tab === 'moderation' ? 'secondary' : 'ghost'}
          onClick={() => setTab('moderation')}
          className={cn('gap-2', tab === 'moderation' && 'shadow-md')}
        >
          <Layers className="size-4" />
          Kiểm duyệt
        </Button>
      </div>

      {/* Manga Selector */}
      {tab === 'by-manga' && selectedManga && (
        <MangaSelector
          manga={selectedManga}
          mangaList={mangaList}
          onChange={setSelectedManga}
        />
      )}

      {/* Moderation Stats */}
      {tab === 'moderation' && !loading && (
        <ModerationStats chapters={legacyChapters} />
      )}

      {/* Filters */}
      <Card className="border-primary/10">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="relative flex-1 min-w-[280px]">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-primary" />
              <Input
                placeholder="Tìm kiếm chương..."
                className="pl-12 h-11 bg-muted/30 border-0 focus:bg-background transition-colors"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* Status Filter - Moderation only */}
            {tab === 'moderation' && (
              <Select value={legacyFilter} onValueChange={setLegacyFilter}>
                <SelectTrigger className="w-[200px] h-11 bg-muted/30 border-0">
                  <div className="flex items-center gap-2">
                    <Filter className="size-4 text-primary" />
                    <SelectValue placeholder="Trạng thái" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả trạng thái</SelectItem>
                  {CHAPTER_STATUSES.map(s => (
                    <SelectItem key={s} value={s}>
                      <Badge className={STATUS_CONFIG[s]?.class}>{STATUS_CONFIG[s]?.label}</Badge>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Count */}
            <div className="ml-auto flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              <FileText className="size-4" />
              {rows.length} chương
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="size-12 animate-spin text-primary" />
          <p className="mt-4 text-sm">Đang tải dữ liệu...</p>
        </div>
      ) : rows.length === 0 ? (
        <Card className="flex flex-col items-center py-16">
          <ImageIcon className="size-14 text-muted-foreground/30" />
          <p className="mt-4 text-lg font-medium text-muted-foreground">Chưa có chương nào</p>
          {tab === 'by-manga' && selectedManga && (
            <Button variant="link" onClick={() => setModal(true)} className="mt-2 gap-1">
              <Plus className="size-4" />
              Thêm chương mới
            </Button>
          )}
        </Card>
      ) : (
        <div className="max-h-[calc(100vh-320px)] overflow-y-auto space-y-3 pr-2">
          <AnimatePresence mode="popLayout">
            {rows.map(chapter => (
              tab === 'moderation' ? (
                <ModerationCard
                  key={chapter.id}
                  chapter={chapter}
                  onStatusChange={(status) => handleStatusChange(chapter.id, status)}
                  onDelete={() => setDeleting(chapter)}
                  canDelete={!isAdmin}
                />
              ) : (
                <ChapterCard
                  key={chapter.id}
                  chapter={chapter}
                  mangaTitle={selectedManga?.title}
                  mangaThumbnail={selectedManga?.thumbnail}
                  showStatus={false}
                  onDelete={() => setDeleting(chapter)}
                  canDelete={!isAdmin}
                />
              )
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Dialog */}
      <ChapterDialog
        mangaId={selectedManga?.id}
        open={modal}
        onClose={() => setModal(false)}
        onSave={handleSave}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Xoá chương?"
        description={deleting ? `Bạn sắp xoá chương "${deleting.title || deleting.number || ''}". Hành động này không thể hoàn tác.` : ''}
        loading={deletingLoading}
        onConfirm={() => handleDelete()}
      />

      <ConfirmDialog
        open={deletingComment !== null}
        onOpenChange={(open) => !open && setDeletingComment(null)}
        title="Xoá bình luận?"
        description="Bạn sắp xoá bình luận này. Hành động này không thể hoàn tác."
        onConfirm={() => {
          if (!deletingComment) return
          setSeriesComments(prev => prev.filter(c => c.id !== deletingComment.id))
          toast.success('Đã xoá bình luận')
          setDeletingComment(null)
        }}
      />
        </>
      )}
    </div>
  )
}
