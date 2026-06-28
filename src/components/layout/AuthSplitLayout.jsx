import { Link } from 'react-router-dom'
import { ArrowLeft, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import './AuthSplit.css'

const PARTICLES = Array.from({ length: 6 }, (_, i) => i)

export function AuthSplitLayout({
  variant = 'login',
  title,
  subtitle,
  children,
}) {
  return (
    <div className={cn('auth-split-page', variant === 'register' && 'auth-split-page--register')}>
      <div className={cn('auth-split-container', variant === 'register' && 'auth-split-container--register')}>
        <aside className="auth-split-left">
          <ul className="auth-split-particles" aria-hidden>
            {PARTICLES.map((i) => (
              <li key={i} />
            ))}
          </ul>
          <Link to="/" className="auth-split-home">
            <BookOpen className="size-4" aria-hidden />
            MangaHub
          </Link>
          <div className="auth-split-left-content">
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
        </aside>

        <main className={cn('auth-split-right', variant === 'register' && 'auth-split-right--register')}>
          <Link to="/" className="auth-split-back">
            <ArrowLeft className="size-4" aria-hidden />
            Quay lại trang chủ
          </Link>
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
