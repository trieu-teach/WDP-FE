import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  BookOpen,
  Calendar,
  FileText,
  History,
  Sparkles,
} from 'lucide-react'
import Header from '@/components/User/Header/Header.jsx'
import Footer from '@/components/User/Footer/Footer.jsx'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import {
  flattenTePendingSections,
  isTeChapterLevelSubmission,
  isTeSeriesLevelSubmission,
  mapTePendingChapterToSubmission,
  parseTePendingResponse,
} from '@/utils/teReviewPending.js'
import { listTantouReviewHistory } from '@/utils/tantouWorkspaceStorage.js'
import './TantouEditor.css'

const NAV_LINKS = [
  { to: '/', label: 'Trang chủ' },
]

const HERO_IMAGES = [
  '/images/editor1.png',
  '/images/editor2.png',
  '/images/editor3.png',
]
const HERO_SLIDE_MS = 5000

const SECTION_ICONS = {
  sparkles: Sparkles,
  file: FileText,
  book: BookOpen,
  history: History,
  calendar: Calendar,
}

export default function TantouHub() {
  const navigate = useNavigate()
  const user = getSession()
  const [heroSlide, setHeroSlide] = useState(0)
  const [counts, setCounts] = useState({
    'series-pending': null,
    'series-approved': null,
    history: listTantouReviewHistory().length,
  })

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
      try {
        const raw = await teReviewsService.getPending()
        if (cancelled) return
        const parsed = parseTePendingResponse(raw)
        const flat = flattenTePendingSections(parsed)
        const mapped = flat.map(({ chapter, series, tabType }) =>
          mapTePendingChapterToSubmission(chapter, series, tabType, null),
        )
        const pending = mapped.filter((s) => isTeSeriesLevelSubmission(s)).length
        const approved = mapped.filter(
          (s) =>
            isTeChapterLevelSubmission(s)
            && (s.status === 'pending' || s.status === 'revision'),
        ).length
        setCounts((prev) => ({
          ...prev,
          'series-pending':
            pending || parsed?.seriesLevel?.count || 0,
          'series-approved':
            approved || parsed?.chapterLevel?.count || 0,
          history: listTantouReviewHistory().length,
        }))
      } catch {
        if (!cancelled) {
          setCounts((prev) => ({
            ...prev,
            'series-pending': 0,
            'series-approved': 0,
          }))
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="ws-page--tantou flex min-h-screen flex-col bg-background">
      <Header links={NAV_LINKS} onLogout={user ? handleLogout : undefined} />

      <section className="ws-hero--tantou te-hero-slideshow relative overflow-hidden border-b border-white/5 text-white">
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
        <div className="te-hero-slides__veil" aria-hidden />
        <div className="page-container relative py-10 md:py-14">
          <div className="max-w-2xl space-y-3">
            <Badge variant="secondary" className="bg-white/10 text-white hover:bg-white/15">
              {LABEL_TANTOU_EDITOR}
            </Badge>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              {`Xin chào${user?.name ? `, ${user.name}` : ''}`}
            </h1>
            <p className="leading-relaxed text-zinc-300">
              {`Nhận bản thảo từ Mangaka · viết nhận xét · chuyển ${LABEL_EDITOR_BOARD} hoặc duyệt phát hành.`}
            </p>
          </div>
        </div>
      </section>

      <main className="page-container flex-1 space-y-6 py-8">
        <div>
          <h2 className="text-xl font-semibold">Khu vực làm việc</h2>
          <p className="text-sm text-muted-foreground">
            Chọn một mục để mở trang làm việc tương ứng.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {TANTOU_SECTIONS.map((section) => {
            const Icon = SECTION_ICONS[section.icon] ?? FileText
            const count = counts[section.id]
            return (
              <Link
                key={section.id}
                to={`${PATH_TANTOU_EDITOR}/${section.id}`}
                className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Card className="flex h-full flex-col gap-0 py-0 transition-colors group-hover:border-primary/40 group-hover:bg-muted/30">
                  <CardHeader className="flex flex-1 flex-col gap-2 pb-3 pt-5">
                    <div className="mb-1 flex size-10 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400">
                      <Icon className="size-5" />
                    </div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      {section.title}
                      {typeof count === 'number' ? (
                        <Badge variant="secondary" className="font-normal">
                          {count}
                        </Badge>
                      ) : null}
                    </CardTitle>
                    <CardDescription className="min-h-[2.75rem] leading-relaxed">
                      {section.description?.trim() || '\u00A0'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="mt-auto border-t border-border/50 px-6 py-3">
                    <span className="text-sm font-medium text-primary group-hover:underline">
                      Mở trang →
                    </span>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          <Link to={PATH_EDITOR_BOARD} className="underline-offset-4 hover:underline">
            Mở {LABEL_EDITOR_BOARD}
          </Link>
          {' · '}
          <Link to={PATH_TANTOU_EDITOR} className="underline-offset-4 hover:underline">
            Làm mới hub
          </Link>
        </p>
      </main>

      <Footer />
    </div>
  )
}
