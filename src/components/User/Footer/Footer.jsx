import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { BookOpen } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { getSession } from '@/lib/auth.js'

const LOGIN_TOAST = {
  title: 'Vui lòng đăng nhập',
  description: 'Bạn cần đăng nhập để truy cập tính năng này trên MangaHub.',
}

const GUARDED_PATHS = new Set(['/mangaka', '/assistant', '/tantou', '/eb', '/register'])

function FooterLink({ to, authGuard, onAuthRequired, className, children }) {
  const navigate = useNavigate()
  const user = getSession()
  const needsGuard = authGuard && !user && GUARDED_PATHS.has(to)

  if (!needsGuard) {
    return (
      <Link to={to} className={className}>
        {children}
      </Link>
    )
  }

  return (
    <Link
      to={to}
      className={className}
      onClick={(e) => {
        e.preventDefault()
        if (onAuthRequired) {
          onAuthRequired(to)
          return
        }
        toast.info(LOGIN_TOAST.title, { description: LOGIN_TOAST.description })
        navigate('/login')
      }}
    >
      {children}
    </Link>
  )
}

export default function Footer({ authGuard = false, onAuthRequired }) {
  return (
    <footer className="mt-auto border-t bg-muted/30">
      <div className="page-container py-10">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-semibold">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <BookOpen className="size-4" />
              </span>
              MangaHub
            </div>
            <p className="max-w-sm text-sm text-muted-foreground">
              Nền tảng quản lý manga — từ draft đến xuất bản, kết nối Mangaka, Assistant và biên tập.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <FooterLink to="/" authGuard={authGuard} onAuthRequired={onAuthRequired} className="text-muted-foreground transition-colors hover:text-foreground">Trang chủ</FooterLink>
            <FooterLink to="/login" authGuard={authGuard} onAuthRequired={onAuthRequired} className="text-muted-foreground transition-colors hover:text-foreground">Đăng nhập</FooterLink>
            <FooterLink to="/register" authGuard={authGuard} onAuthRequired={onAuthRequired} className="text-muted-foreground transition-colors hover:text-foreground">Đăng ký</FooterLink>
            <FooterLink to="/mangaka" authGuard={authGuard} onAuthRequired={onAuthRequired} className="text-muted-foreground transition-colors hover:text-foreground">Mangaka</FooterLink>
            <FooterLink to="/tantou" authGuard={authGuard} onAuthRequired={onAuthRequired} className="text-muted-foreground transition-colors hover:text-foreground">Tantou</FooterLink>
          </nav>
        </div>
        <Separator className="my-8" />
        <p className="text-center text-xs text-muted-foreground md:text-left">
          © 2026 MangaHub — Dự án quản lý manga SWP391
        </p>
      </div>
    </footer>
  )
}
