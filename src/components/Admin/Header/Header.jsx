import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Bell, ChevronDown, LogOut, Search, User, CheckCheck } from 'lucide-react'
import { api } from '@/api/index.js'
import { notificationsService } from '@/api/notifications.service.js'
import { getApiErrorMessage } from '@/api/http.js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  formatAdminNotificationTimeAgo,
  mapAdminNotificationListResponse,
  mapAdminNotificationStats,
} from '@/utils/adminNotificationMappers.js'

export default function Header({ onNavigate }) {
  const [notifs, setNotifs] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [profile, setProfile] = useState(null)
  const [searchFocused, setSearchFocused] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)

  const loadNotifications = useCallback(async () => {
    try {
      const [listRaw, statsRaw] = await Promise.all([
        notificationsService.adminList({ page: 1, limit: 8 }),
        notificationsService.adminStats(),
      ])
      const mapped = mapAdminNotificationListResponse(listRaw)
      const stats = mapAdminNotificationStats(statsRaw)
      setNotifs(mapped.items)
      setUnreadCount(stats.unread || mapped.unreadCount || 0)
    } catch {
      setNotifs([])
      setUnreadCount(0)
    }
  }, [])

  useEffect(() => {
    void loadNotifications()
    api
      .getProfile()
      .then(data => {
        const p = data?.data ?? data ?? {}
        const name = p.name || 'Admin'
        setProfile({
          name,
          role: p.role || 'Admin',
          initials: p.initials || name.slice(0, 2).toUpperCase(),
        })
      })
      .catch(() => setProfile({ name: 'Admin', role: 'Admin', initials: 'AD' }))
  }, [loadNotifications])

  async function handleMarkAllRead() {
    setMarkingAll(true)
    try {
      await notificationsService.adminMarkAllRead()
      setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })))
      setUnreadCount(0)
    } catch (err) {
      console.warn(getApiErrorMessage(err, 'Không đánh dấu được tất cả đã đọc.'))
    } finally {
      setMarkingAll(false)
    }
  }

  function handleLogout() {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    window.location.href = '/login'
  }

  const display = profile ?? { name: 'Admin', role: 'Admin', initials: 'AD' }

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-border/50 bg-gradient-to-r from-card via-card/95 to-card/90 px-6 backdrop-blur-xl">
      <motion.div
        className="relative flex-1 max-w-md"
        animate={{ width: searchFocused ? '100%' : '100%' }}
      >
        <div
          className={`relative flex items-center rounded-xl border bg-gradient-to-r transition-all duration-300 ${
            searchFocused
              ? 'border-primary/50 bg-primary/5 shadow-lg shadow-primary/10 ring-2 ring-primary/20'
              : 'border-border bg-muted/30 hover:border-border/80'
          }`}
        >
          <Search
            className={`pointer-events-none absolute left-3 size-4 transition-colors duration-200 ${
              searchFocused ? 'text-primary' : 'text-muted-foreground'
            }`}
          />
          <Input
            placeholder="Tìm kiếm trong admin panel..."
            className={`h-10 border-0 bg-transparent pl-9 pr-4 text-sm shadow-none focus-visible:ring-0 ${
              searchFocused ? 'placeholder:text-foreground/50' : 'placeholder:text-muted-foreground'
            }`}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
        </div>
      </motion.div>

      <div className="ml-auto flex items-center gap-2">
        <DropdownMenu
          open={notifOpen}
          onOpenChange={(open) => {
            setNotifOpen(open)
            if (open) void loadNotifications()
          }}
        >
          <DropdownMenuTrigger asChild>
            <motion.button
              type="button"
              className="relative flex size-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-all duration-200 hover:bg-accent hover:text-foreground"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              aria-label={unreadCount > 0 ? `${unreadCount} thông báo chưa đọc` : 'Thông báo'}
            >
              <Bell className="size-5" />
              {unreadCount > 0 ? (
                <span className="pointer-events-none absolute right-0 top-0 z-10 flex h-[18px] min-w-[18px] -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground ring-2 ring-background">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              ) : null}
            </motion.button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={8}
            className="w-[min(100vw-1.5rem,400px)] overflow-hidden rounded-xl border border-border/80 p-0 shadow-lg"
          >
            <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold">Thông báo</h3>
                <p className="text-[11px] text-muted-foreground">
                  {unreadCount > 0 ? `${unreadCount} chưa đọc` : 'Tất cả đã đọc'}
                </p>
              </div>
              {unreadCount > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  disabled={markingAll}
                  className="shrink-0 gap-1 text-xs"
                  onClick={() => void handleMarkAllRead()}
                >
                  {markingAll ? (
                    <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <CheckCheck className="size-3" />
                  )}
                  Đọc tất cả
                </Button>
              ) : null}
            </div>

            <div className="max-h-[min(50vh,360px)] overflow-y-auto overscroll-contain">
              {notifs.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-4 py-12">
                  <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                    <Bell className="size-6 text-muted-foreground" />
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">Không có thông báo nào</p>
                </div>
              ) : (
                <ul className="divide-y divide-border/50">
                  {notifs.map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        className={cn(
                          'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50',
                          !n.isRead
                            ? 'border-l-[3px] border-l-primary bg-slate-50 dark:bg-slate-900/40'
                            : 'border-l-[3px] border-l-transparent',
                        )}
                        onClick={() => onNavigate?.('notifications')}
                      >
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p
                            className={cn(
                              'text-sm leading-snug',
                              !n.isRead ? 'font-semibold' : 'font-medium text-foreground/75',
                            )}
                          >
                            {n.title}
                          </p>
                          {n.message ? (
                            <p className="line-clamp-2 text-xs text-muted-foreground">
                              {n.message}
                            </p>
                          ) : null}
                          <p className="text-[10px] text-muted-foreground">
                            {formatAdminNotificationTimeAgo(n.createdAt)}
                          </p>
                        </div>
                        {!n.isRead ? (
                          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-hidden />
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {notifs.length > 0 ? (
              <div className="border-t border-border/60 p-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-xs"
                  size="sm"
                  onClick={() => {
                    setNotifOpen(false)
                    onNavigate?.('notifications')
                  }}
                >
                  Xem tất cả thông báo
                </Button>
              </div>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <motion.button
              type="button"
              className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition-all duration-200 hover:bg-accent"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Avatar className="size-9">
                <AvatarFallback className="bg-gradient-to-br from-primary via-rose-500 to-purple-500 text-xs font-bold text-primary-foreground shadow-lg shadow-primary/20">
                  {display.initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden text-left sm:block">
                <div className="text-sm font-semibold leading-tight">{display.name}</div>
                <div className="flex items-center gap-1.5">
                  <Badge
                    variant="secondary"
                    className="h-4 gap-1 bg-gradient-to-r from-primary/10 to-rose-500/10 px-1.5 text-[10px] font-medium text-primary"
                  >
                    {display.role}
                  </Badge>
                </div>
              </div>
              <ChevronDown className="hidden size-4 text-muted-foreground sm:block" />
            </motion.button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72 p-0">
            <div className="border-b border-border/50 bg-gradient-to-r from-primary/5 via-transparent to-transparent p-4">
              <DropdownMenuLabel className="p-0">
                <div className="flex items-center gap-3">
                  <Avatar className="size-12">
                    <AvatarFallback className="bg-gradient-to-br from-primary via-rose-500 to-purple-500 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20">
                      {display.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-sm font-semibold">{display.name}</div>
                    <Badge
                      variant="secondary"
                      className="mt-1 h-5 bg-gradient-to-r from-primary/10 to-rose-500/10 px-2 text-[10px] font-medium text-primary"
                    >
                      {display.role}
                    </Badge>
                  </div>
                </div>
              </DropdownMenuLabel>
            </div>

            <div className="p-2">
              <DropdownMenuItem
                onClick={() => onNavigate?.('profile')}
                className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-accent"
              >
                <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
                  <User className="size-4 text-muted-foreground" />
                </div>
                Hồ sơ cá nhân
              </DropdownMenuItem>
            </div>

            <div className="border-t border-border/50 p-2">
              <DropdownMenuItem
                onClick={handleLogout}
                className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-destructive transition-colors hover:bg-destructive/10"
              >
                <div className="flex size-8 items-center justify-center rounded-lg bg-destructive/10">
                  <LogOut className="size-4" />
                </div>
                Đăng xuất
              </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
