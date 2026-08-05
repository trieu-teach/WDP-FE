import { useMemo } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  BookOpen,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  User,
} from 'lucide-react'
import { getSession, getRolePath, logout, ROLES, ROLE_LABELS } from '@/lib/auth.js'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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

/** Active nav: soft pill (or light-tone underline) for current page. */
function isHeaderLinkActive(link, { pathname, search }) {
  const target = String(link?.to ?? link?.href ?? '').trim()
  if (!target || link?.href) return false

  try {
    const url = new URL(target, 'http://local.invalid')
    const linkPath = url.pathname
    const linkTab = url.searchParams.get('tab')

    if (linkPath === '/') {
      return pathname === '/'
    }

    if (linkPath === '/mangaka/review') {
      return pathname === '/mangaka/review' || pathname.startsWith('/mangaka/review/')
    }

    if (linkPath === '/assistant') {
      if (pathname !== '/assistant') return false
      const linkView = url.searchParams.get('view') || 'pick'
      const currentView = new URLSearchParams(search).get('view') || 'pick'
      return currentView === linkView
    }

    if (linkPath === '/tantou') {
      return pathname === '/tantou'
    }

    if (linkPath.startsWith('/tantou/')) {
      return pathname === linkPath || pathname.startsWith(`${linkPath}/`)
    }

    if (linkPath === '/eb') {
      if (pathname.startsWith('/eb/history')) return false
      if (pathname.startsWith('/eb/schedule')) return false
      return pathname === '/eb' || pathname.startsWith('/eb/')
    }

    if (linkPath === '/eb/history') {
      return pathname === '/eb/history' || pathname.startsWith('/eb/history/')
    }

    if (linkPath === '/eb/schedule') {
      return pathname === '/eb/schedule' || pathname.startsWith('/eb/schedule/')
    }

    if (linkPath === '/mangaka') {
      if (pathname.startsWith('/mangaka/review')) return false
      if (pathname.startsWith('/mangaka/profile')) return false
      if (pathname.startsWith('/mangaka/end-requests')) return false
      if (pathname !== '/mangaka' && !pathname.startsWith('/mangaka/series')) {
        return false
      }
      if (!linkTab) {
        return pathname === '/mangaka' || pathname.startsWith('/mangaka/series')
      }
      const params = new URLSearchParams(search)
      const currentTab = params.get('tab') || 'series'
      if (pathname.startsWith('/mangaka/series')) {
        return linkTab === 'series'
      }
      return currentTab === linkTab
    }

    return pathname === linkPath || pathname.startsWith(`${linkPath}/`)
  } catch {
    return pathname === target
  }
}

function NavTextLink({ link, active, isLight, compact }) {
  const cls = cn(
    'rounded-full transition-colors duration-150',
    compact ? 'px-2.5 py-1 text-[13px]' : 'px-3.5 py-1.5 text-sm',
    isLight
      ? 'text-white/75 hover:text-white'
      : 'text-gray-600 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-zinc-100',
    active
      && (isLight
        ? 'bg-white/15 font-medium text-white'
        : 'bg-red-50 font-medium text-red-600 dark:bg-rose-500/15 dark:text-rose-300'),
  )

  if (link.href) {
    return (
      <a href={link.href} className={cls} aria-current={active ? 'page' : undefined}>
        {link.label}
      </a>
    )
  }

  return (
    <Link to={link.to} className={cls} aria-current={active ? 'page' : undefined}>
      {link.label}
    </Link>
  )
}

function ActionLink({ link, active, isLight }) {
  const label = link.shortLabel || link.label
  const isPrimary = /upload|editor/i.test(String(link.shortLabel || link.label))

  const cls = cn(
    'inline-flex h-9 items-center justify-center rounded-full px-3.5 text-sm font-medium transition-colors duration-150',
    isPrimary
      ? isLight
        ? 'bg-white text-[#0b1f3f] hover:bg-white/90'
        : 'bg-red-600 text-white hover:bg-red-700 dark:bg-rose-600 dark:hover:bg-rose-500'
      : isLight
        ? 'border border-white/35 bg-white/10 text-white hover:bg-white/15'
        : 'border border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800',
    active && !isPrimary && !isLight && 'border-red-200 bg-red-50 text-red-600',
    active && !isPrimary && isLight && 'border-white/60 bg-white/20',
  )

  if (link.href) {
    return (
      <a href={link.href} className={cls} aria-current={active ? 'page' : undefined}>
        {label}
      </a>
    )
  }

  return (
    <Link to={link.to} className={cls} aria-current={active ? 'page' : undefined}>
      {label}
    </Link>
  )
}

export default function Header({ links = [], onLogout, className, tone = 'default' }) {
  const navigate = useNavigate()
  const location = useLocation()
  const user = getSession()
  const workspacePath = user ? getRolePath(user.role) : null
  const canOpenProfile = user?.role === ROLES.MANGAKA || user?.role === ROLES.ASSISTANT
  const profilePath = user?.role === ROLES.ASSISTANT
    ? '/assistant/profile'
    : '/mangaka/profile'
  const displayName = user?.name || user?.username || 'Tài khoản'
  const initials = useMemo(() => getInitials(displayName), [displayName])
  const roleLabel = user?.role
    ? (ROLE_LABELS[user.role] ?? String(user.role))
    : null
  const identitySubline = user?.email || roleLabel || user?.username || null

  const navLinks = useMemo(
    () => links.filter((link) => link.intent !== 'action'),
    [links],
  )
  const actionLinks = useMemo(
    () => links.filter((link) => link.intent === 'action'),
    [links],
  )
  const compactNav = navLinks.length > 5

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
        'sticky top-0 z-50 w-full border-0',
        isLight
          ? 'bg-transparent'
          : 'border-b border-gray-200/80 bg-white/90 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/90',
        className,
      )}
    >
      <div className="flex w-full items-center justify-between gap-4 px-6 py-3 md:px-8">
        <Link
          to="/"
          className={cn(
            'flex shrink-0 items-center gap-2.5 text-lg font-bold tracking-tight',
            isLight ? 'text-white' : 'text-gray-900 dark:text-zinc-50',
          )}
        >
          <span
            className={cn(
              'flex size-9 items-center justify-center rounded-xl shadow-sm',
              isLight
                ? 'bg-white text-[#0b1f3f]'
                : 'bg-red-600 text-white dark:bg-rose-600',
            )}
          >
            <BookOpen className="size-4" />
          </span>
          <span className="hidden sm:inline">MangaHub</span>
        </Link>

        <nav
          className={cn(
            'hidden min-w-0 flex-1 items-center justify-center md:flex',
            compactNav ? 'gap-1 lg:gap-1.5 xl:gap-2' : 'gap-6 lg:gap-8',
          )}
        >
          {navLinks.map((link) => (
            <NavTextLink
              key={link.label}
              link={link}
              active={isHeaderLinkActive(link, location)}
              isLight={isLight}
              compact={compactNav}
            />
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-4">
          {actionLinks.length > 0 ? (
            <div className="hidden items-center gap-2 md:flex">
              {actionLinks.map((link) => (
                <ActionLink
                  key={link.label}
                  link={link}
                  active={isHeaderLinkActive(link, location)}
                  isLight={isLight}
                />
              ))}
            </div>
          ) : null}

          {user ? (
            <div className="flex items-center gap-4">
              <NotificationBell
                className={cn(
                  isLight && 'text-white hover:bg-white/10 hover:text-white',
                )}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Tài khoản ${displayName}`}
                    className={cn(
                      'rounded-full p-0 outline-none transition',
                      'ring-2 ring-gray-100 hover:ring-red-400 focus-visible:ring-red-400',
                      'dark:ring-zinc-700 dark:hover:ring-rose-400',
                      isLight && 'ring-white/40 hover:ring-white/80',
                    )}
                  >
                    <Avatar className="size-9">
                      {user.avatarUrl ? (
                        <AvatarImage src={user.avatarUrl} alt="" />
                      ) : null}
                      <AvatarFallback className="bg-red-600 text-xs font-semibold text-white dark:bg-rose-600">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  sideOffset={8}
                  className={cn(
                    'w-64 rounded-xl border border-gray-100 bg-white p-1.5 shadow-lg',
                    'focus:outline-none transition-all duration-150',
                    'dark:border-zinc-800 dark:bg-zinc-950',
                  )}
                >
                  <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-3 px-2.5 py-2.5">
                      <Avatar className="size-9 shrink-0 ring-2 ring-gray-100 dark:ring-zinc-800">
                        {user.avatarUrl ? (
                          <AvatarImage src={user.avatarUrl} alt="" />
                        ) : null}
                        <AvatarFallback className="bg-red-600 text-[11px] font-semibold text-white dark:bg-rose-600">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-900 dark:text-zinc-50">
                          {displayName}
                        </p>
                        {identitySubline ? (
                          <p className="truncate text-xs text-gray-500 dark:text-zinc-400">
                            {identitySubline}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="my-1 bg-gray-100 dark:bg-zinc-800" />
                  <DropdownMenuItem
                    asChild
                    className="cursor-pointer gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-700 focus:bg-gray-50 dark:text-zinc-200 dark:focus:bg-zinc-900"
                  >
                    <Link to="/">
                      <Home className="size-4 text-gray-500" />
                      Trang chủ
                    </Link>
                  </DropdownMenuItem>
                  {workspacePath ? (
                    <DropdownMenuItem
                      asChild
                      className="cursor-pointer gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-700 focus:bg-gray-50 dark:text-zinc-200 dark:focus:bg-zinc-900"
                    >
                      <Link to={workspacePath}>
                        <LayoutDashboard className="size-4 text-gray-500" />
                        Không gian làm việc
                      </Link>
                    </DropdownMenuItem>
                  ) : null}
                  {canOpenProfile ? (
                    <DropdownMenuItem
                      asChild
                      className="cursor-pointer gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-700 focus:bg-gray-50 dark:text-zinc-200 dark:focus:bg-zinc-900"
                    >
                      <Link to={profilePath}>
                        <User className="size-4 text-gray-500" />
                        Hồ sơ cá nhân
                      </Link>
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuSeparator className="my-1 bg-gray-100 dark:bg-zinc-800" />
                  <DropdownMenuItem
                    onClick={handleLogoutClick}
                    className="cursor-pointer gap-3 rounded-lg px-3 py-2.5 text-sm text-red-600 focus:bg-red-50 focus:text-red-700 dark:text-red-400 dark:focus:bg-red-500/10 dark:focus:text-red-300"
                  >
                    <LogOut className="size-4" />
                    Đăng xuất
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <div className="flex items-center gap-2">
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
                className={cn(
                  'rounded-full',
                  isLight ? 'bg-white text-[#0b1f3f] hover:bg-white/90' : 'bg-red-600 hover:bg-red-700',
                )}
              >
                <Link to="/register">Đăng ký</Link>
              </Button>
            </div>
          )}

          {links.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon-sm"
                  className={cn(
                    'rounded-full md:hidden',
                    isLight && 'border-white/40 bg-white/10 text-white hover:bg-white/15',
                  )}
                >
                  <Menu className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {links.map((link) => (
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
