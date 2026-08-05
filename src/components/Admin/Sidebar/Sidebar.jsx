import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowDownToLine,
  Bell,
  BookOpen,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Flag,
  LayoutDashboard,
  LogOut,
  Sparkles,
  Trophy,
  UserCircle,
  Users as UsersIcon,
  Wallet,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  {
    section: 'Tổng quan',
    links: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'rankings', label: 'Bảng xếp hạng', icon: Trophy },
      { id: 'finance', label: 'Tài chính', icon: Wallet },
      { id: 'withdrawals', label: 'Yêu cầu rút tiền', icon: ArrowDownToLine },
      { id: 'publication-calendar', label: 'Lịch phát hành', icon: Calendar },
      { id: 'manga', label: 'Quản lý truyện', icon: BookOpen },
    ],
  },
  {
    section: 'Quản lý',
    links: [
      { id: 'users', label: 'Người dùng', icon: UsersIcon },
      { id: 'notifications', label: 'Thông báo', icon: Bell },
      { id: 'end-requests', label: 'Yêu cầu kết thúc', icon: Flag },
      { id: 'profile', label: 'Hồ sơ', icon: UserCircle },
    ],
  },
]

export default function Sidebar({
  activePage = 'dashboard',
  onNavigate,
  navBadges = {},
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [hoveredId, setHoveredId] = useState(null)

  function handleLogout() {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    window.location.href = '/login'
  }

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="relative flex h-full shrink-0 flex-col border-r border-border/50 bg-gradient-to-b from-card via-card to-muted/20"
    >
      {/* Decorative gradient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 -top-20 size-40 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-20 -right-20 size-40 rounded-full bg-purple-500/5 blur-3xl" />
      </div>

      {/* Logo Area */}
      <div className="relative shrink-0 border-b border-border/50 bg-gradient-to-r from-primary/5 via-transparent to-transparent px-4 py-5">
        <div className="flex items-center gap-3">
          <motion.div
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-rose-600 shadow-lg shadow-primary/25"
            whileHover={{ scale: 1.05, rotate: 5 }}
            transition={{ type: 'spring', stiffness: 400 }}
          >
            <BookOpen className="size-5 text-primary-foreground" />
          </motion.div>

          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-2">
                  <div className="text-sm font-bold tracking-tight text-foreground">MangaHub</div>
                  <span className="rounded-full bg-gradient-to-r from-primary/20 to-rose-500/20 px-2 py-0.5 text-[10px] font-medium text-primary">
                    Admin
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground">Dashboard</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation - scrollable */}
      <nav className="relative flex-1 space-y-6 overflow-y-auto px-3 py-5 scrollbar-hide">
        {NAV_ITEMS.map((group, groupIndex) => (
          <div key={group.section}>
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mb-2 flex items-center gap-2 px-3"
                >
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                    {group.section}
                  </span>
                  {groupIndex === 0 && (
                    <div className="h-px flex-1 bg-gradient-to-r from-border/50 to-transparent" />
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-1">
              {group.links.map(link => {
                const Icon = link.icon
                const active = activePage === link.id
                const hovered = hoveredId === link.id
                const badgeCount = Number(navBadges[link.id] ?? 0) || 0

                return (
                  <motion.button
                    key={link.id}
                    type="button"
                    onClick={() => onNavigate?.(link.id)}
                    onMouseEnter={() => setHoveredId(link.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                      active
                        ? 'bg-gradient-to-r from-primary/15 via-primary/10 to-transparent text-primary shadow-sm'
                        : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                      collapsed && 'justify-center px-2'
                    )}
                  >
                    {/* Active indicator */}
                    {active && (
                      <>
                        <motion.div
                          layoutId="activeIndicator"
                          className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/20 to-primary/5 ring-1 ring-primary/20"
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        />
                        <div className="absolute -left-3 top-1/2 size-6 -translate-y-1/2 rounded-full bg-primary shadow-md shadow-primary/30">
                          <Sparkles className="size-3 text-primary-foreground m-auto mt-1.5" />
                        </div>
                      </>
                    )}

                    {/* Icon wrapper */}
                    <div
                      className={cn(
                        'relative z-10 flex size-8 shrink-0 items-center justify-center rounded-lg transition-all duration-200',
                        active
                          ? 'bg-primary/20 text-primary'
                          : hovered
                            ? 'bg-accent text-foreground'
                            : 'bg-muted/50 text-muted-foreground group-hover:bg-accent'
                      )}
                    >
                      <Icon className={cn('size-4', active && 'scale-110')} />
                      {collapsed && badgeCount > 0 ? (
                        <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white">
                          {badgeCount > 9 ? '9+' : badgeCount}
                        </span>
                      ) : null}
                    </div>

                    <AnimatePresence>
                      {!collapsed && (
                        <motion.span
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: 'auto' }}
                          exit={{ opacity: 0, width: 0 }}
                          className="relative z-10 flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-left"
                        >
                          <span className="truncate">{link.label}</span>
                          {badgeCount > 0 ? (
                            <span className="ml-auto inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">
                              {badgeCount > 99 ? '99+' : badgeCount}
                            </span>
                          ) : null}
                        </motion.span>
                      )}
                    </AnimatePresence>

                    {/* Hover arrow */}
                    {hovered && !collapsed && !active && badgeCount === 0 && (
                      <motion.div
                        initial={{ opacity: 0, x: -5 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="relative z-10"
                      >
                        <ChevronRight className="size-3 text-muted-foreground" />
                      </motion.div>
                    )}
                  </motion.button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom Actions - fixed at bottom */}
      <div className="relative shrink-0 border-t border-border/50 bg-gradient-to-t from-muted/30 via-card to-card p-3">
        {/* Logout */}
        <motion.button
          className={cn(
            'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-destructive/10 hover:text-destructive',
            collapsed && 'justify-center px-2'
          )}
          onClick={handleLogout}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground group-hover:bg-destructive/10 group-hover:text-destructive">
            <LogOut className="size-4" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="overflow-hidden"
              >
                Đăng xuất
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      {/* Collapse Toggle */}
      <motion.button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 flex size-6 items-center justify-center rounded-full border bg-card shadow-md transition-all hover:scale-110"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        <motion.div
          animate={{ rotate: collapsed ? 180 : 0 }}
          transition={{ duration: 0.3 }}
        >
          <ChevronLeft className="size-3.5 text-muted-foreground" />
        </motion.div>
      </motion.button>
    </motion.aside>
  )
}
