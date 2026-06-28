import { Link } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import { BookOpen, LogOut, Menu } from 'lucide-react'
import { getSession, getRolePath, logout, ROLE_LABELS } from '@/lib/auth.js'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { NotificationBell } from '@/components/layout/NotificationBell.jsx'
import { cn } from '@/lib/utils'

export default function Header({ links = [], onLogout, className, tone = 'default' }) {
  const navigate = useNavigate()
  const user = getSession()
  const workspacePath = user ? getRolePath(user.role) : null

  function handleLogoutClick() {
    if (onLogout) {
      onLogout()
      return
    }
    logout()
    navigate('/login')
  }

  const isLight = tone === 'light'

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full',
        isLight
          ? 'border-b-0 bg-transparent'
          : 'border-b bg-background/80 backdrop-blur-xl',
        className,
      )}
    >
      <div className="page-container flex h-16 items-center justify-between gap-4">
        <Link
          to="/"
          className={cn(
            'flex items-center gap-2.5 font-semibold tracking-tight',
            isLight && 'text-white',
          )}
        >
          <span
            className={cn(
              'flex size-9 items-center justify-center rounded-xl shadow-sm',
              isLight
                ? 'bg-white text-[#0b1f3f]'
                : 'bg-primary text-primary-foreground',
            )}
          >
            <BookOpen className="size-4" />
          </span>
          <span className="hidden sm:inline">MangaHub</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map(link => {
            const cls = cn(
              'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isLight
                ? 'text-white/80 hover:bg-white/10 hover:text-white'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )
            if (link.href) {
              return (
                <a key={link.label} href={link.href} className={cls}>
                  {link.label}
                </a>
              )
            }
            return (
              <Link key={link.label} to={link.to} className={cls}>
                {link.label}
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center gap-2">
          {user ? <NotificationBell /> : null}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <span className="max-w-[120px] truncate">{user.name || user.username || 'Tài khoản'}</span>
                  <Badge variant="secondary" className="hidden sm:inline-flex">
                    {ROLE_LABELS[user.role]}
                  </Badge>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {workspacePath ? (
                  <DropdownMenuItem asChild>
                    <Link to={workspacePath}>Workspace</Link>
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogoutClick} className="text-destructive focus:text-destructive">
                  <LogOut className="size-4" />
                  Đăng xuất
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : workspacePath ? (
            <Button asChild size="sm">
              <Link to={workspacePath}>Workspace</Link>
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className={cn('hidden sm:inline-flex', isLight && 'text-white hover:bg-white/10 hover:text-white')}
              >
                <Link to="/login">Đăng nhập</Link>
              </Button>
              <Button
                size="sm"
                asChild
                className={cn(isLight && 'bg-white text-[#0b1f3f] hover:bg-white/90')}
              >
                <Link to="/register">Đăng ký</Link>
              </Button>
            </>
          )}

          {links.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon-sm" className="md:hidden">
                  <Menu className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {links.map(link => (
                  link.href ? (
                    <DropdownMenuItem key={link.label} asChild>
                      <a href={link.href}>{link.label}</a>
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem key={link.label} asChild>
                      <Link to={link.to}>{link.label}</Link>
                    </DropdownMenuItem>
                  )
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>
    </header>
  )
}
