import { useEffect, useState } from 'react'
import { Edit, Key, Loader2, Mail, Phone, Shield, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/api/index.js'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'

function formatDate(value) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString('vi-VN')
  } catch {
    return '—'
  }
}

function normalizeProfile(raw) {
  const p = raw?.data ?? raw ?? {}
  const name = p.name || 'Admin'
  return {
    ...p,
    name,
    phoneNumber: p.phoneNumber || '',
    initials: p.initials || name.slice(0, 2).toUpperCase(),
    createdAt: formatDate(p.createdAt),
  }
}

function EditProfileDialog({ open, profile, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', email: '', phoneNumber: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open && profile) {
      setForm({
        name: profile.name ?? '',
        email: profile.email ?? '',
        phoneNumber: profile.phoneNumber ?? '',
      })
      setError('')
    }
  }, [open, profile])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const updated = await api.updateProfile(form)
      onSaved(normalizeProfile(updated))
      toast.success('Đã cập nhật hồ sơ.')
      onClose()
    } catch (err) {
      const message =
        err?.response?.data?.message || err?.message || 'Không thể cập nhật hồ sơ.'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSave}>
          <DialogHeader>
            <DialogTitle>Chỉnh sửa hồ sơ</DialogTitle>
            <DialogDescription>Cập nhật thông tin cá nhân của bạn.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="profile-name">Họ tên</Label>
              <Input
                id="profile-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-email">Email</Label>
              <Input
                id="profile-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-phone">Số điện thoại</Label>
              <Input
                id="profile-phone"
                value={form.phoneNumber}
                onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))}
                placeholder="Tùy chọn"
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Huỷ
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : 'Lưu'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function Profile() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)

  useEffect(() => {
    api
      .getProfile()
      .then((data) => setProfile(normalizeProfile(data)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="size-8 animate-spin" />
        <p className="mt-3 text-sm">Đang tải hồ sơ...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Hồ sơ</h1>
        <p className="mt-1 text-sm text-muted-foreground">Thông tin tài khoản Admin</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card className="overflow-hidden p-0">
          <div className="relative h-32 bg-gradient-to-br from-primary via-rose-500 to-amber-400">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.3),transparent_70%)]" />
          </div>
          <div className="-mt-12 flex flex-col items-center px-6 pb-6 text-center">
            <Avatar className="size-24 border-4 border-card shadow-lg">
              <AvatarFallback className="bg-gradient-to-br from-primary to-rose-500 text-3xl font-bold text-primary-foreground">
                {profile.initials}
              </AvatarFallback>
            </Avatar>
            <h2 className="mt-3 text-xl font-bold">{profile.name}</h2>
            <Badge variant="secondary" className="mt-1">
              <ShieldCheck className="size-3.5" />
              {profile.role}
            </Badge>
            <div className="mt-4 flex w-full gap-2">
              <Button className="flex-1" onClick={() => setEditOpen(true)}>
                <Edit className="size-4" />
                Chỉnh sửa
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => toast.info('Đổi mật khẩu chưa được hỗ trợ trên API.')}
              >
                <Key className="size-4" />
                Đổi mật khẩu
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Thông tin cá nhân</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {[
              { label: 'Họ tên', value: profile.name, icon: null },
              { label: 'Email', value: profile.email, icon: Mail },
              { label: 'Số điện thoại', value: profile.phoneNumber || '—', icon: Phone },
              { label: 'Vai trò', value: profile.role, icon: Shield, badge: true },
              { label: 'Ngày tạo', value: profile.createdAt, icon: null },
              {
                label: 'Trạng thái',
                value: profile.status === 'active' ? 'Hoạt động' : 'Bị khoá',
                statusOk: profile.status === 'active',
              },
            ].map((row, i, arr) => {
              const Icon = row.icon
              return (
                <div key={row.label}>
                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {Icon ? <Icon className="size-4" /> : null}
                      {row.label}
                    </div>
                    {row.badge ? (
                      <Badge variant="secondary">{row.value}</Badge>
                    ) : row.statusOk !== undefined ? (
                      <Badge
                        className={row.statusOk
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400'
                          : 'bg-rose-100 text-rose-700 hover:bg-rose-100 dark:bg-rose-500/15 dark:text-rose-400'}
                        variant="secondary"
                      >
                        {row.value}
                      </Badge>
                    ) : (
                      <span className="font-medium">{row.value}</span>
                    )}
                  </div>
                  {i < arr.length - 1 ? <Separator /> : null}
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      <EditProfileDialog
        open={editOpen}
        profile={profile}
        onClose={() => setEditOpen(false)}
        onSaved={setProfile}
      />
    </div>
  )
}
