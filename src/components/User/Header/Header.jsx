import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  BookOpen,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  User,
} from 'lucide-react'
import { getSession, getRolePath, logout, ROLES } from '@/lib/auth.js'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { NotificationBell } from '@/components/layout/NotificationBell.jsx'
import { cn } from '@/lib/utils'

function getInitials(name = '') {
  const parts = String(name).split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
  }
  return String(name).slice(0, 2).toUpperCase() || 'U'
}

export default function Header({ links = [], onLogout, className, tone = 'default' }) {
  const navigate = useNavigate()
  const user = getSession()
  const workspacePath = user ? getRolePath(user.role) : null
  const canOpenProfile = user?.role === ROLES.MANGAKA
  const profilePath = '/mangaka/profile'
  const displayName = user?.name || user?.username || 'Tài khoản'
  const initials = useMemo(() => getInitials(displayName), [displayName])

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
                <button
                  type="button"
                  aria-label={`Tài khoản ${displayName}`}
                  className={cn(
                    'rounded-full p-0 outline-none transition-transform',
                    'hover:scale-105 focus-visible:ring-2 focus-visible:ring-primary/40',
                    isLight && 'focus-visible:ring-white/50',
                  )}
                >
                  <Avatar
                    className={cn(
                      'size-9 border-2 shadow-sm',
                      isLight ? 'border-white/80' : 'border-background',
                    )}
                  >
                    {user.avatarUrl ? (
                      <AvatarImage src={user.avatarUrl} alt="" />
                    ) : null}
                    <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link to="/">
                    <Home className="size-4" />
                    Home
                  </Link>
                </DropdownMenuItem>
                {workspacePath ? (
                  <DropdownMenuItem asChild>
                    <Link to={workspacePath}>
                      <LayoutDashboard className="size-4" />
                      Workspace
                    </Link>
                  </DropdownMenuItem>
                ) : null}
                {canOpenProfile ? (
                  <DropdownMenuItem asChild>
                    <Link to={profilePath}>
                      <User className="size-4" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogoutClick}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="size-4" />
                  Đăng xuất
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
