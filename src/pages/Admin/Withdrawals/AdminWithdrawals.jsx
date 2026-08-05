import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  CircleAlert,
  Inbox,
  Loader2,
  RefreshCcw,
  Wallet,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/api/index.js'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  formatCoinString,
  formatCoinStringWithUnit,
  formatDateTime,
  formatVnd,
  pickCoinDisplay,
  pickVndDisplay,
} from '@/utils/coinFormatter.js'
import { cn } from '@/lib/utils'

const STATUS_OPTIONS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'approved', label: 'Đã duyệt' },
  { value: 'completed', label: 'Hoàn tất' },
  { value: 'rejected', label: 'Từ chối' },
  { value: 'cancelled', label: 'Đã huỷ' },
]

const STATUS_TONES = {
  pending: 'bg-amber-100 text-amber-700 ring-amber-200/60',
  approved: 'bg-blue-100 text-blue-700 ring-blue-200/60',
  completed: 'bg-emerald-100 text-emerald-700 ring-emerald-200/60',
  rejected: 'bg-rose-100 text-rose-700 ring-rose-200/60',
  cancelled: 'bg-zinc-100 text-zinc-700 ring-zinc-200/60',
}

function StatusPill({ status }) {
  const cfg = STATUS_TONES[status]
  const label = STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status ?? '—'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        cfg ?? 'bg-zinc-100 text-zinc-700 ring-zinc-200/60',
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {label}
    </span>
  )
}

function mapRow(raw) {
  const r = raw && typeof raw === 'object' ? raw : {}
  const amount = pickCoinDisplay(r, [
    'coin_amount_coin_display',
    'coin_amount_coin',
    'coin_display',
    'coin_amount',
  ])
  const vnd = pickVndDisplay(r, [
    'vnd_amount_display',
    'vnd_amount',
    'amount_vnd',
  ])
  const user = r.user && typeof r.user === 'object'
    ? {
        id: r.user._id ?? r.user.id ?? r.user_id ?? null,
        name: r.user.full_name ?? r.user.fullName ?? r.user.name ?? r.user.username ?? '—',
        role: r.user.role ?? '',
        avatarUrl: r.user.avatar_url ?? r.user.avatarUrl ?? '',
      }
    : {
        id: r.user_id ?? null,
        name: r.user_name ?? r.full_name ?? '—',
        role: r.user_role ?? '',
        avatarUrl: '',
      }
  const bank = r.bank_snapshot && typeof r.bank_snapshot === 'object' ? r.bank_snapshot : null
  return {
    id: r._id ?? r.id ?? null,
    user,
    status: r.status ?? 'pending',
    amountCoinDisplay: amount.display,
    amountCoin: amount.number,
    vndAmount: vnd.number,
    note: String(r.note ?? ''),
    adminNote: String(r.admin_note ?? ''),
    bankSnapshot: bank
      ? {
          bank_name: bank.bank_name ?? '',
          account_holder: bank.account_holder ?? '',
          account_number_masked:
            bank.account_number_masked
            ?? bank.bank_account_number_masked
            ?? '',
        }
      : null,
    createdAt: r.createdAt ?? r.created_at ?? null,
    processedAt: r.processed_at ?? r.processedAt ?? null,
    raw: r,
  }
}

function ActionDialog({ open, action, request, onClose, onConfirm }) {
  const [adminNote, setAdminNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setAdminNote('')
      setSubmitting(false)
    }
  }, [open, request?.id])

  if (!request || !action) return null

  const actionMeta = {
    approve: {
      title: 'Duyệt yêu cầu rút tiền',
      description: 'Yêu cầu sẽ chuyển sang trạng thái "Đã duyệt".',
      confirmLabel: 'Duyệt',
      tone: 'default',
    },
    reject: {
      title: 'Từ chối yêu cầu rút tiền',
      description: 'Coin sẽ được hoàn về số dư khả dụng của creator.',
      confirmLabel: 'Từ chối',
      tone: 'destructive',
    },
    complete: {
      title: 'Xác nhận đã chuyển tiền',
      description: 'Đánh dấu yêu cầu đã hoàn tất. Không thể hoàn tác.',
      confirmLabel: 'Hoàn tất',
      tone: 'default',
    },
  }[action]

  async function handleConfirm() {
    if (!request) return
    setSubmitting(true)
    try {
      await onConfirm({ admin_note: adminNote.trim() || undefined })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !submitting) onClose?.()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{actionMeta.title}</DialogTitle>
          <DialogDescription>{actionMeta.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Creator</p>
            <p className="font-medium">{request.user?.name ?? '—'}</p>
            <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">Số tiền</p>
            <p className="text-lg font-bold tabular-nums">
              {formatCoinStringWithUnit(request.amountCoinDisplay)}
            </p>
            <p className="text-xs tabular-nums text-muted-foreground">
              {formatVnd(request.vndAmount)}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wd-admin-note">Ghi chú admin (tuỳ chọn)</Label>
            <Textarea
              id="wd-admin-note"
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="VD: đã chuyển khoản qua Vietcombank lúc 14:30..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
          >
            Huỷ
          </Button>
          <Button
            type="button"
            variant={actionMeta.tone}
            onClick={() => void handleConfirm()}
            disabled={submitting}
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : actionMeta.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function AdminWithdrawals() {
  const [items, setItems] = useState([])
  const [pagination, setPagination] = useState(null)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [action, setAction] = useState(null) // { kind: 'approve'|'reject'|'complete', request }
  const [pendingId, setPendingId] = useState(null)

  /**
   * GET /withdrawals/admin/all?status=&page=&limit=
   * Service trả { items, pagination, stats, success }.
   * - items: danh sách withdrawal (mapped)
   * - pagination: { total, page, limit, pages }
   * - stats: { pending_count, pending_coin, ... } (BE tự tính)
   */
  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.listAdminWithdrawals({
        status: statusFilter,
        page,
        limit: 20,
      })
      const list = Array.isArray(res?.items) ? res.items : []
      setItems(list.map(mapRow))
      setPagination(res?.pagination ?? null)
      // BE trả `stats` (KHÔNG phải `summary`).
      setStats(res?.stats ?? null)
    } catch (err) {
      const msg = err?.response?.data?.message || 'Không tải được danh sách rút tiền.'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, page])

  useEffect(() => {
    void load()
  }, [load])

  function openAction(kind, request) {
    setAction({ kind, request })
  }

  function closeAction() {
    setAction(null)
  }

  async function handleConfirm(payload) {
    if (!action) return
    const { kind, request } = action
    setPendingId(request.id)
    try {
      if (kind === 'approve') {
        await api.approveWithdrawal(request.id, payload)
        toast.success('Đã duyệt yêu cầu.')
      } else if (kind === 'reject') {
        await api.rejectWithdrawal(request.id, payload)
        toast.success('Đã từ chối yêu cầu.')
      } else if (kind === 'complete') {
        await api.completeWithdrawal(request.id, payload)
        toast.success('Đã hoàn tất yêu cầu.')
      }
      closeAction()
      // Refresh list + pagination + stats từ BE sau khi action thành công.
      await load()
    } catch (err) {
      const msg = err?.response?.data?.message || 'Không thể cập nhật yêu cầu.'
      toast.error(msg)
    } finally {
      setPendingId(null)
    }
  }

  const summary = useMemo(() => {
    const pendingCount = items.filter((i) => i.status === 'pending').length
    const approvedCount = items.filter((i) => i.status === 'approved').length
    const completedCount = items.filter((i) => i.status === 'completed').length
    return {
      pendingCount: Number(stats?.pending_count ?? pendingCount),
      approvedCount: Number(stats?.approved_count ?? approvedCount),
      completedCount: Number(stats?.completed_count ?? completedCount),
      pendingCoin: Number(stats?.pending_coin ?? 0),
      pendingCoinDisplay: String(stats?.pending_coin_display ?? '0.00'),
    }
  }, [items, stats])

  const pageCount = pagination?.pages ?? 1

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/20">
              <Wallet className="size-5 text-white" />
            </div>
            Yêu cầu rút tiền
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Quản lý yêu cầu rút Coin của Mangaka / Assistant.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCcw className={cn('size-4', loading && 'animate-spin')} />
          Làm mới
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Đang chờ duyệt</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {summary.pendingCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs tabular-nums text-muted-foreground">
              {summary.pendingCoinDisplay || formatCoinString(summary.pendingCoin)} coin
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Đã duyệt</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {summary.approvedCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Sẵn sàng để chuyển tiền</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Hoàn tất</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {summary.completedCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Đã chuyển khoản</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setPage(1)
                setStatusFilter(v)
              }}
            >
              <SelectTrigger className="h-8 w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50/60 p-3 text-sm text-rose-700">
              {error}
            </p>
          ) : loading && items.length === 0 ? (
            <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Đang tải...
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
              <Inbox className="size-8 opacity-50" />
              <p className="text-sm">Không có yêu cầu nào.</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[60vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Creator</TableHead>
                    <TableHead>Số tiền</TableHead>
                    <TableHead>Ngân hàng</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Ngày tạo</TableHead>
                    <TableHead className="text-right">Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((row) => (
                    <TableRow key={row.id ?? row.createdAt}>
                      <TableCell>
                        <p className="font-medium">{row.user?.name ?? '—'}</p>
                        <p className="text-xs text-muted-foreground">{row.user?.role || '—'}</p>
                      </TableCell>
                      <TableCell>
                        <p className="font-semibold tabular-nums">
                          {formatCoinStringWithUnit(row.amountCoinDisplay)}
                        </p>
                        <p className="text-[11px] tabular-nums text-muted-foreground">
                          {formatVnd(row.vndAmount)}
                        </p>
                      </TableCell>
                      <TableCell>
                        {row.bankSnapshot ? (
                          <div className="text-xs">
                            <p>{row.bankSnapshot.bank_name || '—'}</p>
                            <p className="text-muted-foreground">{row.bankSnapshot.account_holder || '—'}</p>
                            <p className="font-mono text-[11px] text-muted-foreground">
                              {row.bankSnapshot.account_number_masked || '—'}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusPill status={row.status} />
                        {row.adminNote ? (
                          <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                            Admin: {row.adminNote}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-xs">
                        <p>{formatDateTime(row.createdAt)}</p>
                        {row.processedAt ? (
                          <p className="text-[11px] text-muted-foreground">
                            xử lý {formatDateTime(row.processedAt)}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right">
                        <RowActions
                          row={row}
                          pendingId={pendingId}
                          onAction={(kind) => openAction(kind, row)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}

          {pageCount > 1 ? (
            <div className="mt-4 flex items-center justify-end gap-2 text-xs">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Trước
              </Button>
              <span>Trang {page} / {pageCount}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pageCount || loading}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              >
                Sau
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <ActionDialog
        open={Boolean(action)}
        action={action?.kind}
        request={action?.request}
        onClose={closeAction}
        onConfirm={handleConfirm}
      />
    </div>
  )
}

function RowActions({ row, pendingId, onAction }) {
  const busy = pendingId === row.id
  if (row.status === 'pending') {
    return (
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          size="sm"
          variant="default"
          disabled={busy}
          onClick={() => onAction('approve')}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
          Duyệt
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={busy}
          onClick={() => onAction('reject')}
        >
          <XCircle className="size-4" /> Từ chối
        </Button>
      </div>
    )
  }
  if (row.status === 'approved') {
    return (
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          size="sm"
          variant="default"
          disabled={busy}
          onClick={() => onAction('complete')}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
          Hoàn tất
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => onAction('reject')}
        >
          <CircleAlert className="size-4" /> Hủy
        </Button>
      </div>
    )
  }
  return (
    <Badge variant="outline" className="text-xs">
      Chỉ xem
    </Badge>
  )
}
