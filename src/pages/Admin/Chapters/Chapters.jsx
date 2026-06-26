import { useEffect, useState } from 'react'
import { Image as ImageIcon, Layers, Loader2, Plus, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/api/index.js'
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
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const CHAPTER_STATUSES = [
  'draft',
  'pending_assistant',
  'pending_TE',
  'TE_revision',
  'pending_EB',
  'EB_revision',
  'published',
]

const STATUS_LABEL = {
  draft: 'Nháp',
  pending_assistant: 'Chờ Assistant',
  pending_TE: 'Chờ Tantou',
  TE_revision: 'TE sửa',
  pending_EB: 'Chờ EB',
  EB_revision: 'EB sửa',
  published: 'Đã xuất bản',
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
      toast.success('Đã thêm chương.')
      onSave()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Không thể tạo chương.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Thêm chương mới</DialogTitle>
          <DialogDescription>POST /admin/chapters</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Số chương *</Label>
              <Input type="number" value={form.number} onChange={e => set('number', e.target.value)} placeholder="143" />
            </div>
            <div className="space-y-2">
              <Label>Tiêu đề chương</Label>
              <Input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Tên chương (tuỳ chọn)" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Tải ảnh lên</Label>
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 px-6 py-10 text-center">
              <Upload className="size-5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Upload ảnh qua luồng Mangaka (chưa hỗ trợ trực tiếp ở đây)</p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Huỷ</Button>
          <Button onClick={handleSave} disabled={saving || !form.number}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {saving ? 'Đang lưu...' : 'Thêm chương'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ChapterStatusSelect({ chapterId, status, onChanged }) {
  const [saving, setSaving] = useState(false)

  async function handleChange(next) {
    setSaving(true)
    try {
      await api.updateChapterStatus(chapterId, next)
      onChanged(next)
      toast.success('Đã cập nhật trạng thái chương.')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Không thể đổi trạng thái.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Select value={status} onValueChange={handleChange} disabled={saving}>
      <SelectTrigger className="h-8 w-36 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CHAPTER_STATUSES.map((s) => (
          <SelectItem key={s} value={s}>{STATUS_LABEL[s] ?? s}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export default function Chapters() {
  const [tab, setTab] = useState('by-manga')
  const [mangaList, setMangaList] = useState([])
  const [selectedManga, setSelectedManga] = useState(null)
  const [chapters, setChapters] = useState([])
  const [legacyChapters, setLegacyChapters] = useState([])
  const [legacyFilter, setLegacyFilter] = useState('all')
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState(false)

  useEffect(() => {
    api.getMangaList().then((d) => {
      const list = Array.isArray(d) ? d : []
      setMangaList(list)
      if (list.length > 0) setSelectedManga(list[0])
    }).catch(() => setMangaList([]))
  }, [])

  useEffect(() => {
    if (tab !== 'by-manga' || !selectedManga?.id) return
    setLoading(true)
    api
      .getChaptersByManga(selectedManga.id)
      .then((d) => setChapters(Array.isArray(d) ? d : []))
      .catch(() => setChapters([]))
      .finally(() => setLoading(false))
  }, [selectedManga, tab])

  useEffect(() => {
    if (tab !== 'moderation') return
    setLoading(true)
    const params = legacyFilter === 'all' ? {} : { status: legacyFilter }
    api
      .getChaptersLegacy(params)
      .then((d) => setLegacyChapters(Array.isArray(d) ? d : []))
      .catch(() => setLegacyChapters([]))
      .finally(() => setLoading(false))
  }, [tab, legacyFilter])

  async function handleDelete(id) {
    if (!confirm('Xoá chương này?')) return
    try {
      await api.deleteChapter(id)
      setChapters((c) => c.filter((ch) => ch.id !== id))
      toast.success('Đã xoá chương.')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Không thể xoá chương.')
    }
  }

  async function handleSave() {
    setModal(false)
    if (!selectedManga?.id) return
    setLoading(true)
    const d = await api.getChaptersByManga(selectedManga.id)
    setChapters(Array.isArray(d) ? d : [])
    setLoading(false)
  }

  function updateChapterStatus(id, status) {
    setChapters((prev) => prev.map((ch) => (ch.id === id ? { ...ch, status } : ch)))
    setLegacyChapters((prev) => prev.map((ch) => (ch.id === id ? { ...ch, status } : ch)))
  }

  const rows = tab === 'by-manga' ? chapters : legacyChapters

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Chương truyện</h1>
          <p className="mt-1 text-sm text-muted-foreground">Quản lý chương theo truyện hoặc kiểm duyệt toàn hệ thống</p>
        </div>
        {tab === 'by-manga' ? (
          <Button onClick={() => setModal(true)} disabled={!selectedManga}>
            <Plus className="size-4" />
            Thêm chương
          </Button>
        ) : null}
      </div>

      <div className="flex gap-2 rounded-lg border bg-muted/30 p-1 w-fit">
        <Button
          size="sm"
          variant={tab === 'by-manga' ? 'secondary' : 'ghost'}
          onClick={() => setTab('by-manga')}
        >
          Theo truyện
        </Button>
        <Button
          size="sm"
          variant={tab === 'moderation' ? 'secondary' : 'ghost'}
          onClick={() => setTab('moderation')}
        >
          <Layers className="size-3.5" />
          Kiểm duyệt
        </Button>
      </div>

      {tab === 'by-manga' && selectedManga ? (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-4 p-4">
            <div
              className="flex size-14 items-center justify-center rounded-lg text-sm font-bold text-white shadow"
              style={{ background: selectedManga.bg }}
            >
              {selectedManga.initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{selectedManga.title}</div>
              <div className="text-xs text-muted-foreground">{chapters.length} chương đang hiển thị</div>
            </div>
            <Select
              value={String(selectedManga.id)}
              onValueChange={(v) => setSelectedManga(mangaList.find((m) => String(m.id) === v) ?? null)}
            >
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                {mangaList.map((m) => (
                  <SelectItem key={m.id} value={String(m.id)}>{m.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      ) : null}

      {tab === 'moderation' ? (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <span className="text-sm text-muted-foreground">Lọc trạng thái (GET /admin/chapters-legacy):</span>
            <Select value={legacyFilter} onValueChange={setLegacyFilter}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                {CHAPTER_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      ) : null}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="size-7 animate-spin" />
          <p className="mt-3 text-sm">Đang tải...</p>
        </div>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Chương</th>
                  {tab === 'moderation' ? <th className="px-4 py-3 text-left font-medium">Truyện</th> : null}
                  <th className="px-4 py-3 text-left font-medium">Tiêu đề</th>
                  <th className="px-4 py-3 text-left font-medium">Trang</th>
                  {tab === 'moderation' ? <th className="px-4 py-3 text-left font-medium">Trạng thái</th> : null}
                  <th className="px-4 py-3 text-left font-medium">Đăng bởi</th>
                  <th className="px-4 py-3 text-left font-medium">Ngày</th>
                  {tab === 'by-manga' ? <th className="px-4 py-3" style={{ width: 60 }}></th> : null}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((ch) => (
                  <tr key={ch.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="font-mono">#{ch.number}</Badge>
                    </td>
                    {tab === 'moderation' ? (
                      <td className="px-4 py-3 text-xs">{ch.seriesName}</td>
                    ) : null}
                    <td className="px-4 py-3">{ch.title || <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <ImageIcon className="size-3.5" />
                        {ch.pages ?? 0} trang
                      </span>
                    </td>
                    {tab === 'moderation' ? (
                      <td className="px-4 py-3">
                        <ChapterStatusSelect
                          chapterId={ch.id}
                          status={ch.status || 'draft'}
                          onChanged={(status) => updateChapterStatus(ch.id, status)}
                        />
                      </td>
                    ) : null}
                    <td className="px-4 py-3 text-xs text-muted-foreground">{ch.uploadedBy ?? ch.submittedBy}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{ch.uploadedAt ?? ch.createdAt}</td>
                    {tab === 'by-manga' ? (
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="icon-sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDelete(ch.id)}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-muted-foreground">
                <ImageIcon className="size-8 opacity-30" />
                <p className="mt-2 text-sm">Chưa có chương nào</p>
              </div>
            ) : null}
          </div>
        </Card>
      )}

      <ChapterDialog mangaId={selectedManga?.id} open={modal} onClose={() => setModal(false)} onSave={handleSave} />
    </div>
  )
}
