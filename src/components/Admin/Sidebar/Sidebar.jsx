import {
  BookOpen,
  FileText,
  LayoutDashboard,
  LogOut,
  UserCircle,
  Users as UsersIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const NAV_ITEMS = [
  {
    section: 'Tổng quan',
    links: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'manga', label: 'Quản lý truyện', icon: BookOpen },
      { id: 'chapters', label: 'Chương truyện', icon: FileText },
    ],
  },
  {
    section: 'Quản lý',
    links: [
      { id: 'users', label: 'Người dùng', icon: UsersIcon },
      { id: 'profile', label: 'Hồ sơ', icon: UserCircle },
    ],
  },
]

export default function Sidebar({ activePage = 'dashboard', onNavigate }) {
  function handleLogout() {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    window.location.href = '/login'
  }

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r bg-card">
      <div className="border-b px-6 py-5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <BookOpen className="size-4" />
          </span>
          <div>
            <div className="text-sm font-semibold tracking-tight">MangaHub</div>
            <div className="text-xs text-muted-foreground">Admin Panel</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {NAV_ITEMS.map(group => (
          <div key={group.section}>
            <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {group.section}
            </div>
            <div className="space-y-1">
              {group.links.map(link => {
                const Icon = link.icon
                const active = activePage === link.id
                return (
                  <button
                    key={link.id}
                    type="button"
                    onClick={() => onNavigate?.(link.id)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      active
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="flex-1 text-left">{link.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t p-3">
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground hover:text-destructive"
          onClick={handleLogout}
        >
          <LogOut className="size-4" />
          Đăng xuất
        </Button>
      </div>
    </aside>
  )
}
