import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, ChevronDown, LogOut, Search, User, X, Check } from 'lucide-react'
import { api } from '@/api/index.js'
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

export default function Header({ onNavigate }) {
  const [notifs, setNotifs] = useState([])
  const [profile, setProfile] = useState(null)
  const [searchFocused, setSearchFocused] = useState(false)

  useEffect(() => {
    api.getNotifications({ limit: 10 }).then(setNotifs).catch(() => setNotifs([]))
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
  }, [])

  function handleLogout() {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    window.location.href = '/login'
  }

  const display = profile ?? { name: 'Admin', role: 'Admin', initials: 'AD' }
  const unreadCount = notifs.filter(n => !n.isRead).length

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-border/50 bg-gradient-to-r from-card via-card/95 to-card/90 px-6 backdrop-blur-xl">
      {/* Search Bar */}
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
          {searchFocused && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mr-2 flex items-center gap-1"
            >
              <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                ESC
              </kbd>
            </motion.div>
          )}
        </div>
      </motion.div>

      <div className="ml-auto flex items-center gap-2">
        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <motion.button
              className="relative flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-all duration-200 hover:bg-accent hover:text-foreground"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Bell className="size-5" />
              {unreadCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-gradient-to-br from-primary to-rose-500 text-[10px] font-bold text-primary-foreground shadow-lg shadow-primary/30"
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </motion.span>
              )}
            </motion.button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-96 p-0" asChild>
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-xl shadow-black/10"
            >
              <div className="flex items-center justify-between border-b border-border/50 bg-gradient-to-r from-primary/5 via-transparent to-transparent px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                    <Bell className="size-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Thông báo</h3>
                    <p className="text-xs text-muted-foreground">
                      {unreadCount > 0 ? `${unreadCount} chưa đọc` : 'Tất cả đã đọc'}
                    </p>
                  </div>
                </div>
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                    <Check className="size-3" />
                    Đánh dấu đã đọc
                  </Button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto">
                {notifs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center px-4 py-12">
                    <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                      <Bell className="size-6 text-muted-foreground" />
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">Không có thông báo nào</p>
                  </div>
                ) : (
                  notifs.slice(0, 6).map((n, index) => (
                    <motion.div
                      key={n.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`flex items-start gap-3 border-b border-border/30 px-4 py-3 last:border-0 hover:bg-muted/50 ${
                        !n.isRead ? 'bg-primary/5' : ''
                      }`}
                    >
                      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-rose-500/20">
                        <span className="text-sm">{n.icon}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm">{n.text}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{n.time}</p>
                      </div>
                      {!n.isRead && <div className="mt-2 size-2 shrink-0 rounded-full bg-primary" />}
                    </motion.div>
                  ))
                )}
              </div>

              {notifs.length > 0 && (
                <div className="border-t border-border/50 p-2">
                  <Button variant="ghost" className="w-full text-xs" size="sm">
                    Xem tất cả thông báo
                  </Button>
                </div>
              )}
            </motion.div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <motion.button
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
          <DropdownMenuContent align="end" className="w-72 p-0" asChild>
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-xl shadow-black/10"
            >
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
            </motion.div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
