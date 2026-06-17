import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Edit, Loader2, User } from 'lucide-react'
import { toast } from 'sonner'
import Header from '@/components/User/Header/Header.jsx'
import Footer from '@/components/User/Footer/Footer.jsx'
import { api } from '@/api/index.js'
import { getSession, logout, updateSession } from '@/lib/auth.js'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const ROLE_LABELS = {
  admin: 'Quản trị viên',
  editor_board: 'Hội đồng biên tập',
  tantou_editor: 'Biên tập viên thường trực',
  assistant: 'Trợ lý vẽ ngoại cảnh',
  mangaka: 'Mangaka',
  user: 'Người dùng',
}

function getInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(-2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('') || 'U'
}

export default function UserProfile() {
  const navigate = useNavigate()
  const user = getSession()
  const [editOpen, setEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
  })

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header links={[]} />
        <main className="flex flex-1 flex-col items-center justify-center py-20 text-center">
          <User className="size-12 text-muted-foreground" />
          <h1 className="mt-4 text-xl font-semibold">Chưa đăng nhập</h1>
          <p className="mt-1 text-sm text-muted-foreground">Vui lòng đăng nhập để xem hồ sơ.</p>
          <Button className="mt-6" onClick={() => navigate('/login')}>
            Đăng nhập
          </Button>
        </main>
        <Footer />
      </div>
    )
  }

  function patch(k, v) { setForm(p => ({ ...p, [k]: v })) }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error('Vui lòng nhập họ tên.')
      return
    }
    setSaving(true)
    try {
      await api.updateProfile({ name: form.name.trim() })
      updateSession({ ...user, name: form.name.trim() })
      toast.success('Cập nhật hồ sơ thành công.')
      setEditOpen(false)
      window.location.reload()
    } catch (err) {
      toast.error('Cập nhật thất bại. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const roleLabel = ROLE_LABELS[user.role] ?? user.role
  const initials = getInitials(user.name)

  return (
    <div className="flex min-h-screen flex-col">
      <Header links={[]} onLogout={handleLogout} />

      <main className="flex flex-1 py-10">
        <div className="mx-auto w-full max-w-2xl px-4">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight">Hồ sơ</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Thông tin tài khoản của bạn
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
            {/* Avatar card */}
            <Card className="overflow-hidden p-0">
              <div className="relative h-24 bg-gradient-to-br from-primary/80 via-rose-500/60 to-amber-400/60">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.2),transparent_70%)]" />
              </div>
              <div className="-mt-12 flex flex-col items-center px-6 pb-6 text-center">
                <Avatar className="size-20 border-4 border-card shadow-lg">
                  <AvatarFallback className="bg-gradient-to-br from-primary to-rose-500 text-2xl font-bold text-primary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <h2 className="mt-3 text-lg font-bold">{user.name}</h2>
                <Badge variant="secondary" className="mt-1.5">
                  {roleLabel}
                </Badge>
                <Button className="mt-4 w-full" onClick={() => setEditOpen(true)}>
                  <Edit className="size-4" />
                  Chỉnh sửa
                </Button>
              </div>
            </Card>

            {/* Info card */}
            <Card>
              <CardHeader>
                <CardTitle>Thông tin tài khoản</CardTitle>
              </CardHeader>
              <CardContent className="space-y-0">
                <div className="flex items-center justify-between py-3">
                  <span className="text-sm text-muted-foreground">Họ tên</span>
                  <span className="font-medium">{user.name}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between py-3">
                  <span className="text-sm text-muted-foreground">Email</span>
                  <span className="font-medium">{user.email}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between py-3">
                  <span className="text-sm text-muted-foreground">Vai trò</span>
                  <Badge variant="secondary">{roleLabel}</Badge>
                </div>
                {user.createdAt ? (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between py-3">
                      <span className="text-sm text-muted-foreground">Ngày tham gia</span>
                      <span className="font-medium">
                        {new Date(user.createdAt).toLocaleDateString('vi-VN', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  </>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Footer />

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chỉnh sửa hồ sơ</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Họ tên</Label>
              <Input
                id="edit-name"
                value={form.name}
                onChange={e => patch('name', e.target.value)}
                placeholder="Nhập họ tên"
                maxLength={80}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                value={form.email}
                disabled
                className="opacity-60"
              />
              <p className="text-xs text-muted-foreground">Email không thể thay đổi.</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Huỷ
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="size-4 animate-spin" />}
                Lưu
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
