import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlignLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Edit3,
  Filter,
  Image as ImageIcon,
  LayoutGrid,
  List,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/api/index.js'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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

const STATUS_CONFIG = {
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

const SERIES_STATUS_VALUES = ['draft', 'submitted', 'approved', 'rejected', 'published', 'cancelled']

/** Soft delete chỉ cho các status này (khớp BE). */
const SOFT_DELETABLE_STATUSES = new Set(['draft', 'rejected', 'cancelled'])

function formatNumber(n) {
  const num = Number(n) || 0
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return String(num)
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
  const tags = Array.isArray(raw.tags) ? raw.tags : Array.isArray(raw.genre) ? raw.genre : []
  const deletedAt = raw.deletedAt ?? raw.deleted_at ?? null
  return {
    id: raw.id ?? raw._id,
    title,
    author: raw.author ?? '',
    genre: tags,
    status: raw.status ?? 'draft',
    chapters: raw.chapters ?? raw.chapterCount ?? 0,
    views: raw.views ?? raw.reads ?? 0,
    description: raw.description ?? '',
    category: raw.category ?? '',
    createdAt: formatDate(raw.createdAt),
    updatedAt: formatDate(raw.updatedAt ?? raw.createdAt),
    initials: title.slice(0, 2).toUpperCase(),
    bg: `linear-gradient(135deg, hsl(${(title.charCodeAt(0) || index) * 37 % 360} 60% 45%), hsl(${(title.charCodeAt(0) || index) * 17 % 360} 70% 55%))`,
    thumbnail: raw.thumbnail ?? raw.cover_image_url ?? '',
    deletedAt,
    isDeleted: Boolean(deletedAt ?? raw.isDeleted),
  }
}

function canSoftDeleteManga(manga) {
  if (!manga || manga.isDeleted) return false
  return SOFT_DELETABLE_STATUSES.has(String(manga.status ?? '').toLowerCase())
}

function MangaCard({ manga, onEdit, onDelete, onClick }) {
  const statusConfig = STATUS_CONFIG[manga.status] ?? { label: manga.status ?? '—', class: '', icon: '📌' }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="group"
    >
      <Card
        className="overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/5 cursor-pointer"
        onClick={onClick}
      >
        {/* Cover Image */}
        <div className="relative aspect-[3/4] overflow-hidden bg-muted">
          {manga.thumbnail ? (
            <img
              src={manga.thumbnail}
              alt={manga.title}
              className="size-full object-cover transition-transform duration-500 group-hover:scale-110"
              onError={(e) => {
                e.target.style.display = 'none'
                e.target.nextSibling?.classList.remove('hidden')
              }}
            />
          ) : null}
          <div
            className={cn('flex size-full items-center justify-center text-5xl font-bold text-white', manga.thumbnail && 'hidden')}
            style={{ background: manga.bg }}
          >
            {manga.initials}
          </div>

          {/* Status badge */}
          <div className="absolute left-2 top-2 flex flex-col gap-1">
            <Badge className="bg-white/95 text-foreground shadow-lg backdrop-blur-sm font-bold tracking-wide border-0">
              {statusConfig.label}
            </Badge>
            {manga.isDeleted ? (
              <Badge className="border-0 bg-zinc-900/85 text-white shadow-lg">
                Đã ẩn
              </Badge>
            ) : null}
          </div>

          {/* Chapter count */}
          <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
            <BookOpen className="size-3" />
            {manga.chapters} chương
          </div>
        </div>

        <CardContent className="p-4">
          <h3 className="line-clamp-2 text-sm font-semibold leading-tight">{manga.title}</h3>
          <p className="mt-1 truncate text-xs text-muted-foreground">{manga.author || 'Chưa có tác giả'}</p>

          {/* Stats row */}
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <TrendingUp className="size-3" />
              {formatNumber(manga.views)}
            </div>
            <span>{manga.updatedAt}</span>
          </div>

          {/* Action buttons */}
          <div className="mt-3 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5"
              onClick={(e) => { e.stopPropagation(); onEdit() }}
            >
              <Edit3 className="size-3.5" />
              Sửa
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={!canSoftDeleteManga(manga)}
              title={
                manga.isDeleted
                  ? 'Truyện đã được ẩn'
                  : canSoftDeleteManga(manga)
                    ? 'Ẩn truyện (soft delete)'
                    : 'Chỉ ẩn được truyện nháp / từ chối / đã huỷ'
              }
              onClick={(e) => { e.stopPropagation(); onDelete() }}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function MangaRow({ manga, onEdit, onDelete, onClick }) {
  const statusConfig = STATUS_CONFIG[manga.status] ?? { label: manga.status ?? '—', class: '', icon: '📌' }

  return (
    <tr className="group hover:bg-muted/30 cursor-pointer" onClick={onClick}>
      <td className="px-4 py-3">
        <div className="relative size-12 overflow-hidden rounded-lg shadow-sm">
          {manga.thumbnail ? (
            <img
              src={manga.thumbnail}
              alt={manga.title}
              className="size-full object-cover"
              onError={(e) => {
                e.target.style.display = 'none'
                e.target.nextSibling?.classList.remove('hidden')
              }}
            />
          ) : null}
          <div
            className={cn('flex size-full items-center justify-center text-sm font-bold text-white', manga.thumbnail && 'hidden')}
            style={{ background: manga.bg }}
          >
            {manga.initials}
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="font-medium">{manga.title}</div>
        <div className="flex flex-wrap gap-1">
          {(manga.genre ?? []).slice(0, 2).map(g => (
            <span key={g} className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
              {g}
            </span>
          ))}
        </div>
      </td>
      <td className="px-4 py-3 font-mono">{manga.chapters}</td>
      <td className="px-4 py-3">{formatNumber(manga.views)}</td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge className={cn('font-semibold tracking-wide', statusConfig.class)}>
            {statusConfig.label}
          </Badge>
          {manga.isDeleted ? (
            <Badge variant="outline" className="text-[10px]">
              Đã ẩn
            </Badge>
          ) : null}
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">{manga.updatedAt}</td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon-sm" onClick={(e) => { e.stopPropagation(); onEdit() }}>
            <Edit3 className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={!canSoftDeleteManga(manga)}
            title={
              manga.isDeleted
                ? 'Truyện đã được ẩn'
                : canSoftDeleteManga(manga)
                  ? 'Ẩn truyện (soft delete)'
                  : 'Chỉ ẩn được truyện nháp / từ chối / đã huỷ'
            }
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </td>
    </tr>
  )
}

function MangaDialog({ manga, open, onClose, onSave }) {
  const isEdit = !!manga?.id
  const [form, setForm] = useState({ title: '', author: '', genre: '', status: 'draft' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setForm({
        title: manga?.title ?? '',
        author: manga?.author ?? '',
        genre: manga?.genre?.join(', ') ?? '',
        status: manga?.status ?? 'draft',
      })
    }
  }, [open, manga])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave() {
    if (!form.title.trim()) return
    setSaving(true)
    const tags = form.genre.split(',').map(s => s.trim()).filter(Boolean)
    const payload = { title: form.title, author: form.author, tags, status: form.status }
    try {
      await (isEdit ? api.updateManga(manga.id, payload) : api.createManga(payload))
      toast.success(isEdit ? 'Đã cập nhật truyện' : 'Đã thêm truyện mới')
      onSave()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Có lỗi xảy ra')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="relative pb-2">
          <div className="absolute -left-6 -top-4 flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-rose-600 shadow-lg shadow-primary/30">
            <BookOpen className="size-6 text-white" />
          </div>
          <DialogTitle className="pl-10 pt-2 text-xl">
            {isEdit ? 'Chỉnh sửa truyện' : 'Thêm truyện mới'}
          </DialogTitle>
          <DialogDescription className="pl-10">
            {isEdit ? 'Cập nhật thông tin bộ truyện' : 'Tạo bộ truyện mới trong hệ thống'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Title */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              <span className="mr-1.5">📖</span> Tên truyện <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Input
                value={form.title}
                onChange={e => set('title', e.target.value)}
                placeholder="Nhập tên truyện..."
                className="pl-10"
              />
              <BookOpen className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          {/* Author & Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                <span className="mr-1.5">✍️</span> Tác giả
              </Label>
              <div className="relative">
                <Input
                  value={form.author}
                  onChange={e => set('author', e.target.value)}
                  placeholder="Tên tác giả"
                  className="pl-10"
                />
                <Edit3 className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                <span className="mr-1.5">🎯</span> Trạng thái
              </Label>
              <Select value={form.status} onValueChange={v => set('status', v)}>
                <SelectTrigger className="pl-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SERIES_STATUS_VALUES.map(s => (
                    <SelectItem key={s} value={s}>
                      <span className="flex items-center gap-2">
                        <span>{STATUS_CONFIG[s]?.icon}</span>
                        <span>{STATUS_CONFIG[s]?.label}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Genres */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              <span className="mr-1.5">🏷️</span> Thể loại
            </Label>
            <div className="relative">
              <Input
                value={form.genre}
                onChange={e => set('genre', e.target.value)}
                placeholder="Hành động, Isekai, Romance..."
                className="pl-10"
              />
              <AlignLeft className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            </div>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className="text-[10px]">💡</span>
              Phân cách bằng dấu phẩy
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="gap-1.5">
            <X className="size-4" />
            Huỷ bỏ
          </Button>
          <Button onClick={handleSave} disabled={saving || !form.title.trim()} className="gap-1.5">
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {saving ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Thêm truyện'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function Manga() {
  const navigate = useNavigate()
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [chapterSearch, setChapterSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [includeDeleted, setIncludeDeleted] = useState(false)
  const [view, setView] = useState('grid')
  const [modal, setModal] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [page, setPage] = useState(1)
  const ITEMS_PER_PAGE = 10

  // Reset page when search or filter changes
  useEffect(() => {
    setPage(1)
  }, [search, chapterSearch, statusFilter, includeDeleted])

  async function loadList(withDeleted = includeDeleted) {
    setLoading(true)
    try {
      const d = await api.getMangaList({ includeDeleted: withDeleted })
      setList(Array.isArray(d) ? d.map(normalizeManga) : [])
    } catch {
      setList([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadList(includeDeleted)
  }, [includeDeleted])

  async function handleSave() {
    setModal(null)
    await loadList(includeDeleted)
  }

  function handleDelete(manga) {
    if (!canSoftDeleteManga(manga)) {
      toast.error('Chỉ ẩn được truyện ở trạng thái nháp, từ chối hoặc đã huỷ.')
      return
    }
    setDeleteTarget(manga)
  }

  async function confirmSoftDelete() {
    const manga = deleteTarget
    if (!manga?.id) return
    setDeleting(true)
    try {
      await api.deleteManga(manga.id)
      if (includeDeleted) {
        setList((l) =>
          l.map((m) =>
            m.id === manga.id
              ? { ...m, isDeleted: true, deletedAt: new Date().toISOString() }
              : m,
          ),
        )
      } else {
        setList((l) => l.filter((m) => m.id !== manga.id))
      }
      toast.success('Đã ẩn truyện')
      setDeleteTarget(null)
    } catch (err) {
      const status = err?.response?.status
      if (status === 410) {
        toast.error(err?.response?.data?.message || 'Truyện đã được ẩn trước đó.')
        await loadList(includeDeleted)
        setDeleteTarget(null)
        return
      }
      toast.error(err?.response?.data?.message || 'Không thể ẩn truyện')
    } finally {
      setDeleting(false)
    }
  }

  function handleCardClick(manga) {
    navigate(`/admin/chapters?mangaId=${manga.id}`)
  }

  const filtered = list.filter(m => {
    const q = search.toLowerCase()
    const matchSearch = !q || m.title.toLowerCase().includes(q) || m.author.toLowerCase().includes(q)
    const matchChapter = !chapterSearch || m.chapters >= Number(chapterSearch)
    const matchStatus = statusFilter === 'all' || m.status === statusFilter
    return matchSearch && matchChapter && matchStatus
  })

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const paginatedItems = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)

  const stats = {
    total: list.length,
    published: list.filter(m => m.status === 'published').length,
    ongoing: list.filter(m => m.status === 'ongoing').length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-rose-600 shadow-lg shadow-primary/20">
              <BookOpen className="size-5 text-white" />
            </div>
            Quản lý truyện
          </h1>
          <p className="mt-2 pl-[52px] text-sm text-muted-foreground">
            {stats.total} truyện • {stats.published} đã xuất bản • {stats.ongoing} đang phát hành
          </p>
        </div>
        <Button onClick={() => setModal({})} className="gap-2 shadow-lg shadow-primary/20">
          <Plus className="size-4" />
          Thêm truyện
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="overflow-hidden border-violet-200 dark:border-violet-800/50 bg-gradient-to-br from-violet-50/50 to-transparent">
          <CardContent className="flex items-center justify-between gap-4 p-5">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tổng truyện</p>
              <div className="text-4xl font-bold text-violet-600">{stats.total}</div>
            </div>
            <Badge variant="outline" className="bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-500/20 dark:text-violet-400 dark:border-violet-500/30 px-3 py-1.5">
              <BookOpen className="size-3.5 mr-1.5" />
              Series
            </Badge>
          </CardContent>
        </Card>
        <Card className="overflow-hidden border-emerald-200 dark:border-emerald-800/50 bg-gradient-to-br from-emerald-50/50 to-transparent">
          <CardContent className="flex items-center justify-between gap-4 p-5">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Đã xuất bản</p>
              <div className="text-4xl font-bold text-emerald-600">{stats.published}</div>
            </div>
            <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30 px-3 py-1.5">
              <TrendingUp className="size-3.5 mr-1.5" />
              Published
            </Badge>
          </CardContent>
        </Card>
        <Card className="overflow-hidden border-blue-200 dark:border-blue-800/50 bg-gradient-to-br from-blue-50/50 to-transparent">
          <CardContent className="flex items-center justify-between gap-4 p-5">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Đang phát hành</p>
              <div className="text-4xl font-bold text-blue-600">{stats.ongoing}</div>
            </div>
            <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30 px-3 py-1.5">
              <Sparkles className="size-3.5 mr-1.5" />
              Ongoing
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-primary/10">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="relative flex-1 min-w-[280px]">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-primary" />
              <Input
                placeholder="Tìm kiếm theo tên, tác giả..."
                className="pl-12 h-11 bg-muted/30 border-0 focus:bg-background transition-colors"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* Chapter Search */}
            <div className="relative w-[180px]">
              <BookOpen className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-primary" />
              <Input
                type="number"
                placeholder="Số chương..."
                className="pl-10 h-11 bg-muted/30 border-0 focus:bg-background transition-colors"
                value={chapterSearch}
                onChange={e => setChapterSearch(e.target.value)}
              />
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px] h-11 bg-muted/30 border-0">
                <Filter className="size-4 mr-2 text-primary" />
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <span>Tất cả</span>
                </SelectItem>
                {SERIES_STATUS_VALUES.map(s => {
                  const cfg = STATUS_CONFIG[s] || {}
                  return (
                    <SelectItem key={s} value={s}>
                      <Badge className={cfg.class}>{cfg.label}</Badge>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant={includeDeleted ? 'secondary' : 'outline'}
              className="h-11 gap-2"
              onClick={() => setIncludeDeleted((v) => !v)}
              title="GET /admin/manga?include_deleted=true"
            >
              {includeDeleted ? 'Đang hiện cả truyện đã ẩn' : 'Hiện truyện đã ẩn'}
            </Button>

            {/* View Toggle */}
            <div className="flex rounded-xl border bg-muted/50 p-1">
              <Button
                variant={view === 'grid' ? 'secondary' : 'ghost'}
                size="icon-sm"
                onClick={() => setView('grid')}
                className="h-9 w-9"
              >
                <LayoutGrid className="size-4" />
              </Button>
              <Button
                variant={view === 'table' ? 'secondary' : 'ghost'}
                size="icon-sm"
                onClick={() => setView('table')}
                className="h-9 w-9"
              >
                <List className="size-4" />
              </Button>
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
      ) : view === 'grid' ? (
        <>
          <AnimatePresence mode="popLayout">
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {paginatedItems.map(m => (
                <MangaCard
                  key={m.id}
                  manga={m}
                  onEdit={() => setModal(m)}
                  onDelete={() => handleDelete(m)}
                  onClick={() => handleCardClick(m)}
                />
              ))}
            </div>
          </AnimatePresence>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Hiển thị {(page - 1) * ITEMS_PER_PAGE + 1} - {Math.min(page * ITEMS_PER_PAGE, filtered.length)} trong {filtered.length} truyện
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  className="size-9"
                >
                  <ChevronsLeft className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="size-9"
                >
                  <ChevronLeft className="size-4" />
                </Button>

                {/* Page numbers */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum
                  if (totalPages <= 5) {
                    pageNum = i + 1
                  } else if (page <= 3) {
                    pageNum = i + 1
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = page - 2 + i
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={page === pageNum ? 'default' : 'outline'}
                      size="icon-sm"
                      onClick={() => setPage(pageNum)}
                      className="size-9"
                    >
                      {pageNum}
                    </Button>
                  )
                })}

                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="size-9"
                >
                  <ChevronRight className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
                  className="size-9"
                >
                  <ChevronsRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-4 text-left font-medium">Ảnh bìa</th>
                    <th className="px-4 py-4 text-left font-medium">Tên truyện</th>
                    <th className="px-4 py-4 text-left font-medium">Chương</th>
                    <th className="px-4 py-4 text-left font-medium">Lượt xem</th>
                    <th className="px-4 py-4 text-left font-medium">Trạng thái</th>
                    <th className="px-4 py-4 text-left font-medium">Cập nhật</th>
                    <th className="px-4 py-4" style={{ width: 120 }}></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paginatedItems.map(m => (
                    <MangaRow
                      key={m.id}
                      manga={m}
                      onEdit={() => setModal(m)}
                      onDelete={() => handleDelete(m)}
                      onClick={() => handleCardClick(m)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Hiển thị {(page - 1) * ITEMS_PER_PAGE + 1} - {Math.min(page * ITEMS_PER_PAGE, filtered.length)} trong {filtered.length} truyện
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  className="size-9"
                >
                  <ChevronsLeft className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="size-9"
                >
                  <ChevronLeft className="size-4" />
                </Button>

                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum
                  if (totalPages <= 5) {
                    pageNum = i + 1
                  } else if (page <= 3) {
                    pageNum = i + 1
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = page - 2 + i
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={page === pageNum ? 'default' : 'outline'}
                      size="icon-sm"
                      onClick={() => setPage(pageNum)}
                      className="size-9"
                    >
                      {pageNum}
                    </Button>
                  )
                })}

                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="size-9"
                >
                  <ChevronRight className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
                  className="size-9"
                >
                  <ChevronsRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {paginatedItems.length === 0 && !loading && (
        <Card className="flex flex-col items-center py-16">
          <ImageIcon className="size-14 text-muted-foreground/30" />
          <p className="mt-4 text-lg font-medium text-muted-foreground">Không tìm thấy truyện nào</p>
          <Button variant="link" onClick={() => { setSearch(''); setStatusFilter('all') }} className="mt-2">
            Xoá bộ lọc
          </Button>
        </Card>
      )}

      {/* Dialog */}
      <MangaDialog manga={modal?.id ? modal : null} open={modal !== null} onClose={() => setModal(null)} onSave={handleSave} />

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <Trash2 className="size-4" />
              </span>
              Ẩn truyện?
            </DialogTitle>
            <DialogDescription className="text-left leading-relaxed">
              {deleteTarget?.title ? (
                <>
                  Bạn sắp ẩn truyện <strong className="text-foreground">{deleteTarget.title}</strong>.
                  {' '}Truyện sẽ không còn hiện trong danh sách, nhưng dữ liệu vẫn được giữ lại.
                </>
              ) : (
                'Truyện sẽ không còn hiện trong danh sách, nhưng dữ liệu vẫn được giữ lại.'
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={deleting}
              onClick={() => setDeleteTarget(null)}
            >
              Huỷ
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              className="gap-1.5"
              onClick={() => void confirmSoftDelete()}
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              {deleting ? 'Đang ẩn…' : 'Ẩn truyện'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
