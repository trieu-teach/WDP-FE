import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ListChecks } from 'lucide-react'
import Header from '@/components/User/Header/Header.jsx'
import Footer from '@/components/User/Footer/Footer.jsx'
import { MangakaTeRevisionView } from '@/components/Mangaka/MangakaTeRevisionView.jsx'
import { Button } from '@/components/ui/button'
import { getSession, logout } from '@/lib/auth.js'
import { LABEL_TANTOU_EDITOR } from '@/constants/roleTerminology.js'

const NAV_LINKS = [
  { to: '/', label: 'Trang chủ' },
  { to: '/mangaka', label: 'Mangaka' },
]

export default function MangakaTeRevision() {
  const navigate = useNavigate()
  const { chapterId } = useParams()
  const user = getSession()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  function handleClose() {
    navigate('/mangaka')
  }

  if (!chapterId) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header links={NAV_LINKS} onLogout={user ? handleLogout : undefined} />
        <main className="page-container flex flex-1 flex-col items-center justify-center gap-4 py-12">
          <p className="text-sm text-muted-foreground">Thiếu mã chapter.</p>
          <Button asChild variant="outline">
            <Link to="/mangaka">Về Mangaka</Link>
          </Button>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header links={NAV_LINKS} onLogout={user ? handleLogout : undefined} />

      <main className="page-container flex min-h-0 flex-1 flex-col gap-4 py-6 lg:py-8">
        <header className="flex flex-wrap items-center gap-3 border-b border-border/60 pb-4">
          <Button type="button" variant="ghost" size="sm" onClick={handleClose}>
            <ArrowLeft className="size-4" />
            Quay lại
          </Button>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-widest text-sky-500">
              Nhận xét {LABEL_TANTOU_EDITOR}
            </p>
            <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight sm:text-2xl">
              <ListChecks className="size-5 shrink-0 text-sky-500" />
              Xem chapter cần chỉnh sửa
            </h1>
            <p className="text-sm text-muted-foreground">
              Các ô khoanh vùng và ghi chú TE gửi về sau khi từ chối duyệt.
            </p>
          </div>
        </header>

        <MangakaTeRevisionView
          chapterId={chapterId}
          onClose={handleClose}
          className="min-h-0 flex-1"
        />
      </main>

      <Footer />
    </div>
  )
}
