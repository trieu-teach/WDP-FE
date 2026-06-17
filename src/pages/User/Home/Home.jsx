import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BookOpen,
  Brush,
  Check,
  ClipboardCheck,
  Layers,
  PenTool,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import Header from '@/components/User/Header/Header.jsx'
import Footer from '@/components/User/Footer/Footer.jsx'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getSession, getRolePath } from '@/lib/auth.js'
import { PATH_EDITOR_BOARD, PATH_TANTOU_EDITOR } from '@/constants/roleTerminology.js'
import { cn } from '@/lib/utils'
import { seriesService } from '@/api/series.service.js'
import { apiRankingToUi } from '@/utils/apiMappers.js'

const NAV_LINKS = [
  { href: '#featured', label: 'Truyện nổi bật' },
  { href: '#features', label: 'Tính năng' },
  { href: '#workflow', label: 'Quy trình' },
]

const FEATURED = [
  { initials: 'OT', gradient: 'from-rose-500 via-red-600 to-red-900', title: 'One Thorn', genre: 'Hành động', chapters: 142, reads: '82.4K', rank: 1, hot: true },
  { initials: 'ĐL', gradient: 'from-amber-400 via-orange-500 to-orange-800', title: 'Đại Lục Huyền', genre: 'Huyền huyễn', chapters: 310, reads: '91K', rank: 2 },
  { initials: 'CK', gradient: 'from-fuchsia-400 via-pink-500 to-purple-800', title: 'Chiến Kỷ Nguyên', genre: 'Sci-fi', chapters: 189, reads: '72K', rank: 3 },
  { initials: 'SK', gradient: 'from-sky-400 via-blue-600 to-indigo-900', title: 'Sắc Không', genre: 'Isekai', chapters: 87, reads: '65K' },
  { initials: 'HT', gradient: 'from-emerald-400 via-teal-500 to-emerald-800', title: 'Hoa Tàn', genre: 'Tình cảm', chapters: 215, reads: '51.2K' },
  { initials: 'MD', gradient: 'from-violet-400 via-purple-600 to-purple-950', title: 'Ma Đạo', genre: 'Kinh dị', chapters: 33, reads: '37K' },
  { initials: 'VL', gradient: 'from-yellow-400 via-orange-500 to-rose-600', title: 'Vô Lượng', genre: 'Hành động', chapters: 56, reads: '28K' },
  { initials: 'TT', gradient: 'from-teal-400 via-emerald-600 to-emerald-900', title: 'Thần Thoại', genre: 'Phiêu lưu', chapters: 98, reads: '44.5K' },
]

const FLOATING_CARDS = [
  { initials: 'OT', gradient: 'from-rose-500 to-red-900', rotate: '-rotate-6', position: 'top-0 left-4', delay: '0s' },
  { initials: 'ĐL', gradient: 'from-amber-400 to-orange-800', rotate: 'rotate-3', position: 'top-16 right-0', delay: '0.6s' },
  { initials: 'CK', gradient: 'from-fuchsia-400 to-purple-800', rotate: '-rotate-3', position: 'bottom-8 left-0', delay: '1.2s' },
  { initials: 'SK', gradient: 'from-sky-400 to-indigo-900', rotate: 'rotate-6', position: 'bottom-0 right-10', delay: '1.8s' },
]

const ROLES = [
  {
    icon: PenTool,
    title: 'Mangaka',
    desc: 'Tạo series, upload chapter, ghi chú vùng cần Assistant hỗ trợ, duyệt bản tổng hợp ngay trên trang.',
    bullets: ['Upload trang 728×1030', 'Annotate vùng giao việc', 'Duyệt layer Assistant'],
    accent: 'from-rose-500/15 to-rose-500/0',
    iconBg: 'bg-rose-500/10 text-rose-600',
  },
  {
    icon: Brush,
    title: 'Assistant',
    desc: 'Nhận draft theo vùng, vẽ layer trong suốt với Fabric.js, gửi bản ghép hoặc PNG đè cho Mangaka.',
    bullets: ['Layer canvas chuyên nghiệp', 'Pencil, brush, fill, eyedropper', 'Gửi overlay hoặc composite'],
    accent: 'from-violet-500/15 to-violet-500/0',
    iconBg: 'bg-violet-500/10 text-violet-600',
  },
  {
    icon: ClipboardCheck,
    title: 'Tantou Editor',
    desc: 'Nhận xét biên tập, chuyển bản debut sang Editor Board hoặc duyệt phát hành chapter lần 2+.',
    bullets: ['Comment biên tập', 'Quyết định gửi EB', 'Duyệt phát hành nhanh'],
    accent: 'from-sky-500/15 to-sky-500/0',
    iconBg: 'bg-sky-500/10 text-sky-600',
  },
  {
    icon: ShieldCheck,
    title: 'Editor Board',
    desc: 'Biểu quyết series lần đầu, quyết định lịch phát hành theo tuần/tháng dựa trên chất lượng & độ nổi.',
    bullets: ['Vote series debut', 'Lịch tuần / tháng', 'Báo cáo chất lượng'],
    accent: 'from-emerald-500/15 to-emerald-500/0',
    iconBg: 'bg-emerald-500/10 text-emerald-600',
  },
]

const STEPS = [
  { step: '01', icon: BookOpen, title: 'Draft', desc: 'Mangaka upload chapter & đánh dấu vùng cần bổ sung cho Assistant.' },
  { step: '02', icon: Layers, title: 'Layer', desc: 'Assistant vẽ layer trong suốt, gửi lại bản tổng hợp.' },
  { step: '03', icon: ClipboardCheck, title: 'Review', desc: 'Tantou Editor nhận xét, chuyển sang Editor Board nếu cần.' },
  { step: '04', icon: Rocket, title: 'Publish', desc: 'Lên lịch phát hành tuần/tháng — chapter ra mắt.' },
]

const STATS = [
  { value: '10+', label: 'Series đang sản xuất', icon: BookOpen },
  { value: '1.2K+', label: 'Chapter đã xuất bản', icon: Layers },
  { value: '4', label: 'Vai trò chuyên biệt', icon: Users },
  { value: '98%', label: 'Hài lòng quy trình', icon: Star },
]

const GENRES = ['Hành động', 'Huyền huyễn', 'Tình cảm', 'Sci-fi', 'Phiêu lưu', 'Kinh dị', 'Isekai', 'Hài hước', 'Học đường']

function rankingToFeaturedCard(item, index) {
  const r = apiRankingToUi(item, index)
  const title = r.title || `Series ${index + 1}`
  const fallback = FEATURED[index % FEATURED.length]
  const reads = r.reads >= 1000 ? `${(r.reads / 1000).toFixed(1)}K` : String(r.reads || '—')
  return {
    initials: title.slice(0, 2).toUpperCase(),
    gradient: fallback?.gradient ?? 'from-violet-400 to-purple-800',
    title,
    genre: fallback?.genre ?? 'Manga',
    chapters: fallback?.chapters ?? 0,
    reads,
    rank: r.rank ?? index + 1,
    hot: index === 0,
  }
}

export default function Home() {
  const user = getSession()
  const workspacePath = user ? getRolePath(user.role) : null
  const [featuredList, setFeaturedList] = useState(FEATURED)

  useEffect(() => {
    seriesService.getRanking({ limit: 8 })
      .then(data => {
        const list = Array.isArray(data) ? data : []
        if (!list.length) return
        setFeaturedList(list.map(rankingToFeaturedCard))
      })
      .catch(() => {
        seriesService.getAll({ limit: 8, sort: 'createdAt', order: 'desc' })
          .then(data => {
            const list = Array.isArray(data) ? data : (data?.data ?? [])
            if (!list.length) return
            setFeaturedList(list.map((item, i) => rankingToFeaturedCard({
              series_name: item.name ?? item.title,
              rank: i + 1,
              reads: item.marks ?? item.view_count ?? 0,
            }, i)))
          })
          .catch(() => {})
      })
  }, [])

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header links={NAV_LINKS} />

      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden border-b">
        <div className="grid-pattern absolute inset-0 mask-fade-y opacity-50" />
        <div className="gradient-mesh absolute inset-0" />

        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -top-24 -left-20 size-96 rounded-full bg-primary/20 blur-3xl animate-blob" />
        <div className="pointer-events-none absolute top-20 -right-20 size-96 rounded-full bg-violet-500/15 blur-3xl animate-blob animation-delay-2000" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 size-96 rounded-full bg-emerald-500/10 blur-3xl animate-blob animation-delay-4000" />

        <div className="page-container relative py-16 md:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
            {/* Left */}
            <div>
              <Badge variant="outline" className="mb-6 gap-2 rounded-full border-primary/30 bg-background/60 px-4 py-1.5 backdrop-blur">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-primary" />
                </span>
                <span className="text-foreground">Nền tảng quản lý manga thế hệ mới</span>
              </Badge>

              <h1 className="text-5xl font-bold tracking-tight text-balance md:text-6xl lg:text-7xl">
                Sáng tạo, cộng tác
                <br />
                <span className="bg-gradient-to-r from-primary via-rose-500 to-orange-500 bg-clip-text text-transparent">
                  xuất bản manga
                </span>
              </h1>

              <p className="mt-6 max-w-xl text-lg text-muted-foreground leading-relaxed text-pretty">
                Kết nối <span className="font-semibold text-foreground">Mangaka</span>,{' '}
                <span className="font-semibold text-foreground">Assistant</span>,{' '}
                <span className="font-semibold text-foreground">Tantou Editor</span> và{' '}
                <span className="font-semibold text-foreground">Editor Board</span> trong một quy trình duy nhất —
                từ bản draft đến chapter xuất bản.
              </p>

              <div className="mt-10 flex flex-wrap items-center gap-3">
                {workspacePath ? (
                  <Button size="lg" className="group h-12 rounded-full px-6 text-base shadow-lg shadow-primary/25" asChild>
                    <Link to={workspacePath}>
                      Vào workspace
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </Button>
                ) : (
                  <>
                    <Button size="lg" className="group h-12 rounded-full px-6 text-base shadow-lg shadow-primary/25" asChild>
                      <Link to="/register">
                        Bắt đầu miễn phí
                        <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                      </Link>
                    </Button>
                    <Button size="lg" variant="outline" className="h-12 rounded-full px-6 text-base" asChild>
                      <Link to="/login">Đăng nhập</Link>
                    </Button>
                  </>
                )}
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>Thử demo:</span>
                {[
                  { to: '/mangaka', label: 'Mangaka' },
                  { to: '/assistant', label: 'Assistant' },
                  { to: PATH_TANTOU_EDITOR, label: 'Tantou' },
                  { to: PATH_EDITOR_BOARD, label: 'Editor Board' },
                ].map(d => (
                  <Link
                    key={d.label}
                    to={d.to}
                    className="rounded-full border border-border/60 bg-background/60 px-3 py-1 font-medium text-foreground backdrop-blur transition-colors hover:border-primary hover:text-primary"
                  >
                    {d.label}
                  </Link>
                ))}
              </div>

              {/* Avatars row */}
              <div className="mt-10 flex items-center gap-4">
                <div className="flex -space-x-3">
                  {['from-rose-400 to-red-700', 'from-violet-400 to-purple-700', 'from-sky-400 to-blue-700', 'from-emerald-400 to-teal-700'].map((g, i) => (
                    <div key={i} className={cn('flex size-9 items-center justify-center rounded-full border-2 border-background bg-gradient-to-br text-xs font-bold text-white shadow', g)}>
                      {['M', 'A', 'T', 'E'][i]}
                    </div>
                  ))}
                </div>
                <div className="text-sm">
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="size-3.5 fill-amber-400 text-amber-400" />
                    ))}
                    <span className="ml-1 font-semibold">4.9</span>
                  </div>
                  <p className="text-muted-foreground">Đánh giá từ đội ngũ creator</p>
                </div>
              </div>
            </div>

            {/* Right: Floating manga covers */}
            <div className="relative hidden h-[520px] lg:block">
              <div className="absolute inset-0">
                {FLOATING_CARDS.map((c, i) => (
                  <div
                    key={i}
                    className={cn('absolute size-56 animate-float-slow', c.position, c.rotate)}
                    style={{ animationDelay: c.delay }}
                  >
                    <div className={cn('relative size-full overflow-hidden rounded-3xl bg-gradient-to-br p-5 shadow-2xl ring-1 ring-white/10', c.gradient)}>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                      <div className="relative flex h-full flex-col justify-between text-white">
                        <Badge variant="secondary" className="w-fit bg-white/20 text-white backdrop-blur-sm hover:bg-white/25">
                          #{i + 1} HOT
                        </Badge>
                        <div>
                          <span className="text-6xl font-black drop-shadow-lg">{c.initials}</span>
                          <p className="mt-2 text-sm font-medium opacity-90">Volume {i + 12}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Center medallion */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                  <div className="relative size-32 rounded-full bg-background shadow-2xl ring-1 ring-border">
                    <div className="absolute inset-2 flex items-center justify-center rounded-full bg-gradient-to-br from-primary to-rose-500 text-white">
                      <Sparkles className="size-12" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-16 grid gap-4 border-t pt-10 sm:grid-cols-2 lg:grid-cols-4">
            {STATS.map(s => (
              <div key={s.label} className="flex items-center gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <s.icon className="size-5" />
                </div>
                <div>
                  <div className="text-2xl font-bold tracking-tight">{s.value}</div>
                  <div className="text-sm text-muted-foreground">{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== GENRE MARQUEE ===== */}
      <section className="border-b bg-muted/30 py-6">
        <div className="page-container">
          <div className="flex items-center gap-4">
            <span className="shrink-0 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Thể loại
            </span>
            <div className="mask-fade-x overflow-hidden">
              <div className="flex animate-marquee gap-3 whitespace-nowrap">
                {[...GENRES, ...GENRES].map((g, i) => (
                  <Badge key={i} variant="outline" className="rounded-full px-4 py-1.5 text-sm font-medium">
                    {g}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FEATURED ===== */}
      <section id="featured" className="page-container py-20 md:py-24">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Badge variant="outline" className="mb-3 rounded-full">Thư viện</Badge>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Truyện nổi bật tuần này</h2>
            <p className="mt-2 text-muted-foreground">Series được đọc và bàn luận nhiều nhất trên MangaHub</p>
          </div>
          <Button variant="ghost" className="group gap-1" asChild>
            <Link to="/">
              Xem tất cả
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {featuredList.map(m => (
            <Card
              key={m.title}
              className="group cursor-pointer gap-0 overflow-hidden border-0 bg-card p-0 shadow-md transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary/10"
            >
              <div className={cn('relative aspect-[3/4] overflow-hidden bg-gradient-to-br', m.gradient)}>
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                {m.rank ? (
                  <Badge className="absolute right-3 top-3 gap-1 bg-black/40 text-white backdrop-blur-md hover:bg-black/50">
                    <Star className="size-3 fill-amber-400 text-amber-400" />
                    #{m.rank}
                  </Badge>
                ) : null}
                {m.hot ? (
                  <Badge className="absolute left-3 top-3 bg-primary text-primary-foreground">🔥 HOT</Badge>
                ) : null}

                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-7xl font-black text-white/95 drop-shadow-xl transition-transform duration-500 group-hover:scale-110">
                    {m.initials}
                  </span>
                </div>

                <div className="absolute bottom-3 left-3 right-3 text-white">
                  <p className="text-xs font-medium opacity-80">{m.genre}</p>
                  <h3 className="text-lg font-bold leading-tight">{m.title}</h3>
                </div>
              </div>
              <div className="flex items-center justify-between px-4 py-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Layers className="size-3.5" />
                  {m.chapters} ch
                </span>
                <span className="flex items-center gap-1.5">
                  <TrendingUp className="size-3.5" />
                  {m.reads}
                </span>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* ===== ROLES / FEATURES ===== */}
      <section id="features" className="relative border-y bg-gradient-to-b from-muted/40 via-background to-muted/40 py-20 md:py-24">
        <div className="page-container">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <Badge variant="outline" className="mb-3 rounded-full">Vai trò</Badge>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Một quy trình. <span className="text-primary">Bốn vai trò.</span>
            </h2>
            <p className="mt-3 text-muted-foreground text-pretty">
              Mỗi vai trò có không gian làm việc riêng — phối hợp liền mạch để xuất bản chapter chất lượng.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {ROLES.map(r => (
              <Card
                key={r.title}
                className="group relative overflow-hidden border-border/50 bg-card transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl"
              >
                <div className={cn('absolute inset-x-0 top-0 h-32 bg-gradient-to-b opacity-60 transition-opacity group-hover:opacity-100', r.accent)} />
                <CardHeader className="relative">
                  <div className={cn('mb-3 flex size-12 items-center justify-center rounded-2xl shadow-sm ring-1 ring-border/50', r.iconBg)}>
                    <r.icon className="size-6" />
                  </div>
                  <CardTitle className="text-xl">{r.title}</CardTitle>
                  <CardDescription className="leading-relaxed">{r.desc}</CardDescription>
                </CardHeader>
                <CardContent className="relative space-y-2 text-sm">
                  {r.bullets.map(b => (
                    <div key={b} className="flex items-start gap-2 text-muted-foreground">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span>{b}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Highlights row */}
          <div className="mt-16 grid gap-6 lg:grid-cols-3">
            {[
              { icon: Zap, title: 'Canvas chuyên nghiệp', desc: 'Fabric.js, layer trong suốt, undo/redo, eyedropper.' },
              { icon: TrendingUp, title: 'Thống kê real-time', desc: 'Lượt đọc, xếp hạng, cảnh báo series at-risk.' },
              { icon: ShieldCheck, title: 'Phân quyền chặt', desc: 'Mỗi email gắn một vai trò — không tự đổi.' },
            ].map(h => (
              <div key={h.title} className="flex gap-4 rounded-2xl border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-md">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <h.icon className="size-5" />
                </div>
                <div>
                  <h3 className="font-semibold">{h.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{h.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== WORKFLOW ===== */}
      <section id="workflow" className="page-container py-20 md:py-24">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <Badge variant="outline" className="mb-3 rounded-full">Quy trình</Badge>
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Từ ý tưởng đến xuất bản</h2>
          <p className="mt-3 text-muted-foreground">4 bước rõ ràng — không vướng email, không lạc bản thảo.</p>
        </div>

        <div className="relative grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Connecting line */}
          <div className="pointer-events-none absolute left-0 right-0 top-12 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent lg:block" />

          {STEPS.map((s, i) => (
            <div key={s.step} className="relative">
              <Card className="relative h-full overflow-hidden transition-all hover:-translate-y-1 hover:shadow-xl">
                <CardHeader>
                  <div className="mb-3 flex items-center justify-between">
                    <div className="relative flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
                      <s.icon className="size-5" />
                    </div>
                    <span className="text-5xl font-black tracking-tighter text-primary/10">{s.step}</span>
                  </div>
                  <CardTitle>{s.title}</CardTitle>
                  <CardDescription className="leading-relaxed">{s.desc}</CardDescription>
                </CardHeader>
              </Card>
              {i < STEPS.length - 1 ? (
                <ArrowRight className="absolute -right-3 top-1/2 hidden size-5 -translate-y-1/2 text-muted-foreground/40 lg:block" />
              ) : null}
            </div>
          ))}
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="relative overflow-hidden border-t bg-zinc-950 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,oklch(0.577_0.245_27.325_/_0.35),transparent)]" />
        <div className="grid-pattern absolute inset-0 mask-fade-y opacity-10" />

        <div className="pointer-events-none absolute -bottom-32 left-1/4 size-96 rounded-full bg-primary/30 blur-3xl" />
        <div className="pointer-events-none absolute -top-32 right-1/4 size-96 rounded-full bg-violet-500/20 blur-3xl" />

        <div className="page-container relative py-20 md:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="secondary" className="mb-6 rounded-full bg-white/10 text-white hover:bg-white/15">
              🚀 Tham gia hôm nay
            </Badge>
            <h2 className="text-4xl font-bold tracking-tight text-balance md:text-5xl lg:text-6xl">
              Sẵn sàng tạo nên bộ truyện
              <span className="bg-gradient-to-r from-rose-400 via-orange-300 to-amber-300 bg-clip-text text-transparent"> ăn khách tiếp theo?</span>
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg text-zinc-400 text-pretty">
              Đăng ký Mangaka hoặc Assistant ngay — Tantou Editor và Editor Board do Admin cấp tài khoản.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Button size="lg" className="group h-12 rounded-full bg-white px-6 text-base text-zinc-950 shadow-xl hover:bg-zinc-100" asChild>
                <Link to="/register">
                  Tạo tài khoản miễn phí
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="h-12 rounded-full border-white/20 bg-transparent px-6 text-base text-white hover:bg-white/10 hover:text-white" asChild>
                <Link to="/login">Đã có tài khoản</Link>
              </Button>
            </div>
            <p className="mt-6 text-sm text-zinc-500">
              Không cần thẻ tín dụng · Demo workspace mở sẵn tại{' '}
              <Link to="/mangaka" className="font-medium text-white underline-offset-4 hover:underline">/mangaka</Link>
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
