import { Link } from 'react-router-dom'
import { ArrowLeft, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import './AuthSplit.css'

const HERO_IMAGE = '/images/auth-hero.png'

export function AuthSplitLayout({
  variant = 'login',
  title,
  subtitle,
  heroEyebrow = 'MangaHub Studio',
  heroCaption = 'Từ sketch đến chapter hoàn chỉnh',
  children,
}) {
  const isRegister = variant === 'register'

  return (
    <div className={cn('auth-split-page', isRegister && 'auth-split-page--register')}>
      <div
        className="auth-split-page__bg"
        style={{ backgroundImage: `url(${HERO_IMAGE})` }}
        aria-hidden
      />

      <div className={cn('auth-split-container', isRegister && 'auth-split-container--register')}>
        <aside className="auth-split-left">
          <img
            className="auth-split-left__img"
            src={HERO_IMAGE}
            alt=""
            decoding="async"
          />
          <div className="auth-split-left__scrim" aria-hidden />

          {!isRegister ? (
            <div className="auth-split-left__top">
              <Link to="/" className="auth-split-left__brand">
                <BookOpen className="size-4" aria-hidden />
                MangaHub
              </Link>
              <div className="auth-split-left__actions">
                <Link to="/register" className="auth-split-left__ghost">
                  Đăng ký
                </Link>
                <Link to="/register" className="auth-split-left__pill">
                  Tham gia
                </Link>
              </div>
            </div>
          ) : null}

          <div className="auth-split-left__bottom">
            <p className="auth-split-left__eyebrow">{heroEyebrow}</p>
            <h1 className="auth-split-left__title">{title}</h1>
            {subtitle ? <p className="auth-split-left__subtitle">{subtitle}</p> : null}
            <p className="auth-split-left__caption">{heroCaption}</p>
          </div>
        </aside>

        <main className={cn('auth-split-right', isRegister && 'auth-split-right--register')}>
          <div className="auth-split-right__bar">
            <Link to="/" className="auth-split-right__logo">
              <span className="auth-split-right__logo-mark">
                <BookOpen className="size-4" aria-hidden />
              </span>
              MangaHub
            </Link>
            <Link to="/" className="auth-split-back">
              <ArrowLeft className="size-4" aria-hidden />
              Trang chủ
            </Link>
          </div>
          {children}
        </main>
      </div>
    </div>
  )
}

export function AuthFloatField({
  id,
  label,
  type = 'text',
  value,
  onChange,
  autoComplete,
  inputMode,
  required,
  toggle,
}) {
  return (
    <div
      className={cn(
        'auth-split-field',
        value?.toString().trim() && 'is-filled',
        toggle && 'auth-split-field--password',
      )}
    >
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        inputMode={inputMode}
        value={value}
        onChange={onChange}
        required={required}
      />
      <label htmlFor={id}>{label}</label>
      {toggle}
    </div>
  )
}

export function AuthBoxField({
  id,
  label,
  type = 'text',
  value,
  onChange,
  autoComplete,
  inputMode,
  required,
  optional,
  toggle,
}) {
  return (
    <div className={cn('auth-box-field', toggle && 'auth-box-field--password')}>
      <label htmlFor={id}>
        {label}
        {optional ? <span className="auth-box-field__optional">(tuỳ chọn)</span> : null}
      </label>
      <div className="auth-box-field__control">
        <input
          id={id}
          type={type}
          autoComplete={autoComplete}
          inputMode={inputMode}
          value={value}
          onChange={onChange}
          required={required}
          placeholder={optional ? '0912345678' : undefined}
        />
        {toggle}
      </div>
    </div>
  )
}
