import { Link } from 'react-router-dom'
import { BookOpen, Check, Palette, PenLine } from 'lucide-react'
import { cn } from '@/lib/utils'
import './AuthShell.css'
import './AuthForm.css'

const DEFAULT_FEATURES = [
  'Upload chapter & ghi chú vùng giao việc',
  'Hợp tác Mangaka — Assistant trên một nền tảng',
  'Quy trình xuất bản từ draft đến chapter',
]

export function AuthShell({ title, subtitle, children, footer, variant = 'default' }) {
  const isRegister = variant === 'register'

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-[calc(100vh-4rem)] flex-1">
        <aside
          className={cn(
            'auth-shell__brand relative hidden overflow-hidden lg:flex lg:w-[42%] xl:w-[44%]',
            isRegister && 'auth-shell__brand--register',
          )}
        >
          <div className="auth-shell__grid" />

          <div className="relative z-10 flex h-full w-full flex-col justify-between p-10 xl:p-12">
            <Link to="/" className="flex items-center gap-2.5 text-white/95 transition-opacity hover:opacity-90">
              <span className="flex size-10 items-center justify-center rounded-xl bg-white/10 text-lg backdrop-blur-sm">
                <BookOpen className="size-5" />
              </span>
              <span className="text-lg font-semibold tracking-tight">MangaHub</span>
            </Link>

            <div className="max-w-md space-y-8 py-8">
              <div className="space-y-4">
                <p className="text-xs font-medium tracking-wide text-white/45">
                  {isRegister ? 'Bắt đầu hành trình' : 'Workspace'}
                </p>
                <h1 className="text-3xl font-bold leading-[1.15] tracking-[-0.03em] text-white xl:text-[2.75rem]">
                  {title}
                </h1>
                <p className="max-w-sm text-[15px] leading-relaxed text-white/60">{subtitle}</p>
              </div>

              <ul className="space-y-3">
                {DEFAULT_FEATURES.map(item => (
                  <li key={item} className="flex items-start gap-3 text-sm text-white/70">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-white/10 text-white/90">
                      <Check className="size-3" strokeWidth={2.5} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-xs text-white/40">© MangaHub — nền tảng manga creator</p>
          </div>
        </aside>

        <main className="auth-shell__main flex flex-1 items-center justify-center px-5 py-10 sm:px-8 lg:px-10">
          <div className={cn('auth-shell__content w-full space-y-6', isRegister ? 'max-w-[480px]' : 'max-w-[440px]')}>
            <div className="lg:hidden">
              <Link to="/" className="mb-6 inline-flex items-center gap-2 font-semibold">
                <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                  <BookOpen className="size-4" />
                </span>
                MangaHub
              </Link>
            </div>
            {children}
            {footer}
          </div>
        </main>
      </div>
    </div>
  )
}

const ROLE_ICONS = {
  mangaka: PenLine,
  assistant: Palette,
}

export function RoleCard({ active, icon, title, desc, value, onSelect }) {
  const Icon = ROLE_ICONS[icon] ?? PenLine
  const tone = value === 'mangaka' ? 'mangaka' : 'assistant'

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        'auth-role-btn',
        `auth-role-btn--${tone}`,
        active && 'auth-role-btn--active',
      )}
    >
      <span className={cn('auth-role-btn__icon-wrap', active && 'auth-role-btn__icon-wrap--active')}>
        <Icon className="size-[1.125rem]" strokeWidth={2} />
      </span>
      <span className="auth-role-btn__body">
        <span className="auth-role-btn__title">{title}</span>
        <span className="auth-role-btn__desc">{desc}</span>
      </span>
      <span className={cn('auth-role-btn__indicator', active && 'auth-role-btn__indicator--on')} aria-hidden>
        {active ? <Check className="size-2.5" strokeWidth={3} /> : null}
      </span>
    </button>
  )
}
