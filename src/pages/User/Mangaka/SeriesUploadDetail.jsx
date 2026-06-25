import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  FileImage,
  ImageIcon,
  Inbox,
  PenSquare,
  Sparkles,
  Upload,
} from 'lucide-react'
import Header from '@/components/User/Header/Header.jsx'
import Footer from '@/components/User/Footer/Footer.jsx'
import { getSession, logout } from '@/lib/auth.js'
import { seriesService } from '@/api/series.service.js'
import { chaptersService } from '@/api/chapters.service.js'
import { getApiErrorMessage, resolveMediaUrl } from '@/api/http.js'
import {
  apiChapterToAnnotator,
  apiChapterToRow,
  apiSeriesToUi,
  findSeriesByIdOrSlug,
  uiSeriesFormToApi,
} from '@/utils/apiMappers.js'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import {
  formatSeriesCardLine,
  slugifySeriesTitle,
} from '@/utils/seriesModel.js'
import { LABEL_EDITOR_BOARD } from '@/constants/roleTerminology.js'
import AddSeriesModal from './AddSeriesModal.jsx'
import { seriesToForm, applySeriesFormUpdate } from '@/utils/seriesModel.js'
import '@/styles/mangaPage.css'

const NAV_LINKS = [
  { to: '/', label: 'Trang chủ' },
  { to: '/mangaka', label: 'Workspace' },
]

const STATUS_BADGE = {
  draft: { label: 'Nháp', className: 'bg-zinc-100 text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-500/15 dark:text-zinc-400' },
  assistant: { label: 'Assistant', className: 'bg-violet-100 text-violet-700 hover:bg-violet-100 dark:bg-violet-500/15 dark:text-violet-400' },
  review: { label: 'Chờ duyệt', className: 'bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-400' },
  tantou: { label: 'Tantou', className: 'bg-sky-100 text-sky-700 hover:bg-sky-100 dark:bg-sky-500/15 dark:text-sky-400' },
  done: { label: 'Hoàn tất', className: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400' },
}

export function seriesPath(series) {
  const slug = series.slug ?? slugifySeriesTitle(series.title)
  return `/mangaka/series/${slug}`
}

function DetailShell({ children, onLogout }) {
  const user = getSession()
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header links={NAV_LINKS} onLogout={user ? onLogout : undefined} />
      <main className="page-container flex-1 py-8">{children}</main>
      <Footer />
    </div>
  )
}

function Breadcrumb({ items }) {
  return (
    <nav className="mb-6 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground" aria-label="Đường dẫn">
      {items.map((item, i) => {
        const isLast = i === items.length - 1
        return (
          <span key={i} className="flex items-center gap-1.5">
            {item.to && !isLast ? (
              <Link to={item.to} className="transition-colors hover:text-foreground">{item.label}</Link>
            ) : (
              <span className={isLast ? 'font-medium text-foreground' : ''}>{item.label}</span>
            )}
            {!isLast ? <ChevronRight className="size-3.5" /> : null}
          </span>
        )
      })}
    </nav>
  )
}

export default function SeriesUploadDetail() {
  const { seriesSlug, chapterId } = useParams()
  const navigate = useNavigate()
  const [series, setSeries] = useState(null)
  const [chapterRows, setChapterRows] = useState([])
  const [annotatorChapters, setAnnotatorChapters] = useState([])
  const [loading, setLoading] = useState(true)
  const [editSeriesOpen, setEditSeriesOpen] = useState(false)
  const [pageStart, setPageStart] = useState(0)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const mine = await seriesService.getMine()
      const list = (Array.isArray(mine) ? mine : []).map((s, i) => apiSeriesToUi(s, i))
      const found = findSeriesByIdOrSlug(list, seriesSlug)
      if (!found) {
        setSeries(null)
        return
      }
      const detail = await seriesService.getById(found.id)
      const uiSeries = apiSeriesToUi({ ...found, ...detail }, 0)
      setSeries(uiSeries)

      const { chapters, seriesName } = await seriesService.getChapters(found.id)
      const title = seriesName || uiSeries.title
      const rows = (Array.isArray(chapters) ? chapters : []).map(ch => apiChapterToRow(ch, title))
      setChapterRows(rows)

      const annotators = await Promise.all(
        rows.map(async (row) => {
          try {
            const pages = await chaptersService.getPages(row.id)
            const ch = (Array.isArray(chapters) ? chapters : []).find(c => (c._id ?? c.id) === row.id)
            return apiChapterToAnnotator(ch ?? row, pages, title)
          } catch {
            return apiChapterToAnnotator(row, [], title)
          }
        }),
      )
      setAnnotatorChapters(annotators)
    } catch (err) {
      console.error(getApiErrorMessage(err))
      setSeries(null)
    } finally {
      setLoading(false)
    }
  }, [seriesSlug])

  useEffect(() => {
    void loadData()
  }, [loadData])

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const activeRow = useMemo(
    () => (chapterId ? chapterRows.find(r => String(r.id) === String(chapterId)) : null),
    [chapterRows, chapterId],
  )

  const activeAnnotator = useMemo(() => {
    if (!activeRow) return null
    return annotatorChapters.find(ch => ch.id === activeRow.id) ?? null
  }, [activeRow, annotatorChapters])

  useEffect(() => { setPageStart(0) }, [chapterId])

  async function handleEditSeriesSubmit(form) {
    if (!series) return
    try {
      await seriesService.update(series.id, uiSeriesFormToApi(form))
      await loadData()
      setEditSeriesOpen(false)
      const updated = applySeriesFormUpdate(series, form)
      const newSlug = updated.slug ?? slugifySeriesTitle(updated.title)
      if (newSlug !== seriesSlug) {
        navigate(`/mangaka/series/${newSlug}`, { replace: true })
      }
    } catch (err) {
      alert(getApiErrorMessage(err, 'Cập nhật series thất bại.'))
    }
  }

  const chapterCards = useMemo(() => chapterRows.map(row => {
    const annot = annotatorChapters.find(ch => ch.id === row.id)
    const cover = annot?.cover?.url
      ? { url: annot.cover.url, name: annot.cover.name ?? 'cover' }
      : annot?.pages?.find(p => p?.url) ?? annot?.pages?.[0]
    const uploaded = annot?.pages?.length ?? row.pages ?? 0
    return { row, annot, cover, uploaded }
  }), [chapterRows, annotatorChapters])

  if (loading) {
    return (
      <DetailShell onLogout={handleLogout}>
        <p className="text-muted-foreground">Đang tải series...</p>
      </DetailShell>
    )
  }

  if (!series) {
    return (
      <DetailShell onLogout={handleLogout}>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Inbox className="size-12 text-muted-foreground/60" />
            <h1 className="text-2xl font-bold">Không tìm thấy truyện</h1>
            <p className="text-muted-foreground">Series không tồn tại hoặc bạn chưa có quyền truy cập.</p>
            <Button asChild>
              <Link to="/mangaka">
                <ArrowLeft className="size-4" />
                Về Mangaka
              </Link>
            </Button>
          </CardContent>
        </Card>
      </DetailShell>
    )
  }

  const slug = series.slug ?? slugifySeriesTitle(series.title)
  const basePath = `/mangaka/series/${slug}`

  if (chapterId && activeRow) {
    const pages = activeAnnotator?.pages ?? []
    const pagesWithMedia = pages.filter(p => p?.url)
    const staleOnly = pages.length > 0 && pagesWithMedia.length === 0
    const progressPct = pages.length > 0 ? Math.min(100, pages.length * 4) : null
    const statusBadge = STATUS_BADGE[activeRow.status] ?? STATUS_BADGE.draft

    const PAGE_LIMIT = 6
    const visiblePages = pagesWithMedia.slice(pageStart, pageStart + PAGE_LIMIT)
    const hasPrev = pageStart > 0
    const hasNext = pageStart + PAGE_LIMIT < pagesWithMedia.length

    const openAnnotate = () => navigate('/mangaka', {
      state: { tab: 'annotate', series: series.title, chapterId: activeRow.id },
    })

    return (
      <DetailShell onLogout={handleLogout}>
        <Breadcrumb items={[
          { to: '/mangaka', label: 'Workspace' },
          { to: basePath, label: series.title },
          { label: `Chapter ${activeRow.num}` },
        ]} />
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>Chapter {activeRow.num}</CardTitle>
                  <CardDescription>{series.title} · {activeRow.date}</CardDescription>
                </div>
                <Badge className={statusBadge.className} variant="secondary">{statusBadge.label}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {staleOnly ? (
                <p className="text-sm text-amber-600">Ảnh chapter chưa tải được — mở Upload & Ghi chú để xem lại.</p>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {visiblePages.length ? visiblePages.map((p, i) => (
                  <div key={p.id ?? i} className="overflow-hidden rounded-lg border bg-muted/30">
                    <img src={p.url} alt={p.name ?? `Trang ${pageStart + i + 1}`} className="aspect-[728/1030] w-full object-cover" />
                  </div>
                )) : (
                  <div className="col-span-full flex flex-col items-center gap-2 py-12 text-muted-foreground">
                    <FileImage className="size-10 opacity-50" />
                    <p className="text-sm">Chưa có trang nào</p>
                  </div>
                )}
              </div>
              {pagesWithMedia.length > PAGE_LIMIT ? (
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm text-muted-foreground">
                    {pageStart + 1}–{Math.min(pageStart + PAGE_LIMIT, pagesWithMedia.length)} / {pagesWithMedia.length} trang
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPageStart(s => s - PAGE_LIMIT)} disabled={!hasPrev}>
                      <ChevronLeft className="size-4" />
                      Trước
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setPageStart(s => s + PAGE_LIMIT)} disabled={!hasNext}>
                      Sau
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              ) : null}
              <Button onClick={openAnnotate}>
                <PenSquare className="size-4" />
                Mở Upload & Ghi chú
              </Button>
            </CardContent>
          </Card>
          <aside className="space-y-4">
            {progressPct != null ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Tiến độ upload</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{pages.length} trang</div>
                </CardContent>
              </Card>
            ) : null}
          </aside>
        </div>
      </DetailShell>
    )
  }

  return (
    <DetailShell onLogout={handleLogout}>
      <Breadcrumb items={[
        { to: '/mangaka', label: 'Workspace' },
        { label: series.title },
      ]} />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{series.title}</h1>
          <p className="mt-1 text-muted-foreground">{formatSeriesCardLine(series)}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditSeriesOpen(true)}>Chỉnh sửa hồ sơ</Button>
          <Button asChild>
            <Link to="/mangaka" state={{ tab: 'annotate', series: series.title }}>
              <Upload className="size-4" />
              Upload chapter
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Danh sách chapter</h2>
          {chapterCards.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <ImageIcon className="mx-auto mb-3 size-10 opacity-40" />
                Chưa có chapter — bấm Upload chapter để bắt đầu.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {chapterCards.map(({ row, cover, uploaded }) => {
                const badge = STATUS_BADGE[row.status] ?? STATUS_BADGE.draft
                return (
                  <Link key={row.id} to={`${basePath}/chapter/${row.id}`} className="group">
                    <Card className="overflow-hidden transition-shadow hover:shadow-md">
                      <div className="aspect-[16/9] bg-muted">
                        {cover?.url ? (
                          <img src={cover.url} alt="" className="size-full object-cover transition-transform group-hover:scale-[1.02]" />
                        ) : (
                          <div className="flex size-full items-center justify-center text-muted-foreground">
                            <ImageIcon className="size-8 opacity-40" />
                          </div>
                        )}
                      </div>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">Ch. {row.num}</span>
                          <Badge className={cn('text-xs', badge.className)} variant="secondary">{badge.label}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{uploaded} trang · {row.date}</p>
                      </CardContent>
                    </Card>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Hồ sơ series</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {series.coverImage ? (
                <div className="overflow-hidden rounded-md">
                  <img
                    src={resolveMediaUrl(series.coverImage)}
                    alt=""
                    className="aspect-[3/4] w-full object-cover"
                  />
                </div>
              ) : null}
              <p className="text-muted-foreground">{series.synopsis || 'Chưa có tóm tắt.'}</p>
              <Separator />
              <dl className="space-y-2">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Thể loại</dt>
                  <dd className="text-right">{series.genres?.join(', ') || '—'}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Đối tượng</dt>
                  <dd>{series.demographic || '—'}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Chapter</dt>
                  <dd>{chapterRows.length}</dd>
                </div>
              </dl>
              {series.needsFullDebutPipeline ? (
                <p className="flex items-center gap-1 text-xs text-amber-600">
                  <Sparkles className="size-3" />
                  Luồng lần đầu · qua {LABEL_EDITOR_BOARD}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </aside>
      </div>

      {editSeriesOpen ? (
        <AddSeriesModal
          open={editSeriesOpen}
          onClose={() => setEditSeriesOpen(false)}
          onSubmit={handleEditSeriesSubmit}
          initialForm={seriesToForm(series)}
          existingTitles={[]}
          excludeTitle={series.title}
          mode="edit"
        />
      ) : null}
    </DetailShell>
  )
}
