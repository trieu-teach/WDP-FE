import { useEffect, useState } from 'react'
import { Crown, Loader2, UserCheck, UserX } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/api/index.js'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export default function EbRepresentative() {
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(null)

  useEffect(() => {
    loadCandidates()
  }, [])

  async function loadCandidates() {
    setLoading(true)
    try {
      const data = await api.getEbCandidates()
      setCandidates(Array.isArray(data) ? data : [])
    } catch {
      setCandidates([])
      toast.error('Không tải được danh sách EB.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSetRepresentative(userId) {
    setUpdating(userId)
    try {
      await api.setEbRepresentative(userId)
      toast.success('Đã chỉ định đại diện EB.')
      await loadCandidates()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Không thể chỉ định đại diện.')
    } finally {
      setUpdating(null)
    }
  }

  async function handleClear() {
    setUpdating('clear')
    try {
      await api.clearEbRepresentative()
      toast.success('Đã bỏ chỉ định đại diện EB.')
      await loadCandidates()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Không thể bỏ chỉ định.')
    } finally {
      setUpdating(null)
    }
  }

  const current = candidates.find((c) => c.is_eb_representative)

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="size-8 animate-spin" />
        <p className="mt-3 text-sm">Đang tải...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Đại diện EB</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Chỉ định một tài khoản EB duy nhất được lưu điểm hội đồng
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleClear}
          disabled={!current || updating === 'clear'}
        >
          {updating === 'clear' ? <Loader2 className="size-4 animate-spin" /> : <UserX className="size-4" />}
          Bỏ chỉ định
        </Button>
      </div>

      {current ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Crown className="size-4 text-amber-500" />
              Đại diện hiện tại
            </CardTitle>
            <CardDescription>
              {current.name} ({current.email})
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Chưa có đại diện EB nào được chỉ định.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tài khoản role EB</CardTitle>
          <CardDescription>Danh sách từ GET /admin/eb-representative/candidates</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Người dùng</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {candidates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    Không có user role EB
                  </TableCell>
                </TableRow>
              ) : (
                candidates.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="font-medium">{user.name}</div>
                      <div className="text-xs text-muted-foreground">@{user.username}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell>
                      {user.is_eb_representative ? (
                        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400">
                          Đại diện
                        </Badge>
                      ) : (
                        <Badge variant="outline">{user.status === 'active' ? 'Hoạt động' : 'Bị khóa'}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        disabled={user.is_eb_representative || user.status === 'banned' || updating === user.id}
                        onClick={() => handleSetRepresentative(user.id)}
                      >
                        {updating === user.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <UserCheck className="size-3.5" />
                        )}
                        Chỉ định
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
