import { useEffect, useState } from 'react'
import { Ban, CheckCircle, Eye, Loader2, Plus, Search, Trash2, UserCog } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/api/index.js'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const ROLE_OPTIONS = ['Admin', 'Mangaka', 'Assistant', 'Editor', 'EB', 'Reader']

function formatDate(value) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString('vi-VN')
  } catch {
    return '—'
  }
}

function CreateUserDialog({ open, onClose, onCreated }) {
  const [form, setForm] = useState({
    username: '',
    password: '',
    full_name: '',
    email: '',
    role: 'Reader',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setForm({ username: '', password: '', full_name: '', email: '', role: 'Reader' })
      setError('')
    }
  }, [open])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api.createUser(form)
      toast.success('Đã tạo người dùng.')
      onCreated()
      onClose()
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể tạo người dùng.')
    } finally {
      setSaving(false)
    }
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Thêm người dùng</DialogTitle>
            <DialogDescription>Tạo tài khoản mới qua POST /admin/users-legacy</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="space-y-2">
              <Label>Username *</Label>
              <Input value={form.username} onChange={(e) => set('username', e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Mật khẩu *</Label>
              <Input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Họ tên *</Label>
              <Input value={form.full_name} onChange={(e) => set('full_name', e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Vai trò *</Label>
              <Select value={form.role} onValueChange={(v) => set('role', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Huỷ</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : 'Tạo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ManageUserDialog({ userId, open, onClose, onUpdated }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', role: '' })
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !userId) return
    let cancelled = false
    setLoading(true)
    setError('')
    api.getUserById(userId)
      .then((data) => {
        if (cancelled) return
        const d = data?.data ?? data
        setDetail(d)
        setForm({
          full_name: d.name ?? '',
          email: d.email ?? '',
          role: d.role ?? 'Reader',
        })
      })
      .catch(() => {
        if (!cancelled) setError('Không tải được thông tin.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [open, userId])

  async function handleSave() {
    if (!userId) return
    setSaving(true)
    setError('')
    try {
      await api.updateUser(userId, { full_name: form.full_name, email: form.email })
      if (form.role && form.role !== detail?.role) {
        await api.changeUserRole(userId, form.role)
      }
      toast.success('Đã cập nhật người dùng.')
      onUpdated()
      onClose()
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể cập nhật.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!userId || !confirm('Xoá người dùng này? Hành động không thể hoàn tác.')) return
    setSaving(true)
    try {
      await api.deleteUser(userId)
      toast.success('Đã xoá người dùng.')
      onUpdated()
      onClose()
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể xoá.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Quản lý người dùng</DialogTitle>
          <DialogDescription>Chi tiết, sửa, đổi vai trò hoặc xoá tài khoản.</DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex flex-col items-center py-10 text-muted-foreground">
            <Loader2 className="size-7 animate-spin" />
          </div>
        ) : detail ? (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border p-3 text-sm">
              <div className="text-muted-foreground">Username</div>
              <div className="font-medium">{detail.username || '—'}</div>
              <div className="mt-2 text-muted-foreground">Ngày tạo</div>
              <div>{formatDate(detail.createdAt)}</div>
            </div>
            <div className="space-y-2">
              <Label>Họ tên</Label>
              <Input value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Vai trò</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        ) : error ? (
          <p className="py-6 text-center text-sm text-destructive">{error}</p>
        ) : null}
        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={saving || loading}>
            <Trash2 className="size-4" />
            Xoá
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Đóng</Button>
            <Button onClick={handleSave} disabled={saving || loading}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : 'Lưu'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function Users() {
  const [users, setUsers] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [updating, setUpdating] = useState(null)
  const [manageUserId, setManageUserId] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)

  useEffect(() => {
    loadUsers()
    api.getStats().then(setStats).catch(() => setStats(null))
  }, [])

  async function loadUsers() {
    setLoading(true)
    try {
      const data = await api.getUsers()
      setUsers(Array.isArray(data) ? data : data?.data || [])
    } catch (err) {
      console.error(err)
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  async function toggleStatus(user) {
    const newStatus = user.status === 'active' ? 'banned' : 'active'
    setUpdating(user.id)
    try {
      await api.updateUserStatus(user.id, newStatus)
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, status: newStatus } : u)))
      toast.success(newStatus === 'active' ? 'Đã mở khóa.' : 'Đã khóa tài khoản.')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Không thể đổi trạng thái.')
    } finally {
      setUpdating(null)
    }
  }

  const filtered = users.filter(
    (u) =>
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="size-8 animate-spin" />
        <p className="mt-3 text-sm">Đang tải người dùng...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Người dùng</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {stats ? `${stats.users.total} tài khoản · ${stats.series.total} truyện · ${stats.chapters.total} chương` : 'Quản lý tài khoản người dùng'}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          Thêm người dùng
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-base">Danh sách tài khoản</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Tìm tên, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Người dùng</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Vai trò</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Không có người dùng nào
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="font-medium">{user.name || 'N/A'}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{user.role || 'user'}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={user.status === 'active' ? 'default' : 'destructive'}
                        className={user.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' : ''}
                      >
                        {user.status === 'active' ? 'Hoạt động' : 'Bị khóa'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => setManageUserId(user.id)}>
                          <UserCog className="size-3.5" />
                          Quản lý
                        </Button>
                        <Button
                          size="sm"
                          variant={user.status === 'active' ? 'destructive' : 'default'}
                          onClick={() => toggleStatus(user)}
                          disabled={updating === user.id}
                        >
                          {updating === user.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : user.status === 'active' ? (
                            <>
                              <Ban className="size-3.5" />
                              Khóa
                            </>
                          ) : (
                            <>
                              <CheckCircle className="size-3.5" />
                              Mở khóa
                            </>
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CreateUserDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={loadUsers} />
      <ManageUserDialog
        userId={manageUserId}
        open={manageUserId !== null}
        onClose={() => setManageUserId(null)}
        onUpdated={loadUsers}
      />
    </div>
  )
}
