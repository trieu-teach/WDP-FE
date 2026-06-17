import { Link } from 'react-router-dom'
import { BookOpen } from 'lucide-react'
import { Separator } from '@/components/ui/separator'

export default function Footer() {
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
            <Link to="/" className="text-muted-foreground transition-colors hover:text-foreground">Trang chủ</Link>
            <Link to="/login" className="text-muted-foreground transition-colors hover:text-foreground">Đăng nhập</Link>
            <Link to="/register" className="text-muted-foreground transition-colors hover:text-foreground">Đăng ký</Link>
            <Link to="/mangaka" className="text-muted-foreground transition-colors hover:text-foreground">Mangaka</Link>
            <Link to="/tantou" className="text-muted-foreground transition-colors hover:text-foreground">Tantou</Link>
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
