import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Brush,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Layers,
  PenTool,
  Sparkles,
} from 'lucide-react'
import Footer from '@/components/User/Footer/Footer.jsx'
import Header from '@/components/User/Header/Header.jsx'
import { WelcomeBackPill } from '@/components/layout/WelcomeBackPill.jsx'
import { LoginRequiredDialog } from '@/components/auth/LoginRequiredDialog.jsx'
import { getRolePath, logout, ROLES } from '@/lib/auth.js'
import { useLoginRequired } from '@/hooks/useLoginRequired.js'
import {
  LABEL_EDITOR_BOARD,
  LABEL_TANTOU_EDITOR,
  PATH_EDITOR_BOARD,
  PATH_TANTOU_EDITOR,
} from '@/constants/roleTerminology.js'
import { MANGAKA_NAV_LINKS } from '@/constants/mangakaNav.js'
import { ASSISTANT_NAV_LINKS } from '@/constants/assistantNav.js'
import { TANTOU_NAV_LINKS } from '@/constants/tantouNav.js'
import { EB_NAV_LINKS } from '@/constants/ebNav.js'
import { cn } from '@/lib/utils'
import './Home.css'

const HOME_PUBLIC_NAV_LINKS = [
  { to: '/', label: 'Trang chủ' },
  { href: '#pipeline', label: 'Quy trình' },
  { href: '#welcome', label: 'Giới thiệu' },
  { href: '#why', label: 'Tính năng' },
]

const HERO_SLIDES = [
  {
    image: '/images/home2.png',
    objectPosition: 'center 35%',
    badge: 'Nền tảng manga',
    title: 'Khám phá & xuất bản manga dễ dàng',
    desc: 'Kết nối Mangaka, Assistant, Tantou Editor và Editor Board trong một quy trình thống nhất.',
    cta: '/register',
    ctaLabel: 'Bắt đầu ngay',
  },
  {
    image: '/images/home6.png',
    objectPosition: 'center 28%',
    badge: 'Mangaka Studio',
    title: 'Từ sketch đến chapter hoàn chỉnh',
    desc: 'Upload trang, ghi chú vùng và duyệt bản tổng hợp ngay trên workspace.',
    cta: '/mangaka',
    ctaLabel: 'Vào Mangaka',
  },
  {
    image: '/images/home4.png',
    /* Đẩy khung nhìn lên để hiện đủ đầu nhân vật */
    objectPosition: 'center 12%',
    badge: 'Editorial',
    title: 'Quy trình biên tập chuyên nghiệp',
    desc: 'Tantou Editor nhận xét, chuyển debut sang Editor Board và lên lịch phát hành.',
    cta: PATH_TANTOU_EDITOR,
    ctaLabel: 'Xem quy trình',
  },
  {
    image: '/images/home5.png',
    objectPosition: 'center 30%',
    badge: LABEL_EDITOR_BOARD,
    title: 'Chấm điểm & xác nhận phát hành',
    desc: 'Editor Board đánh giá debut series, duyệt chapter và chốt lịch lên sóng.',
    cta: PATH_EDITOR_BOARD,
    ctaLabel: `Vào ${LABEL_EDITOR_BOARD}`,
  },
]

const WHY_CARDS = [
  {
    title: 'Mangaka Studio',
    desc: 'Tạo series, upload chapter và giao việc cho Assistant theo từng vùng trang.',
    to: '/mangaka',
    label: 'Khám phá',
    icon: PenTool,
    image: '/images/home-mangaka-studio.png',
  },
  {
    title: 'Assistant Layer',
    desc: 'Vẽ layer trong suốt với canvas chuyên nghiệp và gửi bản ghép cho Mangaka.',
    to: '/assistant',
    label: 'Khám phá',
    icon: Brush,
    image: '/images/home-assistant-layer.png',
  },
  {
    title: 'Tantou Editor',
    desc: 'Nhận bản thảo từ Mangaka, ghi chú biên tập trên từng trang và chuyển series/chapter sang Editor Board.',
    to: PATH_TANTOU_EDITOR,
    label: 'Khám phá',
    icon: Layers,
    image: '/images/home-tantou-editor.png',
  },
  {
    title: 'Editorial Pipeline',
    desc: 'Editor Board chấm điểm debut series, duyệt chapter lần 2+ và xác nhận lịch phát hành.',
    to: PATH_EDITOR_BOARD,
    label: 'Khám phá',
    icon: ClipboardCheck,
    image: '/images/home-editorial-pipeline.png',
  },
]

const WORKFLOW_STEPS = [
  {
    step: 1,
    title: 'Upload chapter',
    role: 'Mangaka',
    desc: 'Tạo series, upload trang và ghi chú vùng cần Assistant xử lý.',
    to: '/mangaka',
    icon: PenTool,
  },
  {
    step: 2,
    title: 'Vẽ layer',
    role: 'Assistant',
    desc: 'Nhận task, vẽ layer trong suốt và gửi bản ghép về Mangaka.',
    to: '/assistant',
    icon: Brush,
  },
  {
    step: 3,
    title: 'Duyệt bản ghép',
    role: 'Mangaka',
    desc: 'Xem composite, chỉnh sửa và phê duyệt chapter hoàn chỉnh.',
    to: '/mangaka',
    icon: ClipboardCheck,
  },
  {
    step: 4,
    title: 'Biên tập',
    role: LABEL_TANTOU_EDITOR,
    desc: 'Nhận xét trên từng trang, gửi debut hoặc chapter sang Editor Board.',
    to: PATH_TANTOU_EDITOR,
    icon: Layers,
  },
  {
    step: 5,
    title: 'Xuất bản',
    role: LABEL_EDITOR_BOARD,
    desc: 'Chấm điểm hội đồng, duyệt phát hành và lên lịch public.',
    to: PATH_EDITOR_BOARD,
    icon: Sparkles,
  },
]

function HomeAuthLink({ to, className, children, guardClick }) {
  return (
    <Link
      to={to}
      className={className}
      onClick={(e) => guardClick(to, e)}
    >
      {children}
    </Link>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const {
    user,
    open: loginOpen,
    setOpen: setLoginOpen,
    guardClick,
    goLogin,
    requireLogin,
    pendingPath,
  } = useLoginRequired()
  const workspacePath = user ? getRolePath(user.role) : null
  const [heroIndex, setHeroIndex] = useState(0)

  const homeNavLinks = useMemo(() => {
    if (user?.role === ROLES.MANGAKA) return MANGAKA_NAV_LINKS
    if (user?.role === ROLES.ASSISTANT) return ASSISTANT_NAV_LINKS
    if (user?.role === 'editor') return TANTOU_NAV_LINKS
    if (user?.role === 'eb') return EB_NAV_LINKS
    return HOME_PUBLIC_NAV_LINKS
  }, [user?.role])

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const heroSlides = useMemo(() => {
    if (!workspacePath) return HERO_SLIDES
    return HERO_SLIDES.map((slide, i) =>
      i === 0
        ? { ...slide, cta: workspacePath, ctaLabel: 'Vào workspace' }
        : slide,
    )
  }, [workspacePath])

  const activeHero = heroSlides[heroIndex] ?? heroSlides[0]

  const nextHero = useCallback(() => {
    setHeroIndex((i) => (i + 1) % heroSlides.length)
  }, [heroSlides.length])

  useEffect(() => {
    if (heroSlides.length <= 1) return undefined
    const timer = window.setInterval(nextHero, 6000)
    return () => window.clearInterval(timer)
  }, [heroSlides.length, nextHero])

  return (
    <div className="home">
      <WelcomeBackPill />
      <Header
        links={homeNavLinks}
        onLogout={user ? handleLogout : undefined}
      />
      <div className="home-shell">
        <section className="home-hero">
          <div className="home-hero__media">
            <img
              key={activeHero.image}
              src={activeHero.image}
              alt=""
              className="home-hero__img"
              loading="eager"
              style={{
                objectPosition: activeHero.objectPosition ?? 'center 30%',
              }}
            />
            <div className="home-hero__scrim" aria-hidden />

            <div className="home-hero__content">
              <span className="home-hero__badge">{activeHero.badge}</span>
              <h1 className="home-hero__title">{activeHero.title}</h1>
              <p className="home-hero__desc">{activeHero.desc}</p>
              <HomeAuthLink to={activeHero.cta} className="home-hero__btn" guardClick={guardClick}>
                {activeHero.ctaLabel}
                <ArrowRight className="size-4" />
              </HomeAuthLink>
            </div>

            {heroSlides.length > 1 ? (
              <>
                <button
                  type="button"
                  className="home-hero__arrow home-hero__arrow--prev"
                  aria-label="Slide trước"
                  onClick={() =>
                    setHeroIndex((i) => (i - 1 + heroSlides.length) % heroSlides.length)
                  }
                >
                  <ChevronLeft className="size-5" />
                </button>
                <button
                  type="button"
                  className="home-hero__arrow home-hero__arrow--next"
                  aria-label="Slide sau"
                  onClick={nextHero}
                >
                  <ChevronRight className="size-5" />
                </button>
                <div className="home-hero__dots">
                  {heroSlides.map((slide, i) => (
                    <button
                      key={`${slide.image}-${slide.title}`}
                      type="button"
                      className={cn('home-hero__dot', i === heroIndex && 'is-active')}
                      aria-label={`Slide ${i + 1}`}
                      onClick={() => setHeroIndex(i)}
                    />
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </section>

        <section id="welcome" className="home-welcome">
          <div className="home-welcome__media">
            <img
              className="home-welcome__img"
              src="/images/home-welcome.png"
              alt="Không gian làm việc sáng tạo MangaHub — laptop, bảng vẽ và game controller"
              loading="lazy"
            />
            <span className="home-welcome__badge">
              <Sparkles className="size-6" />
            </span>
          </div>
          <div className="home-welcome__content">
            <h2>Chào mừng đến MangaHub?</h2>
            <p>
              Nền tảng quản lý manga từ draft đến xuất bản — kết nối Mangaka,
              Assistant, Tantou Editor và Editor Board trong một workspace thống nhất.
              Upload chapter, vẽ layer, duyệt biên tập và lên lịch phát hành.
            </p>
            <div className="home-welcome__actions">
              <HomeAuthLink to="/mangaka" className="home-welcome__btn" guardClick={guardClick}>
                Khám phá workspace
                <ArrowRight className="size-4" />
              </HomeAuthLink>
              <a href="#pipeline" className="home-welcome__link">
                Xem quy trình
              </a>
            </div>
          </div>
        </section>

        <section id="why" className="home-why">
          <div className="home-why__head">
            <h2>Khám phá Mangahub</h2>
          </div>
          <div className="home-why__grid">
            {WHY_CARDS.map((card) => (
              <article key={card.title} className="home-why-card">
                <img className="home-why-card__img" src={card.image} alt="" loading="lazy" />
                <div className="home-why-card__body">
                  <h3>{card.title}</h3>
                  <p>{card.desc}</p>
                  <HomeAuthLink to={card.to} className="home-why-card__btn" guardClick={guardClick}>
                    {card.label}
                  </HomeAuthLink>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="pipeline" className="home-pipeline">
          <div className="home-pipeline__head">
            <h2>Từ sketch đến xuất bản</h2>
            <p>
              Một chapter đi qua đủ vai trò trong MangaHub — từ upload đến lịch phát hành,
              không cần rời workspace.
            </p>
          </div>
          <ol className="home-pipeline__track">
            {WORKFLOW_STEPS.map((item, index) => {
              const Icon = item.icon
              return (
                <li key={item.step} className="home-pipeline-step">
                  <div className="home-pipeline-step__marker">
                    <span className="home-pipeline-step__icon" aria-hidden>
                      <Icon className="size-5" />
                    </span>
                    {index < WORKFLOW_STEPS.length - 1 ? (
                      <span className="home-pipeline-step__line" aria-hidden />
                    ) : null}
                  </div>
                  <article className="home-pipeline-step__card">
                    <span className="home-pipeline-step__role">
                      Bước {item.step} · {item.role}
                    </span>
                    <h3>{item.title}</h3>
                    <p>{item.desc}</p>
                    <HomeAuthLink to={item.to} className="home-pipeline-step__link" guardClick={guardClick}>
                      Vào workspace
                      <ArrowRight className="size-3.5" />
                    </HomeAuthLink>
                  </article>
                </li>
              )
            })}
          </ol>
          <div className="home-pipeline__cta">
            {user ? (
              <Link to={workspacePath ?? '/'} className="home-pipeline__btn">
                Tiếp tục công việc
                <ArrowRight className="size-4" />
              </Link>
            ) : (
              <HomeAuthLink to="/register" className="home-pipeline__btn" guardClick={guardClick}>
                Bắt đầu miễn phí
                <ArrowRight className="size-4" />
              </HomeAuthLink>
            )}
          </div>
        </section>

        <div className="home-footer-wrap">
          <Footer authGuard onAuthRequired={(path) => requireLogin(path)} />
        </div>
      </div>

      <LoginRequiredDialog
        open={loginOpen}
        onOpenChange={setLoginOpen}
        onLogin={goLogin}
        pendingPath={pendingPath}
      />
    </div>
  )
}
