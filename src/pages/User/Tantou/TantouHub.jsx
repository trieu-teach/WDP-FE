import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  ClipboardList,
  FileText,
  History,
  Inbox,
  Sparkles,
} from 'lucide-react'
import Header from '@/components/User/Header/Header.jsx'
import Footer from '@/components/User/Footer/Footer.jsx'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getSession, logout } from '@/lib/auth.js'
import { cn } from '@/lib/utils'
import { teReviewsService } from '@/api/teReviews.service.js'
import {
  LABEL_EDITOR_BOARD,
  LABEL_TANTOU_EDITOR,
  PATH_EDITOR_BOARD,
  PATH_TANTOU_EDITOR,
} from '@/constants/roleTerminology.js'
import { TANTOU_SECTIONS } from '@/constants/tantouSections.js'
import { TANTOU_NAV_LINKS } from '@/constants/tantouNav.js'
import {
  flattenTePendingSections,
  isTeChapterLevelSubmission,
  isTeSeriesLevelSubmission,
  mapTePendingChapterToSubmission,
  parseTePendingResponse,
  sortTePendingSubmissionsNewestFirst,
} from '@/utils/teReviewPending.js'
import { mapTeReviewHistoryResponse } from '@/utils/teReviewHistoryMappers.js'
import './TantouEditor.css'

const NAV_LINKS = TANTOU_NAV_LINKS

const HERO_IMAGES = [
  '/images/editor1.png',
  '/images/editor2.png',
  '/images/editor3.png',
]
const HERO_SLIDE_MS = 5000
const URGENT_LIST_LIMIT = 8

const SECTION_ICONS = {
  sparkles: Sparkles,
  file: FileText,
  book: BookOpen,
  history: History,
  calendar: Calendar,
}

const SECTION_ICON_TONE = {
  sparkles: 'bg-indigo-50 text-indigo-600',
  file: 'bg-sky-50 text-sky-600',
  book: 'bg-emerald-50 text-emerald-600',
  history: 'bg-amber-50 text-amber-600',
  calendar: 'bg-violet-50 text-violet-600',
}

const SECTION_STAT_LABEL = {
  'series-pending': 'Chưa duyệt',
  'series-approved': 'Đã duyệt',
  'publication-status': 'Trạng thái PH',
  history: 'Lịch sử',
  schedule: 'Lịch PH',
}

function statusChip(status) {
  if (status === 'revision') {
    return { label: 'Cần sửa', className: 'bg-amber-50 text-amber-700' }
  }
  if (status === 'pending') {
    return { label: 'Chờ duyệt', className: 'bg-sky-50 text-sky-700' }
  }
  return { label: status || 'Đang chờ', className: 'bg-gray-100 text-gray-600' }
}

function targetSectionForItem(item) {
  if (isTeSeriesLevelSubmission(item)) return 'series-pending'
  return 'series-approved'
}

export default function TantouHub() {
  const navigate = useNavigate()
  const user = getSession()
  const [heroSlide, setHeroSlide] = useState(0)
  const [loading, setLoading] = useState(true)
  const [counts, setCounts] = useState({
    'series-pending': null,
    'series-approved': null,
    history: null,
  })
  const [pendingItems, setPendingItems] = useState([])

  useEffect(() => {
    if (HERO_IMAGES.length < 2) return undefined
    const timer = window.setInterval(() => {
      setHeroSlide((index) => (index + 1) % HERO_IMAGES.length)
    }, HERO_SLIDE_MS)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const [pendingResult, historyResult] = await Promise.allSettled([
        teReviewsService.getPending(),
        teReviewsService.getHistory({ page: 1, limit: 1 }),
      ])
      if (cancelled) return

      let seriesPending = 0
      let seriesApproved = 0
      let urgent = []
      if (pendingResult.status === 'fulfilled') {
        const parsed = parseTePendingResponse(pendingResult.value)
        const flat = flattenTePendingSections(parsed)
        const mapped = flat.map(({ chapter, series, tabType }) =>
          mapTePendingChapterToSubmission(chapter, series, tabType, null),
        )
        const seriesLevel = mapped.filter((s) => isTeSeriesLevelSubmission(s))
        const chapterLevel = mapped.filter(
          (s) =>
            isTeChapterLevelSubmission(s)
            && (s.status === 'pending' || s.status === 'revision'),
        )
        seriesPending = seriesLevel.length || parsed?.seriesLevel?.count || 0
        seriesApproved = chapterLevel.length || parsed?.chapterLevel?.count || 0
        urgent = sortTePendingSubmissionsNewestFirst([
          ...seriesLevel,
          ...chapterLevel,
        ])
      }

      let historyTotal = 0
      if (historyResult.status === 'fulfilled') {
        historyTotal = mapTeReviewHistoryResponse(historyResult.value).pagination.total
      }

      setCounts({
        'series-pending': seriesPending,
        'series-approved': seriesApproved,
        history: historyTotal,
      })
      setPendingItems(urgent)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const urgentPreview = useMemo(
    () => pendingItems.slice(0, URGENT_LIST_LIMIT),
    [pendingItems],
  )

  const totalUrgent =
    (typeof counts['series-pending'] === 'number' ? counts['series-pending'] : 0)
    + (typeof counts['series-approved'] === 'number' ? counts['series-approved'] : 0)

  function handleLogout() {
    logout()
    navigate('/login')
  }

  function openSection(sectionId) {
    navigate(`${PATH_TANTOU_EDITOR}/${sectionId}`)
  }

  return (
    <div className="ws-page--tantou flex min-h-screen flex-col bg-gray-50">
      <Header links={NAV_LINKS} onLogout={user ? handleLogout : undefined} />

      {/* Hero + overlapping metrics (matches dashboard mock) */}
      <section className="ws-hero--tantou te-hero-slideshow te-hero-hub relative overflow-hidden text-white">
        <div className="te-hero-slides" aria-hidden>
          {HERO_IMAGES.map((src, index) => (
            <img
              key={src}
              src={src}
              alt=""
              className={cn(
                'te-hero-slides__img',
                index === heroSlide && 'te-hero-slides__img--active',
              )}
            />
          ))}
        </div>
        <div className="absolute inset-0 z-[1] bg-black/55" aria-hidden />

        <div className="page-container relative z-[2] pb-0 pt-8 md:pt-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="te-hero-greeting max-w-xl space-y-2">
              <span className="inline-flex rounded-full bg-black/35 px-3 py-1 text-[11px] font-medium tracking-wide text-white/90 backdrop-blur-sm">
                {LABEL_TANTOU_EDITOR} · Dashboard
              </span>
              <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
                {`Xin chào${user?.name ? `, ${user.name}` : ''}`}
              </h1>
              <p className="max-w-md text-sm leading-relaxed text-white/85 md:text-[15px]">
                Tổng quan công việc duyệt — ưu tiên xử lý hàng chờ bên dưới.
              </p>
            </div>

            <div className="rounded-2xl border border-white/20 bg-black/45 px-5 py-3.5 shadow-lg backdrop-blur-md">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/65">
                Cần xử lý
              </p>
              <p className="mt-0.5 text-2xl font-bold tabular-nums text-white md:text-3xl">
                {loading ? '…' : `${totalUrgent} mục`}
              </p>
            </div>
          </div>

          <div className="mt-8 md:mt-10">
            <h2 className="text-base font-semibold text-white md:text-lg">
              Chỉ số nhanh
            </h2>
            <p className="mt-0.5 text-xs text-white/70 md:text-sm">
              Bấm vào thẻ để mở trang làm việc tương ứng.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-5">
              {TANTOU_SECTIONS.map((section) => {
                const Icon = SECTION_ICONS[section.icon] ?? FileText
                const iconTone = SECTION_ICON_TONE[section.icon] ?? SECTION_ICON_TONE.sparkles
                const count = counts[section.id]
                const hasCount = typeof count === 'number'
                const showLoadingCount =
                  loading
                  && (section.id === 'series-pending'
                    || section.id === 'series-approved'
                    || section.id === 'history')
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => openSection(section.id)}
                    className={cn(
                      'te-metric-card group flex cursor-pointer flex-col justify-between rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-sm',
                      'antialiased [text-rendering:optimizeLegibility]',
                      'transition-all duration-150 hover:border-gray-200 hover:shadow-md',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30',
                    )}
                  >
                    <div>
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <div
                          className={cn(
                            'flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50 text-gray-700',
                            iconTone,
                          )}
                        >
                          <Icon className="size-4" />
                        </div>
                        {showLoadingCount ? (
                          <span className="text-lg font-medium text-gray-400">…</span>
                        ) : hasCount ? (
                          <span className="text-2xl font-bold tabular-nums text-gray-900">
                            {count}
                          </span>
                        ) : (
                          <span className="text-lg font-medium text-gray-400">—</span>
                        )}
                      </div>
                      <p className="mb-1 text-sm font-semibold text-gray-900">
                        {SECTION_STAT_LABEL[section.id] ?? section.navLabel ?? section.title}
                      </p>
                      <p className="min-h-[32px] line-clamp-2 text-xs font-normal leading-relaxed text-gray-600">
                        {section.description}
                      </p>
                    </div>
                    <span className="mt-3 flex items-center gap-1 text-xs font-medium text-gray-500 transition-colors group-hover:text-gray-900">
                      Mở
                      <ArrowRight className="size-3.5" />
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      <main className="page-container flex-1 space-y-6 py-8 md:py-10">
        {/* Pending / recent activity */}
        <section className="rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <ClipboardList className="size-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  Việc cần duyệt gấp
                </h2>
                <p className="text-xs text-gray-500">
                  Series / chapter đang chờ xử lý từ hàng duyệt.
                </p>
              </div>
            </div>
            {totalUrgent > 0 ? (
              <Badge className="rounded-full border-0 bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700 hover:bg-red-50">
                {totalUrgent} mục
              </Badge>
            ) : null}
          </div>

          <div className="px-2 py-2 sm:px-3 sm:py-3">
            {loading ? (
              <div className="space-y-2 p-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-14 animate-pulse rounded-xl bg-gray-100"
                  />
                ))}
              </div>
            ) : urgentPreview.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
                <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="size-7" />
                </div>
                <p className="text-sm font-semibold text-gray-900">
                  Không có việc cần duyệt gấp
                </p>
                <p className="mt-1 max-w-sm text-xs leading-relaxed text-gray-500">
                  Hàng chờ đang trống. Bạn có thể xem lịch sử duyệt hoặc lịch phát hành từ thanh chỉ số phía trên.
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-lg text-xs"
                    onClick={() => openSection('history')}
                  >
                    <History className="size-3.5" />
                    Lịch sử duyệt
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-lg text-xs"
                    onClick={() => openSection('schedule')}
                  >
                    <Calendar className="size-3.5" />
                    Lịch phát hành
                  </Button>
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {urgentPreview.map((item) => {
                  const sectionId = targetSectionForItem(item)
                  const chip = statusChip(item.status)
                  const isSeries = isTeSeriesLevelSubmission(item)
                  return (
                    <li
                      key={`${sectionId}-${item.id}`}
                      className="flex flex-wrap items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-gray-50/80 sm:flex-nowrap"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div
                          className={cn(
                            'flex size-10 shrink-0 items-center justify-center rounded-xl',
                            isSeries
                              ? 'bg-indigo-50 text-indigo-600'
                              : 'bg-sky-50 text-sky-600',
                          )}
                        >
                          {isSeries ? (
                            <Sparkles className="size-4" />
                          ) : (
                            <FileText className="size-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gray-900">
                            {item.seriesTitle}
                            {!isSeries && item.chapterNum
                              ? ` · Ch.${item.chapterNum}`
                              : ''}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-gray-500">
                            {item.mangakaName
                              ? `Mangaka: ${item.mangakaName}`
                              : isSeries
                                ? 'Series chờ duyệt'
                                : 'Chapter chờ duyệt'}
                            {item.chapterTitle ? ` · ${item.chapterTitle}` : ''}
                          </p>
                        </div>
                      </div>
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                          isSeries
                            ? 'bg-sky-50 text-sky-700'
                            : chip.className,
                        )}
                      >
                        {isSeries ? 'Series mới' : chip.label}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 shrink-0 rounded-lg bg-red-600 px-3 text-xs font-medium text-white hover:bg-red-700"
                        onClick={() => openSection(sectionId)}
                      >
                        Duyệt ngay
                        <ArrowRight className="size-3.5" />
                      </Button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {!loading && urgentPreview.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-5 py-3">
              <p className="text-xs text-gray-500">
                {pendingItems.length > URGENT_LIST_LIMIT
                  ? `Hiển thị ${URGENT_LIST_LIMIT}/${pendingItems.length} mục mới nhất.`
                  : 'Dùng navbar hoặc chỉ số nhanh để chuyển khu vực.'}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-gray-600"
                  onClick={() => openSection('series-pending')}
                >
                  Series chưa duyệt
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-gray-600"
                  onClick={() => openSection('series-approved')}
                >
                  Series đã duyệt
                </Button>
              </div>
            </div>
          ) : null}
        </section>

        <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-xs text-gray-500">
          <Link
            to={PATH_EDITOR_BOARD}
            className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
          >
            <Inbox className="size-3.5" />
            Mở {LABEL_EDITOR_BOARD}
          </Link>
          <span className="text-gray-300">·</span>
          <button
            type="button"
            className="underline-offset-4 hover:underline"
            onClick={() => window.location.reload()}
          >
            Làm mới dashboard
          </button>
        </p>
      </main>

      <Footer />
    </div>
  )
}
